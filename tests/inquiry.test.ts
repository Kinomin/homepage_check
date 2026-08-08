import { beforeEach, describe, expect, it } from 'vitest';

import { inquiryBasis, toInquiryAnswer } from '../src/lib/actions/inquiry';
import { CRITERIA_BY_ID } from '../src/lib/analysis/criteria';
import type { GapRow } from '../src/lib/analysis/summary';
import { DEMO_ACTIONS } from '../src/lib/data/demo';
import { appendThreadMessages, loadThread } from '../src/lib/data/thread-repository';
import {
  DIFFICULTY_DEFINITION,
  PRIORITY_DEFINITION,
  type Action,
  type Level,
} from '../src/lib/types';

function row(criterionId: string, levels: Level[]): GapRow {
  return { criterion: CRITERIA_BY_ID[criterionId], levels };
}

const action: Action = { ...DEMO_ACTIONS[0], sourceCriterionId: 'E1' };

describe('照会の根拠', () => {
  const rows = [row('E1', ['thin', 'full', 'mid', 'none', 'unknown'])];

  it('施策の優先度・難易度を定義ごと渡す', () => {
    const basis = inquiryBasis(action, rows);
    expect(basis).toContain(action.title);
    expect(basis).toContain(PRIORITY_DEFINITION[action.priority]);
    expect(basis).toContain(DIFFICULTY_DEFINITION[action.difficulty]);
    expect(basis).toContain('上位に置いた根拠');
  });

  it('比較校は公開しているかどうかの件数だけを渡す', () => {
    const basis = inquiryBasis(action, rows);
    expect(basis).toContain('4校中2校が公開');
  });

  it('比較校名や評価の材料を渡さない', () => {
    const basis = inquiryBasis(action, rows);
    expect(basis).not.toMatch(/劣|優れ|不十分|遅れ/);
  });

  it('根拠の調査項目が無いアクションでも壊れない', () => {
    const basis = inquiryBasis({ ...action, sourceCriterionId: null }, rows);
    expect(basis).toContain(action.title);
    expect(basis).not.toContain('比較校の公開状況');
  });

  it('該当する行が走査結果に無ければ比較校の記述を出さない', () => {
    const basis = inquiryBasis(action, [row('C4', ['full', 'full', 'full', 'full', 'full'])]);
    expect(basis).not.toContain('比較校の公開状況');
  });
});

describe('回答の正規化', () => {
  it('変更なしは見直し表示を出さない', () => {
    const answer = toInquiryAnswer(
      {
        answer: '本文',
        revised_priority: 'unchanged',
        revised_difficulty: 'unchanged',
        confirm_in_school: [],
      },
      'basis',
    );
    expect(answer.revisedPriority).toBeNull();
    expect(answer.revisedDifficulty).toBeNull();
  });

  it('位置づけが変わる場合だけ値が入る', () => {
    const answer = toInquiryAnswer(
      {
        answer: '本文',
        revised_priority: 'low',
        revised_difficulty: 'unchanged',
        confirm_in_school: ['サイト改修の時期'],
      },
      'basis',
    );
    expect(answer.revisedPriority).toBe('low');
    expect(answer.revisedDifficulty).toBeNull();
    expect(answer.confirmInSchool).toEqual(['サイト改修の時期']);
  });

  it('根拠は回答に添えて残す', () => {
    const answer = toInquiryAnswer(
      {
        answer: '本文',
        revised_priority: 'unchanged',
        revised_difficulty: 'unchanged',
        confirm_in_school: [],
      },
      '施策：テスト',
    );
    expect(answer.basis).toBe('施策：テスト');
  });
});

describe('照会履歴', () => {
  beforeEach(() => {
    delete (globalThis as { __demoThreads?: unknown }).__demoThreads;
  });

  it('質問と回答が時系列で並ぶ', async () => {
    await appendThreadMessages('AC-TEST', [
      { role: 'user', body: '来年サイトを改修します' },
      { role: 'assistant', body: 'それなら位置づけが変わります' },
    ]);
    await appendThreadMessages('AC-TEST', [
      { role: 'user', body: '費用はまだ未定です' },
      { role: 'assistant', body: '未定でも先に出せます' },
    ]);

    const thread = await loadThread('AC-TEST');
    expect(thread.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(thread[0].body).toBe('来年サイトを改修します');
    expect(thread[3].body).toBe('未定でも先に出せます');
    // 同じミリ秒に書き込まれても順序が判別できる
    expect(new Date(thread[1].createdAt).getTime()).toBeGreaterThan(
      new Date(thread[0].createdAt).getTime(),
    );
  });

  it('やり取りのないアクションは空で返る', async () => {
    expect(await loadThread('AC-NONE')).toEqual([]);
  });
});
