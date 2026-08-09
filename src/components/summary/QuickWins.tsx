'use client';

import { useActionStatus } from '@/lib/data/useActionStatus';
import { DIFFICULTY_LABEL, PRIORITY_LABEL, type Action } from '@/lib/types';

/**
 * 01 SM-04「優先度が高く、難易度の低いもの」。
 *
 * チェックボックスは装飾ではなく対応済みトグルで、06 改善アクションと
 * 同じ actions.status を更新する（handoff.md 5章 06／10章-5）。
 */
export function QuickWins({ actions }: { actions: Action[] }) {
  const { actions: current, setDone } = useActionStatus(actions);

  return (
    <div>
      {current.map((action) => {
        const done = action.status === 'done';
        return (
          <div className={`todo${done ? ' done' : ''}`} key={action.id}>
            <input
              type="checkbox"
              aria-label={`${action.title} を対応済みにする`}
              checked={done}
              onChange={(event) => setDone(action.id, event.target.checked)}
            />
            <div>
              <div className="t">{action.title}</div>
              <div className="d">
                {action.ref} ／ 難易度 {DIFFICULTY_LABEL[action.difficulty]} ・ {action.owner}
              </div>
            </div>
            <div className="when">
              {done ? '対応済み' : `優先 ${PRIORITY_LABEL[action.priority]}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
