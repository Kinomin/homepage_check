import { describe, expect, it } from 'vitest';

import { CRITERIA_BY_ID } from '../src/lib/analysis/criteria';
import {
  actionKeyFor,
  actionKeyToCriterionId,
  buildActionText,
  derivePriority,
  deriveActions,
  isActionable,
} from '../src/lib/analysis/derive-actions';
import type { GapRow } from '../src/lib/analysis/summary';
import { planActionRows } from '../src/lib/data/action-writer';
import type { Level } from '../src/lib/types';

function row(levels: Level[], criterionId = 'B2'): GapRow {
  return { criterion: CRITERIA_BY_ID[criterionId], levels };
}

describe('改善アクションの導出（handoff.md 5章 06）', () => {
  it('自校が none の項目は対象にする', () => {
    expect(isActionable(row(['none', 'full', 'full']))).toBe(true);
  });

  it('自校が thin の項目も対象にする（記載はあるが薄い）', () => {
    expect(isActionable(row(['thin', 'full', 'full']))).toBe(true);
  });

  it('自校が full / mid の項目は対象にしない', () => {
    expect(isActionable(row(['full', 'none', 'none']))).toBe(false);
    expect(isActionable(row(['mid', 'none', 'none']))).toBe(false);
  });

  it('走査できなかった項目（unknown）を改善アクションにしない', () => {
    // 取得失敗を「直すべき欠落」として並べると、走査の失敗が指摘に化ける（handoff.md 4章）
    expect(isActionable(row(['unknown', 'full', 'full']))).toBe(false);
    expect(deriveActions([row(['unknown', 'full', 'full'])])).toEqual([]);
  });

  it('該当なし（n/a）の項目を改善アクションにしない', () => {
    expect(isActionable(row(['n/a', 'full', 'full'], 'D4'))).toBe(false);
    expect(deriveActions([row(['n/a', 'full', 'full'], 'D4')])).toEqual([]);
  });

  it('比較校すべてが公開していて自校にない項目は優先度 高', () => {
    expect(derivePriority(row(['none', 'full', 'mid', 'thin']))).toBe('high');
  });

  it('一部の比較校が公開している項目は優先度 中', () => {
    expect(derivePriority(row(['none', 'full', 'none', 'none']))).toBe('mid');
  });

  it('比較校も公開していない項目は優先度 低', () => {
    expect(derivePriority(row(['none', 'none', 'none', 'none']))).toBe('low');
  });

  it('自校に記載がある（thin）項目は優先度 低', () => {
    // 整備済みだが改善の余地、という区分（handoff.md の定義表）
    expect(derivePriority(row(['thin', 'full', 'full', 'full']))).toBe('low');
  });

  it('比較校が unknown（走査失敗）の項目を「すべてが公開」に数えない', () => {
    expect(derivePriority(row(['none', 'full', 'unknown', 'full']))).toBe('mid');
  });

  it('優先度の高い順、同じ優先度なら着手しやすい順に並べる', () => {
    const actions = deriveActions([
      row(['none', 'none', 'none'], 'A1'), // low / 難易度 high
      row(['none', 'full', 'full'], 'C1'), // high / 難易度 low
      row(['none', 'full', 'none'], 'B1'), // mid / 難易度 mid
    ]);
    expect(actions.map((action) => action.sourceCriterionId)).toEqual(['C1', 'B1', 'A1']);
    expect(actions.map((action) => action.priority)).toEqual(['high', 'mid', 'low']);
  });

  it('鍵は調査項目から一意に決まり、逆も引ける（対応済み状態の引き継ぎに使う）', () => {
    expect(actionKeyFor('F6')).toBe('gap-F6');
    expect(actionKeyToCriterionId('gap-F6')).toBe('F6');
    expect(actionKeyToCriterionId('AC-01')).toBeNull();
  });

  it('保存するのは分類と鍵だけで、本文は持たない', () => {
    const [action] = deriveActions([row(['none', 'full', 'full'], 'F6')]);
    expect(Object.keys(action).sort()).toEqual(
      ['actionKey', 'difficulty', 'priority', 'source', 'sourceCriterionId'].sort(),
    );
    expect(action.source).toBe('gap');
  });
});

describe('改善アクションの本文（数えた事実だけで組み立てる）', () => {
  it('根拠には比較校の公開数だけを書き、評価は書かない', () => {
    const text = buildActionText(row(['none', 'full', 'mid', 'none'], 'F6'));
    expect(text.why).toContain('比較3校中2校が公開しています');
    expect(text.why).toContain('本校では該当する記載を確認できませんでした');
    // 比較校を採点しない（handoff.md 4章）
    expect(text.why).not.toMatch(/優れ|劣|遅れ|不十分/);
  });

  it('比較校が走査できていないときは公開数に触れない', () => {
    const text = buildActionText(row(['none', 'unknown', 'unknown'], 'F6'));
    expect(text.why).not.toContain('比較');
    expect(text.why).toContain('本校では該当する記載を確認できませんでした');
  });

  it('比較校がいないときも本文を組み立てられる', () => {
    const text = buildActionText(row(['none'], 'F6'));
    expect(text.why).not.toContain('比較');
    expect(text.title).toContain(CRITERIA_BY_ID.F6.label);
  });

  it('thin と none で見出しを書き分ける', () => {
    expect(buildActionText(row(['none'], 'F6')).title).toContain('掲載する');
    expect(buildActionText(row(['thin'], 'F6')).title).toContain('充実させる');
  });

  it('実施内容は判定基準から導き、所要時間や期限を書かない', () => {
    const text = buildActionText(row(['none', 'full'], 'F6'));
    expect(text.how.join('\n')).toContain(CRITERIA_BY_ID.F6.judgePrompt);
    // 所要時間・期限は出さない（handoff.md 5章 06）
    expect(text.how.join('\n')).not.toMatch(/日以内|週間|か月|締切|期限/);
  });

  it('特殊な判定ルールがある項目は注意として添える', () => {
    const criterion = Object.values(CRITERIA_BY_ID).find((c) => c.specialRule);
    if (!criterion) return;
    const text = buildActionText(row(['none', 'full'], criterion.id));
    expect(text.how.some((step) => step.includes(criterion.specialRule!))).toBe(true);
  });

  it('出典は調査項目のIDで示す（02 の該当行に戻れる）', () => {
    expect(buildActionText(row(['none'], 'F6')).sourceLabel).toBe('F6 欠落マップ');
  });

  it('文案は生成しない（学校の実際の日程・施設が必要なため）', () => {
    const text: Record<string, unknown> = { ...buildActionText(row(['none', 'full'], 'F6')) };
    expect(text.copy).toBeUndefined();
  });
});

describe('保存する行の決定（action-writer）', () => {
  it('対応済み状態は鍵で引き継ぐ（走査ごとに行を作り直しても外れない）', () => {
    const rows = planActionRows(
      [row(['none', 'full', 'full'], 'F6'), row(['none', 'full', 'full'], 'C1')],
      new Map([['gap-F6', 'done' as const]]),
      'scan-2',
      '2026-08-08T00:00:00.000Z',
    );
    expect(rows.find((r) => r.action_key === 'gap-F6')?.status).toBe('done');
    expect(rows.find((r) => r.action_key === 'gap-C1')?.status).toBe('open');
  });

  it('掲載されて対象から外れた項目は行に含めない（直した項目が並び続けない）', () => {
    const rows = planActionRows(
      [row(['full', 'full', 'full'], 'F6'), row(['none', 'full', 'full'], 'C1')],
      new Map([['gap-F6', 'done' as const]]),
      'scan-2',
      '2026-08-08T00:00:00.000Z',
    );
    expect(rows.map((r) => r.action_key)).toEqual(['gap-C1']);
  });

  it('すべて走査できなかった走査では1件も作らない', () => {
    const rows = planActionRows(
      [row(['unknown', 'unknown'], 'F6'), row(['unknown', 'unknown'], 'C1')],
      new Map(),
      'scan-2',
      '2026-08-08T00:00:00.000Z',
    );
    expect(rows).toEqual([]);
  });

  it('走査IDと更新時刻をすべての行に入れる', () => {
    const rows = planActionRows(
      [row(['none', 'full'], 'F6')],
      new Map(),
      'scan-9',
      '2026-08-08T00:00:00.000Z',
    );
    expect(rows[0]).toMatchObject({
      scan_id: 'scan-9',
      updated_at: '2026-08-08T00:00:00.000Z',
      source: 'gap',
      source_criterion_id: 'F6',
    });
  });
});
