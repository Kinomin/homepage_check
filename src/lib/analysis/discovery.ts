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

/** 誰が直せるか。ここが分からないと点検結果を渡す先が決まらない。 */
export const FIX_OWNERS = ['広報部', '制作会社'] as const;
export type FixOwner = (typeof FIX_OWNERS)[number];

export interface DiscoveryCheck {
  key: string;
  label: string;
  /** 現在の状況（数えた事実） */
  situation: string;
  /** 検索した家庭から見て何が起きているか */
  reader: string;
  /** 直すと何が起きるか */
  effect: string;
  status: CheckStatus;
  /**
   * 誰が直せるか。
   *
   * 以前はここに改善アクションのID（AC-04 など）を入れていたが、
   * それはプロトタイプのデモ用アクションの番号で、実データでは存在しない。
   * 画面には解決しない参照だけが並んでいた。
   * 点検結果を渡す先が分かることのほうが実務では役に立つ。
   */
  fixedBy: FixOwner;
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
      label: '検索結果に説明会の日程を出す設定',
      situation:
        briefingPages.length === 0
          ? '説明会のページが見つかりません'
          : `説明会ページ${briefingPages.length}件のうち${briefingWithEvent.length}件に設定`,
      reader:
        briefingWithEvent.length === 0
          ? '「学校名 説明会」で検索しても、日付は検索結果に出ず、ページを開くまで分かりません'
          : '検索結果に日付が出るページと出ないページが混在しています',
      effect: '検索結果に日付と申込先が直接並び、開かなくても次回の日程が分かる',
      status:
        briefingPages.length === 0
          ? 'unknown'
          : briefingWithEvent.length === 0
            ? 'ng'
            : briefingWithEvent.length < briefingPages.length
              ? 'warn'
              : 'ok',
      fixedBy: '制作会社',
      priority: briefingPages.length > 0 && briefingWithEvent.length < briefingPages.length,
    },
    {
      key: 'page-title',
      label: '検索結果に出る見出しと説明文',
      situation: `学校名だけの見出し ${genericTitlePages.length}件 ／ 説明文なし ${missingDescriptionPages.length}件（全${htmlPages.length}ページ）`,
      reader:
        genericTitlePages.length > 0
          ? '検索結果にどのページも同じ学校名で並ぶため、探している情報がどれか選べません'
          : '検索結果でページの内容が判別できます',
      effect: '検索結果を見た時点で、どのページに何が書いてあるか分かる',
      status:
        genericTitlePages.length === 0 && missingDescriptionPages.length === 0
          ? 'ok'
          : genericTitlePages.length > htmlPages.length / 4
            ? 'ng'
            : 'warn',
      // 見出しと説明文は本文の書き換えなので、多くの場合は広報部で直せる
      fixedBy: '広報部',
      priority: genericTitlePages.length > 0 || missingDescriptionPages.length > 0,
    },
    {
      key: 'pdf-only',
      label: 'PDFでしか読めないページ',
      situation: `PDF ${pdfPages.length}件`,
      reader:
        pdfPages.length > 0
          ? 'スマートフォンでは開くのに時間がかかり、文字も小さく、検索にも出にくい状態です'
          : 'PDFに頼らずページ内で読めます',
      effect: '検索に出るようになり、スマートフォンでもそのまま読める',
      status: pdfPages.length === 0 ? 'ok' : pdfPages.length > 5 ? 'ng' : 'warn',
      fixedBy: '広報部',
      priority: pdfPages.length > 0,
    },
    {
      key: 'briefing-url',
      label: '説明会ページのURLに年度が入っていないか',
      situation:
        yearInPathBriefing.length > 0
          ? `年度がURLに含まれる ${yearInPathBriefing.length}件`
          : '年度によらない固定のURL',
      reader:
        yearInPathBriefing.length > 0
          ? '毎年ページを作り直すことになり、前年まで検索で積み上げた評価が引き継がれません'
          : '同じURLを使い続けられています',
      effect: '毎年URLを変えずに済み、前年までの検索での評価がそのまま続く',
      fixedBy: '制作会社',
      status: yearInPathBriefing.length > 0 ? 'ng' : 'ok',
      priority: yearInPathBriefing.length > 0,
    },
    {
      key: 'image-alt',
      label: '写真の説明文（代替テキスト）',
      situation:
        totalImages === 0
          ? '画像が見つかりません'
          : `未設定 ${imagesWithoutAlt} / ${totalImages}点`,
      reader:
        imagesWithoutAlt > 0
          ? '画像検索に出ず、読み上げソフトを使う人には何の写真か伝わりません'
          : '写真の内容が検索エンジンと読み上げソフトに伝わります',
      effect: '画像検索から人が来る。読み上げソフトにも対応できる',
      status:
        totalImages === 0
          ? 'unknown'
          : imagesWithoutAlt === 0
            ? 'ok'
            : imagesWithoutAlt > totalImages / 2
              ? 'ng'
              : 'warn',
      fixedBy: '広報部',
      priority: imagesWithoutAlt > 0,
    },
    {
      key: 'organization-schema',
      label: '学校の基本情報を検索エンジンに伝える設定',
      situation: hasOrganizationSchema ? '設定済み' : '未設定',
      reader: hasOrganizationSchema
        ? '所在地や連絡先が検索エンジンに伝わっています'
        : '所在地・電話・設立年を検索エンジンが読み取れていません',
      effect: '学校名で検索したときの枠に、所在地や連絡先が表示される',
      status: hasOrganizationSchema ? 'ok' : 'ng',
      fixedBy: '制作会社',
      priority: false,
    },
    {
      key: 'heading',
      label: '各ページの大見出し',
      situation: `未設定 ${noH1Pages.length}ページ ／ 複数設定 ${multipleH1Pages.length}ページ`,
      reader:
        noH1Pages.length > 0 || multipleH1Pages.length > 0
          ? 'そのページが何について書かれたものか、検索エンジンが判断しにくい状態です'
          : 'ページの主題が伝わる形になっています',
      effect: 'そのページの主題が検索エンジンに正しく伝わる',
      status:
        noH1Pages.length === 0 && multipleH1Pages.length === 0
          ? 'ok'
          : noH1Pages.length > htmlPages.length / 4
            ? 'ng'
            : 'warn',
      fixedBy: '制作会社',
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
