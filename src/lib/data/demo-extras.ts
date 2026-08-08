/**
 * prototype.html のうち、JS 配列になっていない画面内容（03 の経路図・比較表など）。
 * これも架空のサンプルであり、Supabase 接続時は measurements / scans から置き換える。
 */

import type { DiscoveryPage } from '../analysis/discovery';
import type { MeasurementMethod } from '../types';
import type { PathStep } from './reference';

/** 01 SM-02 比較校の更新記録（前回スキャンとの差分） */
export const DEMO_COMPETITOR_UPDATES: { date: string; school: string; body: string }[] = [
  { date: '8/02', school: '白鷺学園', body: '「探究発表会レポート」を公開（写真14枚）' },
  { date: '7/31', school: '東雲台', body: '入試要項2027を公開。昨年の本校より 23日 早い' },
  { date: '7/28', school: '清和国際', body: 'トップページを刷新。動画を先頭に配置' },
  { date: '7/26', school: '桐生ヶ丘', body: 'お知らせの更新頻度が週1→週3に増加' },
  { date: '7/22', school: '白鷺学園', body: '学費ページに6年間の総額シミュレーターを追加' },
];

/** 03 MS-01 デモ用の自校の経路（架空。本番では手動記録の値を出す） */
export const DEMO_SELF_PATH: { clicks: number; steps: PathStep[] } = {
  clicks: 4,
  steps: [
    { label: 'トップページ', note: '説明会への常設導線なし。ナビにも項目なし', pain: true },
    { label: '入試情報' },
    { label: '学校説明会', note: '申込リンクは本文8行目。2回スクロールが必要', pain: true },
    { label: '外部予約サイト' },
    { label: '申込完了', end: true },
  ],
};

/** 03 MS-05 測定条件と再現性（該当する指標） */
export const MEASUREMENT_METHOD_TARGETS: Record<MeasurementMethod, string> = {
  scan: '更新件数、カテゴリ数、写真・動画の数、ページ数、公開までの日数',
  operate: '説明会申込までのクリック数、学校案内を読むまでのクリック数',
  external: 'スマートフォンでの表示完了時間',
};

/** 07 レポート末尾の注記（handoff.md 5章 07：必ず入れる） */
export const REPORT_CONFIDENTIALITY = [
  '本レポートの調査項目は、実在する私立中高一貫校6校（首都圏・関西・東北／進学校・中堅校・大学附属校／男子校・女子校・共学校）のサイト構造をもとに設計しています。項目の判定はページ名称の一致ではなく、内容に基づいて行っています。',
  '本レポートは本校内での検討を目的として作成したものです。比較校に関する記載は、各校が一般に公開しているページの有無・更新日・掲載件数を記録したもので、教育内容や学校運営の優劣を評価するものではありません。校外への配布・転載はご遠慮ください。',
];

/* ===== 04 発見のされ方 ===== */

/**
 * デモ用の疑似ページ集合。
 *
 * SE-04（設定状況の点検）は analyzeDiscovery が pages から算出する。
 * デモでも同じ算出ロジックを通すため、prototype.html が示していた数値
 * （128ページ／PDF 12件／title が学校名のみ 41件／説明文なし 96件／
 * 画像 186点中 149点が alt 未設定／h1 未設定 22・複数 6）と
 * 一致する疑似ページを組み立てる。
 *
 * 固定の判定結果を書き置くのではなくデータから算出させるのは、
 * 表示だけ整えて算出ロジックが動いていない状態を作らないため。
 */
export function demoDiscoveryPages(): DiscoveryPage[] {
  const pages: DiscoveryPage[] = [];
  const htmlCount = 116;
  const pdfCount = 12;
  const genericTitleCount = 41;
  const missingDescriptionCount = 96;
  const noH1Count = 22;
  const multipleH1Count = 6;
  const totalImages = 186;
  const imagesWithoutAlt = 149;
  // SE-03 の検出対象：校内の呼称のままページ名にしている例
  const internalNames: Record<number, string> = {
    41: '諸費用について',
    42: '進路状況',
    43: '総合的な学習の時間',
    44: '入学者選抜要項',
  };

  for (let index = 0; index < htmlCount; index += 1) {
    pages.push({
      url:
        index === 0
          ? 'https://suiryogaoka.example.ed.jp/admission/briefing2026'
          : `https://suiryogaoka.example.ed.jp/page-${index}`,
      title:
        index < genericTitleCount
          ? '翠陵ヶ丘中学校・高等学校'
          : (internalNames[index] ?? `ページ${index}｜翠陵ヶ丘中学校・高等学校`),
      metaDescription: index < missingDescriptionCount ? null : 'ページの説明文',
      h1Count: index < noH1Count ? 0 : index < noH1Count + multipleH1Count ? 2 : 1,
      imageCount: 0,
      imageWithoutAltCount: 0,
      hasJsonLd: false,
      jsonLdTypes: [],
      isPdf: false,
    });
  }

  // 画像は先頭ページにまとめて持たせる（点数の合計だけが判定に効くため）
  pages[0].imageCount = totalImages;
  pages[0].imageWithoutAltCount = imagesWithoutAlt;

  for (let index = 0; index < pdfCount; index += 1) {
    pages.push({
      url: `https://suiryogaoka.example.ed.jp/admission/document-${index}.pdf`,
      title: null,
      metaDescription: null,
      h1Count: 0,
      imageCount: 0,
      imageWithoutAltCount: 0,
      hasJsonLd: false,
      jsonLdTypes: [],
      isPdf: true,
    });
  }

  return pages;
}

/** SE-01 一般検索での順位。外部の順位計測 API が未確定のため手動記録の想定。 */
export const DEMO_RANKINGS: {
  keyword: string;
  monthlySearches: number;
  selfPosition: number | null;
  bestCompetitor: string;
  bestCompetitorPosition: number;
  topDomain: string;
}[] = [
  {
    keyword: '○○市 私立中学',
    monthlySearches: 890,
    selfPosition: 12,
    bestCompetitor: '白鷺学園',
    bestCompetitorPosition: 4,
    topDomain: '受験情報サイト',
  },
  {
    keyword: '○○市 中高一貫',
    monthlySearches: 320,
    selfPosition: null,
    bestCompetitor: '白鷺学園',
    bestCompetitorPosition: 3,
    topDomain: '塾ポータル',
  },
  {
    keyword: '○○線 私立中学 共学',
    monthlySearches: 210,
    selfPosition: null,
    bestCompetitor: '東雲台',
    bestCompetitorPosition: 6,
    topDomain: '受験情報サイト',
  },
  {
    keyword: '中学受験 探究学習 ○○',
    monthlySearches: 140,
    selfPosition: null,
    bestCompetitor: '白鷺学園',
    bestCompetitorPosition: 2,
    topDomain: '白鷺学園',
  },
  {
    keyword: '○○市 中学 説明会',
    monthlySearches: 260,
    selfPosition: null,
    bestCompetitor: '清和国際',
    bestCompetitorPosition: 5,
    topDomain: '塾ポータル',
  },
];
