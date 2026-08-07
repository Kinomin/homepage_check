/**
 * 06 照会欄のやり取り（action_threads）。
 *
 * 学校が入力した事情と、それに対する回答を時系列で保持する。
 * Supabase 未接続時はプロセス内に保持する。
 */

import { createServerClient } from '../supabase/server';

export interface ThreadMessage {
  role: 'user' | 'assistant';
  body: string;
  createdAt: string;
}

const demoThreads: { byAction: Map<string, ThreadMessage[]> } = ((
  globalThis as { __demoThreads?: { byAction: Map<string, ThreadMessage[]> } }
).__demoThreads ??= { byAction: new Map() });

export async function loadThread(actionId: string): Promise<ThreadMessage[]> {
  const supabase = createServerClient();
  if (!supabase) return demoThreads.byAction.get(actionId) ?? [];

  const { data, error } = await supabase
    .from('action_threads')
    .select('role, body, created_at')
    .eq('action_id', actionId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];

  return data.map((row) => ({
    role: row.role as ThreadMessage['role'],
    body: String(row.body),
    createdAt: String(row.created_at),
  }));
}

export async function appendThreadMessages(
  actionId: string,
  messages: Omit<ThreadMessage, 'createdAt'>[],
): Promise<ThreadMessage[]> {
  const stamped: ThreadMessage[] = messages.map((message, index) => ({
    ...message,
    // 同じミリ秒でも順序が保たれるようにずらす
    createdAt: new Date(Date.now() + index).toISOString(),
  }));

  const supabase = createServerClient();
  if (!supabase) {
    const current = demoThreads.byAction.get(actionId) ?? [];
    demoThreads.byAction.set(actionId, [...current, ...stamped]);
    return demoThreads.byAction.get(actionId)!;
  }

  const { error } = await supabase.from('action_threads').insert(
    stamped.map((message) => ({
      action_id: actionId,
      role: message.role,
      body: message.body,
      created_at: message.createdAt,
    })),
  );
  if (error) throw new Error(error.message);

  return loadThread(actionId);
}

/** 06 の一覧表示用。アクションIDごとのやり取り件数だけを取る。 */
export async function loadThreadCounts(actionIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const supabase = createServerClient();

  if (!supabase) {
    for (const id of actionIds) {
      const messages = demoThreads.byAction.get(id);
      if (messages?.length) counts.set(id, messages.length);
    }
    return counts;
  }

  const { data } = await supabase
    .from('action_threads')
    .select('action_id')
    .in('action_id', actionIds);
  for (const row of data ?? []) {
    const id = String(row.action_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
