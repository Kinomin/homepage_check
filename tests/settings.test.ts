import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  SCANS_PER_MONTH,
  estimateMonthlyJudgements,
  fromJst,
  isScanDue,
  nextScanAt,
  toJstParts,
  validateSettings,
  type OrgSettings,
  type ScheduleSettings,
} from '../src/lib/settings';

const schedule: ScheduleSettings = {
  selfFrequency: 'weekly',
  competitorFrequency: 'monthly',
  dayOfWeek: 1, // 月曜
  dayOfMonth: 1,
  hour: 6,
};

describe('次回走査日時（日本時間で解釈する）', () => {
  it('週次は指定曜日・時刻の次の回', () => {
    // 2026-08-03(月) 06:00 JST に走査 → 次は 2026-08-10(月) 06:00 JST
    const last = fromJst(2026, 8, 3, 6);
    const next = nextScanAt('weekly', schedule, last);
    expect(toJstParts(next!)).toMatchObject({ year: 2026, month: 8, day: 10, hour: 6, weekday: 1 });
  });

  it('週の途中に走査しても、次は指定曜日に揃う', () => {
    const last = fromJst(2026, 8, 5, 14); // 水曜の午後
    const next = nextScanAt('weekly', schedule, last);
    expect(toJstParts(next!)).toMatchObject({ month: 8, day: 10, hour: 6, weekday: 1 });
  });

  it('隔週は14日以上あとの指定曜日', () => {
    const last = fromJst(2026, 8, 3, 6);
    const next = nextScanAt('biweekly', schedule, last);
    expect(toJstParts(next!)).toMatchObject({ month: 8, day: 17, hour: 6, weekday: 1 });
  });

  it('月次は指定日・時刻の次の回', () => {
    const last = fromJst(2026, 8, 1, 6);
    const next = nextScanAt('monthly', schedule, last);
    expect(toJstParts(next!)).toMatchObject({ year: 2026, month: 9, day: 1, hour: 6 });
  });

  it('月次は年をまたいでも正しい', () => {
    const last = fromJst(2026, 12, 1, 6);
    const next = nextScanAt('monthly', schedule, last);
    expect(toJstParts(next!)).toMatchObject({ year: 2027, month: 1, day: 1, hour: 6 });
  });

  it('手動のみは次回がない', () => {
    expect(nextScanAt('manual', schedule, new Date())).toBeNull();
  });

  it('実行環境のタイムゾーンに左右されない（UTC 換算で9時間前）', () => {
    const next = nextScanAt('weekly', schedule, fromJst(2026, 8, 3, 6));
    expect(next!.toISOString()).toBe('2026-08-09T21:00:00.000Z');
  });
});

describe('走査すべきかの判定（cron から使う）', () => {
  it('一度も走査していない学校は対象', () => {
    expect(isScanDue('weekly', schedule, null, fromJst(2026, 8, 5, 6))).toBe(true);
  });

  it('次回日時を過ぎていれば対象', () => {
    const last = fromJst(2026, 8, 3, 6);
    expect(isScanDue('weekly', schedule, last, fromJst(2026, 8, 10, 7))).toBe(true);
  });

  it('次回日時前は対象外', () => {
    const last = fromJst(2026, 8, 3, 6);
    expect(isScanDue('weekly', schedule, last, fromJst(2026, 8, 9, 23))).toBe(false);
  });

  it('手動のみは自動実行の対象にならない', () => {
    expect(isScanDue('manual', schedule, null, new Date())).toBe(false);
  });

  it('比較校を月次にすると、週次の自校と実行日が分かれる', () => {
    const last = fromJst(2026, 8, 3, 6);
    const now = fromJst(2026, 8, 10, 6);
    expect(isScanDue(schedule.selfFrequency, schedule, last, now)).toBe(true);
    expect(isScanDue(schedule.competitorFrequency, schedule, last, now)).toBe(false);
  });
});

describe('判定コストの見積もり（handoff.md 9章A）', () => {
  it('既定値（自校 週次／比較校 月次・4校）では月 248 判定', () => {
    const estimate = estimateMonthlyJudgements(DEFAULT_SETTINGS, 4, 31);
    expect(estimate.selfPerMonth).toBe(31 * 4);
    expect(estimate.competitorsPerMonth).toBe(31 * 4 * 1);
    expect(estimate.totalPerMonth).toBe(248);
  });

  it('比較校も週次にすると判定数が跳ね上がる', () => {
    const weekly: OrgSettings = {
      ...DEFAULT_SETTINGS,
      schedule: { ...DEFAULT_SETTINGS.schedule, competitorFrequency: 'weekly' },
    };
    expect(estimateMonthlyJudgements(weekly, 4, 31).totalPerMonth).toBe(31 * 4 + 31 * 4 * 4);
  });

  it('手動のみは自動実行ぶんの判定が発生しない', () => {
    expect(SCANS_PER_MONTH.manual).toBe(0);
    const manual: OrgSettings = {
      ...DEFAULT_SETTINGS,
      schedule: {
        ...DEFAULT_SETTINGS.schedule,
        selfFrequency: 'manual',
        competitorFrequency: 'manual',
      },
    };
    expect(estimateMonthlyJudgements(manual, 4, 31).totalPerMonth).toBe(0);
  });
});

describe('設定の検証', () => {
  it('既定値はそのまま通る', () => {
    const { settings, errors } = validateSettings(DEFAULT_SETTINGS);
    expect(errors).toHaveLength(0);
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('範囲外の値はエラーにし、範囲内に丸める', () => {
    const { settings, errors } = validateSettings({
      ...DEFAULT_SETTINGS,
      crawl: { ...DEFAULT_SETTINGS.crawl, maxDepth: 99, concurrency: 0 },
    });
    expect(errors.map((e) => e.field)).toEqual(['maxDepth', 'concurrency']);
    expect(settings.crawl.maxDepth).toBe(6);
    expect(settings.crawl.concurrency).toBe(1);
  });

  it('リクエスト間隔を短くしすぎられない（相手サイトへの負荷）', () => {
    const { errors } = validateSettings({
      ...DEFAULT_SETTINGS,
      crawl: { ...DEFAULT_SETTINGS.crawl, requestIntervalMs: 10 },
    });
    expect(errors.some((e) => e.field === 'requestIntervalMs')).toBe(true);
  });

  it('未知の頻度・思考深度は受け付けない', () => {
    const { errors } = validateSettings({
      ...DEFAULT_SETTINGS,
      schedule: {
        ...DEFAULT_SETTINGS.schedule,
        selfFrequency: 'daily' as never,
      },
      judge: { ...DEFAULT_SETTINGS.judge, effort: 'turbo' as never },
    });
    expect(errors.map((e) => e.field).sort()).toEqual(['effort', 'selfFrequency']);
  });

  it('月次の実行日は28日までに制限する（月末のずれを避ける）', () => {
    const { errors, settings } = validateSettings({
      ...DEFAULT_SETTINGS,
      schedule: { ...DEFAULT_SETTINGS.schedule, dayOfMonth: 31 },
    });
    expect(errors.some((e) => e.field === 'dayOfMonth')).toBe(true);
    expect(settings.schedule.dayOfMonth).toBe(28);
  });
});
