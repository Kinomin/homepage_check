/**
 * 走査と判定の実行（1校ぶん）。
 *
 *   npm run scan -- --url https://example.ed.jp --name 翠陵ヶ丘中学校 --role self
 *
 * 主なオプション
 *   --role self|competitor   比較校は走査範囲を絞り、評価文を生成しない
 *   --max-pages N            取得するページ数の上限
 *   --depth N                クロール深度（既定 4）
 *   --affiliated-university  系列大学あり（D4 の判定対象にする）
 *   --no-junior / --no-senior 募集していない課程（F1 の判定対象から外す）
 *   --dry-run                クロールのみ行い、LLM 判定を呼ばない
 *
 * Supabase が設定されていれば scans / pages / findings に書き込み、
 * 未設定なら .data/ に JSON として保存する。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { isAnthropicConfigured } from '../src/lib/env';
import { runScan } from '../src/lib/judge/pipeline';
import { createServiceClient } from '../src/lib/supabase/server';
import type { School } from '../src/lib/types';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const url = arg('url');
  if (!url) {
    console.error('--url は必須です');
    process.exit(1);
  }

  const school: School = {
    id: arg('school-id') ?? 'local',
    name: arg('name') ?? new URL(url).hostname,
    url,
    prefecture: null,
    schoolType: null,
    coedType: null,
    hasJuniorAdmission: !flag('no-junior'),
    hasSeniorAdmission: !flag('no-senior'),
    hasAffiliatedUniversity: flag('affiliated-university'),
    robotsAllowed: true,
    role: arg('role') === 'competitor' ? 'competitor' : 'self',
    sortOrder: 0,
  };

  if (!isAnthropicConfigured() && !flag('dry-run')) {
    console.warn(
      'ANTHROPIC_API_KEY が未設定です。判定はすべて unknown になります（--dry-run と同じ扱い）。',
    );
  }

  console.log(`走査開始: ${school.name}（${school.url}）role=${school.role}`);

  const outcome = await runScan(school, {
    maxDepth: Number(arg('depth') ?? 4),
    maxPages: Number(arg('max-pages') ?? (school.role === 'self' ? 200 : 60)),
    // 比較校の本文は保持しない（handoff.md 6章）
    keepBodyText: school.role === 'self',
  });

  console.log(`走査結果: status=${outcome.crawl.status} pages=${outcome.crawl.stats.pageCount}`);
  if (outcome.crawl.reason) console.log(`理由: ${outcome.crawl.reason}`);

  const counts = outcome.findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.level] = (acc[finding.level] ?? 0) + 1;
    return acc;
  }, {});
  console.log('判定内訳:', counts);

  const supabase = createServiceClient();
  if (supabase && arg('school-id')) {
    const { data: scan, error } = await supabase
      .from('scans')
      .insert({
        school_id: school.id,
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

    // 比較校のページ本文は保存しない。集計値と URL のみ。
    await supabase.from('pages').insert(
      outcome.crawl.pages.map((page) => ({
        scan_id: scan.id,
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
      })),
    );

    await supabase.from('findings').insert(
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

    console.log(`Supabase に保存しました（scan_id=${scan.id}）`);
    return;
  }

  const outputDir = path.join(process.cwd(), '.data');
  await mkdir(outputDir, { recursive: true });
  const file = path.join(outputDir, `scan-${Date.now()}.json`);
  await writeFile(
    file,
    JSON.stringify(
      {
        school,
        status: outcome.crawl.status,
        reason: outcome.crawl.reason,
        stats: outcome.crawl.stats,
        // 本文は保存しない（サイズと再配布の両方の理由）
        pages: outcome.crawl.pages.map((page) => ({
          url: page.url,
          title: page.title,
          metaDescription: page.metaDescription,
          h1Count: page.h1Count,
          wordCount: page.wordCount,
          imageCount: page.imageCount,
          imageWithoutAltCount: page.imageWithoutAltCount,
          hasJsonLd: page.hasJsonLd,
          jsonLdTypes: page.jsonLdTypes,
          lastModified: page.lastModified,
          httpStatus: page.httpStatus,
          isPdf: page.isPdf,
          depth: page.depth,
        })),
        findings: outcome.findings,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`保存しました: ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
