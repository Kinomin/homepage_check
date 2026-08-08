/**
 * 走査のあとに改善アクション（06）を作り直す。
 *
 * `actions` は自校の最新走査に紐づけて持つ。優先度は比較校の公開状況で決まるため
 * （handoff.md 5章 06 の定義表）、自校の判定結果だけでは確定できない。
 * そのため「1校の走査が終わった直後」ではなく「その学校法人の走査が一巡した後」に
 * まとめて導出する。
 *
 * 比較校を走査したときも作り直す。比較校が新たに公開した項目は、
 * 自校の優先度を中から高へ動かすため。
 *
 * 対応済み状態（`actions.status`）は `action_key` で引き継ぐ。走査ごとに
 * 行を作り直すので、鍵で引き継がないと毎週チェックが外れる。
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { deriveActions } from '../analysis/derive-actions';
import type { GapRow } from '../analysis/summary';
import { createServiceClient } from '../supabase/server';
import type { ActionStatus, School } from '../types';
import { loadGapRows, loadLatestScans } from './gap-rows';

/** 過去の対応済み状態を引き継ぐ際に見る走査の数 */
const STATUS_HISTORY_SCANS = 10;

export interface ActionSyncResult {
  orgId: string;
  selfSchoolId: string;
  scanId: string;
  /** 導出した件数 */
  count: number;
  /** 対応済みとして引き継いだ件数 */
  carriedOverDone: number;
}

/**
 * 走査した学校が属する学校法人の改善アクションを作り直す。
 *
 * 1校が複数の学校法人に比較校として登録されていることがあるため、
 * 学校IDから組織を引き直す（呼び出し側が組織を知らなくても正しく動くようにする）。
 */
export async function syncActionsForScannedSchools(
  schoolIds: string[],
  client: SupabaseClient | null = createServiceClient(),
): Promise<ActionSyncResult[]> {
  if (!client || schoolIds.length === 0) return [];

  const { data: links, error } = await client
    .from('org_schools')
    .select('org_id')
    .in('school_id', schoolIds);
  if (error) throw new Error(error.message);

  const orgIds = [...new Set((links ?? []).map((row) => String(row.org_id)))];
  const results: ActionSyncResult[] = [];
  for (const orgId of orgIds) {
    const result = await syncOrgActions(orgId, client);
    if (result) results.push(result);
  }
  return results;
}

/** 1つの学校法人ぶん。自校の最新走査がまだ無ければ何もしない。 */
export async function syncOrgActions(
  orgId: string,
  client: SupabaseClient,
): Promise<ActionSyncResult | null> {
  const schools = await loadOrgSchoolsOrdered(client, orgId);
  if (schools.length === 0 || schools[0].role !== 'self') return null;

  const latestScanBySchool = await loadLatestScans(
    client,
    schools.map((school) => school.id),
  );
  const selfScan = latestScanBySchool.get(schools[0].id);
  if (!selfScan) return null;

  const gapRows = await loadGapRows(client, schools, latestScanBySchool);
  const previousStatus = await loadPreviousStatuses(client, schools[0].id);
  const rows = planActionRows(gapRows, previousStatus, selfScan.id, new Date().toISOString());

  if (rows.length > 0) {
    const { error: upsertError } = await client
      .from('actions')
      .upsert(rows, { onConflict: 'scan_id,action_key' });
    if (upsertError) throw new Error(upsertError.message);
  }

  // 掲載されて対象から外れた項目の行を落とす。
  // 残しておくと、すでに直した項目が改善アクションに並び続ける。
  await deleteStaleActions(
    client,
    selfScan.id,
    rows.map((row) => row.action_key),
  );

  return {
    orgId,
    selfSchoolId: schools[0].id,
    scanId: selfScan.id,
    count: rows.length,
    carriedOverDone: rows.filter((row) => row.status === 'done').length,
  };
}

/** `actions` に入れる1行 */
export interface ActionRow {
  scan_id: string;
  action_key: string;
  priority: string;
  difficulty: string;
  source: string;
  source_criterion_id: string;
  status: ActionStatus;
  updated_at: string;
}

/**
 * 保存する行を決める（DB に触らない部分）。
 *
 * 対応済み状態は `action_key` で引き継ぐ。走査ごとに行を作り直すので、
 * 鍵で引き継がないと毎週チェックが外れる。
 */
export function planActionRows(
  gapRows: GapRow[],
  previousStatus: Map<string, ActionStatus>,
  scanId: string,
  now: string,
): ActionRow[] {
  return deriveActions(gapRows).map((action) => ({
    scan_id: scanId,
    action_key: action.actionKey,
    priority: action.priority,
    difficulty: action.difficulty,
    source: action.source,
    source_criterion_id: action.sourceCriterionId,
    status: previousStatus.get(action.actionKey) ?? 'open',
    updated_at: now,
  }));
}

/** `schools[0]` を自校にして返す（02 の列順と揃える） */
async function loadOrgSchoolsOrdered(client: SupabaseClient, orgId: string): Promise<School[]> {
  const { data, error } = await client
    .from('org_schools')
    .select('role, sort_order, schools(*)')
    .eq('org_id', orgId);
  if (error) throw new Error(error.message);

  return (data ?? [])
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
      } satisfies School;
    })
    .sort((a, b) =>
      a.role === 'self' ? -1 : b.role === 'self' ? 1 : a.sortOrder - b.sortOrder,
    );
}

/**
 * 直近の走査から対応済み状態を集める。
 *
 * 同じ鍵が複数の走査に存在するので、更新が新しいものを採る。
 * 今回の走査ぶんも含めて見るため、走査後に人が付けたチェックが
 * 再導出で外れることはない。
 */
async function loadPreviousStatuses(
  client: SupabaseClient,
  selfSchoolId: string,
): Promise<Map<string, ActionStatus>> {
  const statuses = new Map<string, ActionStatus>();

  const { data: scans, error: scansError } = await client
    .from('scans')
    .select('id')
    .eq('school_id', selfSchoolId)
    .eq('status', 'done')
    .order('started_at', { ascending: false })
    .limit(STATUS_HISTORY_SCANS);
  if (scansError) throw new Error(scansError.message);

  const scanIds = (scans ?? []).map((row) => String(row.id));
  if (scanIds.length === 0) return statuses;

  const { data, error } = await client
    .from('actions')
    .select('action_key, status, updated_at')
    .in('scan_id', scanIds)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const key = String(row.action_key);
    if (!statuses.has(key)) statuses.set(key, row.status as ActionStatus);
  }
  return statuses;
}

async function deleteStaleActions(
  client: SupabaseClient,
  scanId: string,
  keepKeys: string[],
): Promise<void> {
  let query = client.from('actions').delete().eq('scan_id', scanId).eq('source', 'gap');
  if (keepKeys.length > 0) {
    query = query.not('action_key', 'in', `(${keepKeys.join(',')})`);
  }
  const { error } = await query;
  if (error) throw new Error(error.message);
}
