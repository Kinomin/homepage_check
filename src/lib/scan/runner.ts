/**
 * スケジュールに従った走査の実行。
 *
 * CLI（`npm run scan:due`）と自動実行のエンドポイント（`POST /api/cron/scan`）の
 * 両方がここを通る。判断も実行も1箇所に置き、cron からだけ挙動が違う、
 * という状態を作らない。
 *
 * 「どの学校をいま走査すべきか」の判断は settings.ts の純関数（isScanDue /
 * nextScanAt）に閉じてあり、ここではその結果を並べるだけ。
 *
 * 1校の失敗で残りを止めない。走査できなかったことは記録して次の学校に進む。
 * 走査失敗と「情報がない」を混ぜないため、失敗した学校の結果は保存しない
 * （handoff.md 4章）。
 */

import { loadPreviousFindings, persistScanOutcome } from '../data/scan-writer';
import { runScan } from '../judge/pipeline';
import { isScanDue, nextScanAt, type OrgSettings, type ScanFrequency } from '../settings';
import { createServiceClient } from '../supabase/server';
import type { School } from '../types';

/** 1つの学校法人ぶんの走査対象 */
export interface ScanTargetGroup {
  orgId: string;
  orgName: string;
  schools: School[];
  lastScanBySchool: Map<string, Date>;
}

/**
 * 走査対象を**学校法人ごとに**まとめて返す。
 *
 * 走査はサービスキーで動くため RLS が効かない。組織で分けずに全件を取ると、
 * ある組織の設定（走査頻度・クロール範囲）で別の組織の学校まで走査してしまう。
 * 組織単位で分離するという前提（handoff.md 7章）はここでも守る必要がある。
 *
 * Supabase が未接続なら走査対象を確定できないため null を返す
 * （デモデータで自動走査を始めてしまわないようにする）。
 */
export async function loadScanTargets(): Promise<ScanTargetGroup[] | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data: orgSchools, error } = await supabase
    .from('org_schools')
    .select('org_id, role, sort_order, schools(*), organizations(name)')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);

  const groups = new Map<string, ScanTargetGroup>();
  for (const row of orgSchools ?? []) {
    const orgId = String(row.org_id);
    const organization = row.organizations as unknown as { name?: string } | null;
    if (!groups.has(orgId)) {
      groups.set(orgId, {
        orgId,
        orgName: String(organization?.name ?? orgId),
        schools: [],
        lastScanBySchool: new Map(),
      });
    }
    groups.get(orgId)!.schools.push(toSchool(row));
  }

  const allSchoolIds = [...groups.values()].flatMap((g) => g.schools.map((s) => s.id));
  if (allSchoolIds.length === 0) return [...groups.values()];

  // 前回走査は「走り切ったもの」だけを見る。
  // 失敗した走査を前回扱いにすると、次回まで再試行されなくなる。
  const { data: scans } = await supabase
    .from('scans')
    .select('school_id, started_at')
    .eq('status', 'done')
    .in('school_id', allSchoolIds)
    .order('started_at', { ascending: false });

  const lastScanBySchool = new Map<string, Date>();
  for (const scan of scans ?? []) {
    if (!lastScanBySchool.has(scan.school_id)) {
      lastScanBySchool.set(scan.school_id, new Date(scan.started_at));
    }
  }
  for (const group of groups.values()) {
    for (const school of group.schools) {
      const last = lastScanBySchool.get(school.id);
      if (last) group.lastScanBySchool.set(school.id, last);
    }
  }

  return [...groups.values()];
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

export interface DueSchool {
  school: School;
  frequency: ScanFrequency;
  lastScanAt: Date | null;
  nextScanAt: Date | null;
  due: boolean;
}

/**
 * 走査対象の判定。副作用を持たせず、結果だけを返す。
 * 対象外の学校も理由が分かるよう、判定に使った前回・次回を添えて返す。
 */
export function selectDueSchools(
  schools: School[],
  lastScanBySchool: Map<string, Date>,
  settings: OrgSettings,
  now: Date,
): DueSchool[] {
  return schools.map((school) => {
    const frequency =
      school.role === 'self'
        ? settings.schedule.selfFrequency
        : settings.schedule.competitorFrequency;
    const lastScanAt = lastScanBySchool.get(school.id) ?? null;
    return {
      school,
      frequency,
      lastScanAt,
      nextScanAt: lastScanAt ? nextScanAt(frequency, settings.schedule, lastScanAt) : null,
      due: isScanDue(frequency, settings.schedule, lastScanAt, now),
    };
  });
}

export interface ScanRunEntry {
  schoolId: string;
  schoolName: string;
  role: School['role'];
  /** 走査の結末。crawl の status か、例外で終わった場合は 'failed' */
  status: 'done' | 'blocked' | 'failed';
  /** blocked / failed の理由（robots.txt 拒否・タイムアウト・例外など） */
  reason: string | null;
  pageCount: number;
  /** 判定できなかった項目数。走査できても判定に失敗することがある */
  unknownCount: number;
  savedTo: string | null;
}

export interface ScanRunResult {
  startedAt: string;
  finishedAt: string;
  /** 走査対象になった学校数 */
  dueCount: number;
  entries: ScanRunEntry[];
  /** 最後まで走り切れなかった学校（blocked も含む。人が見るべきもの） */
  failures: ScanRunEntry[];
}

/**
 * 対象校を順番に走査する。並列にしない。
 * 学校ごとの同時接続数は crawl 側で制限しているが、学校をまたいで並列に走らせると
 * 実行環境から見た総接続数が設定値を超えてしまう。
 */
export async function runDueScans(
  due: DueSchool[],
  settings: OrgSettings,
  hooks: { onProgress?: (message: string) => void } = {},
): Promise<ScanRunResult> {
  const startedAt = new Date().toISOString();
  const entries: ScanRunEntry[] = [];

  for (const { school } of due) {
    hooks.onProgress?.(`走査開始: ${school.name}`);
    entries.push(await scanOne(school, settings));
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    dueCount: due.length,
    entries,
    failures: entries.filter((entry) => entry.status !== 'done'),
  };
}

async function scanOne(school: School, settings: OrgSettings): Promise<ScanRunEntry> {
  const base = {
    schoolId: school.id,
    schoolName: school.name,
    role: school.role,
  };

  try {
    // 前回の判定結果を渡し、判定の揺れを抑える（handoff.md 9章E）
    const previousFindings = await loadPreviousFindings(school.id);
    const outcome = await runScan(school, {}, previousFindings, settings);
    const unknownCount = outcome.findings.filter((finding) => finding.level === 'unknown').length;

    // 走査できなかったものは保存しない。
    // 空の結果を保存すると、次の集計で「情報がない」として扱われてしまう。
    if (outcome.crawl.status !== 'done') {
      return {
        ...base,
        status: outcome.crawl.status === 'blocked' ? 'blocked' : 'failed',
        reason: outcome.crawl.reason ?? null,
        pageCount: outcome.crawl.stats.pageCount,
        unknownCount,
        savedTo: null,
      };
    }

    const saved = await persistScanOutcome(outcome, { schoolId: school.id });
    return {
      ...base,
      status: 'done',
      reason: null,
      pageCount: outcome.crawl.stats.pageCount,
      unknownCount,
      savedTo: saved.location,
    };
  } catch (error) {
    return {
      ...base,
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error),
      pageCount: 0,
      unknownCount: 0,
      savedTo: null,
    };
  }
}
