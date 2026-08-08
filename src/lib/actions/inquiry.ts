/**
 * 06 改善アクションの照会（handoff.md 5章 06）。
 *
 * 学校の事情を入力すると、その施策の位置づけを再評価した回答を返す。
 * 会話は action_threads に保存する。
 *
 * 守ること
 * ・所要時間・期限を出さない。学校ごとに体制が違いすぎ、こちらが決めてよい数字ではない
 * ・比較校を採点しない。公開の有無という事実だけを根拠にする
 * ・優先度・難易度は「どこまで話を通す必要があるか」の定義に沿って語る
 * ・事情を聞いて位置づけが変わるなら変わると言う。無理に元の結論を守らない
 */

import Anthropic from '@anthropic-ai/sdk';

import { CRITERIA_BY_ID } from '../analysis/criteria';
import type { GapRow } from '../analysis/summary';
import { env, isAnthropicConfigured } from '../env';
import { DEFAULT_SETTINGS, type JudgeEffort } from '../settings';
import {
  DIFFICULTY_DEFINITION,
  DIFFICULTY_LABEL,
  PRIORITY_DEFINITION,
  PRIORITY_LABEL,
  isPresent,
  type Action,
} from '../types';

export const INQUIRY_SYSTEM_PROMPT = `あなたは私立中高一貫校の入試広報担当者から、改善施策についての相談を受ける立場です。学校側から「校内の事情」を伝えられたとき、その施策の位置づけがどう変わるかを答えます。

答えるときに守ること:
1. 所要時間・期限・工数の見積もりを出さない。学校ごとに体制が大きく異なり、外部が決めてよい数字ではありません。
2. 優先度は「誰の判断に影響するか」、難易度は「校内でどこまで話を通す必要があるか」で語る。作業量では語らない。
3. 比較校について書けるのは「公開しているかどうか」という事実だけ。教育内容や運営の優劣を評価しない。
4. 伝えられた事情によって位置づけが変わるなら、変わるとはっきり言う。元の結論を守るために事情を軽く扱わない。
5. 断定できないことは断定しない。校内でしか分からないことは、担当者が確認すべき点として示す。
6. 相手は学校の広報担当者です。責める書き方をしない。

回答は3〜5文程度。前置きを書かず、結論から書いてください。`;

export const INQUIRY_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    answer: {
      type: 'string',
      description: '事情を踏まえた回答。3〜5文。所要時間・期限は含めない。',
    },
    revised_priority: {
      type: 'string',
      enum: ['high', 'mid', 'low', 'unchanged'],
      description: '事情を踏まえた優先度。変わらない場合は unchanged。',
    },
    revised_difficulty: {
      type: 'string',
      enum: ['low', 'mid', 'high', 'unchanged'],
      description: '事情を踏まえた難易度。変わらない場合は unchanged。',
    },
    confirm_in_school: {
      type: 'array',
      items: { type: 'string' },
      description: '校内で確認すべき点（あれば）。無ければ空配列。',
    },
  },
  required: ['answer', 'revised_priority', 'revised_difficulty', 'confirm_in_school'],
  additionalProperties: false,
} as const;

export interface InquiryOutput {
  answer: string;
  revised_priority: 'high' | 'mid' | 'low' | 'unchanged';
  revised_difficulty: 'low' | 'mid' | 'high' | 'unchanged';
  confirm_in_school: string[];
}

export interface InquiryAnswer {
  body: string;
  /** 位置づけが変わる場合のみ入る */
  revisedPriority: Action['priority'] | null;
  revisedDifficulty: Action['difficulty'] | null;
  confirmInSchool: string[];
  /** 回答の根拠に使った事実 */
  basis: string;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

/**
 * 回答の根拠になる事実。
 * 比較校については公開しているかどうかだけを渡す（評価文の材料を与えない）。
 */
export function inquiryBasis(action: Action, gapRows: GapRow[]): string {
  const lines: string[] = [
    `施策：${action.title}（${action.summary}）`,
    `現在の優先度：${PRIORITY_LABEL[action.priority]}（${PRIORITY_DEFINITION[action.priority]}）`,
    `現在の難易度：${DIFFICULTY_LABEL[action.difficulty]}（${DIFFICULTY_DEFINITION[action.difficulty]}）`,
    `上位に置いた根拠：${action.why}`,
  ];

  if (action.sourceCriterionId) {
    const row = gapRows.find((r) => r.criterion.id === action.sourceCriterionId);
    if (row) {
      const competitors = row.levels.slice(1);
      const published = competitors.filter(isPresent).length;
      const criterion = CRITERIA_BY_ID[action.sourceCriterionId];
      lines.push(
        `関連する調査項目：${criterion?.id} ${criterion?.label}`,
        `　本校の掲載状況：${row.levels[0]}`,
        `　比較校の公開状況：${competitors.length}校中${published}校が公開`,
      );
    }
  }

  return lines.join('\n');
}

export async function answerInquiry(params: {
  action: Action;
  question: string;
  gapRows: GapRow[];
  /** これまでのやり取り（新しい順ではなく時系列） */
  history?: { role: 'user' | 'assistant'; body: string }[];
  effort?: JudgeEffort;
}): Promise<InquiryAnswer | null> {
  if (!isAnthropicConfigured()) return null;

  const basis = inquiryBasis(params.action, params.gapRows);
  const historyText = (params.history ?? [])
    .map((entry) => `${entry.role === 'user' ? '学校' : '回答'}：${entry.body}`)
    .join('\n');

  const userMessage = [
    `## 施策の状況\n${basis}`,
    historyText ? `## これまでのやり取り\n${historyText}` : '',
    `## 学校から伝えられた事情\n${params.question}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await getClient().messages.create({
      model: env.anthropicModel,
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: INQUIRY_SYSTEM_PROMPT,
          // 全アクション共通の固定文。ここまでをキャッシュする。
          cache_control: { type: 'ephemeral' },
        },
      ],
      output_config: {
        effort: params.effort ?? DEFAULT_SETTINGS.judge.effort,
        format: { type: 'json_schema', schema: INQUIRY_OUTPUT_SCHEMA },
      },
      messages: [{ role: 'user', content: userMessage }],
    });

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;
    const text = response.content.find((block) => block.type === 'text')?.text;
    if (!text) return null;

    return toInquiryAnswer(JSON.parse(text) as InquiryOutput, basis);
  } catch {
    return null;
  }
}

export function toInquiryAnswer(output: InquiryOutput, basis: string): InquiryAnswer {
  return {
    body: output.answer,
    revisedPriority:
      output.revised_priority === 'unchanged' ? null : (output.revised_priority ?? null),
    revisedDifficulty:
      output.revised_difficulty === 'unchanged' ? null : (output.revised_difficulty ?? null),
    confirmInSchool: output.confirm_in_school ?? [],
    basis,
  };
}
