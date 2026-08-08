/**
 * 01 SM-02 の材料。比較校ごとに直近2回の走査を読む。
 *
 * 保持しているのは集計値と URL だけで、ページ本文は保存していない
 * （handoff.md 6章）。差分もその範囲で出す。
 *
 * クエリは3回に固定してある（学校数に比例させない）。
 * 以前は学校ごとに「走査 → ページ → 判定」を投げていて、比較4校で20往復していた。
 * 01 は最初に開く画面なので、ここが遅いと全体が遅く見える。
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

type ScanRow = {
  id: string;
  school_id: string;
  started_at: string;
  status: string;
  page_count: number;
};

export async function loadCompetitorChanges(
  competitors: School[],
  maxPagesPerScan: number,
): Promise<CompetitorDiff> {
  const supabase = await createDataClient();
  if (!supabase || competitors.length === 0) {
    return { changes: [], availability: 'no-scan' };
  }

  const schoolIds = competitors.map((school) => school.id);

  // 走り切った回だけを比較の対象にする。
  // 失敗した回を挟むと、取得できなかったことが変化として出てしまう。
  //
  // 全校ぶんをまとめて取り、学校ごとに新しい2件へ切り分ける。
  // limit は掛けない：学校ごとの上位2件は SQL 側では絞れないため、
  // 新しい順に取ってアプリ側で数える。
  const { data: scans } = await supabase
    .from('scans')
    .select('id, school_id, started_at, status, page_count')
    .in('school_id', schoolIds)
    .eq('status', 'done')
    .order('started_at', { ascending: false });

  const recentBySchool = new Map<string, ScanRow[]>();
  for (const row of (scans ?? []) as ScanRow[]) {
    const list = recentBySchool.get(row.school_id) ?? [];
    if (list.length < 2) {
      list.push(row);
      recentBySchool.set(row.school_id, list);
    }
  }

  const scanIds = [...recentBySchool.values()].flat().map((row) => row.id);

  // 必要な走査が確定してから、ページと判定をまとめて1回ずつ引く
  const [pagesByScan, findingsByScan] = await Promise.all([
    loadPages(supabase, scanIds),
    loadFindings(supabase, scanIds),
  ]);

  const entries = competitors.map((school) => {
    const rows = recentBySchool.get(school.id) ?? [];
    const build = (row: ScanRow | undefined): ScanSnapshot | null =>
      row ? toSnapshot(row, pagesByScan, findingsByScan, maxPagesPerScan) : null;
    return { school, current: build(rows[0]), previous: build(rows[1]) };
  });

  const availability = diffAvailability(entries);
  const comparable = entries.filter(
    (entry): entry is { school: School; previous: ScanSnapshot | null; current: ScanSnapshot } =>
      entry.current !== null,
  );

  return { changes: collectCompetitorChanges(comparable), availability };
}

type Client = NonNullable<Awaited<ReturnType<typeof createDataClient>>>;

async function loadPages(
  supabase: Client,
  scanIds: string[],
): Promise<Map<string, ScanSnapshot['pages']>> {
  const byScan = new Map<string, ScanSnapshot['pages']>();
  if (scanIds.length === 0) return byScan;

  const { data } = await supabase
    .from('pages')
    .select('scan_id, url, title, last_modified')
    .in('scan_id', scanIds);

  for (const row of data ?? []) {
    const scanId = String(row.scan_id);
    const list = byScan.get(scanId) ?? [];
    list.push({
      url: String(row.url),
      title: (row.title as string) ?? null,
      lastModified: (row.last_modified as string) ?? null,
    });
    byScan.set(scanId, list);
  }
  return byScan;
}

async function loadFindings(
  supabase: Client,
  scanIds: string[],
): Promise<Map<string, ScanSnapshot['findings']>> {
  const byScan = new Map<string, ScanSnapshot['findings']>();
  if (scanIds.length === 0) return byScan;

  const { data } = await supabase
    .from('findings')
    .select('scan_id, criterion_id, level')
    .in('scan_id', scanIds);

  for (const row of data ?? []) {
    const scanId = String(row.scan_id);
    const list = byScan.get(scanId) ?? [];
    list.push({ criterionId: row.criterion_id as CriterionId, level: row.level as Level });
    byScan.set(scanId, list);
  }
  return byScan;
}

function toSnapshot(
  row: ScanRow,
  pagesByScan: Map<string, ScanSnapshot['pages']>,
  findingsByScan: Map<string, ScanSnapshot['findings']>,
  maxPagesPerScan: number,
): ScanSnapshot {
  return {
    scanId: String(row.id),
    startedAt: String(row.started_at),
    status: row.status as ScanStatus,
    pages: pagesByScan.get(String(row.id)) ?? [],
    findings: findingsByScan.get(String(row.id)) ?? [],
    // 上限ちょうどで止まっていれば、その先に取れていないページがある。
    // ページの増減は出さない（走査の都合を変化として書かないため）。
    truncated: Number(row.page_count) >= maxPagesPerScan,
  };
}
