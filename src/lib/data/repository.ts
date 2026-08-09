/**
 * 画面に渡すデータの取得口。
 *
 * Supabase が設定されていればそこから読み、未設定ならプロトタイプ由来の
 * デモデータで動く。どちらの場合も画面側は同じ型だけを見る。
 *
 * 対応済みトグル（01 SM-04 と 06）は同じ actions を参照する。
 * 状態変更はどちらの画面からでも同じ更新口（updateActionStatus）を通す。
 */

import { CRITERIA_BY_ID } from '../analysis/criteria';
import { actionKeyToCriterionId, buildActionText } from '../analysis/derive-actions';
import type { DiscoveryPage } from '../analysis/discovery';
import { composeMeasurements } from '../analysis/measurements';
import type { GapRow } from '../analysis/summary';
import { createDataClient } from '../supabase/server';
import type {
  Action,
  ActionStatus,
  Level,
  Measurement,
  MeasurementMethod,
  School,
} from '../types';
import { DEMO_ACTIONS, DEMO_GAP_ROWS, DEMO_MEASUREMENTS, DEMO_SCAN, DEMO_SCHOOL_NAMES } from './demo';
import { demoDiscoveryPages } from './demo-extras';
import { loadGapRows, loadLatestScans } from './gap-rows';

export interface ScanMeta {
  startedAt: string;
  nextScanAt: string | null;
  crawlDepth: number;
  pageCount: number;
  indexedCount: number;
  imageCount: number;
  imageWithoutAltCount: number;
  pdfOnlyCount: number;
  /**
   * 未計測は null。0 と書き分ける。
   * 「更新0件」と「更新日が取れていない」は意味が違う（設計原則4）。
   */
  updates90d: number | null;
  newsCategories: number | null;
  mobileLcpSeconds: number | null;
}

export interface Dashboard {
  /** [0] が自校、[1..] が比較校。02 の列順と一致する。 */
  schools: School[];
  scan: ScanMeta;
  gapRows: GapRow[];
  measurements: Measurement[];
  actions: Action[];
  /** 04 発見のされ方の算出に使う自校のページ（走査結果がなければ空） */
  selfPages: DiscoveryPage[];
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
  const supabase = await createDataClient();
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

  const actions: Action[] = DEMO_ACTIONS.map((action) => ({
    ...action,
    // 調査項目に紐づくものはそのIDを出す。紐づかないもの（03 由来など）は
    // デモの通し番号をそのまま使う。
    ref: action.sourceCriterionId ?? action.id,
    status: demoActionStatus.get(action.id) ?? action.status,
  }));

  return {
    schools,
    scan: { ...DEMO_SCAN },
    gapRows,
    measurements: DEMO_MEASUREMENTS,
    actions,
    selfPages: demoDiscoveryPages(),
    isDemo: true,
  };
}

/** 自校の判定根拠（02 の根拠パネル）。デモでは prototype の記述をそのまま使う。 */
export function evidenceForSelf(criterionId: string): { text: string; source: string } | null {
  const row = DEMO_GAP_ROWS.find((r) => r.criterionId === criterionId);
  return row ? { text: row.evidenceText, source: row.evidenceSource } : null;
}

export async function updateActionStatus(actionId: string, status: ActionStatus): Promise<void> {
  const supabase = await createDataClient();
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
  const supabase = await createDataClient();
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

  // 各校の最新スキャン（走り切ったものだけ）
  const latestScanBySchool = await loadLatestScans(
    supabase,
    schools.map((s) => s.id),
  );
  const selfScan = latestScanBySchool.get(schools[0].id);
  if (!selfScan) return null;

  const gapRows = await loadGapRows(supabase, schools, latestScanBySchool);
  const gapRowByCriterionId = new Map(gapRows.map((row) => [row.criterion.id, row]));

  const { data: actionRows } = await supabase
    .from('actions')
    .select('id, action_key, priority, difficulty, source, source_criterion_id, status, assignee_note')
    .eq('scan_id', selfScan.id);

  // 本文は保存しない。判定結果から組み立て直す（derive-actions.ts）。
  // DB には状態と分類だけを持たせ、同じ文言を2箇所で管理しない。
  const actions: Action[] = (actionRows ?? []).flatMap((row) => {
    const criterionId =
      (row.source_criterion_id as string | null) ?? actionKeyToCriterionId(String(row.action_key));
    if (!criterionId) return [];
    const gapRow = gapRowByCriterionId.get(criterionId);
    // 対応する調査項目が引けない行は出さない（見出しだけの空のカードを作らない）
    if (!gapRow) return [];
    return [
      {
        ...buildActionText(gapRow),
        id: String(row.id),
        ref: criterionId,
        priority: row.priority as Action['priority'],
        difficulty: row.difficulty as Action['difficulty'],
        source: row.source as Action['source'],
        sourceCriterionId: criterionId,
        status: row.status as ActionStatus,
        // 文案は学校の実際の日程・施設・呼称が必要なため導出しない。
        // 校内で書き足したものを assignee_note に持つ。
        copy: (row.assignee_note as string | null) ?? '',
      },
    ];
  });

  // 04 の算出に使う自校のページ（比較校のページは 04 では使わない）
  const { data: pageRows } = await supabase
    .from('pages')
    .select(
      'url, title, meta_description, h1_count, image_count, image_without_alt_count, has_json_ld, json_ld_types, is_pdf',
    )
    .eq('scan_id', selfScan.id);

  const selfPages: DiscoveryPage[] = (pageRows ?? []).map((row) => ({
    url: String(row.url),
    title: (row.title as string) ?? null,
    metaDescription: (row.meta_description as string) ?? null,
    h1Count: Number(row.h1_count),
    imageCount: Number(row.image_count),
    imageWithoutAltCount: Number(row.image_without_alt_count),
    hasJsonLd: Boolean(row.has_json_ld),
    jsonLdTypes: (row.json_ld_types as string[]) ?? [],
    isPdf: Boolean(row.is_pdf),
  }));

  // 03 の計測値。自校の値と、比較校の中央値を出すための値をまとめて読む。
  // 中央値はデモの固定値ではなく、実際に走査できた比較校の値から出す。
  const competitorScanIds = schools
    .slice(1)
    .map((school) => latestScanBySchool.get(school.id)?.id)
    .filter((id): id is string => Boolean(id));

  const { data: measurementRows } = await supabase
    .from('measurements')
    .select('scan_id, key, value, unit, method')
    .in('scan_id', [selfScan.id, ...competitorScanIds]);

  const selfValues = new Map<string, { value: number; unit: string; method: MeasurementMethod }>();
  const competitorValues = new Map<string, number[]>();
  for (const row of measurementRows ?? []) {
    const key = String(row.key);
    const value = Number(row.value);
    if (String(row.scan_id) === selfScan.id) {
      selfValues.set(key, { value, unit: String(row.unit), method: row.method as MeasurementMethod });
    } else {
      competitorValues.set(key, [...(competitorValues.get(key) ?? []), value]);
    }
  }
  const measurements = composeMeasurements(selfValues, competitorValues);

  return {
    schools,
    scan: {
      startedAt: selfScan.startedAt,
      nextScanAt: null,
      crawlDepth: selfScan.crawlDepth,
      pageCount: selfScan.pageCount,
      indexedCount: selfScan.indexedCount,
      imageCount: selfScan.imageCount,
      imageWithoutAltCount: selfPages.reduce((total, page) => total + page.imageWithoutAltCount, 0),
      pdfOnlyCount: selfScan.pdfOnlyCount,
      // 計測できていない指標は null にする。0 と書くと「更新0件」「分類0」という
      // 事実として読まれてしまう。
      updates90d: selfValues.get('m03')?.value ?? null,
      newsCategories: selfValues.get('m05')?.value ?? null,
      mobileLcpSeconds: selfValues.get('m10')?.value ?? null,
    },
    gapRows,
    measurements,
    actions,
    selfPages,
    isDemo: false,
  };
}
