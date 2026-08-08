/**
 * 自動実行の結果の記録と、失敗時の通知。
 *
 * 通知先はメール配信サービスを勝手に選ばず、任意の Webhook URL を設定できる形にした
 * （Slack・Google Chat・自前の受け口のいずれでも使える）。配信ベンダーの選定は
 * 順位計測API（handoff.md 9章D）と同じく、発注者の判断が要る事項のため。
 *
 * 通知に載せるのは学校名・結末・理由だけ。ページ本文は載せない（handoff.md 6章）。
 */

import { createServiceClient } from '../supabase/server';
import type { ScanRunEntry, ScanRunResult } from './runner';

const STATUS_LABEL: Record<ScanRunEntry['status'], string> = {
  done: '完了',
  blocked: '取得できず',
  failed: '失敗',
};

/** 走査結果の要約。通知本文にも画面にも同じ文面を使う。 */
export function summarizeRun(result: ScanRunResult): string {
  if (result.dueCount === 0) return '走査対象の学校はありませんでした。';

  const done = result.entries.filter((entry) => entry.status === 'done').length;
  const lines = [`走査 ${result.dueCount}校：完了 ${done}校／要確認 ${result.failures.length}校`];

  for (const failure of result.failures) {
    lines.push(
      `・${failure.schoolName}（${STATUS_LABEL[failure.status]}）${failure.reason ?? '理由の記録なし'}`,
    );
  }

  // 取得はできたが判定が付かなかった項目がある場合も、人が見るべき状態として出す。
  // 「情報がない」と取り違えないよう、判定できなかった件数として書く。
  for (const entry of result.entries) {
    if (entry.status === 'done' && entry.unknownCount > 0) {
      lines.push(`・${entry.schoolName}（完了）判定できなかった項目 ${entry.unknownCount}件`);
    }
  }

  return lines.join('\n');
}

/** 人が対応すべきことがあるか（通知を出すかの判断） */
export function needsAttention(result: ScanRunResult): boolean {
  return (
    result.failures.length > 0 ||
    result.entries.some((entry) => entry.status === 'done' && entry.unknownCount > 0)
  );
}

/**
 * 実行の記録。
 * orgId は呼び出し側が渡す。ここで「1件目の組織」を拾うと、
 * 別の組織の走査結果が他組織の記録として残る。
 */
export async function recordScanRun(
  result: ScanRunResult,
  trigger: 'cron' | 'manual',
  orgId: string,
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;

  const { error } = await supabase.from('scan_runs').insert({
    org_id: orgId,
    trigger,
    started_at: result.startedAt,
    finished_at: result.finishedAt,
    due_count: result.dueCount,
    succeeded_count: result.entries.filter((entry) => entry.status === 'done').length,
    failed_count: result.failures.length,
    summary: summarizeRun(result),
    entries: result.entries,
  });
  if (error) throw new Error(error.message);
}

export interface NotifyResult {
  sent: boolean;
  /** 送らなかった場合の理由。送信先未設定と送信失敗を区別する */
  reason: 'no-webhook' | 'nothing-to-report' | 'delivery-failed' | null;
}

/**
 * 失敗があったときだけ通知する。
 * 毎回送ると読まれなくなり、本当に見てほしいときに気づかれない。
 */
export async function notifyScanRun(
  result: ScanRunResult,
  webhookUrl: string | null,
): Promise<NotifyResult> {
  if (!needsAttention(result)) return { sent: false, reason: 'nothing-to-report' };
  if (!webhookUrl) return { sent: false, reason: 'no-webhook' };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `[School Insight] 走査で確認が必要です\n${summarizeRun(result)}` }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? { sent: true, reason: null } : { sent: false, reason: 'delivery-failed' };
  } catch {
    return { sent: false, reason: 'delivery-failed' };
  }
}
