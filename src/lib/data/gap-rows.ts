/**
 * 判定結果（findings）から 02 欠落マップの行を組み立てる読み取り。
 *
 * 画面（repository.ts、RLS 付きのクライアント）と走査後のアクション導出
 * （action-writer.ts、サービスキー）の両方が通る。
 *
 * ここに置いているのは、走査結果が無い学校を `unknown` にする規則を
 * 1箇所に閉じるため。この規則が2箇所に分かれると、片方だけ `none` を返して
 * 「他校にあってお宅にない」という誤った指摘に化ける（handoff.md 4章）。
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { CRITERIA } from '../analysis/criteria';
import type { GapRow } from '../analysis/summary';
import type { Level, School } from '../types';

export interface LatestScan {
  id: string;
  schoolId: string;
  startedAt: string;
  pageCount: number;
  indexedCount: number;
  imageCount: number;
  pdfOnlyCount: number;
  crawlDepth: number;
}

/**
 * 各校の最新の走査を返す。
 *
 * `status='done'` のものだけを見る。途中で失敗した走査を最新扱いにすると、
 * 判定できていない項目が欠落として表示される。
 */
export async function loadLatestScans(
  client: SupabaseClient,
  schoolIds: string[],
): Promise<Map<string, LatestScan>> {
  const latest = new Map<string, LatestScan>();
  if (schoolIds.length === 0) return latest;

  const { data, error } = await client
    .from('scans')
    .select(
      'id, school_id, started_at, page_count, indexed_count, image_count, pdf_only_count, crawl_depth',
    )
    .in('school_id', schoolIds)
    .eq('status', 'done')
    .order('started_at', { ascending: false });
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const schoolId = String(row.school_id);
    if (latest.has(schoolId)) continue;
    latest.set(schoolId, {
      id: String(row.id),
      schoolId,
      startedAt: String(row.started_at),
      pageCount: Number(row.page_count),
      indexedCount: Number(row.indexed_count),
      imageCount: Number(row.image_count),
      pdfOnlyCount: Number(row.pdf_only_count),
      crawlDepth: Number(row.crawl_depth),
    });
  }
  return latest;
}

/**
 * 31項目 × 学校の判定結果を組み立てる。
 * `schools[0]` が自校である前提（02 の列順と一致させる）。
 */
export async function loadGapRows(
  client: SupabaseClient,
  schools: School[],
  latestScanBySchool: Map<string, LatestScan>,
): Promise<GapRow[]> {
  const scanIds = schools
    .map((school) => latestScanBySchool.get(school.id)?.id)
    .filter((id): id is string => Boolean(id));

  const findingByScanAndCriterion = new Map<
    string,
    { level: Level; evidenceText: string; evidenceUrls: string[] }
  >();

  if (scanIds.length > 0) {
    const { data, error } = await client
      .from('findings')
      .select('scan_id, criterion_id, level, evidence_text, evidence_urls')
      .in('scan_id', scanIds);
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      findingByScanAndCriterion.set(`${row.scan_id}:${row.criterion_id}`, {
        level: row.level as Level,
        evidenceText: (row.evidence_text as string) ?? '',
        evidenceUrls: (row.evidence_urls as string[]) ?? [],
      });
    }
  }

  return CRITERIA.map((criterion) => {
    const cells = schools.map((school) => {
      const scanId = latestScanBySchool.get(school.id)?.id;
      // 走査結果がない学校は unknown。none（欠落）にしない。
      if (!scanId) return null;
      return findingByScanAndCriterion.get(`${scanId}:${criterion.id}`) ?? null;
    });

    return {
      criterion,
      levels: cells.map((cell) => cell?.level ?? 'unknown'),
      evidence: cells.map((cell) =>
        cell
          ? {
              text: cell.evidenceText,
              source: cell.evidenceUrls.join(' ｜ ') || 'サイト全体を走査',
            }
          : null,
      ),
    };
  });
}
