import { NextResponse } from 'next/server';

import { updateActionStatus } from '@/lib/data/repository';
import { ACTION_STATUSES, type ActionStatus } from '@/lib/types';

/**
 * 対応済みトグルの更新口。01 サマリー（SM-04）と 06 改善アクションの
 * どちらから叩いても同じ状態を書き換える（handoff.md 5章 06）。
 * 画面側は楽観的に表示を切り替え、ここで永続化する。
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  const status = body?.status;

  if (!status || !ACTION_STATUSES.includes(status as ActionStatus)) {
    return NextResponse.json(
      { error: `status は ${ACTION_STATUSES.join(' / ')} のいずれかです` },
      { status: 400 },
    );
  }

  try {
    await updateActionStatus(id, status as ActionStatus);
    return NextResponse.json({ id, status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新に失敗しました' },
      { status: 500 },
    );
  }
}
