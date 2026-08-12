import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { needsAttention, summarizeRun } from '../src/lib/scan/notify';
import {
  allSchoolsAsDue,
  runDueScans,
  selectDueSchools,
  type DueSchool,
  type ScanRunEntry,
  type ScanRunResult,
} from '../src/lib/scan/runner';
import { resolveTrigger } from '../src/lib/scan/trigger';
import { DEFAULT_SETTINGS, fromJst, type OrgSettings } from '../src/lib/settings';
import type { School } from '../src/lib/types';

function school(id: string, role: School['role']): School {
  return {
    id,
    name: `${id}校`,
    url: `https://${id}.ed.jp`,
    prefecture: null,
    schoolType: null,
    coedType: null,
    hasJuniorAdmission: true,
    hasSeniorAdmission: true,
    hasAffiliatedUniversity: false,
    robotsAllowed: true,
    role,
    sortOrder: 0,
  };
}

const schools = [school('self', 'self'), school('rival', 'competitor')];

/** 既定：自校・比較校とも月次、1日6時（日本時間） */
const settings: OrgSettings = DEFAULT_SETTINGS;

/** 自校だけ週次にした設定。週次特有の挙動（週単位の拾い直しなど）を確かめるテストで使う。 */
const selfWeekly: OrgSettings = {
  ...DEFAULT_SETTINGS,
  schedule: { ...DEFAULT_SETTINGS.schedule, selfFrequency: 'weekly' },
};

describe('走査対象の判定', () => {
  it('一度も走査していない学校は対象になる', () => {
    const due = selectDueSchools(schools, new Map(), settings, fromJst(2026, 8, 7, 9));
    expect(due.every((entry) => entry.due)).toBe(true);
    expect(due.map((entry) => entry.lastScanAt)).toEqual([null, null]);
  });

  it('自校と比較校で別々の頻度を適用する', () => {
    // 前回はどちらも 8月3日（月）6時。8月10日（月）9時の時点で……
    const last = new Map([
      ['self', fromJst(2026, 8, 3, 6)],
      ['rival', fromJst(2026, 8, 3, 6)],
    ]);
    const due = selectDueSchools(schools, last, selfWeekly, fromJst(2026, 8, 10, 9));

    // 自校は週次なので対象、比較校は月次（1日）なのでまだ対象外
    expect(due.find((entry) => entry.school.id === 'self')?.due).toBe(true);
    expect(due.find((entry) => entry.school.id === 'rival')?.due).toBe(false);
  });

  it('組織ごとに別の設定を適用できる（設定を混ぜない）', () => {
    // 走査はサービスキーで動き RLS が効かないため、組織の分離はコード側で保つ。
    // A学園は自校週次、B学園は手動のみ、という状態を取り違えないこと。
    const weekly = selfWeekly;
    const manual: OrgSettings = {
      ...settings,
      schedule: { ...settings.schedule, selfFrequency: 'manual' },
    };
    const now = fromJst(2026, 8, 7, 9);

    const orgA = selectDueSchools([school('a-self', 'self')], new Map(), weekly, now);
    const orgB = selectDueSchools([school('b-self', 'self')], new Map(), manual, now);

    expect(orgA[0].due).toBe(true);
    expect(orgB[0].due).toBe(false);
  });

  it('手動のみに設定した対象は自動実行から外れる', () => {
    const manual: OrgSettings = {
      ...settings,
      schedule: { ...settings.schedule, competitorFrequency: 'manual' },
    };
    const due = selectDueSchools(schools, new Map(), manual, fromJst(2026, 8, 7, 9));
    const rival = due.find((entry) => entry.school.id === 'rival');
    expect(rival?.due).toBe(false);
    expect(rival?.nextScanAt).toBeNull();
  });

  it('失敗した学校は次に起きたときも対象のまま（週の途中で拾い直せる）', () => {
    // 失敗した走査は保存されない（runner の scanOne が status!=='done' で保存しない）ため、
    // 前回走査として渡されるのは「走り切った回」だけになる。
    // その結果、月曜に失敗した学校は水曜・金曜の拾い直しでも対象に残る。
    // （週次の場合の挙動を確認するテストなので selfWeekly を使う）
    const lastSuccess = fromJst(2026, 8, 3, 6); // 8/3(月) は成功
    const failedOnMonday = new Map<string, Date>([['self', lastSuccess]]);
    // rival は 8/10(月) に失敗 → 記録が無いので前回は 8/3 のまま
    failedOnMonday.set('rival', lastSuccess);

    // 8/12(水) の拾い直し
    const wednesday = selectDueSchools(schools, failedOnMonday, selfWeekly, fromJst(2026, 8, 12, 6));
    expect(wednesday.find((e) => e.school.id === 'self')?.due).toBe(true);

    // 8/10(月) に成功していれば、同じ水曜では対象にならない
    const succeeded = new Map<string, Date>([['self', fromJst(2026, 8, 10, 6)]]);
    const after = selectDueSchools(schools, succeeded, selfWeekly, fromJst(2026, 8, 12, 6));
    expect(after.find((e) => e.school.id === 'self')?.due).toBe(false);
  });

  it('対象外の学校も次回予定を添えて返す（なぜ対象外かが分かるように）', () => {
    const last = new Map([['self', fromJst(2026, 8, 3, 6)]]);
    const due = selectDueSchools(schools, last, selfWeekly, fromJst(2026, 8, 5, 9));
    const self = due.find((entry) => entry.school.id === 'self');
    expect(self?.due).toBe(false);
    expect(self?.nextScanAt).toEqual(fromJst(2026, 8, 10, 6));
  });
});

describe('今すぐ走査する（09画面のボタン用）', () => {
  it('頻度設定に関わらず全校を対象にする', () => {
    const manual: OrgSettings = {
      ...settings,
      schedule: { ...settings.schedule, selfFrequency: 'manual', competitorFrequency: 'manual' },
    };
    const due = allSchoolsAsDue(schools, new Map(), manual);
    // 「手動のみ」はこのボタンで動かすための設定なので、除外しない
    expect(due.every((entry) => entry.due)).toBe(true);
    expect(due).toHaveLength(schools.length);
  });

  it('自校と比較校で参照する頻度の欄は分けて記録する（表示用）', () => {
    const mixed: OrgSettings = {
      ...settings,
      schedule: { ...settings.schedule, selfFrequency: 'weekly', competitorFrequency: 'monthly' },
    };
    const due = allSchoolsAsDue(schools, new Map(), mixed);
    expect(due.find((e) => e.school.id === 'self')?.frequency).toBe('weekly');
    expect(due.find((e) => e.school.id === 'rival')?.frequency).toBe('monthly');
  });

  it('前回走査を引き継ぐ（scan-writer 側の重複判定などに使えるように）', () => {
    const last = new Map([['self', fromJst(2026, 8, 3, 6)]]);
    const due = allSchoolsAsDue(schools, last, settings);
    expect(due.find((e) => e.school.id === 'self')?.lastScanAt).toEqual(fromJst(2026, 8, 3, 6));
    expect(due.find((e) => e.school.id === 'rival')?.lastScanAt).toBeNull();
  });
});

function result(entries: ScanRunEntry[]): ScanRunResult {
  return {
    startedAt: '2026-08-10T21:00:00.000Z',
    finishedAt: '2026-08-10T21:12:00.000Z',
    dueCount: entries.length,
    actionsDerived: null,
    actionSyncError: null,
    entries,
    failures: entries.filter((entry) => entry.status !== 'done'),
  };
}

function entry(overrides: Partial<ScanRunEntry> = {}): ScanRunEntry {
  return {
    schoolId: 'self',
    schoolName: '本校',
    role: 'self',
    status: 'done',
    reason: null,
    pageCount: 120,
    unknownCount: 0,
    savedTo: 'scan-1',
    ...overrides,
  };
}

describe('実行結果の要約', () => {
  it('すべて成功したら通知しない', () => {
    const run = result([entry(), entry({ schoolId: 'rival', schoolName: 'A校' })]);
    expect(needsAttention(run)).toBe(false);
    expect(summarizeRun(run)).toBe('走査 2校：完了 2校／要確認 0校');
  });

  it('robots.txt で取得できなかった学校は理由つきで挙げる', () => {
    const run = result([
      entry(),
      entry({
        schoolId: 'rival',
        schoolName: 'A校',
        status: 'blocked',
        reason: 'robots.txt により許可されていません',
        pageCount: 0,
        savedTo: null,
      }),
    ]);
    expect(needsAttention(run)).toBe(true);
    expect(summarizeRun(run)).toContain('A校（取得できず）robots.txt');
    expect(summarizeRun(run)).toContain('完了 1校／要確認 1校');
  });

  it('走査は終わったが判定が付かなかった項目も知らせる', () => {
    const run = result([entry({ unknownCount: 3 })]);
    expect(needsAttention(run)).toBe(true);
    expect(summarizeRun(run)).toContain('判定できなかった項目 3件');
  });

  it('走査対象がなければその旨だけを返す', () => {
    expect(summarizeRun(result([]))).toBe('走査対象の学校はありませんでした。');
    expect(needsAttention(result([]))).toBe(false);
  });

  it('要約にページ本文を含めない（学校名・結末・理由のみ）', () => {
    const run = result([
      entry({ status: 'failed', reason: 'timeout', savedTo: null, pageCount: 0 }),
    ]);
    const summary = summarizeRun(run);
    expect(summary.split('\n')).toHaveLength(2);
    expect(summary).toContain('本校（失敗）timeout');
  });
});

describe('走査の実行', () => {
  let server: Server;
  let blockedUrl = '';

  beforeAll(async () => {
    // robots.txt で全面的に拒否するサイト
    server = createServer((request, response) => {
      if (request.url === '/robots.txt') {
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end('User-agent: *\nDisallow: /\n');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><body>本文</body></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    blockedUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function due(school: School): DueSchool {
    return { school, frequency: 'weekly', lastScanAt: null, nextScanAt: null, due: true };
  }

  it('robots.txt に拒否されたら blocked にし、結果を保存しない', async () => {
    const target = { ...school('rival', 'competitor'), url: blockedUrl };
    const run = await runDueScans([due(target)], DEFAULT_SETTINGS);

    expect(run.entries[0].status).toBe('blocked');
    expect(run.entries[0].reason).toContain('robots.txt');
    // 取得できなかったことを「情報がない」として扱わないため、保存しない
    expect(run.entries[0].savedTo).toBeNull();
    expect(run.failures).toHaveLength(1);
  });

  it('1校が失敗しても残りの学校を続ける', async () => {
    const dead = { ...school('dead', 'competitor'), url: 'http://127.0.0.1:1/' };
    const blocked = { ...school('rival', 'competitor'), url: blockedUrl };

    const run = await runDueScans([due(dead), due(blocked)], DEFAULT_SETTINGS);

    expect(run.dueCount).toBe(2);
    expect(run.entries).toHaveLength(2);
    expect(run.entries.map((e) => e.schoolId)).toEqual(['dead', 'rival']);
    expect(run.failures).toHaveLength(2);
    expect(needsAttention(run)).toBe(true);
  }, 30_000);
});

describe('実行履歴に残す区分（週1回の自動実行が動いているか画面で分かるように）', () => {
  it('GitHub Actions のスケジュール起動は自動として記録する', () => {
    expect(resolveTrigger(['node', 'scan-due.ts', '--run'], { GITHUB_EVENT_NAME: 'schedule' })).toBe(
      'cron',
    );
  });

  it('手で起こした実行（workflow_dispatch）は手動として記録する', () => {
    expect(
      resolveTrigger(['node', 'scan-due.ts', '--run'], { GITHUB_EVENT_NAME: 'workflow_dispatch' }),
    ).toBe('manual');
  });

  it('手元での実行は手動', () => {
    expect(resolveTrigger(['node', 'scan-due.ts', '--run'], {})).toBe('manual');
  });

  it('別のスケジューラからは --trigger cron で指定できる', () => {
    expect(resolveTrigger(['node', 'scan-due.ts', '--run', '--trigger', 'cron'], {})).toBe('cron');
  });

  it('--trigger は環境変数より優先する', () => {
    expect(
      resolveTrigger(['node', 'scan-due.ts', '--trigger', 'manual'], {
        GITHUB_EVENT_NAME: 'schedule',
      }),
    ).toBe('manual');
  });
});

describe('改善アクションの導出に失敗した走査', () => {
  it('走査自体は成功でも要確認として扱う（06 が前回のままになるため）', () => {
    const run = { ...result([entry()]), actionSyncError: '書き込みに失敗しました' };
    expect(needsAttention(run)).toBe(true);
    expect(summarizeRun(run)).toContain('改善アクションを作り直せませんでした');
  });

  it('導出できていれば通知しない', () => {
    expect(needsAttention(result([entry()]))).toBe(false);
  });
});
