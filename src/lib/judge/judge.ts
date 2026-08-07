/**
 * 判定パイプライン 2段目の実行：Claude API 呼び出し。
 *
 * コスト設計（handoff.md 9章A：31項目 × 6校 = 186判定／回、週次で月800判定）
 * ・候補ページ抽出で LLM に渡す本文量を絞る（candidates.ts）
 * ・システムプロンプトは全判定で共通の固定文にし、cache_control でキャッシュする
 *   （可変部分は必ず後ろに置く。前方一致が崩れるとキャッシュが効かない）
 * ・effort は既定 low。判定は分類タスクであり、深い推論を必要としない
 * ・さらに絞る場合は Message Batches API（50%割引）に載せ替えられるよう、
 *   1判定 = 1リクエストの形を保っている
 *
 * 判定できなかった場合は必ず unknown を返す。none（欠落）に倒してはならない。
 */

import Anthropic from '@anthropic-ai/sdk';

import { env, isAnthropicConfigured } from '../env';
import type { JudgeEffort } from '../settings';
import type { Level, SchoolRole } from '../types';
import {
  JUDGE_OUTPUT_SCHEMA,
  buildJudgeUserMessage,
  systemPromptFor,
  type BuildPromptParams,
  type JudgeOutput,
} from './prompt';

export interface JudgeResult {
  level: Level;
  evidenceText: string;
  evidenceUrls: string[];
  evidenceCounts: Record<string, string>;
  changeReason: string;
  /** 判定できなかった理由（level が unknown のとき） */
  failureReason: string | null;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

export async function judgeCriterion(
  params: BuildPromptParams & { role: SchoolRole; effort?: JudgeEffort },
): Promise<JudgeResult> {
  if (!isAnthropicConfigured()) {
    return unknownResult('ANTHROPIC_API_KEY が設定されていません');
  }

  try {
    const response = await getClient().messages.create({
      model: env.anthropicModel,
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: systemPromptFor(params.role),
          // 全判定で共通の固定文。ここまでをキャッシュする。
          cache_control: { type: 'ephemeral' },
        },
      ],
      output_config: {
        // 設定画面（08）の思考深度。未指定なら環境変数の既定値。
        effort: params.effort ?? env.judgeEffort,
        format: { type: 'json_schema', schema: JUDGE_OUTPUT_SCHEMA },
      },
      messages: [{ role: 'user', content: buildJudgeUserMessage(params) }],
    });

    // 安全性の判定で応答が拒否された場合。content を読む前に必ず確認する。
    if (response.stop_reason === 'refusal') {
      return unknownResult('モデルが応答を拒否しました');
    }
    if (response.stop_reason === 'max_tokens') {
      return unknownResult('出力が上限に達し、判定結果を取得できませんでした');
    }

    const text = response.content.find((block) => block.type === 'text')?.text;
    if (!text) return unknownResult('判定結果が空でした');

    return toJudgeResult(JSON.parse(text) as JudgeOutput);
  } catch (error) {
    return unknownResult(error instanceof Error ? error.message : '判定に失敗しました');
  }
}

export function toJudgeResult(output: JudgeOutput): JudgeResult {
  const counts: Record<string, string> = {};
  for (const entry of output.evidence_counts ?? []) {
    if (entry?.key) counts[entry.key] = entry.value;
  }
  return {
    level: output.level,
    evidenceText: output.evidence_text,
    evidenceUrls: output.evidence_urls ?? [],
    evidenceCounts: counts,
    changeReason: output.change_reason ?? '',
    failureReason: null,
  };
}

/**
 * 判定不能はすべて unknown。
 * 走査失敗・API 失敗を none として保存すると、
 * 「他校にあってお宅にない」という誤った指摘に化ける（設計原則4）。
 */
export function unknownResult(reason: string): JudgeResult {
  return {
    level: 'unknown',
    evidenceText: `取得できませんでした（${reason}）`,
    evidenceUrls: [],
    evidenceCounts: {},
    changeReason: '',
    failureReason: reason,
  };
}
