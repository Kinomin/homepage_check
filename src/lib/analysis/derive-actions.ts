/**
 * 06 改善アクションの導出（handoff.md 5章 06）。
 *
 * 走査したのに改善アクションが1件も出ない、という状態を作らないための層。
 * 判定結果（findings）から機械的に導く。ここで LLM は使わない
 * （設計原則1「計測と解釈を分離する」）。
 *
 * 優先度は handoff.md の定義表をそのままコードにしている：
 *
 *   高 … 比較校すべてが公開
 *   中 … 一部の比較校が公開
 *   低 … 整備済みだが改善の余地
 *
 * 難易度はデータから導けない。「校内でどこまで話を通す必要があるか」で決まり、
 * それは学校の体制の話であってサイトの記載からは分からない。
 * 分類ごとの既定値を置き、実際の体制に合わせて調整できるようにしてある。
 *
 * 文案は導出しない。学校の実際の日程・施設・呼称が必要で、
 * こちらで埋めると事実でない文章を渡すことになる。
 * 画面側は文案が空のときその欄を出さない（空の見出しを見せない）。
 */

import type { ActionSource, CriterionCategory, Difficulty, Level, Priority } from '../types';
import {
  competitorsWithInfo,
  isAbsentAtSelf,
  isAbsentAtSelfAndSomeCompetitorsHave,
  isAbsentAtSelfButAllCompetitorsHave,
  selfLevel,
  type GapRow,
} from './summary';

/**
 * 分類ごとの既定の難易度と想定担当。
 *
 * 難易度は作業量ではなく「どこまで話を通す必要があるか」で決める（handoff.md 5章 06）。
 * 学校で施策が止まる主因は工数ではなく合意形成のため。
 */
const CATEGORY_DEFAULTS: Record<
  CriterionCategory,
  { difficulty: Difficulty; owner: string; note: string }
> = {
  A: {
    difficulty: 'high',
    owner: '管理職・広報部',
    note: '理念や方針の記述は管理職の確認を経る必要がある',
  },
  B: {
    difficulty: 'mid',
    owner: '教務部・広報部',
    note: '教育内容の説明は担当分掌の確認が必要',
  },
  C: { difficulty: 'low', owner: '広報部', note: '学校生活の紹介は広報部の判断で完結しやすい' },
  D: { difficulty: 'mid', owner: '進路指導部・広報部', note: '進路の数字は進路指導部が持っている' },
  E: { difficulty: 'mid', owner: '事務室・広報部', note: '費用は事務室の確認が必要' },
  F: { difficulty: 'low', owner: '広報部', note: '入試広報の導線は広報部の所管' },
  G: { difficulty: 'low', owner: '広報部', note: '発信の運用は広報部で変えられる' },
};

/** DB に保存する分（文言は保存しない：`actions` は状態と分類のみを持つ） */
export interface DerivedAction {
  /** 走査をまたいで同じ施策を指す鍵。これで対応済み状態が引き継がれる */
  actionKey: string;
  priority: Priority;
  difficulty: Difficulty;
  source: ActionSource;
  sourceCriterionId: string;
}

/** 画面に出す分（保存した行から組み立て直す。事実だけで構成する） */
export interface DerivedActionText {
  title: string;
  summary: string;
  why: string;
  how: string[];
  owner: string;
  sourceLabel: string;
  qa: { question: string; answer: string }[];
}

/** 走査をまたいで同じ施策を指す鍵 */
export function actionKeyFor(criterionId: string): string {
  return `gap-${criterionId}`;
}

/** 保存済みの行から本文を引くための逆変換 */
export function actionKeyToCriterionId(actionKey: string): string | null {
  const match = /^gap-(.+)$/.exec(actionKey);
  return match ? match[1] : null;
}

/**
 * 掲載が足りていない項目から改善アクションを導く。
 *
 * 対象にするのは「本校に無い（none）」か「記載が薄い（thin）」項目だけ。
 * `unknown`（走査できなかった）と `n/a`（該当なし）は対象にしない。
 * 取得できなかったことを改善すべき欠落として並べないため（handoff.md 4章）。
 */
export function deriveActions(rows: GapRow[]): DerivedAction[] {
  const actions: DerivedAction[] = [];

  for (const row of rows) {
    if (!isActionable(row)) continue;
    actions.push({
      actionKey: actionKeyFor(row.criterion.id),
      priority: derivePriority(row),
      difficulty: CATEGORY_DEFAULTS[row.criterion.category].difficulty,
      source: 'gap' satisfies ActionSource,
      sourceCriterionId: row.criterion.id,
    });
  }

  // 優先度の高い順に並べる（同じ優先度なら難易度の低い順＝着手しやすい順）
  const priorityOrder: Priority[] = ['high', 'mid', 'low'];
  const difficultyOrder: Difficulty[] = ['low', 'mid', 'high'];
  return actions.sort(
    (a, b) =>
      priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority) ||
      difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty),
  );
}

/** 改善アクションにする対象か。none（欠落）と thin（記載が薄い）のみ。 */
export function isActionable(row: GapRow): boolean {
  return isAbsentAtSelf(row) || selfLevel(row) === 'thin';
}

/** handoff.md 5章 06 の定義表をそのまま写したもの */
export function derivePriority(row: GapRow): Priority {
  if (isAbsentAtSelfButAllCompetitorsHave(row)) return 'high';
  if (isAbsentAtSelfAndSomeCompetitorsHave(row)) return 'mid';
  // 本校に記載はあるが薄い、または比較校も公開していない
  return 'low';
}

/**
 * 画面に出す文言を組み立てる。
 *
 * 根拠（why）は数えた事実だけで書く。比較校については「何校が公開しているか」
 * しか書かない（handoff.md 4章：比較校を採点しない）。
 * 実施内容（how）は判定基準から導く。full と判定される条件がそのまま
 * 「何を載せれば足りるか」になっている。
 */
export function buildActionText(row: GapRow): DerivedActionText {
  const level = selfLevel(row);
  const { have, measured } = competitorsWithInfo(row);
  const defaults = CATEGORY_DEFAULTS[row.criterion.category];

  const facts: string[] = [];
  if (measured > 0) {
    facts.push(`比較${measured}校中${have}校が公開しています`);
  }
  facts.push(
    level === 'none'
      ? '本校では該当する記載を確認できませんでした'
      : '本校では短い言及のみで、まとまった説明を確認できませんでした',
  );

  return {
    title:
      level === 'thin'
        ? `${row.criterion.label}の記載を充実させる`
        : `${row.criterion.label}を掲載する`,
    summary: `主に${row.criterion.audience}が探す情報`,
    why: `${facts.join('。')}。`,
    how: buildHow(row, level),
    owner: defaults.owner,
    sourceLabel: `${row.criterion.id} 欠落マップ`,
    qa: [
      {
        question: `${row.criterion.label}は校内のどこが持っている情報ですか`,
        answer: `${defaults.note}ため、${defaults.owner}での確認を想定しています。実際の分掌に合わせて読み替えてください。`,
      },
    ],
  };
}

/**
 * 実施内容。判定基準（judgePrompt）が「full と判定される条件」を書いているので、
 * それをそのまま示す。こちらで作業手順を創作しない。
 */
function buildHow(row: GapRow, level: Level): string[] {
  const steps: string[] = [];

  steps.push(
    level === 'none'
      ? `${row.criterion.label}を扱うページを設ける`
      : `${row.criterion.label}の記載を1ページにまとめる`,
  );
  steps.push(`載せる内容の目安：${row.criterion.judgePrompt}`);

  if (row.criterion.aliases.length > 0) {
    // 別名は学校ごとの呼び方の例。ページ名を決めるときの参考として示す
    steps.push(`他校での呼び方の例：${row.criterion.aliases.join('／')}`);
  }
  if (row.criterion.specialRule) {
    steps.push(`注意：${row.criterion.specialRule}`);
  }
  return steps;
}
