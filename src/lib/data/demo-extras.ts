/**
 * prototype.html のうち、JS 配列になっていない画面内容（03 の経路図・比較表など）。
 * これも架空のサンプルであり、Supabase 接続時は measurements / scans から置き換える。
 */

import type { DiscoveryPage } from '../analysis/discovery';
import type { MeasurementMethod } from '../types';

/** 01 SM-02 比較校の更新記録（前回スキャンとの差分） */
export const DEMO_COMPETITOR_UPDATES: { date: string; school: string; body: string }[] = [
  { date: '8/02', school: '白鷺学園', body: '「探究発表会レポート」を公開（写真14枚）' },
  { date: '7/31', school: '東雲台', body: '入試要項2027を公開。昨年の本校より 23日 早い' },
  { date: '7/28', school: '清和国際', body: 'トップページを刷新。動画を先頭に配置' },
  { date: '7/26', school: '桐生ヶ丘', body: 'お知らせの更新頻度が週1→週3に増加' },
  { date: '7/22', school: '白鷺学園', body: '学費ページに6年間の総額シミュレーターを追加' },
];

/** 03 MS-01 説明会の申込にたどり着くまで */
export interface PathStep {
  label: string;
  note?: string;
  pain?: boolean;
  end?: boolean;
}

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

export const DEMO_PEER_PATH: { clicks: number; steps: PathStep[] } = {
  clicks: 2,
  steps: [
    { label: 'トップページ', note: '常設バナー、またはナビのドロップダウンから直接' },
    { label: '説明会ページ', note: '冒頭に予約ボタン。日程ごとに個別のボタン' },
    { label: '外部予約サイト' },
    { label: '申込完了', end: true },
  ],
};

/** 03 MS-02 実在6校との導線比較（学校名は伏せる） */
export const DEMO_PEER_COMPARISON: {
  school: string;
  toBriefing: number;
  persistentLink: string;
  toBrochure: number;
  reservation: string;
  isSelf?: boolean;
}[] = [
  { school: '本校', toBriefing: 4, persistentLink: 'なし', toBrochure: 3, reservation: '外部サービス', isSelf: true },
  { school: 'A 女子進学校（首都圏）', toBriefing: 2, persistentLink: 'あり', toBrochure: 1, reservation: '外部サービス' },
  { school: 'B 共学進学校（首都圏）', toBriefing: 2, persistentLink: 'あり', toBrochure: 1, reservation: '外部サービス' },
  { school: 'C 共学中堅校（東北）', toBriefing: 2, persistentLink: 'あり', toBrochure: 2, reservation: '学校独自' },
  { school: 'D 男子中堅校（首都圏）', toBriefing: 2, persistentLink: 'なし', toBrochure: 2, reservation: '外部サービス' },
  { school: 'E 共学附属校（首都圏）', toBriefing: 2, persistentLink: 'あり', toBrochure: 1, reservation: '外部サービス' },
  { school: 'F 共学附属校（関西）', toBriefing: 2, persistentLink: 'なし', toBrochure: 1, reservation: '学校独自' },
];

/** 03 MS-04 更新の実態 */
export const DEMO_UPDATE_REALITY: { aspect: string; note?: string; self: string; peers: string }[] = [
  {
    aspect: '行事の実施から公開まで',
    note: '中央値',
    self: '12日',
    peers:
      '海外研修の様子を8日間連続で日次更新した例、オープンスクールの報告を実施の翌営業日に公開した例が確認できました。',
  },
  {
    aspect: 'お知らせのカテゴリ数',
    self: '0',
    peers:
      '「部活動報告」「留学レポート」「国際交流ニュース」「メディア掲載」「外部イベント出展情報」「事務室からのお知らせ」など8分類で運用している例。別の学校では5タブに分けています。',
  },
  {
    aspect: '直近90日の更新',
    note: '内訳',
    self: '12件（うち事務連絡 9）',
    peers: '入試関連・学校行事・課外活動を独立したタブに分け、事務連絡がトップに並ばない構成にしている例が複数。',
  },
  {
    aspect: '自校の露出の報告',
    self: '0件',
    peers: '受験情報誌に取材された、外部フェアに出展する、といった情報も新着として発信している例。活動量の証明として機能します。',
  },
];

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
