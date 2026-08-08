import { describe, expect, it } from 'vitest';

import {
  collectCompetitorChanges,
  diffAvailability,
  diffCompetitorScans,
  type ScanSnapshot,
} from '../src/lib/analysis/competitor-diff';
import type { CriterionId, Level } from '../src/lib/types';

const school = { id: 'rival-1', name: '白鷺学園' };

function snapshot(overrides: Partial<ScanSnapshot> = {}): ScanSnapshot {
  return {
    scanId: 'scan-1',
    startedAt: '2026-08-03T06:00:00.000Z',
    status: 'done',
    pages: [],
    findings: [],
    truncated: false,
    ...overrides,
  };
}

function findings(entries: [CriterionId, Level][]) {
  return entries.map(([criterionId, level]) => ({ criterionId, level }));
}

describe('項目の公開状況の変化', () => {
  it('掲載がなかった項目に掲載を確認したら記録する', () => {
    const changes = diffCompetitorScans(
      school,
      snapshot({ findings: findings([['E1', 'none']]) }),
      snapshot({ startedAt: '2026-08-10T06:00:00.000Z', findings: findings([['E1', 'mid']]) }),
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('criterion-published');
    expect(changes[0].body).toContain('E1');
    expect(changes[0].criterionId).toBe('E1');
  });

  it('掲載を確認できなくなった場合も記録する', () => {
    const changes = diffCompetitorScans(
      school,
      snapshot({ findings: findings([['E1', 'full']]) }),
      snapshot({ findings: findings([['E1', 'none']]) }),
    );
    expect(changes[0].kind).toBe('criterion-unavailable');
  });

  it('掲載量の増減だけでは記録しない（優劣を書かないため）', () => {
    const changes = diffCompetitorScans(
      school,
      snapshot({ findings: findings([['E1', 'thin']]) }),
      snapshot({ findings: findings([['E1', 'full']]) }),
    );
    expect(changes).toHaveLength(0);
  });

  it('評価語を含まない（公開しているかどうかの事実だけを書く）', () => {
    const changes = diffCompetitorScans(
      school,
      snapshot({ findings: findings([['E1', 'none']]) }),
      snapshot({ findings: findings([['E1', 'full']]) }),
    );
    expect(changes[0].body).not.toMatch(/充実|優れ|劣|遅れ|不十分|改善/);
  });
});

describe('判定できなかった回を根拠にしない', () => {
  it('前回が unknown なら比較しない', () => {
    expect(
      diffCompetitorScans(
        school,
        snapshot({ findings: findings([['E1', 'unknown']]) }),
        snapshot({ findings: findings([['E1', 'full']]) }),
      ),
    ).toHaveLength(0);
  });

  it('今回が unknown なら「掲載を確認できず」にしない', () => {
    expect(
      diffCompetitorScans(
        school,
        snapshot({ findings: findings([['E1', 'full']]) }),
        snapshot({ findings: findings([['E1', 'unknown']]) }),
      ),
    ).toHaveLength(0);
  });

  it('該当なし（n/a）は比較しない', () => {
    expect(
      diffCompetitorScans(
        school,
        snapshot({ findings: findings([['F5', 'n/a']]) }),
        snapshot({ findings: findings([['F5', 'full']]) }),
      ),
    ).toHaveLength(0);
  });

  it('前回に無かった項目は比較しない', () => {
    expect(
      diffCompetitorScans(school, snapshot({}), snapshot({ findings: findings([['E1', 'full']]) })),
    ).toHaveLength(0);
  });
});

describe('走り切っていない走査を比較しない', () => {
  it('前回が robots.txt で取得できていなければ何も出さない', () => {
    expect(
      diffCompetitorScans(
        school,
        snapshot({ status: 'blocked', findings: findings([['E1', 'none']]) }),
        snapshot({ findings: findings([['E1', 'full']]) }),
      ),
    ).toHaveLength(0);
  });

  it('今回が失敗していれば何も出さない', () => {
    expect(
      diffCompetitorScans(
        school,
        snapshot({ findings: findings([['E1', 'none']]) }),
        snapshot({ status: 'failed', findings: findings([['E1', 'full']]) }),
      ),
    ).toHaveLength(0);
  });

  it('初回の走査では比べる相手がない', () => {
    expect(
      diffCompetitorScans(school, null, snapshot({ findings: findings([['E1', 'full']]) })),
    ).toHaveLength(0);
  });
});

describe('ページの増減', () => {
  const previousPages = [{ url: 'https://a.ed.jp/x', title: '既存', lastModified: null }];
  const currentPages = [
    ...previousPages,
    { url: 'https://a.ed.jp/y', title: '探究発表会レポート', lastModified: null },
  ];

  it('新しく確認したページを記録する', () => {
    const changes = diffCompetitorScans(
      school,
      snapshot({ pages: previousPages }),
      snapshot({ pages: currentPages }),
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('page-added');
    expect(changes[0].body).toContain('探究発表会レポート');
    expect(changes[0].url).toBe('https://a.ed.jp/y');
  });

  it('ページ数上限に当たった走査では増減を出さない', () => {
    // 上限で切られただけのページを「公開をやめた／新しく出した」と書かない
    expect(
      diffCompetitorScans(
        school,
        snapshot({ pages: previousPages, truncated: true }),
        snapshot({ pages: currentPages }),
      ),
    ).toHaveLength(0);
    expect(
      diffCompetitorScans(
        school,
        snapshot({ pages: previousPages }),
        snapshot({ pages: currentPages, truncated: true }),
      ),
    ).toHaveLength(0);
  });

  it('無くなったページは記録しない（走査の都合と区別できないため）', () => {
    const changes = diffCompetitorScans(
      school,
      snapshot({ pages: currentPages }),
      snapshot({ pages: previousPages }),
    );
    expect(changes).toHaveLength(0);
  });

  it('タイトルが無ければ URL を出す', () => {
    const changes = diffCompetitorScans(
      school,
      snapshot({ pages: [] }),
      snapshot({ pages: [{ url: 'https://a.ed.jp/z.pdf', title: '  ', lastModified: null }] }),
    );
    expect(changes[0].body).toContain('https://a.ed.jp/z.pdf');
  });
});

describe('複数校のまとめ', () => {
  it('新しい順に並べ、件数を絞る', () => {
    const entries = [
      {
        school: { id: 'a', name: 'A校' },
        previous: snapshot({ findings: findings([['E1', 'none']]) }),
        current: snapshot({
          startedAt: '2026-08-01T00:00:00.000Z',
          findings: findings([['E1', 'full']]),
        }),
      },
      {
        school: { id: 'b', name: 'B校' },
        previous: snapshot({ findings: findings([['C4', 'none']]) }),
        current: snapshot({
          startedAt: '2026-08-09T00:00:00.000Z',
          findings: findings([['C4', 'full']]),
        }),
      },
    ];
    const changes = collectCompetitorChanges(entries);
    expect(changes.map((c) => c.schoolName)).toEqual(['B校', 'A校']);
    expect(collectCompetitorChanges(entries, 1)).toHaveLength(1);
  });
});

describe('差分を出せる状態かの判定', () => {
  it('走査記録が無い／1回目／2回目以降を区別する', () => {
    expect(diffAvailability([])).toBe('no-scan');
    expect(diffAvailability([{ previous: null, current: null }])).toBe('no-scan');
    expect(diffAvailability([{ previous: null, current: snapshot() }])).toBe('first-scan');
    expect(diffAvailability([{ previous: snapshot(), current: snapshot() }])).toBe('ready');
  });
});
