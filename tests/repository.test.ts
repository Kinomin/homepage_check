import { beforeEach, describe, expect, it } from 'vitest';

import { loadDemoDashboard, updateActionStatus } from '../src/lib/data/repository';
import { topQuickWins } from '../src/lib/analysis/summary';

describe('対応済み状態の共有（handoff.md 5章 06）', () => {
  beforeEach(async () => {
    for (const action of loadDemoDashboard().actions) {
      await updateActionStatus(action.id, 'open');
    }
  });

  it('更新した状態が読み出しに反映される', async () => {
    const before = loadDemoDashboard().actions.find((a) => a.id === 'AC-01');
    expect(before?.status).toBe('open');

    await updateActionStatus('AC-01', 'done');

    const after = loadDemoDashboard().actions.find((a) => a.id === 'AC-01');
    expect(after?.status).toBe('done');
  });

  it('01 の SM-04 と 06 が同じ actions を参照する', async () => {
    await updateActionStatus('AC-01', 'done');

    const dashboard = loadDemoDashboard();
    const inQuickWins = topQuickWins(dashboard.actions).find((a) => a.id === 'AC-01');
    const inActionList = dashboard.actions.find((a) => a.id === 'AC-01');

    // 同じデータソースなので、片方だけ done になることはない
    expect(inQuickWins?.status).toBe('done');
    expect(inActionList?.status).toBe('done');
  });
});

describe('デモデータの構造', () => {
  it('31項目ぶんの判定結果が揃っている', () => {
    expect(loadDemoDashboard().gapRows).toHaveLength(31);
  });

  it('自校＋比較4校の5列になっている', () => {
    const dashboard = loadDemoDashboard();
    expect(dashboard.schools).toHaveLength(5);
    expect(dashboard.schools[0].role).toBe('self');
    expect(dashboard.gapRows.every((row) => row.levels.length === 5)).toBe(true);
  });

  it('アクションの出典がすべて enum の値になっている（フィルタから漏れない）', () => {
    const sources = new Set(loadDemoDashboard().actions.map((a) => a.source));
    expect([...sources].every((s) => ['gap', 'measurement', 'discovery', 'persona'].includes(s))).toBe(
      true,
    );
  });
});
