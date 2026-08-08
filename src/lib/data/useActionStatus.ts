'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useSyncExternalStore, useTransition } from 'react';

import { IS_STATIC_DEMO, snapshotLocal, subscribeLocal, writeLocal } from '../static-demo';
import type { Action, ActionStatus } from '../types';

const STORAGE_KEY = 'action-status';
const EMPTY: Record<string, ActionStatus> = {};

/**
 * 対応済みトグルの共有状態。
 *
 * 01 サマリーと 06 改善アクションはどちらも同じ actions を参照し、
 * 状態変更は同じ PATCH /api/actions/[id] を通す（handoff.md 5章 06）。
 * 表示は楽観的に切り替え、失敗時はサーバの値に戻す。
 *
 * 静的デモ（GitHub Pages）にはサーバが無いので、同じ状態をブラウザ内に持つ。
 * どちらの経路でも 01 と 06 で状態が共有されることは変わらない。
 *
 * handoff.md 10章-5 の教訓：押せそうに見えて反応しない要素を作らないこと。
 * このフックを使わずにチェックボックスを置いてはならない。
 */
export function useActionStatus(actions: Action[]) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // 静的デモではブラウザ内の保存を正とする。
  // localStorage は React の外の状態なので、effect で読むのではなく購読する。
  // サーバ描画時（HTML の生成時）は空として扱い、水和後に実際の値へ切り替わる。
  const localStatus = useSyncExternalStore(
    subscribeLocal,
    () => (IS_STATIC_DEMO ? snapshotLocal(STORAGE_KEY, EMPTY) : EMPTY),
    () => EMPTY,
  );

  const base = IS_STATIC_DEMO
    ? actions.map((action) => ({ ...action, status: localStatus[action.id] ?? action.status }))
    : actions;

  const [optimisticActions, applyOptimistic] = useOptimistic(
    base,
    (current: Action[], update: { id: string; status: ActionStatus }) =>
      current.map((action) =>
        action.id === update.id ? { ...action, status: update.status } : action,
      ),
  );

  function setDone(actionId: string, done: boolean) {
    const status: ActionStatus = done ? 'done' : 'open';

    if (IS_STATIC_DEMO) {
      // 書き込むとストアが通知を出し、購読しているこのフックが読み直す
      writeLocal(STORAGE_KEY, { ...localStatus, [actionId]: status });
      return;
    }

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
