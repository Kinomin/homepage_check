/**
 * ペルソナ仮説の生成（LLM）。
 *
 * 02 の判定結果（findings）だけを材料にする。サイト本文は渡さない。
 * 「サイトの記載内容から読み取れること」の範囲を超えさせないため。
 *
 * 生成された仮説には必ず criterion_id を紐付けさせ、紐付けのないものは捨てる。
 * 根拠のない読み取りを出すと、この画面は会議で最初に否定される（handoff.md 5章 05）。
 */

import Anthropic from '@anthropic-ai/sdk';

import { CRITERIA_BY_ID } from '../analysis/criteria';
import type { GapRow } from '../analysis/summary';
import { env, isAnthropicConfigured } from '../env';
import { DEFAULT_SETTINGS, type JudgeEffort } from '../settings';
import { LEVEL_LABEL, isPresent, type CriterionId } from '../types';
import {
  HYPOTHESIS_KINDS,
  PERSONA_STAGE_CONTEXT,
  PERSONA_STAGE_LABEL,
  genderLabel,
  type Hypothesis,
  type Persona,
  type PersonaGender,
  type PersonaStage,
  type SurveyQuestion,
} from './types';

export const PERSONA_SYSTEM_PROMPT = `あなたは私立中高一貫校のホームページを、受験生や保護者の目線で読み直す役割です。

渡されるのは、そのサイトの調査結果（項目ごとに「掲載されているか、どの水準か」）だけです。サイトの本文は渡されません。渡された事実の範囲だけで、その人がサイトを見たときに何を感じ、何が分からないままかを読み取ってください。

守ること:
1. すべての読み取りに、根拠となる調査項目のID（A1〜G3）を必ず1つ以上添える。根拠を示せない読み取りは書かない。
2. 渡された調査結果にない情報を推測しない。学校の教育内容そのものを評価しない。
3. これは実際の受験生・保護者の声ではなく、サイトの記載内容から機械的に立てた仮説です。断定した書き方をしない。
4. 掲載されている項目（支持）と、掲載がなく判断できない項目（欠落）の両方を挙げる。欠落だけを並べない。
5. 学校を責める書き方をしない。「◯◯が分からない」という読み手側の状態として書く。

quote は、その人がサイトを見終えたときにこぼしそうな一言を1〜2文で。誇張しない。`;

export const PERSONA_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    quote: {
      type: 'string',
      description: 'その人がサイトを見終えたときの一言（1〜2文）',
    },
    hypotheses: {
      type: 'array',
      description: '読み取り。支持と欠落の両方を含める。3〜5件。',
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['support', 'gap', 'check'],
            description: 'support=掲載があり判断材料になる／gap=掲載がなく分からない／check=要確認',
          },
          body: { type: 'string', description: '読み取りの内容（読み手側の状態として書く）' },
          criterion_ids: {
            type: 'array',
            items: { type: 'string' },
            description: '根拠となる調査項目ID（A1〜G3）。1つ以上必須。',
          },
        },
        required: ['kind', 'body', 'criterion_ids'],
        additionalProperties: false,
      },
    },
  },
  required: ['quote', 'hypotheses'],
  additionalProperties: false,
} as const;

interface PersonaOutput {
  quote: string;
  hypotheses: { kind: string; body: string; criterion_ids: string[] }[];
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

/**
 * 自校の調査結果を、この人が気にする観点に絞ってまとめる。
 * 31項目すべてを渡すとコストが上がり、読み取りも散る。
 */
export function findingsDigest(gapRows: GapRow[], stage: PersonaStage): string {
  const audienceKeyword = stage === 'parent' ? '保護者' : '受験生';

  const relevant = gapRows.filter(
    (row) =>
      row.criterion.audience.includes(audienceKeyword) ||
      // 塾向けの項目も、保護者は間接的に見る
      (stage === 'parent' && row.criterion.audience.includes('塾')),
  );

  const rows = (relevant.length > 0 ? relevant : gapRows).map((row) => {
    const level = row.levels[0];
    const competitors = row.levels.slice(1);
    const publishedCount = competitors.filter(isPresent).length;
    return `- ${row.criterion.id} ${row.criterion.label}：本校は「${LEVEL_LABEL[level]}」／比較校${competitors.length}校中${publishedCount}校が公開`;
  });

  return rows.join('\n');
}

export interface GeneratePersonaParams {
  stage: PersonaStage;
  gender: PersonaGender;
  schoolName: string;
  gapRows: GapRow[];
  effort?: JudgeEffort;
}

export async function generatePersona(params: GeneratePersonaParams): Promise<Persona | null> {
  if (!isAnthropicConfigured()) return null;

  const { stage, gender, schoolName, gapRows } = params;
  const userMessage = [
    `## 対象校\n${schoolName}`,
    `## この人\n${PERSONA_STAGE_LABEL[stage]}・${genderLabel(stage, gender)}\n${PERSONA_STAGE_CONTEXT[stage]}`,
    `## サイトの調査結果\n${findingsDigest(gapRows, stage)}`,
  ].join('\n\n');

  try {
    const response = await getClient().messages.create({
      model: env.anthropicModel,
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: PERSONA_SYSTEM_PROMPT,
          // 6パターンで共通の固定文。ここまでをキャッシュする。
          cache_control: { type: 'ephemeral' },
        },
      ],
      output_config: {
        effort: params.effort ?? DEFAULT_SETTINGS.judge.effort,
        format: { type: 'json_schema', schema: PERSONA_OUTPUT_SCHEMA },
      },
      messages: [{ role: 'user', content: userMessage }],
    });

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;
    const text = response.content.find((block) => block.type === 'text')?.text;
    if (!text) return null;

    return toPersona(JSON.parse(text) as PersonaOutput, stage, gender);
  } catch {
    return null;
  }
}

/**
 * 出力を検証してペルソナに変換する。
 * 存在しない criterion_id や、根拠のない読み取りはここで落とす。
 */
export function toPersona(
  output: PersonaOutput,
  stage: PersonaStage,
  gender: PersonaGender,
): Persona {
  const hypotheses: Hypothesis[] = (output.hypotheses ?? [])
    .map((raw) => {
      const criterionIds = (raw.criterion_ids ?? []).filter(
        (id): id is CriterionId => Boolean(CRITERIA_BY_ID[id]),
      );
      const kind = HYPOTHESIS_KINDS.includes(raw.kind as Hypothesis['kind'])
        ? (raw.kind as Hypothesis['kind'])
        : 'check';
      return { kind, body: raw.body, criterionIds };
    })
    // 根拠のない読み取りは表示しない
    .filter((hypothesis) => hypothesis.criterionIds.length > 0 && hypothesis.body.trim());

  return {
    stage,
    gender,
    quote: output.quote ?? '',
    hypotheses,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 検証用アンケート設問。
 * この画面の仮説を説明会アンケートで確かめてもらうためのもの。
 * 仮説の根拠になった項目から設問を組み立てる。
 */
export function buildSurveyQuestions(personas: Persona[]): SurveyQuestion[] {
  const mentioned = new Set<CriterionId>();
  for (const persona of personas) {
    for (const hypothesis of persona.hypotheses) {
      if (hypothesis.kind === 'gap') {
        for (const id of hypothesis.criterionIds) mentioned.add(id);
      }
    }
  }

  const labels = [...mentioned]
    .map((id) => CRITERIA_BY_ID[id]?.label)
    .filter((label): label is string => Boolean(label))
    .slice(0, 5);

  const questions: SurveyQuestion[] = [
    { no: 'Q1', text: '本日ご来校前に、本校のホームページで最も知りたかったことは何ですか。（自由記述）' },
    { no: 'Q2', text: 'ホームページを見て、分からなかった・不安に感じたことはありましたか。（自由記述）' },
  ];

  if (labels.length > 0) {
    questions.push({
      no: 'Q3',
      text: '次のうち、ホームページで見つけられたものすべてに○をつけてください。',
      options: labels,
    });
  }

  questions.push({
    no: labels.length > 0 ? 'Q4' : 'Q3',
    text: '本校をお知りになったきっかけを教えてください。',
    options: ['学校サイト', '塾', '受験情報サイト', '知人', 'その他'],
  });

  return questions;
}
