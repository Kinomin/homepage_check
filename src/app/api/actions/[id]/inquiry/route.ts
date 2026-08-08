import { NextResponse } from 'next/server';

import { answerInquiry } from '@/lib/actions/inquiry';
import { loadDashboard } from '@/lib/data/repository';
import { loadSettings } from '@/lib/data/settings-repository';
import { appendThreadMessages, loadThread } from '@/lib/data/thread-repository';
import { isAnthropicConfigured } from '@/lib/env';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json({ messages: await loadThread(id) });
}

/**
 * 照会：校内の事情を受け取り、その施策の位置づけを再評価した回答を返す。
 * 質問と回答は action_threads に保存する（handoff.md 5章 06）。
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { question?: string } | null;
  const question = body?.question?.trim();

  if (!question) {
    return NextResponse.json({ error: '照会内容を入力してください' }, { status: 400 });
  }

  if (!isAnthropicConfigured()) {
    return NextResponse.json(
      {
        error:
          'ANTHROPIC_API_KEY が設定されていないため、照会に回答できません（質問は保存していません）',
      },
      { status: 503 },
    );
  }

  const { actions, gapRows } = await loadDashboard();
  const action = actions.find((item) => item.id === id);
  if (!action) {
    return NextResponse.json({ error: '該当する改善アクションがありません' }, { status: 404 });
  }

  const history = await loadThread(id);
  const { settings } = await loadSettings();
  const answer = await answerInquiry({
    action,
    question,
    gapRows,
    history: history.map(({ role, body: text }) => ({ role, body: text })),
    effort: settings.judge.effort,
  });

  // 回答が得られなかったときは質問も保存しない。
  // 「回答できなかった」ことと「事情を伝えていない」ことを混ぜないため（handoff.md 5章 走査失敗の扱いと同じ考え方）。
  if (!answer) {
    return NextResponse.json(
      { error: '照会に回答できませんでした。時間をおいて再度お試しください' },
      { status: 502 },
    );
  }

  const messages = await appendThreadMessages(id, [
    { role: 'user', body: question },
    { role: 'assistant', body: answer.body },
  ]);

  return NextResponse.json({ messages, answer });
}
