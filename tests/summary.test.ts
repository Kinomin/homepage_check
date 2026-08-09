import { describe, expect, it } from 'vitest';

import { CRITERIA_BY_ID } from '../src/lib/analysis/criteria';
import {
  actionBreakdown,
  competitorsWithInfo,
  isAbsentAtSelfAndSomeCompetitorsHave,
  isAbsentAtSelfButAllCompetitorsHave,
  isSelfStronger,
  matchesGapFilter,
  summarizeGap,
  topQuickWins,
  weakerCompetitorCount,
  type GapRow,
} from '../src/lib/analysis/summary';
import { ACTION_SOURCES, type Action, type Level } from '../src/lib/types';

function row(levels: Level[], criterionId = 'B2'): GapRow {
  return { criterion: CRITERIA_BY_ID[criterionId], levels };
}

describe('欠落の集計（handoff.md 5章 01）', () => {
  it('比較校すべてが公開し、自校にない項目を数える', () => {
    expect(isAbsentAtSelfButAllCompetitorsHave(row(['none', 'full', 'mid', 'thin', 'full']))).toBe(
      true,
    );
  });

  it('比較校に1校でも none があれば「すべてが公開」ではない', () => {
    expect(isAbsentAtSelfButAllCompetitorsHave(row(['none', 'full', 'none', 'full', 'full']))).toBe(
      false,
    );
  });

  it('比較校に unknown（走査失敗）を含む項目は集計から除外する', () => {
    // 走査できなかったものを「公開している」と扱うと、
    // 取得失敗が「他校にあってお宅にない」という誤った指摘に化ける
    expect(
      isAbsentAtSelfButAllCompetitorsHave(row(['none', 'full', 'unknown', 'full', 'full'])),
    ).toBe(false);
  });

  it('比較校の n/a（判定対象外）も「公開している」に数えない', () => {
    expect(isAbsentAtSelfButAllCompetitorsHave(row(['none', 'full', 'n/a', 'full', 'full']))).toBe(
      false,
    );
  });

  it('自校が unknown の項目は欠落として数えない', () => {
    expect(
      isAbsentAtSelfButAllCompetitorsHave(row(['unknown', 'full', 'full', 'full', 'full'])),
    ).toBe(false);
  });

  it('比較校が0校のときは判定しない', () => {
    expect(isAbsentAtSelfButAllCompetitorsHave(row(['none']))).toBe(false);
  });

  it('一部の比較校のみ公開している項目を切り分ける', () => {
    const target = row(['none', 'full', 'none', 'mid', 'none']);
    expect(isAbsentAtSelfAndSomeCompetitorsHave(target)).toBe(true);
    expect(competitorsWithInfo(target)).toEqual({ have: 2, measured: 4 });
  });
});

describe('本校が上回る項目（SM-01）', () => {
  it('自校が full で、走査できた比較校に full 未満があるとき', () => {
    const target = row(['full', 'mid', 'full', 'thin', 'full']);
    expect(isSelfStronger(target)).toBe(true);
    expect(weakerCompetitorCount(target)).toBe(2);
  });

  it('unknown の比較校は「本校が上回る」根拠にしない', () => {
    expect(isSelfStronger(row(['full', 'unknown', 'full', 'full', 'full']))).toBe(false);
    expect(weakerCompetitorCount(row(['full', 'unknown', 'mid', 'full', 'full']))).toBe(1);
  });

  it('自校が full でなければ対象外', () => {
    expect(isSelfStronger(row(['mid', 'none', 'none', 'none', 'none']))).toBe(false);
  });
});

describe('02 のフィルタ', () => {
  const rows = [
    row(['none', 'full', 'full', 'full', 'full'], 'B2'),
    row(['none', 'full', 'none', 'full', 'full'], 'F3'),
    row(['full', 'mid', 'full', 'full', 'full'], 'C2'),
    row(['unknown', 'full', 'full', 'full', 'full'], 'A1'),
  ];

  it('all はすべて通す', () => {
    expect(rows.filter((r) => matchesGapFilter(r, 'all'))).toHaveLength(4);
  });

  it('absent は自校が none の項目のみ（unknown は含めない）', () => {
    expect(rows.filter((r) => matchesGapFilter(r, 'absent'))).toHaveLength(2);
  });

  it('allhave は比較校すべてが公開している項目のみ', () => {
    expect(rows.filter((r) => matchesGapFilter(r, 'allhave'))).toHaveLength(1);
  });

  it('strong は自校が上回る項目のみ', () => {
    expect(rows.filter((r) => matchesGapFilter(r, 'strong'))).toHaveLength(1);
  });

  it('summarizeGap が unknown 件数を別枠で数える', () => {
    const summary = summarizeGap(rows);
    expect(summary.absentEverywhereElse).toHaveLength(1);
    expect(summary.strengths).toHaveLength(1);
    expect(summary.unknownRows).toHaveLength(1);
    expect(summary.totalCriteria).toBe(4);
  });
});

describe('指摘件数の内訳（SM-03）', () => {
  const actions: Action[] = [
    action('AC-01', 'high', 'low', 'gap'),
    action('AC-02', 'high', 'mid', 'gap'),
    action('AC-03', 'mid', 'low', 'measurement'),
  ];

  it('出典ごとに件数・優先度高・難易度低を数える', () => {
    expect(actionBreakdown(actions, ACTION_SOURCES)).toEqual([
      { source: 'gap', total: 2, highPriority: 2, lowDifficulty: 1 },
      { source: 'measurement', total: 1, highPriority: 0, lowDifficulty: 1 },
    ]);
  });

  it('件数0の出典は行に出さない（選択肢とデータのズレを作らない）', () => {
    expect(actionBreakdown(actions, ACTION_SOURCES).map((r) => r.source)).not.toContain('persona');
  });

  it('優先度が高く難易度の低いものから並べる', () => {
    expect(topQuickWins(actions, 2).map((a) => a.id)).toEqual(['AC-01', 'AC-02']);
  });
});

function action(
  id: string,
  priority: Action['priority'],
  difficulty: Action['difficulty'],
  source: Action['source'],
): Action {
  return {
    id,
    ref: id,
    title: id,
    summary: '',
    priority,
    difficulty,
    source,
    sourceCriterionId: null,
    sourceLabel: '',
    status: 'open',
    why: '',
    how: [],
    copy: '',
    owner: '',
    qa: [],
  };
}
