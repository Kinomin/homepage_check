/**
 * 01 サマリー・02 欠落マップの集計ロジック（handoff.md 5章）。
 *
 * 設計原則1「計測と解釈を分離する」に従い、ここには機械判定の集計のみを置く。
 * LLM の解釈はここを通さない。
 *
 * 設計原則4「取得できなかったことを『情報がない』と表示しない」に従い、
 * `unknown` を含む項目は欠落の集計から必ず除外する。
 * これを怠ると、取得失敗が「他校にあってお宅にない」という誤った指摘に化ける。
 */

import {
  isMeasured,
  isPresent,
  type Action,
  type ActionSource,
  type Criterion,
  type Level,
} from '../types';

/** セルをクリックしたときに出す根拠（判定理由＋使用URL） */
export interface CellEvidence {
  text: string;
  /** 判定に使ったページ */
  source: string;
}

/** 1項目ぶんの、自校＋比較校の判定結果 */
export interface GapRow {
  criterion: Criterion;
  /** [0] が自校、[1..] が比較校（列の並びは schools と一致させる） */
  levels: Level[];
  /** 列ごとの根拠。levels と同じ並び。 */
  evidence?: (CellEvidence | null)[];
}

export function selfLevel(row: GapRow): Level {
  return row.levels[0];
}

export function competitorLevels(row: GapRow): Level[] {
  return row.levels.slice(1);
}

/** 本校にない情報（走査できた結果として「ない」と分かったものだけ） */
export function isAbsentAtSelf(row: GapRow): boolean {
  return selfLevel(row) === 'none';
}

/**
 * 比較校すべてが公開していて、本校にない情報。01 のヒーロー数値。
 *
 * 判定：自校が `none` かつ、比較校が全校とも公開している（full/mid/thin）。
 * `unknown`（走査失敗）はもちろん、`n/a`（判定対象外）を含む項目もこの集計から外す。
 * n/a を「公開している」側に数えると、系列大学を持たない比較校が
 * 「公開済み」として扱われ、誤った指摘になるため。
 */
export function isAbsentAtSelfButAllCompetitorsHave(row: GapRow): boolean {
  const competitors = competitorLevels(row);
  if (competitors.length === 0) return false;
  return isAbsentAtSelf(row) && competitors.every(isPresent);
}

/**
 * 本校が比較校より整っている情報（SM-01）。
 * 自校が full かつ、走査できた比較校のうち1校以上が full 未満。
 * `unknown` の比較校は「本校が上回る」根拠にしない。
 */
export function isSelfStronger(row: GapRow): boolean {
  if (selfLevel(row) !== 'full') return false;
  return competitorLevels(row).some((l) => isMeasured(l) && l !== 'full');
}

/** 上回っている比較校数（「比較4校中N校は本校より掲載量が少ない」の N） */
export function weakerCompetitorCount(row: GapRow): number {
  return competitorLevels(row).filter((l) => isMeasured(l) && l !== 'full').length;
}

/** 一部の比較校が公開していて本校にない項目（07 レポートの2つ目の表） */
export function isAbsentAtSelfAndSomeCompetitorsHave(row: GapRow): boolean {
  if (!isAbsentAtSelf(row)) return false;
  const competitors = competitorLevels(row);
  const have = competitors.filter(isPresent).length;
  return have > 0 && !competitors.every(isPresent);
}

export function competitorsWithInfo(row: GapRow): { have: number; measured: number } {
  const competitors = competitorLevels(row);
  return {
    have: competitors.filter(isPresent).length,
    measured: competitors.filter(isMeasured).length,
  };
}

/** 02 のフィルタ。選択肢はこのキーから生成する（handoff.md 10章-2）。 */
export const GAP_FILTERS = ['all', 'absent', 'allhave', 'strong'] as const;
export type GapFilter = (typeof GAP_FILTERS)[number];

export const GAP_FILTER_LABEL: Record<GapFilter, string> = {
  all: '全31項目',
  absent: '本校にない情報',
  allhave: '4校すべてにあり、本校になし',
  strong: '本校が上回る項目',
};

export function matchesGapFilter(row: GapRow, filter: GapFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'absent':
      return isAbsentAtSelf(row);
    case 'allhave':
      return isAbsentAtSelfButAllCompetitorsHave(row);
    case 'strong':
      return isSelfStronger(row);
  }
}

export interface GapSummary {
  /** 比較校すべてが公開していて本校にない項目 */
  absentEverywhereElse: GapRow[];
  /** 本校が上回る項目 */
  strengths: GapRow[];
  /** 走査できなかった項目（欠落には数えないが、件数は開示する） */
  unknownRows: GapRow[];
  /** 判定対象外の項目 */
  notApplicableRows: GapRow[];
  totalCriteria: number;
}

export function summarizeGap(rows: GapRow[]): GapSummary {
  return {
    absentEverywhereElse: rows.filter(isAbsentAtSelfButAllCompetitorsHave),
    strengths: rows.filter(isSelfStronger),
    unknownRows: rows.filter((r) => r.levels.some((l) => l === 'unknown')),
    notApplicableRows: rows.filter((r) => selfLevel(r) === 'n/a'),
    totalCriteria: rows.length,
  };
}

/* ===== 指摘件数の内訳（SM-03） ===== */

export interface ActionBreakdownRow {
  source: ActionSource;
  total: number;
  highPriority: number;
  lowDifficulty: number;
}

export function actionBreakdown(actions: Action[], sources: readonly ActionSource[]): ActionBreakdownRow[] {
  return sources
    .map((source) => {
      const rows = actions.filter((a) => a.source === source);
      return {
        source,
        total: rows.length,
        highPriority: rows.filter((a) => a.priority === 'high').length,
        lowDifficulty: rows.filter((a) => a.difficulty === 'low').length,
      };
    })
    .filter((r) => r.total > 0);
}

/**
 * 01 SM-04「優先度が高く、難易度の低いもの」上位5件。
 * 06 と同じ actions を参照する（対応済みトグルの状態を共有するため）。
 */
export function topQuickWins(actions: Action[], limit = 5): Action[] {
  const priorityRank = { high: 0, mid: 1, low: 2 } as const;
  const difficultyRank = { low: 0, mid: 1, high: 2 } as const;
  return [...actions]
    .sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        difficultyRank[a.difficulty] - difficultyRank[b.difficulty] ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}

export function doneCount(actions: Action[]): number {
  return actions.filter((a) => a.status === 'done').length;
}
