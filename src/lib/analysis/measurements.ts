/**
 * 03 導線の実測（handoff.md 5章 03）の指標定義と、走査から出せる値の算出。
 *
 * この画面は「数えた事実」しか置かない場所なので、算出できない指標には
 * 値を入れない。埋められない欄はサンプルで埋めずに「未計測」と理由を出す。
 * 架空の数値を本校の計測値として見せると、この製品の前提が崩れる。
 *
 * 手動記録（operate）と外部測定（external）は走査から出せない。
 * クリック数は実際に操作しないと分からず、表示速度は測定ツールに依存する。
 * どちらも `derivable: false` として、記録されるまで未計測のままにする。
 */

import type { Measurement, MeasurementMethod } from '../types';

export interface MeasurementDefinition {
  key: string;
  label: string;
  note: string;
  unit: string;
  /** バーの上限（表示用のスケール） */
  scaleMax: number;
  /** 値が小さいほど良い指標か */
  lowerIsBetter: boolean;
  method: MeasurementMethod;
  /** 走査から機械的に出せるか。false は記録されるまで未計測 */
  derivable: boolean;
  /** 未計測のときに画面へ出す理由 */
  unmeasuredReason: string;
}

/**
 * 指標の一覧。値は持たない（値は走査ごとに `measurements` に入る）。
 *
 * 「うち学校の様子が伝わる記事」「お知らせのカテゴリ数」「行事の実施から公開まで」は
 * 記事の内容や行事の実施日を読み取る必要があり、走査した集計値からは出せない。
 * 語句一致で数えれば形は作れるが、学校ごとに呼び方が違うため数字が信用できない
 * （設計原則2）。ここでは未計測として扱う。
 */
export const MEASUREMENT_DEFINITIONS: MeasurementDefinition[] = [
  {
    key: 'm01',
    label: 'トップページから説明会の申込完了まで',
    note: '最短経路のクリック数',
    unit: 'クリック',
    scaleMax: 6,
    lowerIsBetter: true,
    method: 'operate',
    derivable: false,
    unmeasuredReason: '実際に操作した記録が必要です',
  },
  {
    key: 'm02',
    label: '学校案内を読み始めるまで',
    note: 'その場で読める形式に到達するまで',
    unit: 'クリック',
    scaleMax: 6,
    lowerIsBetter: true,
    method: 'operate',
    derivable: false,
    unmeasuredReason: '実際に操作した記録が必要です',
  },
  {
    key: 'm03',
    label: '直近90日の更新件数',
    note: '更新日を取得できたページの件数',
    unit: '件',
    scaleMax: 60,
    lowerIsBetter: false,
    method: 'scan',
    derivable: true,
    unmeasuredReason: '',
  },
  {
    key: 'm04',
    label: 'うち学校の様子が伝わる記事',
    note: '事務連絡を除いた件数',
    unit: '件',
    scaleMax: 40,
    lowerIsBetter: false,
    method: 'scan',
    derivable: false,
    unmeasuredReason: '記事の内容の読み取りが必要です',
  },
  {
    key: 'm05',
    label: 'お知らせのカテゴリ数',
    note: '種類ごとに分けているか',
    unit: '分類',
    scaleMax: 10,
    lowerIsBetter: false,
    method: 'scan',
    derivable: false,
    unmeasuredReason: '分類の呼び方が学校ごとに異なるため機械では数えられません',
  },
  {
    key: 'm06',
    label: '行事の実施から公開までの日数',
    note: '中央値。小さいほど速い',
    unit: '日',
    scaleMax: 20,
    lowerIsBetter: true,
    method: 'scan',
    derivable: false,
    unmeasuredReason: '行事の実施日の読み取りが必要です',
  },
  {
    key: 'm07',
    label: '掲載写真の点数',
    note: 'サイト全体（バナー・アイコンを含む）',
    unit: '点',
    scaleMax: 600,
    lowerIsBetter: false,
    method: 'scan',
    derivable: true,
    unmeasuredReason: '',
  },
  {
    key: 'm08',
    label: '動画の本数',
    note: '埋め込み・リンクの合計',
    unit: '本',
    scaleMax: 14,
    lowerIsBetter: false,
    method: 'scan',
    derivable: false,
    unmeasuredReason: '走査では数えていません',
  },
  {
    key: 'm09',
    label: '部活動の個別ページ数',
    note: '部ごとにページがあるか',
    unit: 'ページ',
    scaleMax: 30,
    lowerIsBetter: false,
    method: 'scan',
    derivable: false,
    unmeasuredReason: 'ページ名から機械的には判別できません',
  },
  {
    key: 'm10',
    label: 'スマートフォンでの表示完了時間',
    note: '測るたびに値が変わります',
    unit: '秒',
    scaleMax: 6,
    lowerIsBetter: true,
    method: 'external',
    derivable: false,
    unmeasuredReason: '外部の測定ツールの結果が必要です',
  },
];

export const MEASUREMENT_DEFINITION_BY_KEY: Record<string, MeasurementDefinition> =
  Object.fromEntries(MEASUREMENT_DEFINITIONS.map((definition) => [definition.key, definition]));

/** 直近の更新として数える期間 */
export const RECENT_UPDATE_DAYS = 90;

export interface DerivedMeasurement {
  key: string;
  value: number;
  unit: string;
  method: MeasurementMethod;
}

/**
 * 走査結果から出せる指標だけを算出する。
 *
 * 更新件数は `Last-Modified` を返したページだけを数える。返さないページは
 * 「更新がない」ではなく「更新日が分からない」なので、0 として数えない
 * （走査できなかったことを事実として扱わない：設計原則4）。
 */
export function deriveMeasurements(
  input: { imageCount: number; pageLastModified: (string | null)[] },
  now: Date,
): DerivedMeasurement[] {
  const threshold = now.getTime() - RECENT_UPDATE_DAYS * 24 * 60 * 60 * 1000;
  const recentUpdates = input.pageLastModified.filter((value) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time >= threshold && time <= now.getTime();
  }).length;

  return [
    { key: 'm03', value: recentUpdates, unit: '件', method: 'scan' },
    { key: 'm07', value: input.imageCount, unit: '点', method: 'scan' },
  ];
}

/**
 * 画面に渡す形に組み立てる。
 *
 * 定義の一覧が主で、値は乗るなら乗る。値のない指標も未計測として並べる
 * （黙って消すと、測っていないのか測って良かったのか区別できない）。
 */
export function composeMeasurements(
  selfValues: Map<string, { value: number; unit: string; method: MeasurementMethod }>,
  competitorValues: Map<string, number[]>,
): Measurement[] {
  return MEASUREMENT_DEFINITIONS.map((definition) => {
    const self = selfValues.get(definition.key);
    return {
      key: definition.key,
      label: definition.label,
      note: definition.note,
      value: self?.value ?? null,
      unit: self?.unit ?? definition.unit,
      median: median(competitorValues.get(definition.key) ?? []),
      scaleMax: definition.scaleMax,
      lowerIsBetter: definition.lowerIsBetter,
      method: self?.method ?? definition.method,
      unmeasuredReason: self ? '' : definition.unmeasuredReason,
    };
  });
}

/** 比較校の中央値。値が1つも無ければ null（0 と区別する） */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
}
