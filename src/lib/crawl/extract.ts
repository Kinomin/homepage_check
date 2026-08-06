/**
 * HTML から判定に必要な集計値と本文を取り出す。
 *
 * 学校サイトは静的 HTML が大半のため Cheerio で足りる（handoff.md 9章C）。
 * JS レンダリングが必要なページのみ Playwright にフォールバックする二段構えを想定し、
 * この関数は「取得済みの HTML 文字列」だけを入力にとる。
 */

import * as cheerio from 'cheerio';

import type { PageRecord } from '../types';

export interface ExtractedPage extends PageRecord {
  /** 同一ホストの内部リンク（絶対 URL・正規化済み） */
  links: string[];
}

const IGNORED_EXTENSIONS =
  /\.(jpe?g|png|gif|webp|svg|ico|css|js|zip|docx?|xlsx?|pptx?|mp4|mp3|woff2?|ttf)$/i;

/** バナー・アイコンなど装飾目的の画像を除く（03「掲載写真の点数」の定義に合わせる） */
const DECORATIVE_IMAGE = /(icon|logo|banner|btn|button|bg|spacer|arrow)/i;

export function normalizeUrl(base: string, href: string): string | null {
  try {
    const url = new URL(href, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    // 末尾スラッシュの有無で同じページを二重に数えない
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function isSameSite(a: string, b: string): boolean {
  try {
    const hostA = new URL(a).hostname.replace(/^www\./, '');
    const hostB = new URL(b).hostname.replace(/^www\./, '');
    return hostA === hostB;
  } catch {
    return false;
  }
}

export function extractPage(params: {
  url: string;
  html: string;
  httpStatus: number;
  lastModified: string | null;
  depth: number;
}): ExtractedPage {
  const { url, html, httpStatus, lastModified, depth } = params;
  const $ = cheerio.load(html);

  // 構造化データは script を除去する前に読む
  const jsonLdTypes: string[] = [];
  const jsonLdScripts = $('script[type="application/ld+json"]');
  jsonLdScripts.each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
        const type = node?.['@type'];
        if (typeof type === 'string') jsonLdTypes.push(type);
        else if (Array.isArray(type)) jsonLdTypes.push(...type.filter((t) => typeof t === 'string'));
      }
    } catch {
      // 壊れた JSON-LD は「設置されているが読めない」として型を記録しない
    }
  });
  const hasJsonLd = jsonLdScripts.length > 0;

  $('script, style, noscript').remove();

  let imageCount = 0;
  let imageWithoutAltCount = 0;
  $('img').each((_, el) => {
    const src = $(el).attr('src') ?? '';
    if (DECORATIVE_IMAGE.test(src)) return;
    imageCount += 1;
    const alt = $(el).attr('alt');
    if (alt === undefined || alt.trim() === '') imageWithoutAltCount += 1;
  });

  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text) headings.push(text);
  });

  // ナビゲーションのラベルも候補ページ抽出の手がかりになる
  $('nav a, header a').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length <= 30) headings.push(text);
  });

  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const normalized = normalizeUrl(url, href);
    if (!normalized) return;
    if (IGNORED_EXTENSIONS.test(new URL(normalized).pathname)) return;
    links.push(normalized);
  });

  const text = $('body').text().replace(/\s+/g, ' ').trim();

  return {
    url,
    title: $('title').first().text().trim() || null,
    metaDescription: $('meta[name="description"]').attr('content')?.trim() || null,
    h1Count: $('h1').length,
    wordCount: countWords(text),
    imageCount,
    imageWithoutAltCount,
    hasJsonLd,
    jsonLdTypes: [...new Set(jsonLdTypes)],
    lastModified,
    httpStatus,
    isPdf: false,
    text,
    headings: [...new Set(headings)],
    depth,
    links: [...new Set(links)],
  };
}

/** 日本語は空白で区切られないため、文字数ベースで概算する */
export function countWords(text: string): number {
  const ascii = text.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  const cjk = text.match(/[\u3000-\u9fff\uff00-\uffef]/g)?.length ?? 0;
  return ascii + Math.round(cjk / 2);
}

/** PDF は本文抽出を試み、失敗したら「PDFのみ」として記録する（handoff.md 6章） */
export function pdfPlaceholder(url: string, httpStatus: number, depth: number): ExtractedPage {
  return {
    url,
    title: null,
    metaDescription: null,
    h1Count: 0,
    wordCount: 0,
    imageCount: 0,
    imageWithoutAltCount: 0,
    hasJsonLd: false,
    jsonLdTypes: [],
    lastModified: null,
    httpStatus,
    isPdf: true,
    text: '',
    headings: [],
    depth,
    links: [],
  };
}
