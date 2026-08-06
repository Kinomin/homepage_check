/**
 * ドメイン型の唯一の定義元。
 *
 * handoff.md 10章-2 の教訓：分類値・タグ・ステータスなどの enum は
 * フリーテキストで持たず、Union 型（＋DB側の enum 制約）で定義する。
 * UI のフィルタ選択肢もここから動的に生成し、データ側と構造的にズレないようにする。
 */

/* ===== 判定レベル ===== */

/**
 * handoff.md 4章「レベル定義」。
 * `unknown` が最重要：走査失敗・robots 拒否・タイムアウトは `none` ではなくこれ。
 * UI では空欄＋「取得できませんでした」と表示し、欠落件数に数えない。
 */
export const LEVELS = ['full', 'mid', 'thin', 'none', 'n/a', 'unknown'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABEL: Record<Level, string> = {
  full: '詳細ページあり',
  mid: '記載はあるが浅い',
  thin: '一言のみ',
  none: '該当情報なし',
  'n/a': '判定対象外',
  unknown: '取得できませんでした',
};

/** 02 欠落マップのマーク（prototype.html の MARK 定数が正典） */
export const LEVEL_MARK: Record<Level, string> = {
  full: '●',
  mid: '◐',
  thin: '○',
  none: '—',
  'n/a': '',
  unknown: '',
};

/** 掲載量として比較可能なレベル（n/a・unknown は集計から除外する） */
export function isMeasured(level: Level): level is 'full' | 'mid' | 'thin' | 'none' {
  return level === 'full' || level === 'mid' || level === 'thin' || level === 'none';
}

/** 情報が公開されている（＝欠落ではない）と言えるか。unknown は判断しない。 */
export function isPresent(level: Level): boolean {
  return level === 'full' || level === 'mid' || level === 'thin';
}

/* ===== 調査項目 ===== */

export const CRITERION_CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type CriterionCategory = (typeof CRITERION_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<CriterionCategory, string> = {
  A: '理念・方針',
  B: '教育内容',
  C: '学校生活',
  D: '進路',
  E: '費用・安心',
  F: '入試・導線',
  G: '情報発信',
};

/** 判定対象外の条件（handoff.md 3章 criteria.applicable_when） */
export const APPLICABILITY_FLAGS = [
  'has_affiliated_university',
  'has_junior_admission',
  'has_senior_admission',
] as const;
export type ApplicabilityFlag = (typeof APPLICABILITY_FLAGS)[number];

export type CriterionId = string; // 'A1' 〜 'G3'

export interface Criterion {
  id: CriterionId;
  category: CriterionCategory;
  label: string;
  /** 主に見る人（受験生・保護者・塾） */
  audience: string;
  /** LLM に渡す判定基準。語句一致ではなく内容で判定させるための説明。 */
  judgePrompt: string;
  /** 学校ごとに異なる名称の例。判定の手がかりであり、一致条件ではない。 */
  aliases: string[];
  /** 候補ページ抽出に使う URL パスの手がかり（ルールベースの絞り込みのみに使用） */
  pathHints: string[];
  /** この条件が false の学校では n/a とする */
  applicableWhen?: ApplicabilityFlag;
  /** 特殊な判定ルールがある場合の注記（画面にも表示する） */
  specialRule?: string;
}

/* ===== 学校・組織 ===== */

export const SCHOOL_ROLES = ['self', 'competitor'] as const;
export type SchoolRole = (typeof SCHOOL_ROLES)[number];

export interface School {
  id: string;
  name: string;
  url: string;
  prefecture: string | null;
  schoolType: string | null;
  coedType: string | null;
  hasJuniorAdmission: boolean;
  hasSeniorAdmission: boolean;
  hasAffiliatedUniversity: boolean;
  robotsAllowed: boolean;
  role: SchoolRole;
  sortOrder: number;
}

/* ===== 走査 ===== */

export const SCAN_STATUSES = ['queued', 'running', 'done', 'blocked', 'failed'] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export interface Scan {
  id: string;
  schoolId: string;
  startedAt: string;
  finishedAt: string | null;
  status: ScanStatus;
  pageCount: number;
  indexedCount: number;
  imageCount: number;
  pdfOnlyCount: number;
  crawlDepth: number;
}

export interface PageRecord {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  wordCount: number;
  imageCount: number;
  imageWithoutAltCount: number;
  hasJsonLd: boolean;
  jsonLdTypes: string[];
  lastModified: string | null;
  httpStatus: number;
  isPdf: boolean;
  /**
   * 判定に渡す本文。比較校では保持しない（handoff.md 6章：
   * 比較校のページ本文をそのまま保存・再配布しない）。
   */
  text?: string;
  /** ナビゲーション階層・見出し（候補ページ抽出に使う） */
  headings: string[];
  depth: number;
}

/* ===== 判定結果 ===== */

export const JUDGED_BY = ['rule', 'llm'] as const;
export type JudgedBy = (typeof JUDGED_BY)[number];

export interface Finding {
  scanId: string;
  criterionId: CriterionId;
  level: Level;
  /** 判定理由。02 の根拠パネルにそのまま出す。 */
  evidenceText: string;
  evidenceUrls: string[];
  /** 画像点数・記事件数など、判定に使った集計値 */
  evidenceCounts: Record<string, number | string>;
  judgedBy: JudgedBy;
  judgedAt: string;
}

/* ===== 03 計測値 ===== */

/**
 * 測定方法。handoff.md 5章 MS-05「測定条件と再現性」の3段階。
 * 再現性の水準が違うものを混ぜないため、値と必ずセットで持つ。
 */
export const MEASUREMENT_METHODS = ['scan', 'operate', 'external'] as const;
export type MeasurementMethod = (typeof MEASUREMENT_METHODS)[number];

export const MEASUREMENT_METHOD_LABEL: Record<MeasurementMethod, string> = {
  scan: '走査',
  operate: '操作',
  external: '外部測定',
};

export const MEASUREMENT_REPRODUCIBILITY: Record<MeasurementMethod, string> = {
  scan: '同じ日なら完全に一致',
  operate: '経路の選び方で±1',
  external: '回線と時間帯で変動',
};

export interface Measurement {
  key: string;
  label: string;
  note: string;
  value: number;
  unit: string;
  /** 比較校の中央値 */
  median: number;
  /** バーの上限（表示用のスケール） */
  scaleMax: number;
  /** 値が小さいほど良い指標か（バーの配色に使う） */
  lowerIsBetter: boolean;
  method: MeasurementMethod;
}

/* ===== 06 改善アクション ===== */

export const PRIORITIES = ['high', 'mid', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DIFFICULTIES = ['low', 'mid', 'high'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = { high: '高', mid: '中', low: '低' };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { low: '低', mid: '中', high: '高' };

/** handoff.md 5章「優先度・難易度の定義」 */
export const PRIORITY_DEFINITION: Record<Priority, string> = {
  high: '比較4校すべてが公開／申込導線上の離脱点',
  mid: '一部の比較校が公開／間接的に影響',
  low: '整備済みだが改善の余地がある',
};

/**
 * 難易度は作業量ではなく「どこまで話を通す必要があるか」で定義する。
 * 学校で施策が止まる主因は工数ではなく合意形成のため（handoff.md 5章）。
 */
export const DIFFICULTY_DEFINITION: Record<Difficulty, string> = {
  low: '広報部の判断で完結し、素材も揃っている',
  mid: '他分掌との調整、または新規素材の作成が必要',
  high: '委員会・管理職の決裁、または外部委託が必要',
};

export const ACTION_STATUSES = ['open', 'doing', 'done', 'wontfix'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

/** 出典（どの画面で検出したか）。06 のフィルタ選択肢はこの型から生成する。 */
export const ACTION_SOURCES = ['gap', 'measurement', 'discovery', 'persona'] as const;
export type ActionSource = (typeof ACTION_SOURCES)[number];

export interface Action {
  id: string;
  title: string;
  summary: string;
  priority: Priority;
  difficulty: Difficulty;
  source: ActionSource;
  /** 根拠となった調査項目（02 由来のとき） */
  sourceCriterionId: CriterionId | null;
  /** 根拠の出典表示（例：'F6 欠落マップ'） */
  sourceLabel: string;
  status: ActionStatus;
  /** 上位に置いた根拠 */
  why: string;
  /** 実施内容 */
  how: string[];
  /** 文案 */
  copy: string;
  /** 想定担当 */
  owner: string;
  /** 照会欄の想定質問と回答（Phase2 で action_threads に置き換える） */
  qa: { question: string; answer: string }[];
}

/** 対応済みトグルの状態。01 と 06 で同じデータソースを参照する（handoff.md 5章 06）。 */
export function isDone(status: ActionStatus): boolean {
  return status === 'done';
}
