'use client';

import { useState } from 'react';

import { useActionStatus } from '@/lib/data/useActionStatus';
import { sourceLabel } from '@/lib/screens';
import {
  ACTION_SOURCES,
  DIFFICULTIES,
  DIFFICULTY_DEFINITION,
  DIFFICULTY_LABEL,
  PRIORITIES,
  PRIORITY_DEFINITION,
  PRIORITY_LABEL,
  type Action,
  type ActionSource,
} from '@/lib/types';

type GroupBy = 'priority' | 'difficulty';
type SourceFilter = ActionSource | 'all';

/**
 * 06 改善アクション。
 *
 * ・優先度／難易度でグループ化を切り替え
 * ・出典（検出元の画面）でフィルタ。選択肢は ACTION_SOURCES から生成する
 *   （データ側の値と選択肢が構造的にズレないようにする：handoff.md 10章-2）
 * ・対応済みトグルは 01 サマリーの SM-04 と同じ状態を更新する
 * ・所要時間・期限は出さない（handoff.md 5章）
 */
export function ActionList({ actions }: { actions: Action[] }) {
  const { actions: current, setDone } = useActionStatus(actions);
  const [groupBy, setGroupBy] = useState<GroupBy>('priority');
  const [source, setSource] = useState<SourceFilter>('all');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const filtered = current.filter((action) => source === 'all' || action.source === source);
  const doneTotal = current.filter((a) => a.status === 'done').length;

  const groups =
    groupBy === 'priority'
      ? PRIORITIES.map((key) => ({
          key,
          title: `優先度 ${PRIORITY_LABEL[key]}`,
          definition: PRIORITY_DEFINITION[key],
          items: filtered.filter((a) => a.priority === key),
        }))
      : DIFFICULTIES.map((key) => ({
          key,
          title: `難易度 ${DIFFICULTY_LABEL[key]}`,
          definition: DIFFICULTY_DEFINITION[key],
          items: filtered.filter((a) => a.difficulty === key),
        }));

  // 出典フィルタは、実際にデータが存在する出典だけを出す
  const availableSources = ACTION_SOURCES.filter((s) => current.some((a) => a.source === s));

  return (
    <>
      <div className="btnrow">
        <span className="lb">GROUP BY</span>
        <button
          className="btn ghost"
          aria-pressed={groupBy === 'priority'}
          onClick={() => setGroupBy('priority')}
        >
          優先度
        </button>
        <button
          className="btn ghost"
          aria-pressed={groupBy === 'difficulty'}
          onClick={() => setGroupBy('difficulty')}
        >
          難易度
        </button>
        <span className="lb" style={{ marginLeft: 16 }}>
          SOURCE
        </span>
        <button className="btn ghost" aria-pressed={source === 'all'} onClick={() => setSource('all')}>
          すべて
        </button>
        {availableSources.map((key) => (
          <button
            key={key}
            className="btn ghost"
            aria-pressed={source === key}
            onClick={() => setSource(key)}
          >
            {sourceLabel(key)}
          </button>
        ))}
        <span className="lb" style={{ marginLeft: 'auto' }}>
          対応済み {doneTotal} / {current.length}件
        </span>
      </div>

      <div>
        {groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.key}>
              <div className="ghead">
                <span className="gt">{group.title}</span>
                <span className="gd">{group.definition}</span>
                <span className="gc">{group.items.length}件</span>
              </div>
              {group.items.map((action) => {
                const done = action.status === 'done';
                const isOpen = open.has(action.id);
                return (
                  <div
                    className={`act${done ? ' done' : ''}`}
                    data-open={isOpen ? '1' : '0'}
                    key={action.id}
                  >
                    <button
                      className="act-h"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpen((previous) => {
                          const next = new Set(previous);
                          if (next.has(action.id)) next.delete(action.id);
                          else next.add(action.id);
                          return next;
                        })
                      }
                    >
                      <span className="aid">{action.id}</span>
                      <span className="act-t">
                        {action.title}
                        <small>{action.summary}</small>
                      </span>
                      <span className="act-tags">
                        <label
                          className={`act-status${done ? ' done' : ''}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={done}
                            aria-label={`${action.title} を対応済みにする`}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => setDone(action.id, event.target.checked)}
                          />
                          {done ? '対応済み' : '対応済みにする'}
                        </label>
                        <span className="tag t-neu">
                          {groupBy === 'priority'
                            ? `難易度 ${DIFFICULTY_LABEL[action.difficulty]}`
                            : `優先度 ${PRIORITY_LABEL[action.priority]}`}
                        </span>
                        <span className="chev">▶</span>
                      </span>
                    </button>
                    <div className="act-b">
                      <h4>この項目を上位に置いた根拠</h4>
                      <p>{action.why}</p>
                      <h4>実施内容</h4>
                      <ul>
                        {action.how.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                      <h4>文案</h4>
                      <div className="copy">{action.copy}</div>
                      <div className="meta">
                        <span>
                          PRIORITY <b>{PRIORITY_LABEL[action.priority]}</b>
                        </span>
                        <span>
                          DIFFICULTY <b>{DIFFICULTY_LABEL[action.difficulty]}</b>
                        </span>
                        <span>
                          想定担当 <b>{action.owner}</b>
                        </span>
                        <span>
                          SOURCE <b>{action.sourceLabel}</b>
                        </span>
                      </div>
                      {action.qa.length > 0 && (
                        <div className="ask">
                          <div className="ah">想定される確認事項</div>
                          <div className="ab">
                            {action.qa.map((qa) => (
                              <div key={qa.question} style={{ marginBottom: 10 }}>
                                <div
                                  style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}
                                >
                                  {qa.question}
                                </div>
                                <div style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--ink-2)' }}>
                                  {qa.answer}
                                </div>
                              </div>
                            ))}
                            <p
                              style={{
                                fontSize: 10,
                                color: 'var(--mute)',
                                marginTop: 8,
                                paddingTop: 7,
                                borderTop: '1px solid var(--line)',
                                lineHeight: 1.7,
                              }}
                            >
                              校内事情を入力して再評価を受ける照会欄は Phase 2
                              で実装します（handoff.md 8章）。
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    </>
  );
}
