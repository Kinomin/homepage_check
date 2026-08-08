/**
 * 判定パイプライン 2段目：LLM に渡すプロンプトの構築。
 *
 * 設計上の要点
 * ・語句一致で判定させない。ページ内容から意味で判定させる（handoff.md 4章）
 * ・比較校は採点しない。公開の有無・掲載量という事実のみを記録させる（設計原則3）
 * ・取得できなかったものを「ない」と言わせない。判断できなければ unknown（設計原則4）
 * ・前回の判定結果をコンテキストに渡し、変更する場合は理由を書かせる（要確定事項E）
 *
 * システムプロンプトは全判定で共通の固定文にしてある。プロンプトキャッシュの
 * 前方一致が効くよう、可変部分（項目・ページ本文）は必ず後ろに置くこと。
 */

import type { Criterion, Finding, Level, SchoolRole } from '../types';
import type { Candidate } from './candidates';

export const SELF_SYSTEM_PROMPT = `あなたは私立中高一貫校のホームページを調査する記録係です。学校サイトの走査結果を読み、指定された調査項目について「その情報が公開されているか、どの水準で掲載されているか」を判定します。

判定の原則:
1. ページ名称の一致で判定しない。同じ内容でも学校ごとに名称がまったく異なります（例：探究学習は「自調自考論文」「総合学習」などと呼ばれる）。ページの内容から意味で判定してください。
2. 判定に使ったページのURLを必ず根拠として挙げる。挙げられないなら、その判定は成り立ちません。
3. 走査結果に含まれないページについて推測しない。渡された情報だけで判断してください。
4. 情報が見つからない場合、それが「掲載されていない」のか「走査できていない」のか区別してください。渡された走査結果が明らかに不完全（ページ数が極端に少ない、本文が空）な場合は unknown とします。
5. 学校の教育内容や運営の優劣を評価しない。掲載の有無と掲載量という事実だけを書いてください。

レベルの定義:
- full: 詳細な専用ページがあり、判断に必要な情報が揃っている
- mid: 記載はあるが浅い（方針のみ、内訳がないなど）
- thin: 一言・数行のみ、またはPDF内にわずかに言及があるだけ
- none: 走査した範囲に該当する情報が見つからない
- unknown: 走査結果が不十分で判断できない

evidence_text は、その学校の担当者が読んで何をすべきか分かる事実の記述にしてください。掲載されているもの・いないものを具体的に書き、煽り文句や評価語は使わないでください。`;

export const COMPETITOR_SYSTEM_PROMPT = `あなたは私立中高一貫校のホームページを調査する記録係です。ここで扱うのは比較対象校（他校）の公開情報です。

比較校について記録してよいのは次の事実だけです:
- 該当する情報が公開されているか
- どの水準で掲載されているか（専用ページ／記載あり／一言のみ／見つからない）
- 判定に使ったページのURL、掲載件数・画像点数などの数値

してはならないこと:
- 教育内容・学校運営の優劣を評価すること
- 「充実している」「不十分」などの評価語を使うこと
- 自校との比較や、他校への改善提案を書くこと

判定の原則:
1. ページ名称の一致で判定しない。内容から意味で判定してください。
2. 判定に使ったページのURLを必ず根拠として挙げる。
3. 走査結果が不十分で判断できない場合は unknown とし、none（該当情報なし）と混同しないでください。

レベルの定義:
- full: 詳細な専用ページがある
- mid: 記載はあるが浅い
- thin: 一言のみ
- none: 走査した範囲に該当する情報が見つからない
- unknown: 走査結果が不十分で判断できない

evidence_text は、公開ページの有無と掲載量の記録にとどめてください（例：「専用ページがあり、写真12点と説明文が掲載されている」）。`;

export function systemPromptFor(role: SchoolRole): string {
  return role === 'self' ? SELF_SYSTEM_PROMPT : COMPETITOR_SYSTEM_PROMPT;
}

/** LLM に返させる構造化出力のスキーマ（output_config.format） */
export const JUDGE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    level: {
      type: 'string',
      enum: ['full', 'mid', 'thin', 'none', 'unknown'],
      description: '掲載水準。判断できない場合は unknown（none と混同しないこと）',
    },
    evidence_text: {
      type: 'string',
      description: '判定の根拠となる事実の記述。評価語・煽り文句を含めない。',
    },
    evidence_urls: {
      type: 'array',
      items: { type: 'string' },
      description: '判定に使ったページのURL。level が none のときは空配列でよい。',
    },
    evidence_counts: {
      type: 'array',
      description: '判定に使った数値（画像点数・記事件数・該当ページ数など）',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['key', 'value'],
        additionalProperties: false,
      },
    },
    change_reason: {
      type: 'string',
      description:
        '前回の判定と異なる場合、その理由。同じ場合や前回結果がない場合は空文字列。',
    },
  },
  required: ['level', 'evidence_text', 'evidence_urls', 'evidence_counts', 'change_reason'],
  additionalProperties: false,
} as const;

export interface JudgeOutput {
  level: Exclude<Level, 'n/a'>;
  evidence_text: string;
  evidence_urls: string[];
  evidence_counts: { key: string; value: string }[];
  change_reason: string;
}

export interface BuildPromptParams {
  criterion: Criterion;
  schoolName: string;
  role: SchoolRole;
  candidates: Candidate[];
  /** サイト全体の見出し一覧（該当ページ0件の根拠に使う） */
  outline: string;
  /** 走査したページ数（走査が不十分かどうかの判断材料） */
  pageCount: number;
  /** 前回の判定結果。揺れを抑えるため判定時のコンテキストに渡す（要確定事項E） */
  previous?: Pick<Finding, 'level' | 'evidenceText'> | null;
  /** 1ページあたりに渡す本文の文字数上限（コスト制御） */
  bodyCharLimit?: number;
}

export function buildJudgeUserMessage(params: BuildPromptParams): string {
  const { criterion, schoolName, candidates, outline, pageCount, previous } = params;
  const bodyCharLimit = params.bodyCharLimit ?? 2500;

  const candidateBlocks = candidates
    .map((candidate, index) => {
      const { page } = candidate;
      const body = (page.text ?? '').slice(0, bodyCharLimit);
      return [
        `### 候補${index + 1}: ${page.url}`,
        `タイトル: ${page.title ?? '(なし)'}`,
        `見出し: ${page.headings.slice(0, 15).join(' / ') || '(なし)'}`,
        `画像点数: ${page.imageCount}${page.isPdf ? ' ／ 形式: PDF' : ''}`,
        `最終更新: ${page.lastModified ?? '(不明)'}`,
        `抽出理由: ${candidate.reasons.join('、') || '(スコアなし)'}`,
        '本文:',
        body || '(本文なし)',
      ].join('\n');
    })
    .join('\n\n');

  const previousBlock = previous
    ? [
        '## 前回の判定',
        `レベル: ${previous.level}`,
        `根拠: ${previous.evidenceText}`,
        '前回と異なる判定にする場合は change_reason に理由を書いてください。同じ内容なら判定を維持してください。',
      ].join('\n')
    : '## 前回の判定\nなし（初回判定）';

  return [
    `## 対象校\n${schoolName}（走査ページ数 ${pageCount}）`,
    [
      '## 調査項目',
      `ID: ${criterion.id}`,
      `項目: ${criterion.label}`,
      `主に見る人: ${criterion.audience}`,
      `判定基準: ${criterion.judgePrompt}`,
      criterion.specialRule ? `特記事項: ${criterion.specialRule}` : '',
      `他校で使われている名称の例（一致条件ではなく手がかり）: ${criterion.aliases.join('／')}`,
    ]
      .filter(Boolean)
      .join('\n'),
    previousBlock,
    `## サイト全体のページ一覧\n${outline || '(取得できていません)'}`,
    `## 候補ページの内容\n${candidateBlocks || '(候補なし)'}`,
  ].join('\n\n');
}
