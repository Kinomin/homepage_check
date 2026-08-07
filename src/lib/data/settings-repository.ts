/**
 * 設定の読み書き。
 *
 * Supabase が設定されていれば organization_settings を読み、未設定なら
 * プロセス内（globalThis）に保持する。画面・API・走査スクリプトは
 * すべてこの入口を通す。設定の解釈がばらつくと、画面に出ている値と
 * 実際の走査条件が食い違う。
 */

import { createDataClient } from '../supabase/server';
import {
  DEFAULT_SETTINGS,
  validateSettings,
  type JudgeEffort,
  type OrgSettings,
  type ScanFrequency,
} from '../settings';

/**
 * デモ動作時の設定。Route Handler と Server Component で
 * 同じインスタンスを見るため globalThis に置く。
 */
const demoSettings: { current: OrgSettings } = ((
  globalThis as { __demoSettings?: { current: OrgSettings } }
).__demoSettings ??= { current: structuredClone(DEFAULT_SETTINGS) });

export interface SettingsSource {
  settings: OrgSettings;
  /** Supabase から読んだ値か（false ならプロセス内の一時保存） */
  persisted: boolean;
  updatedAt: string | null;
}

export async function loadSettings(): Promise<SettingsSource> {
  const supabase = await createDataClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      return { settings: fromRow(data), persisted: true, updatedAt: data.updated_at as string };
    }
  }
  return { settings: demoSettings.current, persisted: false, updatedAt: null };
}

export async function saveSettings(input: OrgSettings): Promise<SettingsSource> {
  // 画面と API で同じ検証を通す
  const { settings, errors } = validateSettings(input);
  if (errors.length > 0) {
    throw new SettingsValidationFailure(errors.map((e) => e.message));
  }

  const supabase = await createDataClient();
  if (supabase) {
    const { data: existing } = await supabase
      .from('organization_settings')
      .select('org_id')
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { data, error } = await supabase
        .from('organization_settings')
        .update({ ...toRow(settings), updated_at: new Date().toISOString() })
        .eq('org_id', existing.org_id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return { settings: fromRow(data), persisted: true, updatedAt: data.updated_at as string };
    }
  }

  demoSettings.current = settings;
  return { settings, persisted: false, updatedAt: null };
}

export class SettingsValidationFailure extends Error {
  constructor(public readonly messages: string[]) {
    super(messages.join(' / '));
    this.name = 'SettingsValidationFailure';
  }
}

type SettingsRow = Record<string, unknown>;

function fromRow(row: SettingsRow): OrgSettings {
  const { settings } = validateSettings({
    schedule: {
      selfFrequency: row.self_scan_frequency as ScanFrequency,
      competitorFrequency: row.competitor_scan_frequency as ScanFrequency,
      dayOfWeek: Number(row.scan_day_of_week),
      dayOfMonth: Number(row.scan_day_of_month),
      hour: Number(row.scan_hour),
    },
    crawl: {
      maxDepth: Number(row.crawl_max_depth),
      selfMaxPages: Number(row.self_max_pages),
      competitorMaxPages: Number(row.competitor_max_pages),
      requestIntervalMs: Number(row.request_interval_ms),
      concurrency: Number(row.crawl_concurrency),
    },
    judge: {
      effort: row.judge_effort as JudgeEffort,
      bodyCharLimit: Number(row.judge_body_char_limit),
      candidateLimit: Number(row.judge_candidate_limit),
    },
    notify: {
      webhookUrl: (row.notify_webhook_url as string) ?? '',
      onFailure: row.notify_on_failure !== false,
    },
  });
  return settings;
}

function toRow(settings: OrgSettings): SettingsRow {
  return {
    self_scan_frequency: settings.schedule.selfFrequency,
    competitor_scan_frequency: settings.schedule.competitorFrequency,
    scan_day_of_week: settings.schedule.dayOfWeek,
    scan_day_of_month: settings.schedule.dayOfMonth,
    scan_hour: settings.schedule.hour,
    crawl_max_depth: settings.crawl.maxDepth,
    self_max_pages: settings.crawl.selfMaxPages,
    competitor_max_pages: settings.crawl.competitorMaxPages,
    request_interval_ms: settings.crawl.requestIntervalMs,
    crawl_concurrency: settings.crawl.concurrency,
    judge_effort: settings.judge.effort,
    judge_body_char_limit: settings.judge.bodyCharLimit,
    judge_candidate_limit: settings.judge.candidateLimit,
    notify_webhook_url: settings.notify.webhookUrl || null,
    notify_on_failure: settings.notify.onFailure,
  };
}
