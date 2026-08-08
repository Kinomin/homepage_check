/**
 * クロール（handoff.md 6章）。
 *
 * ・robots.txt を必ず尊重する。拒否されている学校は走査せず blocked
 * ・クロール間隔を空け、同時接続数を制限する
 * ・深度は 4 を既定
 * ・PDF は本文抽出を試み、失敗したら「PDFのみ」として記録
 * ・比較校のページ本文は保存しない。判定に必要な集計値と URL のみ保持する
 *
 * 走査範囲は要確定事項B の推奨に従い、比較校は判定に必要なページのみに絞る
 * （maxPages を小さくする）。全体集計値は自校のみで取る。
 */

import { env } from '../env';
import type { ScanStatus } from '../types';
import { extractPage, isSameSite, normalizeUrl, pdfPlaceholder, type ExtractedPage } from './extract';
import { crawlDelayFor, isAllowed, isSiteBlocked, parseRobotsTxt, type RobotsTxt } from './robots';

export interface CrawlOptions {
  /** 走査の起点（学校サイトのトップ） */
  origin: string;
  /** 既定 4（handoff.md 6章） */
  maxDepth?: number;
  /** 取得するページ数の上限。比較校は判定に必要な範囲に絞る（要確定事項B） */
  maxPages?: number;
  /** リクエスト間隔（ミリ秒）。robots.txt の Crawl-delay があればそちらを優先 */
  delayMs?: number;
  /** 同時接続数 */
  concurrency?: number;
  requestTimeoutMs?: number;
  /** 比較校では本文を保持しない */
  keepBodyText?: boolean;
  fetchImpl?: typeof fetch;
}

export interface CrawlResult {
  status: ScanStatus;
  /** 走査できなかった理由（blocked / failed のとき） */
  reason: string | null;
  pages: ExtractedPage[];
  stats: {
    pageCount: number;
    imageCount: number;
    imageWithoutAltCount: number;
    pdfOnlyCount: number;
    /** meta description と固有の title が揃っているページ数 */
    describedPageCount: number;
    crawlDepth: number;
  };
}

const DEFAULTS = {
  maxDepth: 4,
  maxPages: 200,
  delayMs: 1000,
  concurrency: 2,
  requestTimeoutMs: 15000,
};

export async function fetchRobots(
  origin: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<RobotsTxt | null> {
  try {
    const url = new URL('/robots.txt', origin).toString();
    const response = await withTimeout(
      fetchImpl(url, { headers: { 'user-agent': env.crawlUserAgent } }),
      timeoutMs,
    );
    if (!response.ok) return { groups: [], sitemaps: [] };
    return parseRobotsTxt(await response.text());
  } catch {
    // robots.txt が取得できないこと自体は拒否ではない。取得できたページのみ扱う。
    return null;
  }
}

export async function crawlSite(options: CrawlOptions): Promise<CrawlResult> {
  const {
    origin,
    maxDepth = DEFAULTS.maxDepth,
    maxPages = DEFAULTS.maxPages,
    delayMs = DEFAULTS.delayMs,
    concurrency = DEFAULTS.concurrency,
    requestTimeoutMs = DEFAULTS.requestTimeoutMs,
    keepBodyText = true,
    fetchImpl = fetch,
  } = options;

  const robots = await fetchRobots(origin, fetchImpl, requestTimeoutMs);

  if (robots && isSiteBlocked(robots, env.crawlUserAgent)) {
    return {
      status: 'blocked',
      reason: 'robots.txt により走査が拒否されています',
      pages: [],
      stats: emptyStats(maxDepth),
    };
  }

  const politeDelayMs = Math.max(
    delayMs,
    robots ? (crawlDelayFor(robots, env.crawlUserAgent) ?? 0) * 1000 : 0,
  );

  const start = normalizeUrl(origin, '/') ?? origin;
  const queue: { url: string; depth: number }[] = [{ url: start, depth: 0 }];
  const seen = new Set<string>([start]);
  const pages: ExtractedPage[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    // 同時接続数を制限し、バッチのあいだに間隔を空ける
    const batch = queue.splice(0, concurrency);
    const results = await Promise.all(
      batch.map(({ url, depth }) =>
        fetchPage(url, depth, fetchImpl, requestTimeoutMs).catch(() => null),
      ),
    );

    for (const page of results) {
      if (!page) continue;
      if (!keepBodyText) page.text = undefined;
      pages.push(page);

      if (page.depth >= maxDepth) continue;
      for (const link of page.links) {
        if (seen.has(link)) continue;
        if (!isSameSite(origin, link)) continue;
        if (robots && !isAllowed(robots, env.crawlUserAgent, new URL(link).pathname)) continue;
        seen.add(link);
        queue.push({ url: link, depth: page.depth + 1 });
      }
    }

    if (queue.length > 0 && politeDelayMs > 0) await sleep(politeDelayMs);
  }

  if (pages.length === 0) {
    return {
      status: 'failed',
      reason: '1ページも取得できませんでした',
      pages: [],
      stats: emptyStats(maxDepth),
    };
  }

  return {
    status: 'done',
    reason: null,
    pages,
    stats: {
      pageCount: pages.length,
      imageCount: sum(pages, (p) => p.imageCount),
      imageWithoutAltCount: sum(pages, (p) => p.imageWithoutAltCount),
      pdfOnlyCount: pages.filter((p) => p.isPdf).length,
      describedPageCount: pages.filter((p) => p.title && p.metaDescription).length,
      crawlDepth: maxDepth,
    },
  };
}

async function fetchPage(
  url: string,
  depth: number,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<ExtractedPage | null> {
  const response = await withTimeout(
    fetchImpl(url, { headers: { 'user-agent': env.crawlUserAgent }, redirect: 'follow' }),
    timeoutMs,
  );
  const contentType = response.headers.get('content-type') ?? '';
  const lastModified = response.headers.get('last-modified');

  if (contentType.includes('application/pdf')) {
    // 本文抽出は Phase1 では行わず、「PDFのみ」として記録する
    return pdfPlaceholder(url, response.status, depth);
  }
  if (!contentType.includes('html')) return null;
  if (!response.ok) return null;

  return extractPage({
    url,
    html: await response.text(),
    httpStatus: response.status,
    lastModified: lastModified ? new Date(lastModified).toISOString() : null,
    depth,
  });
}

function emptyStats(crawlDepth: number): CrawlResult['stats'] {
  return {
    pageCount: 0,
    imageCount: 0,
    imageWithoutAltCount: 0,
    pdfOnlyCount: 0,
    describedPageCount: 0,
    crawlDepth,
  };
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('タイムアウト')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
