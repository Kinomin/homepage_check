/**
 * 05 ペルソナ仮説（handoff.md 5章 05）。
 *
 * この画面は 02・03・04 の**解釈層**であり、計測結果ではない。
 * 生成物は必ず「サイトの記載内容から自動生成した仮説」と明示し、
 * 各仮説に findings の criterion_id を紐付けて根拠を表示する。
 *
 * **この画面を「分析結果」として提示しないこと。**
 * 会議で反発を招き、製品全体の信用を損なう（handoff.md 5章 05）。
 * そのため画面には検証用アンケート設問の生成を併置する。
 */

import type { CriterionId } from '../types';

export const PERSONA_STAGES = ['e6', 'j3', 'parent'] as const;
export type PersonaStage = (typeof PERSONA_STAGES)[number];

export const PERSONA_GENDERS = ['f', 'm'] as const;
export type PersonaGender = (typeof PERSONA_GENDERS)[number];

export const PERSONA_STAGE_LABEL: Record<PersonaStage, string> = {
  e6: '小学6年生',
  j3: '中学3年生',
  parent: '保護者',
};

/** 保護者は「母親／父親」表記に切り替える（handoff.md 5章 05） */
export function genderLabel(stage: PersonaStage, gender: PersonaGender): string {
  if (stage === 'parent') return gender === 'f' ? '母親' : '父親';
  return gender === 'f' ? '女子' : '男子';
}

export const PERSONA_STAGE_CONTEXT: Record<PersonaStage, string> = {
  e6: '中学受験を検討している小学6年生本人。学校生活が想像できるかを見ている。',
  j3: '高校からの入学を検討している中学3年生本人。中入生との関係や、高校3年間の過ごし方を気にしている。',
  parent: '受験生の保護者（40代）。最終的な意思決定者で、費用・進路・サポート体制を見ている。',
};

export function personaKey(stage: PersonaStage, gender: PersonaGender): string {
  return `${stage}-${gender}`;
}

/** 仮説1件。必ず根拠となる調査項目に紐付ける。 */
export const HYPOTHESIS_KINDS = ['support', 'gap', 'check'] as const;
export type HypothesisKind = (typeof HYPOTHESIS_KINDS)[number];

export const HYPOTHESIS_KIND_LABEL: Record<HypothesisKind, string> = {
  support: '支持',
  gap: '欠落',
  check: '要確認',
};

export interface Hypothesis {
  kind: HypothesisKind;
  /** 読み取りの内容 */
  body: string;
  /**
   * 根拠となった調査項目。空にしてはならない。
   * 根拠のない読み取りは、この画面が最も嫌われる形（handoff.md 5章 05）。
   */
  criterionIds: CriterionId[];
}

export interface Persona {
  stage: PersonaStage;
  gender: PersonaGender;
  /** ペルソナの一人称の言葉（仮説であることを前提に読む） */
  quote: string;
  hypotheses: Hypothesis[];
  /** 生成に使った走査の日時 */
  generatedAt: string;
}

/** 検証用アンケート設問（この画面を「分析結果」として出さないための装置） */
export interface SurveyQuestion {
  no: string;
  text: string;
  /** 選択肢がある場合 */
  options?: string[];
}
