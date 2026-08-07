/**
 * 01 SM-02 の材料。比較校ごとに直近2回の走査を読む。
 *
 * 保持しているのは集計値と URL だけで、ページ本文は保存していない
 * （handoff.md 6章）。差分もその範囲で出す。
 */

import {
  collectCompetitorChanges,
  diffAvailability,
  type CompetitorChange,
  type ScanSnapshot,
} from '../analysis/competitor-diff';
import { createDataClient } from '../supabase/server';
import type { CriterionId, Level, School, ScanStatus } from '../types';

export interface CompetitorDiff {
  changes: CompetitorChange[];
  /** 差分を出せる状態か。画面の文言を分けるために使う */
  availability: 'ready' | 'first-scan' | 'no-scan';
}

export async function loadCompetitorChanges(
  competitors: School[],
  maxPagesPerScan: number,
): Promise<CompetitorDiff> {
  const supabase = await createDataClient();
  if (!supabase || competitors.length === 0) {
    return { changes: [], availability: 'no-scan' };
  }

  const entries: {
    school: School;
    previous: ScanSnapshot | null;
    current: ScanSnapshot | null;
  }[] = [];

  for (const school of competitors) {
    // 走り切った回だけを比較の対象にする。
    // 失敗した回を挟むと、取得できなかったことが変化として出てしまう。
    const { data: scans } = await supabase
      .from('scans')
      .select('id, started_at, status, page_count')
      .eq('school_id', school.id)
      .eq('status', 'done')
      .order('started_at', { ascending: false })
      .limit(2);

    const rows = scans ?? [];
    const current = rows[0] ? await toSnapshot(supabase, rows[0], maxPagesPerScan) : null;
    const previous = rows[1] ? await toSnapshot(supabase, rows[1], maxPagesPerScan) : null;
    entries.push({ school, previous, current });
  }

  const availability = diffAvailability(entries);
  const comparable = entries.filter(
    (entry): entry is { school: School; previous: ScanSnapshot | null; current: ScanSnapshot } =>
      entry.current !== null,
  );

  return { changes: collectCompetitorChanges(comparable), availability };
}

type ScanRow = { id: string; started_at: string; status: string; page_count: number };

async function toSnapshot(
  supabase: NonNullable<Awaited<ReturnType<typeof createDataClient>>>,
  row: ScanRow,
  maxPagesPerScan: number,
): Promise<ScanSnapshot> {
  const [{ data: pages }, { data: findings }] = await Promise.all([
    supabase.from('pages').select('url, title, last_modified').eq('scan_id', row.id),
    supabase.from('findings').select('criterion_id, level').eq('scan_id', row.id),
  ]);

  return {
    scanId: String(row.id),
    startedAt: String(row.started_at),
    status: row.status as ScanStatus,
    pages: (pages ?? []).map((page) => ({
      url: String(page.url),
      title: (page.title as string) ?? null,
      lastModified: (page.last_modified as string) ?? null,
    })),
    findings: (findings ?? []).map((finding) => ({
      criterionId: finding.criterion_id as CriterionId,
      level: finding.level as Level,
    })),
    // 上限ちょうどで止まっていれば、その先に取れていないページがある。
    // ページの増減は出さない（走査の都合を変化として書かないため）。
    truncated: Number(row.page_count) >= maxPagesPerScan,
  };
}
