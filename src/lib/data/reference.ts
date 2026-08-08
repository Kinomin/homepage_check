/**
 * 調査項目の設計に使った実在6校で確認できた運用（handoff.md 2章）。
 *
 * これはデモデータではない。製品の参照資料として、本番でもそのまま出す。
 * 「他校ではこうしている」という記録であり、比較校の採点でもない
 * （比較校＝組織が登録した学校とは別物。ここに出るのは設計に使った6校）。
 *
 * 自校側の値はここに置かない。自校の値は走査（`measurements`）から取り、
 * 取れていないものは未計測として出す。サンプル値で埋めない。
 */

/** 03 MS-01 実在6校の標準形（説明会の申込までの経路） */
export interface PathStep {
  label: string;
  note?: string;
  pain?: boolean;
  end?: boolean;
}

export const REFERENCE_PATH: { clicks: number; steps: PathStep[] } = {
  clicks: 2,
  steps: [
    { label: 'トップページ', note: '常設バナー、またはナビのドロップダウンから直接' },
    { label: '説明会ページ', note: '冒頭に予約ボタン。日程ごとに個別のボタン' },
    { label: '外部予約サイト' },
    { label: '申込完了', end: true },
  ],
};

/** 03 MS-02 実在6校の導線（学校名は伏せる） */
export const REFERENCE_COMPARISON: {
  school: string;
  toBriefing: number;
  persistentLink: string;
  toBrochure: number;
  reservation: string;
}[] = [
  { school: 'A 女子進学校（首都圏）', toBriefing: 2, persistentLink: 'あり', toBrochure: 1, reservation: '外部サービス' },
  { school: 'B 共学進学校（首都圏）', toBriefing: 2, persistentLink: 'あり', toBrochure: 1, reservation: '外部サービス' },
  { school: 'C 共学中堅校（東北）', toBriefing: 2, persistentLink: 'あり', toBrochure: 2, reservation: '学校独自' },
  { school: 'D 男子中堅校（首都圏）', toBriefing: 2, persistentLink: 'なし', toBrochure: 2, reservation: '外部サービス' },
  { school: 'E 共学附属校（首都圏）', toBriefing: 2, persistentLink: 'あり', toBrochure: 1, reservation: '外部サービス' },
  { school: 'F 共学附属校（関西）', toBriefing: 2, persistentLink: 'なし', toBrochure: 1, reservation: '学校独自' },
];

/**
 * 03 MS-04 更新の実態。
 *
 * 自校の欄は `measurementKey` の計測値から出す。計測値が無い観点は
 * `measurementKey: null` とし、自校の欄を未計測として出す。
 */
export const REFERENCE_UPDATE_PRACTICE: {
  aspect: string;
  note?: string;
  measurementKey: string | null;
  peers: string;
}[] = [
  {
    aspect: '行事の実施から公開まで',
    note: '中央値',
    measurementKey: 'm06',
    peers:
      '海外研修の様子を8日間連続で日次更新した例、オープンスクールの報告を実施の翌営業日に公開した例が確認できました。',
  },
  {
    aspect: 'お知らせのカテゴリ数',
    measurementKey: 'm05',
    peers:
      '「部活動報告」「留学レポート」「国際交流ニュース」「メディア掲載」「外部イベント出展情報」「事務室からのお知らせ」など8分類で運用している例。別の学校では5タブに分けています。',
  },
  {
    aspect: '直近90日の更新',
    note: '更新日を取得できたページの件数',
    measurementKey: 'm03',
    peers:
      '入試関連・学校行事・課外活動を独立したタブに分け、事務連絡がトップに並ばない構成にしている例が複数。',
  },
  {
    aspect: '自校の露出の報告',
    measurementKey: null,
    peers:
      '受験情報誌に取材された、外部フェアに出展する、といった情報も新着として発信している例。活動量の証明として機能します。',
  },
];
