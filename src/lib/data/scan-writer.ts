/**
 * 走査結果の保存。
 *
 * scripts/scan.ts（1校の手動走査）と scripts/scan-due.ts（スケジュール実行）の
 * 両方から使う。保存処理を2箇所に書くと、片方だけ列を足し忘れる。
 *
 * ページ本文はどちらの経路でも保存しない。判定にはメモリ上の本文を使い、
 * 永続化するのは集計値と URL のみ（handoff.md 6章）。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { deriveMeasurements } from '../analysis/measurements';
import type { ExtractedPage } from '../crawl/extract';
import type { ScanOutcome } from '../judge/pipeline';
import { createServiceClient } from '../supabase/server';
import type { Finding, Level } from '../types';

/** 本文とリンクを落とし、保存してよい集計値だけにする */
export function toStoredPage(page: ExtractedPage) {
  return {
    url: page.url,
    title: page.title,
    meta_description: page.metaDescription,
    h1_count: page.h1Count,
    word_count: page.wordCount,
    image_count: page.imageCount,
    image_without_alt_count: page.imageWithoutAltCount,
    has_json_ld: page.hasJsonLd,
    json_ld_types: page.jsonLdTypes,
    last_modified: page.lastModified,
    http_status: page.httpStatus,
    is_pdf: page.isPdf,
    depth: page.depth,
  };
}

export interface PersistResult {
  target: 'supabase' | 'file';
  location: string;
}

/**
 * Supabase が使える（かつ school.id が実在の学校ID）なら DB に、
 * そうでなければ .data/ に JSON として保存する。
 */
export async function persistScanOutcome(
  outcome: ScanOutcome,
  options: { schoolId?: string; outputDir?: string } = {},
): Promise<PersistResult> {
  const supabase = createServiceClient();
  const schoolId = options.schoolId;

  if (supabase && schoolId) {
    const { data: scan, error } = await supabase
      .from('scans')
      .insert({
        school_id: schoolId,
        status: outcome.crawl.status,
        finished_at: new Date().toISOString(),
        page_count: outcome.crawl.stats.pageCount,
        image_count: outcome.crawl.stats.imageCount,
        pdf_only_count: outcome.crawl.stats.pdfOnlyCount,
        indexed_count: outcome.crawl.stats.describedPageCount,
        crawl_depth: outcome.crawl.stats.crawlDepth,
      })
      .select('id')
      .single();
    if (error || !scan) throw new Error(error?.message ?? 'scans への書き込みに失敗しました');

    if (outcome.crawl.pages.length > 0) {
      const { error: pagesError } = await supabase
        .from('pages')
        .insert(outcome.crawl.pages.map((page) => ({ scan_id: scan.id, ...toStoredPage(page) })));
      if (pagesError) throw new Error(pagesError.message);
    }

    const { error: findingsError } = await supabase.from('findings').insert(
      outcome.findings.map((finding) => ({
        scan_id: scan.id,
        criterion_id: finding.criterionId,
        level: finding.level,
        evidence_text: finding.evidenceText,
        evidence_urls: finding.evidenceUrls,
        evidence_counts: finding.evidenceCounts,
        judged_by: finding.judgedBy,
        judged_at: finding.judgedAt,
      })),
    );
    if (findingsError) throw new Error(findingsError.message);

    // 03 の計測値。走査から出せる指標だけを入れる（出せないものは未計測のまま）。
    const measurements = deriveMeasurements(
      {
        imageCount: outcome.crawl.stats.imageCount,
        pageLastModified: outcome.crawl.pages.map((page) => page.lastModified),
      },
      new Date(),
    );
    const { error: measurementsError } = await supabase
      .from('measurements')
      .insert(measurements.map((measurement) => ({ scan_id: scan.id, ...measurement })));
    if (measurementsError) throw new Error(measurementsError.message);

    return { target: 'supabase', location: String(scan.id) };
  }

  const outputDir = options.outputDir ?? path.join(process.cwd(), '.data');
  await mkdir(outputDir, { recursive: true });
  const file = path.join(outputDir, `scan-${Date.now()}-${slug(outcome.school.name)}.json`);
  await writeFile(
    file,
    JSON.stringify(
      {
        school: outcome.school,
        status: outcome.crawl.status,
        reason: outcome.crawl.reason,
        stats: outcome.crawl.stats,
        pages: outcome.crawl.pages.map(toStoredPage),
        findings: outcome.findings,
      },
      null,
      2,
    ),
    'utf8',
  );
  return { target: 'file', location: file };
}

/** 前回の判定結果（判定の揺れを抑えるためプロンプトに渡す：要確定事項E） */
export async function loadPreviousFindings(
  schoolId: string,
): Promise<Map<string, Pick<Finding, 'level' | 'evidenceText'>>> {
  const result = new Map<string, Pick<Finding, 'level' | 'evidenceText'>>();
  const supabase = createServiceClient();
  if (!supabase) return result;

  const { data: previousScan } = await supabase
    .from('scans')
    .select('id')
    .eq('school_id', schoolId)
    .eq('status', 'done')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!previousScan) return result;

  const { data: findings } = await supabase
    .from('findings')
    .select('criterion_id, level, evidence_text')
    .eq('scan_id', previousScan.id);

  for (const finding of findings ?? []) {
    result.set(finding.criterion_id as string, {
      level: finding.level as Level,
      evidenceText: (finding.evidence_text as string) ?? '',
    });
  }
  return result;
}

function slug(name: string): string {
  return name.replace(/[^\p{Letter}\p{Number}]+/gu, '-').slice(0, 24);
}
