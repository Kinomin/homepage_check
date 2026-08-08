/**
 * 学校と比較校の登録（08 学校と比較校）。
 *
 * 守ること（handoff.md 3章・7章）
 * ・比較校は5校まで。DB のトリガでも制限しているが、画面でも先に止める
 * ・比較校として登録された事実は相手校に通知しない。学校の行は組織ごとに持ち、
 *   「誰が登録したか」を相手から辿れる情報は残さない
 * ・同じ学校を二重に登録しない。URL の正規化で突き合わせる
 */

import { getCurrentSession } from '../auth/session';
import {
  MAX_COMPETITORS,
  normalizeSchoolUrl,
  validateSchoolInput,
  type SchoolInput,
} from '../schools/schema';
import { createSessionClient } from '../supabase/server';
import type { School } from '../types';

export interface OrgSchools {
  self: School | null;
  competitors: School[];
}

export async function loadOrgSchools(): Promise<OrgSchools | null> {
  const supabase = await createSessionClient();
  if (!supabase) return null;

  // RLS が組織で絞るので、ここで org_id を条件に入れない
  const { data, error } = await supabase
    .from('org_schools')
    .select('role, sort_order, schools(*)')
    .order('sort_order', { ascending: true });
  if (error || !data) return { self: null, competitors: [] };

  const schools = data.map((row) => toSchool(row));
  return {
    self: schools.find((school) => school.role === 'self') ?? null,
    competitors: schools.filter((school) => school.role === 'competitor'),
  };
}

/**
 * 学校を1件登録し、組織に紐付ける。
 * 行は組織ごとに作る（他組織の行を使い回さない：0008_schools_per_org.sql）。
 */
export async function addSchool(
  input: SchoolInput,
  role: School['role'],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSessionClient();
  if (!supabase) return { ok: false, error: 'Supabase が未接続です' };

  let validated: SchoolInput & { url: string };
  try {
    validated = validateSchoolInput(input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '入力を確認してください' };
  }

  const current = await loadOrgSchools();
  if (!current) return { ok: false, error: 'Supabase が未接続です' };

  if (role === 'self' && current.self) {
    return { ok: false, error: '自校はすでに登録されています' };
  }
  // DB のトリガでも止まるが、画面には理由の分かる文言を返したい
  if (role === 'competitor' && current.competitors.length >= MAX_COMPETITORS) {
    return { ok: false, error: `比較校は${MAX_COMPETITORS}校までです` };
  }

  const registered = [current.self, ...current.competitors].filter(Boolean) as School[];
  if (registered.some((school) => normalizeSchoolUrl(school.url) === validated.url)) {
    return { ok: false, error: 'この学校はすでに登録されています' };
  }

  // 学校の作成と紐付けは1トランザクションで行う（0009_atomic_registration.sql）。
  // 分けて書き込むと、紐付けに失敗したときにどこからも見えない学校の行が残る。
  // その行は schools_delete の条件（自組織が登録している学校）も満たさないため、
  // アプリからは片付けられない。
  //
  // 他組織が作った行は使い回さない。使い回すと、相手が付けた学校名を掴み、
  // 走査結果と走査の間隔が組織をまたいで混ざる（0008_schools_per_org.sql）。
  const orgId = (await getCurrentSession())?.membership?.orgId;
  if (!orgId) return { ok: false, error: '所属する学校法人が見つかりません' };

  const { error } = await supabase.rpc('add_school_to_org', {
    p_org_id: orgId,
    p_name: validated.name,
    p_url: validated.url,
    p_role: role,
    p_prefecture: validated.prefecture ?? null,
    p_school_type: validated.schoolType ?? null,
    p_coed_type: validated.coedType ?? null,
    p_has_junior_admission: validated.hasJuniorAdmission ?? true,
    p_has_senior_admission: validated.hasSeniorAdmission ?? true,
    p_has_affiliated_university: validated.hasAffiliatedUniversity ?? false,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/**
 * 比較校を外す。
 *
 * 学校の行は組織ごとに持っているので（0008_schools_per_org.sql）、
 * 行ごと消す。org_schools は on delete cascade で一緒に消える。
 * 共有していた頃は行を残していたが、いまは残すとゴミになる。
 *
 * 自校は外せない。外すと走査対象が無くなり、画面がすべて空になる。
 */
export async function removeCompetitor(
  schoolId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSessionClient();
  if (!supabase) return { ok: false, error: 'Supabase が未接続です' };

  const { data: link } = await supabase
    .from('org_schools')
    .select('role')
    .eq('school_id', schoolId)
    .maybeSingle();
  if (!link) return { ok: false, error: '対象の学校が見つかりません' };
  if (link.role !== 'competitor') return { ok: false, error: '自校は外せません' };

  const { error } = await supabase.from('schools').delete().eq('id', schoolId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * 学校法人と自校を作り、作った人を管理者にする（初回のみ）。
 * 組織を作った直後は自分しかいないため、この1人が admin になる。
 */
export async function createOrganization(
  orgName: string,
  self: SchoolInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSessionClient();
  if (!supabase) return { ok: false, error: 'Supabase が未接続です' };

  const name = orgName.trim();
  if (!name) return { ok: false, error: '学校法人名を入力してください' };

  let validated: SchoolInput & { url: string };
  try {
    validated = validateSchoolInput(self);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '入力を確認してください' };
  }

  // 学校法人・管理者・自校をまとめて作る（0009_atomic_registration.sql）。
  // 分けて書き込むと、途中で失敗したときに「自校の無い学校法人」が残る。
  // その状態は初回登録の画面にも戻れず、行き止まりになる。
  const { error } = await supabase.rpc('create_organization_with_school', {
    p_org_name: name,
    p_name: validated.name,
    p_url: validated.url,
    p_prefecture: validated.prefecture ?? null,
    p_school_type: validated.schoolType ?? null,
    p_coed_type: validated.coedType ?? null,
    p_has_junior_admission: validated.hasJuniorAdmission ?? true,
    p_has_senior_admission: validated.hasSeniorAdmission ?? true,
    p_has_affiliated_university: validated.hasAffiliatedUniversity ?? false,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

type OrgSchoolRow = { role: string; sort_order: number; schools: unknown };

function toSchool(row: OrgSchoolRow): School {
  const school = row.schools as Record<string, unknown>;
  return {
    id: String(school.id),
    name: String(school.name),
    url: String(school.url),
    prefecture: (school.prefecture as string) ?? null,
    schoolType: (school.school_type as string) ?? null,
    coedType: (school.coed_type as string) ?? null,
    hasJuniorAdmission: Boolean(school.has_junior_admission),
    hasSeniorAdmission: Boolean(school.has_senior_admission),
    hasAffiliatedUniversity: Boolean(school.has_affiliated_university),
    robotsAllowed: Boolean(school.robots_allowed),
    role: row.role as School['role'],
    sortOrder: Number(row.sort_order),
  };
}
