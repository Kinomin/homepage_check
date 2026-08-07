/**
 * 組織ごとの設定（走査スケジュール・クロール範囲・判定コスト）。
 *
 * handoff.md 9章A は「比較校は月次、自校は週次、という頻度差を付けるか」を
 * 要確定事項として残している。ここでコードに固定せず、設定として変更できるようにする。
 * 既定値は handoff.md の推奨（自校 週次／比較校 月次、深度4、比較校は判定に必要な範囲のみ）。
 *
 * 次回走査日時の算出は純関数にしてある（副作用なし・テストで固定）。
 * 走査時刻はすべて日本時間（Asia/Tokyo）で解釈する。日本の学校向けであり、
 * 実行環境のタイムゾーンに結果を左右させないため。
 */

/* ===== 走査スケジュール ===== */

export const SCAN_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'manual'] as const;
export type ScanFrequency = (typeof SCAN_FREQUENCIES)[number];

export const SCAN_FREQUENCY_LABEL: Record<ScanFrequency, string> = {
  weekly: '週次',
  biweekly: '隔週',
  monthly: '月次',
  manual: '手動のみ',
};

export const SCAN_FREQUENCY_NOTE: Record<ScanFrequency, string> = {
  weekly: '毎週1回。更新の速い自校向け',
  biweekly: '2週に1回',
  monthly: '月1回。判定コストを抑えたい比較校向け',
  manual: '自動実行しない。設定画面から手動で走査する',
};

/** 月あたりの走査回数（判定コストの見積もりに使う） */
export const SCANS_PER_MONTH: Record<ScanFrequency, number> = {
  weekly: 4,
  biweekly: 2,
  monthly: 1,
  manual: 0,
};

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export interface ScheduleSettings {
  /** 自校の走査頻度 */
  selfFrequency: ScanFrequency;
  /** 比較校の走査頻度。自校と分けられる（handoff.md 9章A） */
  competitorFrequency: ScanFrequency;
  /** 週次・隔週のときの実行曜日（0=日曜） */
  dayOfWeek: number;
  /** 月次のときの実行日（月末のずれを避けるため 1〜28） */
  dayOfMonth: number;
  /** 実行時刻（日本時間の時。学校サイトへの負荷が低い早朝を既定にする） */
  hour: number;
}

export interface CrawlSettings {
  /** クロール深度（handoff.md 6章の既定は 4） */
  maxDepth: number;
  /** 自校の取得ページ数上限 */
  selfMaxPages: number;
  /** 比較校の取得ページ数上限（判定に必要な範囲に絞る：要確定事項B） */
  competitorMaxPages: number;
  /** リクエスト間隔（ミリ秒）。robots.txt の Crawl-delay の方が長ければそちらを優先 */
  requestIntervalMs: number;
  /** 同時接続数 */
  concurrency: number;
}

export const JUDGE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type JudgeEffort = (typeof JUDGE_EFFORTS)[number];

export interface JudgeSettings {
  /** 判定の思考深度。上げるほど精度は上がるがコストも増える */
  effort: JudgeEffort;
  /** 1ページあたりに渡す本文の文字数上限 */
  bodyCharLimit: number;
  /** 1項目あたりに渡す候補ページ数 */
  candidateLimit: number;
}

export interface OrgSettings {
  schedule: ScheduleSettings;
  crawl: CrawlSettings;
  judge: JudgeSettings;
}

/** 初期設定。handoff.md の推奨をそのまま既定値にしている。 */
export const DEFAULT_SETTINGS: OrgSettings = {
  schedule: {
    selfFrequency: 'weekly',
    competitorFrequency: 'monthly',
    dayOfWeek: 1, // 月曜
    dayOfMonth: 1,
    hour: 6,
  },
  crawl: {
    maxDepth: 4,
    selfMaxPages: 200,
    competitorMaxPages: 60,
    requestIntervalMs: 1000,
    concurrency: 2,
  },
  judge: {
    effort: 'low',
    bodyCharLimit: 2500,
    candidateLimit: 5,
  },
};

/* ===== 入力値の検証 ===== */

export interface SettingsFieldRange {
  min: number;
  max: number;
  label: string;
  note: string;
}

export const SETTINGS_RANGES = {
  dayOfWeek: { min: 0, max: 6, label: '実行曜日', note: '' },
  dayOfMonth: { min: 1, max: 28, label: '実行日', note: '月末のずれを避けるため1〜28日' },
  hour: { min: 0, max: 23, label: '実行時刻', note: '日本時間' },
  maxDepth: { min: 1, max: 6, label: 'クロール深度', note: '既定は4' },
  selfMaxPages: { min: 10, max: 1000, label: '自校の取得ページ数上限', note: '' },
  competitorMaxPages: {
    min: 10,
    max: 500,
    label: '比較校の取得ページ数上限',
    note: '判定に必要な範囲に絞る',
  },
  requestIntervalMs: {
    min: 200,
    max: 10000,
    label: 'リクエスト間隔',
    note: '相手サイトへの負荷を抑えるため短くしすぎない',
  },
  concurrency: { min: 1, max: 4, label: '同時接続数', note: '' },
  bodyCharLimit: { min: 500, max: 8000, label: '1ページあたりの本文上限', note: '判定コストに直結' },
  candidateLimit: { min: 1, max: 10, label: '1項目あたりの候補ページ数', note: '判定コストに直結' },
} satisfies Record<string, SettingsFieldRange>;

export type SettingsRangeKey = keyof typeof SETTINGS_RANGES;

export interface SettingsValidationError {
  field: string;
  message: string;
}

function clampError(
  key: SettingsRangeKey,
  value: number,
  errors: SettingsValidationError[],
): number {
  const range = SETTINGS_RANGES[key];
  if (!Number.isInteger(value) || value < range.min || value > range.max) {
    errors.push({
      field: key,
      message: `${range.label}は ${range.min}〜${range.max} の整数で指定してください`,
    });
    return Math.min(range.max, Math.max(range.min, Math.round(Number.isFinite(value) ? value : range.min)));
  }
  return value;
}

/**
 * 受け取った設定を検証し、範囲内に収めた値とエラーを返す。
 * 画面・API の両方から同じ関数を通す（片方だけ緩い、という状態を作らない）。
 */
export function validateSettings(input: OrgSettings): {
  settings: OrgSettings;
  errors: SettingsValidationError[];
} {
  const errors: SettingsValidationError[] = [];

  const frequency = (value: ScanFrequency, field: string): ScanFrequency => {
    if (!SCAN_FREQUENCIES.includes(value)) {
      errors.push({ field, message: `頻度は ${SCAN_FREQUENCIES.join(' / ')} のいずれかです` });
      return 'manual';
    }
    return value;
  };

  const effort = checkEffort(input.judge.effort, errors);

  return {
    settings: {
      schedule: {
        selfFrequency: frequency(input.schedule.selfFrequency, 'selfFrequency'),
        competitorFrequency: frequency(input.schedule.competitorFrequency, 'competitorFrequency'),
        dayOfWeek: clampError('dayOfWeek', input.schedule.dayOfWeek, errors),
        dayOfMonth: clampError('dayOfMonth', input.schedule.dayOfMonth, errors),
        hour: clampError('hour', input.schedule.hour, errors),
      },
      crawl: {
        maxDepth: clampError('maxDepth', input.crawl.maxDepth, errors),
        selfMaxPages: clampError('selfMaxPages', input.crawl.selfMaxPages, errors),
        competitorMaxPages: clampError('competitorMaxPages', input.crawl.competitorMaxPages, errors),
        requestIntervalMs: clampError('requestIntervalMs', input.crawl.requestIntervalMs, errors),
        concurrency: clampError('concurrency', input.crawl.concurrency, errors),
      },
      judge: {
        effort,
        bodyCharLimit: clampError('bodyCharLimit', input.judge.bodyCharLimit, errors),
        candidateLimit: clampError('candidateLimit', input.judge.candidateLimit, errors),
      },
    },
    errors,
  };
}

function checkEffort(value: JudgeEffort, errors: SettingsValidationError[]): JudgeEffort {
  if (!JUDGE_EFFORTS.includes(value)) {
    errors.push({ field: 'effort', message: `思考深度は ${JUDGE_EFFORTS.join(' / ')} のいずれかです` });
    return DEFAULT_SETTINGS.judge.effort;
  }
  return value;
}

/* ===== 次回走査日時の算出 ===== */

const JST_OFFSET_MINUTES = 9 * 60;

/** 日本時間の年月日・時から UTC の Date を作る */
export function fromJst(year: number, month: number, day: number, hour: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0) - JST_OFFSET_MINUTES * 60_000);
}

/** UTC の Date を日本時間の年月日・曜日・時に分解する */
export function toJstParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: number;
} {
  const shifted = new Date(date.getTime() + JST_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * 次回の走査日時。`manual` の場合は null（自動実行しない）。
 *
 * ・weekly  … 指定曜日・時刻のうち after より後の最初の日時
 * ・biweekly … 同じ条件で、after から14日以上あとの最初の日時
 * ・monthly … 指定日・時刻のうち after より後の最初の日時
 */
export function nextScanAt(
  frequency: ScanFrequency,
  schedule: ScheduleSettings,
  after: Date,
): Date | null {
  if (frequency === 'manual') return null;

  // 隔週は「前回から14日以上あと」が条件。週次・月次は前回より後であればよい。
  const minimumDays = frequency === 'biweekly' ? 14 : 0;
  const minimumTime = after.getTime() + minimumDays * 24 * 60 * 60_000;
  const isValid = (candidate: Date) =>
    candidate.getTime() >= minimumTime && candidate.getTime() > after.getTime();

  const parts = toJstParts(new Date(minimumTime));

  if (frequency === 'monthly') {
    const candidate = fromJst(parts.year, parts.month, schedule.dayOfMonth, schedule.hour);
    if (isValid(candidate)) return candidate;
    const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
    const nextYear = parts.month === 12 ? parts.year + 1 : parts.year;
    return fromJst(nextYear, nextMonth, schedule.dayOfMonth, schedule.hour);
  }

  // weekly / biweekly：指定曜日まで進める
  const dayGap = (schedule.dayOfWeek - parts.weekday + 7) % 7;
  const sameWeek = new Date(
    fromJst(parts.year, parts.month, parts.day, schedule.hour).getTime() +
      dayGap * 24 * 60 * 60_000,
  );
  if (isValid(sameWeek)) return sameWeek;
  return new Date(sameWeek.getTime() + 7 * 24 * 60 * 60_000);
}

/** その学校をいま走査すべきか（cron から呼ぶ） */
export function isScanDue(
  frequency: ScanFrequency,
  schedule: ScheduleSettings,
  lastScanAt: Date | null,
  now: Date,
): boolean {
  if (frequency === 'manual') return false;
  if (!lastScanAt) return true; // 一度も走査していなければ対象
  const next = nextScanAt(frequency, schedule, lastScanAt);
  return next !== null && next.getTime() <= now.getTime();
}

/* ===== 判定コストの見積もり（handoff.md 9章A） ===== */

export interface JudgementEstimate {
  selfPerMonth: number;
  competitorsPerMonth: number;
  totalPerMonth: number;
}

/**
 * 月あたりの判定数。31項目 × 校数 × 走査回数。
 * 設定画面でその場に出し、頻度を上げたときのコスト増が見えるようにする。
 */
export function estimateMonthlyJudgements(
  settings: OrgSettings,
  competitorCount: number,
  criteriaCount: number,
): JudgementEstimate {
  const selfPerMonth = criteriaCount * SCANS_PER_MONTH[settings.schedule.selfFrequency];
  const competitorsPerMonth =
    criteriaCount * competitorCount * SCANS_PER_MONTH[settings.schedule.competitorFrequency];
  return {
    selfPerMonth,
    competitorsPerMonth,
    totalPerMonth: selfPerMonth + competitorsPerMonth,
  };
}
