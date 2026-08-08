import { describe, expect, it } from 'vitest';

import { extractPage, normalizeUrl, isSameSite } from '../src/lib/crawl/extract';
import {
  crawlDelayFor,
  isAllowed,
  isSiteBlocked,
  matchesPattern,
  parseRobotsTxt,
} from '../src/lib/crawl/robots';

describe('robots.txt の解釈（handoff.md 6章）', () => {
  const robots = parseRobotsTxt(`
    # コメント
    User-agent: *
    Disallow: /admin/
    Allow: /admin/public/
    Crawl-delay: 3

    User-agent: EvilBot
    Disallow: /

    Sitemap: https://example.ed.jp/sitemap.xml
  `);

  it('グループとサイトマップを読む', () => {
    expect(robots.groups).toHaveLength(2);
    expect(robots.sitemaps).toEqual(['https://example.ed.jp/sitemap.xml']);
  });

  it('Disallow を尊重する', () => {
    expect(isAllowed(robots, 'SchoolInsightBot/1.0', '/admin/settings')).toBe(false);
  });

  it('より長く一致する Allow が Disallow に優先する', () => {
    expect(isAllowed(robots, 'SchoolInsightBot/1.0', '/admin/public/notice')).toBe(true);
  });

  it('指定のない場所は許可', () => {
    expect(isAllowed(robots, 'SchoolInsightBot/1.0', '/admission/briefing')).toBe(true);
  });

  it('自分の User-agent 向けのグループを優先する', () => {
    expect(isAllowed(robots, 'EvilBot/2.0', '/admission/briefing')).toBe(false);
  });

  it('サイト全体の拒否を検出する（走査せず blocked にする）', () => {
    expect(isSiteBlocked(parseRobotsTxt('User-agent: *\nDisallow: /'), 'SchoolInsightBot')).toBe(
      true,
    );
  });

  it('Disallow: （空）は全許可', () => {
    expect(isSiteBlocked(parseRobotsTxt('User-agent: *\nDisallow:'), 'SchoolInsightBot')).toBe(
      false,
    );
  });

  it('Crawl-delay を読む', () => {
    expect(crawlDelayFor(robots, 'SchoolInsightBot/1.0')).toBe(3);
  });

  it('ワイルドカードと末尾一致', () => {
    expect(matchesPattern('/*.pdf$', '/admission/fee.pdf')).toBe(true);
    expect(matchesPattern('/*.pdf$', '/admission/fee.pdf?x=1')).toBe(false);
  });
});

describe('ページ抽出', () => {
  const html = `
    <html><head>
      <title>学校説明会・体験入学の日程｜翠陵ヶ丘中学校</title>
      <meta name="description" content="2026年度の説明会日程">
      <script type="application/ld+json">{"@type":"Event","name":"学校説明会"}</script>
    </head><body>
      <nav><a href="/admission/">入試情報</a><a href="/access/">アクセス</a></nav>
      <h1>学校説明会</h1>
      <h2>日程</h2>
      <img src="/img/briefing.jpg" alt="説明会の様子">
      <img src="/img/logo.png" alt="">
      <img src="/img/campus.jpg">
      <a href="https://other.example.com/x">外部</a>
      <a href="/admission/briefing#top">同じページ</a>
      <p>本校の説明会は年6回実施しています。</p>
    </body></html>`;

  const page = extractPage({
    url: 'https://example.ed.jp/admission/briefing',
    html,
    httpStatus: 200,
    lastModified: null,
    depth: 2,
  });

  it('タイトルと説明文を取る', () => {
    expect(page.title).toContain('学校説明会');
    expect(page.metaDescription).toBe('2026年度の説明会日程');
  });

  it('構造化データの型を取る', () => {
    expect(page.hasJsonLd).toBe(true);
    expect(page.jsonLdTypes).toEqual(['Event']);
  });

  it('装飾画像を除いて画像点数と alt 未設定数を数える', () => {
    expect(page.imageCount).toBe(2); // logo.png は装飾として除外
    expect(page.imageWithoutAltCount).toBe(1); // campus.jpg のみ alt なし
  });

  it('見出しとナビのラベルを候補抽出の手がかりとして拾う', () => {
    expect(page.headings).toContain('学校説明会');
    expect(page.headings).toContain('入試情報');
  });

  it('リンクを正規化し、フラグメントを落とす', () => {
    expect(page.links).toContain('https://example.ed.jp/admission/briefing');
    expect(page.links.some((l) => l.includes('#'))).toBe(false);
  });

  it('同一サイト判定は www の有無を無視する', () => {
    expect(isSameSite('https://example.ed.jp/', 'https://www.example.ed.jp/access')).toBe(true);
    expect(isSameSite('https://example.ed.jp/', 'https://other.example.com/')).toBe(false);
  });

  it('URL 正規化は末尾スラッシュを揃える', () => {
    expect(normalizeUrl('https://example.ed.jp/', '/news/')).toBe('https://example.ed.jp/news');
  });
});
