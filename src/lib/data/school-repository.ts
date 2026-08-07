/**
 * 学校と比較校の登録（08 学校と比較校）。
 *
 * 守ること（handoff.md 3章・7章）
 * ・比較校は5校まで。DB のトリガでも制限しているが、画面でも先に止める
 * ・比較校として登録された事実は相手校に通知しない。登録は org_schools に閉じ、
 *   schools（組織横断のマスタ）には「誰が登録したか」を持たせない
 * ・同じ学校を二重に登録しない。URL の正規化で突き合わせる
 */

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
 * 同じ URL の学校がマスタにあれば作らずに使い回す（比較校は他組織と共有されうる）。
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

  const { data: existing } = await supabase
    .from('schools')
    .select('id')
    .eq('url', validated.url)
    .limit(1)
    .maybeSingle();

  let schoolId = existing?.id as string | undefined;
  if (!schoolId) {
    const { data: created, error } = await supabase
      .from('schools')
      .insert({
        name: validated.name,
        url: validated.url,
        prefecture: validated.prefecture ?? null,
        school_type: validated.schoolType ?? null,
        coed_type: validated.coedType ?? null,
        has_junior_admission: validated.hasJuniorAdmission ?? true,
        has_senior_admission: validated.hasSeniorAdmission ?? true,
        has_affiliated_university: validated.hasAffiliatedUniversity ?? false,
      })
      .select('id')
      .single();
    if (error || !created) return { ok: false, error: error?.message ?? '学校の登録に失敗しました' };
    schoolId = created.id as string;
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id')
    .limit(1)
    .maybeSingle();
  if (!membership) return { ok: false, error: '所属する学校法人が見つかりません' };

  const { error: linkError } = await supabase.from('org_schools').insert({
    org_id: membership.org_id,
    school_id: schoolId,
    role,
    sort_order: role === 'self' ? 0 : current.competitors.length + 1,
  });
  if (linkError) return { ok: false, error: linkError.message };

  return { ok: true };
}

/** 比較校を外す。schools マスタからは消さない（他組織が使っていることがある）。 */
export async function removeCompetitor(
  schoolId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSessionClient();
  if (!supabase) return { ok: false, error: 'Supabase が未接続です' };

  const { error } = await supabase
    .from('org_schools')
    .delete()
    .eq('school_id', schoolId)
    .eq('role', 'competitor');
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'ログインが必要です' };

  const { data: organization, error } = await supabase
    .from('organizations')
    .insert({ name })
    .select('id')
    .single();
  if (error || !organization) {
    return { ok: false, error: error?.message ?? '学校法人の登録に失敗しました' };
  }

  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({ org_id: organization.id, user_id: user.id, role: 'admin' });
  if (memberError) return { ok: false, error: memberError.message };

  return addSchool(validated, 'self');
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
