/**
 * 自動実行の記録の読み出し（09 設定に出す）。
 *
 * 走査が失敗したまま気づかれない状態を作らないため、直近の実行結果を画面に出す。
 * 失敗した走査は scans に保存されないので、ここが唯一の手がかりになる。
 */

import { createDataClient } from '../supabase/server';
import type { ScanRunEntry } from '../scan/runner';

export interface ScanRunRecord {
  id: string;
  trigger: 'cron' | 'manual';
  startedAt: string;
  finishedAt: string;
  dueCount: number;
  succeededCount: number;
  failedCount: number;
  summary: string;
  entries: ScanRunEntry[];
}

export async function loadRecentScanRuns(limit = 5): Promise<ScanRunRecord[]> {
  const supabase = await createDataClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('scan_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  return data.map((row) => ({
    id: String(row.id),
    trigger: row.trigger as ScanRunRecord['trigger'],
    startedAt: String(row.started_at),
    finishedAt: String(row.finished_at),
    dueCount: Number(row.due_count),
    succeededCount: Number(row.succeeded_count),
    failedCount: Number(row.failed_count),
    summary: String(row.summary ?? ''),
    entries: (row.entries ?? []) as ScanRunEntry[],
  }));
}
