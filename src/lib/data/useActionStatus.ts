'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';

import type { Action, ActionStatus } from '../types';

/**
 * 対応済みトグルの共有状態。
 *
 * 01 サマリーと 06 改善アクションはどちらも同じ actions を参照し、
 * 状態変更は同じ PATCH /api/actions/[id] を通す（handoff.md 5章 06）。
 * 表示は楽観的に切り替え、失敗時はサーバの値に戻す。
 *
 * handoff.md 10章-5 の教訓：押せそうに見えて反応しない要素を作らないこと。
 * このフックを使わずにチェックボックスを置いてはならない。
 */
export function useActionStatus(actions: Action[]) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimisticActions, applyOptimistic] = useOptimistic(
    actions,
    (current: Action[], update: { id: string; status: ActionStatus }) =>
      current.map((action) =>
        action.id === update.id ? { ...action, status: update.status } : action,
      ),
  );

  function setDone(actionId: string, done: boolean) {
    const status: ActionStatus = done ? 'done' : 'open';
    startTransition(async () => {
      applyOptimistic({ id: actionId, status });
      const response = await fetch(`/api/actions/${encodeURIComponent(actionId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      // 失敗時は router.refresh() でサーバの値に戻す（楽観的更新を巻き戻す）
      if (!response.ok) console.error('対応済み状態の更新に失敗しました');
      router.refresh();
    });
  }

  return { actions: optimisticActions, setDone };
}
