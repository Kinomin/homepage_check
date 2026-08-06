/**
 * 画面に渡すデータの取得口。
 *
 * Supabase が設定されていればそこから読み、未設定ならプロトタイプ由来の
 * デモデータで動く。どちらの場合も画面側は同じ型だけを見る。
 *
 * 対応済みトグル（01 SM-04 と 06）は同じ actions を参照する。
 * 状態変更はどちらの画面からでも同じ更新口（updateActionStatus）を通す。
 */

import { CRITERIA, CRITERIA_BY_ID } from '../analysis/criteria';
import type { GapRow } from '../analysis/summary';
import { createServerClient } from '../supabase/server';
import type { Action, ActionStatus, Level, Measurement, School } from '../types';
import { DEMO_ACTIONS, DEMO_GAP_ROWS, DEMO_MEASUREMENTS, DEMO_SCAN, DEMO_SCHOOL_NAMES } from './demo';

export interface ScanMeta {
  startedAt: string;
  nextScanAt: string | null;
  crawlDepth: number;
  pageCount: number;
  indexedCount: number;
  imageCount: number;
  imageWithoutAltCount: number;
  pdfOnlyCount: number;
  updates90d: number;
  newsCategories: number;
  mobileLcpSeconds: number | null;
}

export interface Dashboard {
  /** [0] が自校、[1..] が比較校。02 の列順と一致する。 */
  schools: School[];
  scan: ScanMeta;
  gapRows: GapRow[];
  measurements: Measurement[];
  actions: Action[];
  /** デモデータで動作しているか（画面に明示する） */
  isDemo: boolean;
}

/**
 * デモ動作時の対応済み状態。プロセス内にのみ保持する。
 * 本番は actions.status（Supabase）が正で、ここは使わない。
 *
 * globalThis に置くのは、Route Handler と Server Component が
 * 別のモジュールインスタンスになる場合でも同じ状態を参照させるため。
 * これがずれると 01 と 06 でトグルの状態が食い違う。
 */
const demoActionStatus: Map<string, ActionStatus> = ((
  globalThis as { __demoActionStatus?: Map<string, ActionStatus> }
).__demoActionStatus ??= new Map());

export async function loadDashboard(): Promise<Dashboard> {
  const supabase = createServerClient();
  if (supabase) {
    const dashboard = await loadFromSupabase();
    if (dashboard) return dashboard;
  }
  return loadDemoDashboard();
}

export function loadDemoDashboard(): Dashboard {
  const schools: School[] = DEMO_SCHOOL_NAMES.map((name, index) => ({
    id: `demo-school-${index}`,
    name,
    url: '',
    prefecture: null,
    schoolType: null,
    coedType: null,
    hasJuniorAdmission: true,
    hasSeniorAdmission: true,
    hasAffiliatedUniversity: true,
    robotsAllowed: true,
    role: index === 0 ? 'self' : 'competitor',
    sortOrder: index,
  }));

  const gapRows: GapRow[] = DEMO_GAP_ROWS.map((row) => ({
    criterion: CRITERIA_BY_ID[row.criterionId],
    levels: row.levels as Level[],
    // 自校のみ判定理由を持つ。比較校は公開の有無と掲載量の記録にとどめる（設計原則3）。
    evidence: row.levels.map((_, index) =>
      index === 0 ? { text: row.evidenceText, source: row.evidenceSource } : null,
    ),
  }));

  const actions = DEMO_ACTIONS.map((action) => ({
    ...action,
    status: demoActionStatus.get(action.id) ?? action.status,
  }));

  return {
    schools,
    scan: { ...DEMO_SCAN },
    gapRows,
    measurements: DEMO_MEASUREMENTS,
    actions,
    isDemo: true,
  };
}

/** 自校の判定根拠（02 の根拠パネル）。デモでは prototype の記述をそのまま使う。 */
export function evidenceForSelf(criterionId: string): { text: string; source: string } | null {
  const row = DEMO_GAP_ROWS.find((r) => r.criterionId === criterionId);
  return row ? { text: row.evidenceText, source: row.evidenceSource } : null;
}

export async function updateActionStatus(actionId: string, status: ActionStatus): Promise<void> {
  const supabase = createServerClient();
  if (supabase) {
    const { error } = await supabase
      .from('actions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', actionId);
    if (error) throw new Error(error.message);
    return;
  }
  demoActionStatus.set(actionId, status);
}

async function loadFromSupabase(): Promise<Dashboard | null> {
  const supabase = createServerClient();
  if (!supabase) return null;

  const { data: orgSchools, error: schoolsError } = await supabase
    .from('org_schools')
    .select('role, sort_order, schools(*)')
    .order('role', { ascending: true })
    .order('sort_order', { ascending: true });
  if (schoolsError || !orgSchools?.length) return null;

  const schools: School[] = orgSchools
    .map((row) => {
      const school = row.schools as unknown as Record<string, unknown>;
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
    })
    .sort((a, b) => (a.role === 'self' ? -1 : b.role === 'self' ? 1 : a.sortOrder - b.sortOrder));

  // 各校の最新スキャン
  const { data: scans } = await supabase
    .from('scans')
    .select('id, school_id, started_at, status, page_count, indexed_count, image_count, pdf_only_count, crawl_depth')
    .in('school_id', schools.map((s) => s.id))
    .eq('status', 'done')
    .order('started_at', { ascending: false });

  type ScanRow = NonNullable<typeof scans>[number];
  const latestScanBySchool = new Map<string, ScanRow>();
  for (const scan of scans ?? []) {
    if (!latestScanBySchool.has(scan.school_id)) latestScanBySchool.set(scan.school_id, scan);
  }
  const selfScan = latestScanBySchool.get(schools[0].id);
  if (!selfScan) return null;

  const scanIds = schools
    .map((s) => latestScanBySchool.get(s.id)?.id)
    .filter((id): id is string => Boolean(id));

  const { data: findings } = await supabase
    .from('findings')
    .select('scan_id, criterion_id, level, evidence_text, evidence_urls')
    .in('scan_id', scanIds);

  type FindingRow = NonNullable<typeof findings>[number];
  const findingByScanAndCriterion = new Map<string, FindingRow>();
  for (const finding of findings ?? []) {
    findingByScanAndCriterion.set(`${finding.scan_id}:${finding.criterion_id}`, finding);
  }

  const gapRows: GapRow[] = CRITERIA.map((criterion) => {
    const cells = schools.map((school) => {
      const scanId = latestScanBySchool.get(school.id)?.id;
      // 走査結果がない学校は unknown。none（欠落）にしない。
      if (!scanId) return null;
      return findingByScanAndCriterion.get(`${scanId}:${criterion.id}`) ?? null;
    });
    return {
      criterion,
      levels: cells.map((cell) => (cell?.level as Level) ?? 'unknown'),
      evidence: cells.map((cell) =>
        cell
          ? {
              text: cell.evidence_text as string,
              source: ((cell.evidence_urls as string[]) ?? []).join(' ｜ ') || 'サイト全体を走査',
            }
          : null,
      ),
    };
  });

  const { data: actionRows } = await supabase
    .from('actions')
    .select('id, action_key, priority, difficulty, source, source_criterion_id, status')
    .eq('scan_id', selfScan.id);

  // 本文（why / how / 文案）はアクション定義カタログ側が持つ。
  // DB には状態と分類のみを持たせ、文言の二重管理を避ける。
  const actions: Action[] = (actionRows ?? []).flatMap((row) => {
    const template = DEMO_ACTIONS.find((a) => a.id === row.action_key);
    if (!template) return [];
    return [
      {
        ...template,
        id: String(row.id),
        priority: row.priority as Action['priority'],
        difficulty: row.difficulty as Action['difficulty'],
        source: row.source as Action['source'],
        sourceCriterionId: (row.source_criterion_id as string) ?? null,
        status: row.status as ActionStatus,
      },
    ];
  });

  const { data: measurementRows } = await supabase
    .from('measurements')
    .select('key, value, unit, method')
    .eq('scan_id', selfScan.id);

  const measurements: Measurement[] = (measurementRows ?? []).flatMap((row) => {
    const template = DEMO_MEASUREMENTS.find((m) => m.key === row.key);
    if (!template) return [];
    return [{ ...template, value: Number(row.value), unit: row.unit, method: row.method }];
  });

  return {
    schools,
    scan: {
      startedAt: selfScan.started_at,
      nextScanAt: null,
      crawlDepth: selfScan.crawl_depth,
      pageCount: selfScan.page_count,
      indexedCount: selfScan.indexed_count,
      imageCount: selfScan.image_count,
      imageWithoutAltCount: 0,
      pdfOnlyCount: selfScan.pdf_only_count,
      updates90d: 0,
      newsCategories: 0,
      mobileLcpSeconds: null,
    },
    gapRows,
    measurements: measurements.length ? measurements : DEMO_MEASUREMENTS,
    actions,
    isDemo: false,
  };
}
