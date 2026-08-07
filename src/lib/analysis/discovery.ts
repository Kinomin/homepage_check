/**
 * 04 発見のされ方の算出ロジック（handoff.md 5章 04）。
 *
 * この画面の役割は認知の獲得。02・03 が「すでに来た人」を扱うのに対し、
 * ここだけが「まだ学校名を知らない人」を扱う。
 *
 * データの出どころが2つあり、性質がまったく違う。混ぜないこと。
 *
 *   SE-04 設定状況の点検 … 自前のクロール結果から機械的に算出できる（このファイル）
 *   SE-01 一般検索の順位  … 外部の順位計測 API が必要。課金設計が未確定のため
 *   SE-02 検索結果の見え方   Phase 1 では手動記録（rankings テーブル）で受ける
 *
 * 技術チェックの羅列は制作会社の無料診断と同じ土俵なので主役にしない。
 * 主役は SE-01（まだ学校名を知らない層に届いているか）であり、
 * SE-04 は「先に直す5つ」として改善アクションに紐付ける形で出す。
 */

import type { CriterionId } from '../types';

/** 判定に使うページ情報。crawl の結果と DB の pages 行の共通部分。 */
export interface DiscoveryPage {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  imageCount: number;
  imageWithoutAltCount: number;
  hasJsonLd: boolean;
  jsonLdTypes: string[];
  isPdf: boolean;
}

export const CHECK_STATUSES = ['ng', 'warn', 'ok', 'unknown'] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export const CHECK_STATUS_MARK: Record<CheckStatus, string> = {
  ng: '×',
  warn: '△',
  ok: '○',
  unknown: '—',
};

export interface DiscoveryCheck {
  key: string;
  label: string;
  /** 現在の状況（数えた事実） */
  situation: string;
  /** 直すと何が起きるか */
  effect: string;
  status: CheckStatus;
  /** 対応する改善アクション。無ければ制作会社への依頼事項 */
  actionKey: string | null;
  /** 「先に直す5つ」に入れるか */
  priority: boolean;
}

/**
 * ページのタイトルが学校名だけになっていないか。
 * 検索結果に並んだときに何のページか判別できない状態を検出する。
 */
export function hasGenericTitle(title: string | null, schoolName: string): boolean {
  if (!title) return true;
  const normalized = title.replace(/[\s｜|｜\-—–・]/g, '');
  const school = schoolName.replace(/[\s｜|｜\-—–・]/g, '');
  if (!school) return normalized.length === 0;
  // 学校名を取り除いて何も残らなければ、そのページ固有の情報がない
  return normalized.replace(school, '').length === 0;
}

/**
 * URL に年号が埋まっているか（/briefing2026/ など）。
 * 年度ごとに URL が変わると、前年までの検索評価がリセットされる。
 */
export function hasYearInPath(url: string): boolean {
  try {
    return /20\d{2}/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** 説明会ページらしい URL か（構造化データの点検対象を絞るため） */
export function looksLikeBriefingPage(url: string, title: string | null): boolean {
  const haystack = `${safePath(url)} ${title ?? ''}`.toLowerCase();
  return /briefing|setsumeikai|open|event|admission|説明会|オープン|体験入学/.test(haystack);
}

export interface DiscoveryInput {
  pages: DiscoveryPage[];
  schoolName: string;
}

export interface DiscoverySummary {
  checks: DiscoveryCheck[];
  /** 冒頭に出す「先に直す5つ」 */
  priorityChecks: DiscoveryCheck[];
  pageCount: number;
}

/**
 * SE-04 設定状況の点検。走査できたページから機械的に算出する。
 *
 * 走査結果がない場合は空を返す。ここで「未設定」と断定してはならない
 * （取得できなかったことを「情報がない」と表示しない：設計原則4）。
 */
export function analyzeDiscovery({ pages, schoolName }: DiscoveryInput): DiscoverySummary {
  if (pages.length === 0) {
    return { checks: [], priorityChecks: [], pageCount: 0 };
  }

  const htmlPages = pages.filter((page) => !page.isPdf);
  const briefingPages = htmlPages.filter((page) => looksLikeBriefingPage(page.url, page.title));
  const briefingWithEvent = briefingPages.filter((page) =>
    page.jsonLdTypes.some((type) => /event/i.test(type)),
  );
  const hasOrganizationSchema = htmlPages.some((page) =>
    page.jsonLdTypes.some((type) => /EducationalOrganization|School|Organization/i.test(type)),
  );

  const genericTitlePages = htmlPages.filter((page) => hasGenericTitle(page.title, schoolName));
  const missingDescriptionPages = htmlPages.filter((page) => !page.metaDescription);
  const pdfPages = pages.filter((page) => page.isPdf);
  const yearInPathBriefing = briefingPages.filter((page) => hasYearInPath(page.url));
  const totalImages = pages.reduce((sum, page) => sum + page.imageCount, 0);
  const imagesWithoutAlt = pages.reduce((sum, page) => sum + page.imageWithoutAltCount, 0);
  const noH1Pages = htmlPages.filter((page) => page.h1Count === 0);
  const multipleH1Pages = htmlPages.filter((page) => page.h1Count > 1);

  const checks: DiscoveryCheck[] = [
    {
      key: 'briefing-event-schema',
      label: '説明会の構造化データ',
      situation:
        briefingPages.length === 0
          ? '説明会ページが見つかりません'
          : `${briefingWithEvent.length} / ${briefingPages.length}ページで設定`,
      effect: '検索結果に日程が直接表示されるようになる',
      status:
        briefingPages.length === 0
          ? 'unknown'
          : briefingWithEvent.length === 0
            ? 'ng'
            : briefingWithEvent.length < briefingPages.length
              ? 'warn'
              : 'ok',
      actionKey: 'AC-04',
      priority: briefingPages.length > 0 && briefingWithEvent.length < briefingPages.length,
    },
    {
      key: 'page-title',
      label: 'ページ固有のtitle・説明文',
      situation: `title が学校名のみ ${genericTitlePages.length}件 ／ 説明文なし ${missingDescriptionPages.length}件（全${htmlPages.length}ページ）`,
      effect: '検索結果で何のページか判別できるようになる',
      status:
        genericTitlePages.length === 0 && missingDescriptionPages.length === 0
          ? 'ok'
          : genericTitlePages.length > htmlPages.length / 4
            ? 'ng'
            : 'warn',
      actionKey: 'AC-08',
      priority: genericTitlePages.length > 0 || missingDescriptionPages.length > 0,
    },
    {
      key: 'pdf-only',
      label: '学費・要項がPDFのみ',
      situation: `PDF ${pdfPages.length}件`,
      effect: '検索対象になり、スマートフォンで読める',
      status: pdfPages.length === 0 ? 'ok' : pdfPages.length > 5 ? 'ng' : 'warn',
      actionKey: 'AC-07',
      priority: pdfPages.length > 0,
    },
    {
      key: 'briefing-url',
      label: '説明会ページのURL',
      situation:
        yearInPathBriefing.length > 0
          ? `年度がURLに含まれる ${yearInPathBriefing.length}件`
          : '年度によらない固定URL',
      effect: '検索の評価が翌年に引き継がれる',
      status: yearInPathBriefing.length > 0 ? 'ng' : 'ok',
      actionKey: 'AC-12',
      priority: yearInPathBriefing.length > 0,
    },
    {
      key: 'image-alt',
      label: '画像の代替テキスト',
      situation:
        totalImages === 0
          ? '画像が見つかりません'
          : `未設定 ${imagesWithoutAlt} / ${totalImages}点`,
      effect: '画像検索から人が来る。音声読み上げにも対応できる',
      status:
        totalImages === 0
          ? 'unknown'
          : imagesWithoutAlt === 0
            ? 'ok'
            : imagesWithoutAlt > totalImages / 2
              ? 'ng'
              : 'warn',
      actionKey: 'AC-15',
      priority: imagesWithoutAlt > 0,
    },
    {
      key: 'organization-schema',
      label: '構造化データ EducationalOrganization',
      situation: hasOrganizationSchema ? '設定済み' : '未設定',
      effect: '学校の基本情報（所在地・電話・設立）が検索エンジンに伝わる',
      status: hasOrganizationSchema ? 'ok' : 'ng',
      actionKey: 'AC-04',
      priority: false,
    },
    {
      key: 'heading',
      label: '見出し構造（h1）',
      situation: `未設定 ${noH1Pages.length}ページ ／ 複数設定 ${multipleH1Pages.length}ページ`,
      effect: 'ページの主題が検索エンジンに伝わる',
      status:
        noH1Pages.length === 0 && multipleH1Pages.length === 0
          ? 'ok'
          : noH1Pages.length > htmlPages.length / 4
            ? 'ng'
            : 'warn',
      actionKey: null,
      priority: false,
    },
  ];

  // 「先に直す5つ」。priority が立っているものを、影響の大きい順に5件まで。
  const priorityOrder = ['briefing-event-schema', 'page-title', 'pdf-only', 'briefing-url', 'image-alt'];
  const priorityChecks = priorityOrder
    .map((key) => checks.find((check) => check.key === key))
    .filter((check): check is DiscoveryCheck => Boolean(check?.priority))
    .slice(0, 5);

  return { checks, priorityChecks, pageCount: pages.length };
}

/* ===== SE-03 ページ名称と検索語のズレ ===== */

/**
 * 校内の呼称のままページ名にしている箇所。
 *
 * 02 の欠落マップでは「名称が違っても内容で判定する」が、
 * 検索エンジンはそこまで汲み取ってくれない。同じ問題が順位として現れる箇所。
 *
 * criteria の aliases のうち「一般に検索される語」を先頭に置いてあるため、
 * 2番目以降の別名だけがページ名に使われている場合を検出する。
 */
export interface NamingGap {
  criterionId: CriterionId;
  /** 自校が使っている名称 */
  usedName: string;
  /** 実際に検索されている語 */
  searchedName: string;
  url: string;
  pageTitle: string;
}

export function findNamingGaps(
  pages: DiscoveryPage[],
  criteria: { id: CriterionId; aliases: string[] }[],
): NamingGap[] {
  const gaps: NamingGap[] = [];

  for (const criterion of criteria) {
    const [searchedName, ...alternatives] = criterion.aliases;
    if (!searchedName || alternatives.length === 0) continue;

    for (const page of pages) {
      const title = page.title;
      if (!title) continue;
      // 一般的な語が入っていれば問題ない
      if (title.includes(searchedName)) continue;
      const used = alternatives.find((alias) => title.includes(alias));
      if (!used) continue;

      gaps.push({
        criterionId: criterion.id,
        usedName: used,
        searchedName,
        url: page.url,
        pageTitle: title,
      });
      break; // 1項目につき1件で十分
    }
  }

  return gaps;
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
