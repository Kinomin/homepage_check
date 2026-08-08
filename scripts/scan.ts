/**
 * 走査と判定の実行（1校ぶん）。
 *
 *   npm run scan -- --url https://example.ed.jp --name 翠陵ヶ丘中学校 --role self
 *
 * 主なオプション
 *   --role self|competitor   比較校は走査範囲を絞り、評価文を生成しない
 *   --max-pages N            取得するページ数の上限（既定は設定画面の値）
 *   --depth N                クロール深度（既定は設定画面の値）
 *   --school-id UUID         Supabase の学校ID。指定すると DB に保存する
 *   --affiliated-university  系列大学あり（D4 の判定対象にする）
 *   --no-junior / --no-senior 募集していない課程（F1 の判定対象から外す）
 *
 * 走査条件（深度・ページ数上限・リクエスト間隔・思考深度）は設定画面（08）の
 * 値を既定とし、上記の引数で個別に上書きできる。
 *
 * 保存先は Supabase（--school-id 指定時）または .data/ の JSON。
 * どちらの場合もページ本文は保存しない（handoff.md 6章）。
 */

import type { CrawlOptions } from '../src/lib/crawl/crawler';
import { syncActionsForScannedSchools } from '../src/lib/data/action-writer';
import { loadPreviousFindings, persistScanOutcome } from '../src/lib/data/scan-writer';
import { loadSettings } from '../src/lib/data/settings-repository';
import { isAnthropicConfigured } from '../src/lib/env';
import { runScan } from '../src/lib/judge/pipeline';
import type { Finding, School } from '../src/lib/types';

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

  const schoolId = arg('school-id');
  const school: School = {
    id: schoolId ?? 'local',
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

  if (!isAnthropicConfigured()) {
    console.warn('ANTHROPIC_API_KEY が未設定です。判定はすべて unknown になります。');
  }

  // 走査条件は設定画面（08）の値を既定にし、コマンドライン引数で上書きできる
  const { settings } = await loadSettings();
  const overrides: Partial<CrawlOptions> = {};
  if (arg('depth')) overrides.maxDepth = Number(arg('depth'));
  if (arg('max-pages')) overrides.maxPages = Number(arg('max-pages'));

  console.log(`走査開始: ${school.name}（${school.url}）role=${school.role}`);
  console.log(
    `走査条件: 深度 ${overrides.maxDepth ?? settings.crawl.maxDepth} ／ 上限 ${
      overrides.maxPages ??
      (school.role === 'self' ? settings.crawl.selfMaxPages : settings.crawl.competitorMaxPages)
    }ページ ／ 間隔 ${settings.crawl.requestIntervalMs}ms ／ 思考深度 ${settings.judge.effort}`,
  );

  // 前回の判定結果を渡し、判定の揺れを抑える（要確定事項E）
  const previousFindings = schoolId
    ? await loadPreviousFindings(schoolId)
    : new Map<string, Pick<Finding, 'level' | 'evidenceText'>>();

  const outcome = await runScan(school, overrides, previousFindings, settings);

  console.log(`走査結果: status=${outcome.crawl.status} pages=${outcome.crawl.stats.pageCount}`);
  if (outcome.crawl.reason) console.log(`理由: ${outcome.crawl.reason}`);

  const counts = outcome.findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.level] = (acc[finding.level] ?? 0) + 1;
    return acc;
  }, {});
  console.log('判定内訳:', counts);

  const saved = await persistScanOutcome(outcome, { schoolId });
  console.log(
    saved.target === 'supabase'
      ? `Supabase に保存しました（scan_id=${saved.location}）`
      : `保存しました: ${saved.location}`,
  );

  // 改善アクション（06）を作り直す。優先度は比較校の公開状況で決まるため、
  // 保存済みの他校の判定結果も合わせて見る必要がある。
  if (schoolId && saved.target === 'supabase' && outcome.crawl.status === 'done') {
    const synced = await syncActionsForScannedSchools([schoolId]);
    for (const result of synced) {
      console.log(
        `改善アクションを導出: ${result.count}件（対応済みの引き継ぎ ${result.carriedOverDone}件）`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
