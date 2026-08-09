'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { StaticDemoNote } from '@/components/shell/StaticDemoNote';
import type { ScanRunRecord } from '@/lib/data/scan-run-repository';
import { IS_STATIC_DEMO } from '@/lib/static-demo';
import {
  DEFAULT_SETTINGS,
  JUDGE_EFFORTS,
  SCANS_PER_MONTH,
  SCAN_FREQUENCIES,
  SCAN_FREQUENCY_LABEL,
  SCAN_FREQUENCY_NOTE,
  SETTINGS_RANGES,
  WEEKDAY_LABELS,
  estimateMonthlyJudgements,
  nextScanAt,
  type OrgSettings,
  type ScanFrequency,
  type SettingsRangeKey,
} from '@/lib/settings';

/**
 * 09 設定。
 *
 * ・走査スケジュール（自校・比較校で頻度を分けられる：handoff.md 9章A）
 * ・クロール範囲（比較校は判定に必要な範囲に絞る：9章B）
 * ・判定コスト（LLM に渡す量と思考深度）
 *
 * 入力の範囲は SETTINGS_RANGES を唯一の定義元とし、画面の input と
 * サーバ側の検証で同じ値を使う。保存後は画面全体を再取得して、
 * サイドバーの「次回走査」など他画面の表示も同時に更新する。
 */
export function SettingsForm({
  initialSettings,
  persisted,
  competitorCount,
  criteriaCount,
  lastScanAt,
  cronEnabled,
  canManage,
  recentRuns,
}: {
  initialSettings: OrgSettings;
  persisted: boolean;
  competitorCount: number;
  criteriaCount: number;
  lastScanAt: string;
  /** 自動実行が有効か（CRON_SECRET の有無） */
  cronEnabled: boolean;
  /** 設定を変更できる権限があるか（管理者のみ：handoff.md 7章） */
  canManage: boolean;
  /** 直近の実行記録。走査の失敗に気づけるようにする */
  recentRuns: ScanRunRecord[];
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<OrgSettings>(initialSettings);
  const [saving, startSaving] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const estimate = estimateMonthlyJudgements(settings, competitorCount, criteriaCount);
  const baseline = estimateMonthlyJudgements(DEFAULT_SETTINGS, competitorCount, criteriaCount);
  const nextSelf = nextScanAt(
    settings.schedule.selfFrequency,
    settings.schedule,
    new Date(lastScanAt),
  );
  const nextCompetitor = nextScanAt(
    settings.schedule.competitorFrequency,
    settings.schedule,
    new Date(lastScanAt),
  );

  const dirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  function save() {
    startSaving(async () => {
      setMessage(null);
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage({ kind: 'error', text: body?.error ?? '保存に失敗しました' });
        return;
      }
      setMessage({
        kind: 'ok',
        text: persisted
          ? '保存しました'
          : '保存しました（Supabase 未接続のため、サーバを再起動すると既定値に戻ります）',
      });
      router.refresh();
    });
  }

  return (
    <div className="stack">
      {/* 走査スケジュール */}
      <div className="card">
        <div className="card-h">
          <h2>
            <span className="id">ST-01</span>走査スケジュール
          </h2>
          <span className="note">自校と比較校で頻度を分けられます</span>
        </div>
        <div className="card-b">
          <div className="grid2">
            <FrequencyField
              label="自校の走査頻度"
              note="更新が速い時期だけ週次に上げるのがおすすめ"
              value={settings.schedule.selfFrequency}
              nextRun={nextSelf}
              onChange={(selfFrequency) =>
                setSettings((s) => ({ ...s, schedule: { ...s.schedule, selfFrequency } }))
              }
            />
            <FrequencyField
              label="比較校の走査頻度"
              note="判定コストを抑えるなら月次"
              value={settings.schedule.competitorFrequency}
              nextRun={nextCompetitor}
              onChange={(competitorFrequency) =>
                setSettings((s) => ({ ...s, schedule: { ...s.schedule, competitorFrequency } }))
              }
            />
          </div>

          <div className="setting-row" style={{ marginTop: 16 }}>
            <div className="setting-label">
              実行曜日
              <small>週次・隔週のときに使います</small>
            </div>
            <div className="seg">
              {WEEKDAY_LABELS.map((label, index) => (
                <button
                  key={label}
                  aria-pressed={settings.schedule.dayOfWeek === index}
                  onClick={() =>
                    setSettings((s) => ({ ...s, schedule: { ...s.schedule, dayOfWeek: index } }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <NumberRow
            rangeKey="dayOfMonth"
            value={settings.schedule.dayOfMonth}
            suffix="日"
            hint="月次のときに使います"
            onChange={(dayOfMonth) =>
              setSettings((s) => ({ ...s, schedule: { ...s.schedule, dayOfMonth } }))
            }
          />
          <NumberRow
            rangeKey="hour"
            value={settings.schedule.hour}
            suffix="時"
            hint="学校サイトへの負荷が低い早朝を推奨"
            onChange={(hour) => setSettings((s) => ({ ...s, schedule: { ...s.schedule, hour } }))}
          />

          <p className="setting-note">
            「手動のみ」を選んだ対象は自動実行から外れ、<code> npm run scan </code>
            での個別実行のみになります。
            <br />
            自動実行を起こしているのは <code>.github/workflows/scan.yml</code> で、
            <b>週1回（月曜 6時）＋失敗時の拾い直し（水・金）</b>に様子を見に来ます。
            ここで決めた曜日・時刻とその確認タイミングがずれても、次に来たときに
            拾われるので合わせる必要はありません。ただし確認は週1回なので、
            スケジュールに達してから実際に走査されるまで最大で数日ずれます。
          </p>
        </div>
      </div>

      {/* 自動実行 */}
      <div className="card">
        <div className="card-h">
          <h2>
            <span className="id">ST-04</span>自動実行と通知
          </h2>
          <span className="note">走査が失敗したまま気づかれない状態を作らないため</span>
        </div>
        <div className="card-b">
          <div className="setting-row">
            <div className="setting-label">
              自動実行
              <small>週1回（月曜 6時）に起動し、上のスケジュールに達した学校だけを走査します</small>
            </div>
            <span
              className="tag"
              style={{
                background: cronEnabled ? 'var(--sage-tint)' : 'var(--surface-3)',
                color: cronEnabled ? 'var(--sage)' : 'var(--mute)',
              }}
            >
              {cronEnabled ? '有効' : '無効（CRON_SECRET 未設定）'}
            </span>
          </div>

          <div className="setting-row">
            <div className="setting-label">
              失敗時に通知する
              <small>通知を切っても、実行の記録はこの画面に残ります</small>
            </div>
            <div className="seg">
              <button
                aria-pressed={settings.notify.onFailure}
                onClick={() =>
                  setSettings((s) => ({ ...s, notify: { ...s.notify, onFailure: true } }))
                }
              >
                通知する
              </button>
              <button
                aria-pressed={!settings.notify.onFailure}
                onClick={() =>
                  setSettings((s) => ({ ...s, notify: { ...s.notify, onFailure: false } }))
                }
              >
                通知しない
              </button>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">
              通知先の Webhook URL
              <small>Slack・Google Chat・自前の受け口のいずれでも使えます（https のみ）</small>
            </div>
            <div className="setting-input" style={{ flex: 1, maxWidth: 420 }}>
              <input
                type="url"
                style={{ width: '100%' }}
                placeholder="https://hooks.example.com/..."
                value={settings.notify.webhookUrl}
                disabled={!settings.notify.onFailure}
                onChange={(event) =>
                  setSettings((s) => ({
                    ...s,
                    notify: { ...s.notify, webhookUrl: event.target.value },
                  }))
                }
              />
            </div>
          </div>

          <p className="setting-note">
            通知に載せるのは学校名・結末・理由だけです。ページ本文は送りません。
            走査できなかった学校の結果は保存しません（取得できなかったことを「情報がない」として扱わないため）。
          </p>

          {recentRuns.length > 0 ? (
            <table className="dt" style={{ marginTop: 14 }}>
              <thead>
                <tr>
                  <th>実行</th>
                  <th>起動</th>
                  <th>対象</th>
                  <th>要確認</th>
                  <th>内容</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{formatJst(new Date(run.startedAt))}</td>
                    <td>{run.trigger === 'cron' ? '自動' : '手動'}</td>
                    <td className="n">{run.dueCount}校</td>
                    <td className="n" style={{ color: run.failedCount > 0 ? 'var(--rose)' : undefined }}>
                      {run.failedCount}校
                    </td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{run.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="setting-note">自動実行の記録はまだありません。</p>
          )}
        </div>
      </div>

      {/* 判定コスト */}
      <div className="card">
        <div className="card-h">
          <h2>
            <span className="id">ST-02</span>判定コスト
          </h2>
          <span className="note">頻度と渡す情報量で決まります</span>
        </div>
        <div className="card-b">
          <table className="dt">
            <thead>
              <tr>
                <th>対象</th>
                <th>頻度</th>
                <th>月あたりの判定数</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>自校</td>
                <td>
                  {SCAN_FREQUENCY_LABEL[settings.schedule.selfFrequency]}（月
                  {SCANS_PER_MONTH[settings.schedule.selfFrequency]}回）
                </td>
                <td className="n">{estimate.selfPerMonth}</td>
              </tr>
              <tr>
                <td>比較校 {competitorCount}校</td>
                <td>
                  {SCAN_FREQUENCY_LABEL[settings.schedule.competitorFrequency]}（月
                  {SCANS_PER_MONTH[settings.schedule.competitorFrequency]}回）
                </td>
                <td className="n">{estimate.competitorsPerMonth}</td>
              </tr>
              <tr>
                <td>
                  <b>合計</b>
                  <span className="sub2">{criteriaCount}項目 × 校数 × 走査回数</span>
                </td>
                <td>—</td>
                <td className="n">
                  <b>{estimate.totalPerMonth}</b>
                  {estimate.totalPerMonth !== baseline.totalPerMonth && (
                    <span
                      className="sub2"
                      style={{
                        color:
                          estimate.totalPerMonth > baseline.totalPerMonth
                            ? 'var(--rose)'
                            : 'var(--sage)',
                      }}
                    >
                      既定値 {baseline.totalPerMonth} 比{' '}
                      {estimate.totalPerMonth > baseline.totalPerMonth ? '+' : ''}
                      {estimate.totalPerMonth - baseline.totalPerMonth}
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <div className="setting-row">
              <div className="setting-label">
                思考深度
                <small>上げるほど判定は丁寧になりますが、コストも増えます</small>
              </div>
              <div className="seg">
                {JUDGE_EFFORTS.map((effort) => (
                  <button
                    key={effort}
                    aria-pressed={settings.judge.effort === effort}
                    onClick={() => setSettings((s) => ({ ...s, judge: { ...s.judge, effort } }))}
                  >
                    {effort}
                  </button>
                ))}
              </div>
            </div>
            <NumberRow
              rangeKey="bodyCharLimit"
              value={settings.judge.bodyCharLimit}
              suffix="字"
              hint="1ページあたりに LLM へ渡す本文の量"
              onChange={(bodyCharLimit) =>
                setSettings((s) => ({ ...s, judge: { ...s.judge, bodyCharLimit } }))
              }
            />
            <NumberRow
              rangeKey="candidateLimit"
              value={settings.judge.candidateLimit}
              suffix="ページ"
              hint="1項目あたりに渡す候補ページ数"
              onChange={(candidateLimit) =>
                setSettings((s) => ({ ...s, judge: { ...s.judge, candidateLimit } }))
              }
            />
          </div>
        </div>
      </div>

      {/* クロール範囲 */}
      <div className="card">
        <div className="card-h">
          <h2>
            <span className="id">ST-03</span>クロール範囲
          </h2>
          <span className="note">robots.txt は設定に関わらず必ず尊重します</span>
        </div>
        <div className="card-b">
          <NumberRow
            rangeKey="maxDepth"
            value={settings.crawl.maxDepth}
            suffix="階層"
            hint="トップページからたどる深さ"
            onChange={(maxDepth) => setSettings((s) => ({ ...s, crawl: { ...s.crawl, maxDepth } }))}
          />
          <NumberRow
            rangeKey="selfMaxPages"
            value={settings.crawl.selfMaxPages}
            suffix="ページ"
            hint="全体集計（写真点数など）は自校のみで取ります"
            onChange={(selfMaxPages) =>
              setSettings((s) => ({ ...s, crawl: { ...s.crawl, selfMaxPages } }))
            }
          />
          <NumberRow
            rangeKey="competitorMaxPages"
            value={settings.crawl.competitorMaxPages}
            suffix="ページ"
            hint="比較校は判定に必要なページのみ走査します"
            onChange={(competitorMaxPages) =>
              setSettings((s) => ({ ...s, crawl: { ...s.crawl, competitorMaxPages } }))
            }
          />
          <NumberRow
            rangeKey="requestIntervalMs"
            value={settings.crawl.requestIntervalMs}
            suffix="ミリ秒"
            hint="robots.txt の Crawl-delay の方が長ければそちらを優先します"
            onChange={(requestIntervalMs) =>
              setSettings((s) => ({ ...s, crawl: { ...s.crawl, requestIntervalMs } }))
            }
          />
          <NumberRow
            rangeKey="concurrency"
            value={settings.crawl.concurrency}
            suffix="接続"
            hint="相手サイトへの同時接続数"
            onChange={(concurrency) =>
              setSettings((s) => ({ ...s, crawl: { ...s.crawl, concurrency } }))
            }
          />
          <p className="setting-note">
            比較校のページ本文は保存しません（判定に必要な集計値と URL のみ保持します）。
          </p>
        </div>
      </div>

      {/* 保存 */}
      <div className="card">
        <div className="card-b">
          <div className="btnrow" style={{ margin: 0, alignItems: 'center' }}>
            <button
              className="btn"
              onClick={save}
              disabled={saving || !dirty || IS_STATIC_DEMO || !canManage}
            >
              {saving ? '保存中…' : '設定を保存する'}
            </button>
            <button
              className="btn ghost"
              onClick={() => setSettings(DEFAULT_SETTINGS)}
              disabled={saving}
            >
              初期設定に戻す
            </button>
            {message && (
              <span
                className="tag"
                style={{
                  marginLeft: 8,
                  background: message.kind === 'ok' ? 'var(--sage-tint)' : 'var(--rose-tint)',
                  color: message.kind === 'ok' ? 'var(--sage)' : 'var(--rose)',
                }}
              >
                {message.text}
              </span>
            )}
            {dirty && !message && !IS_STATIC_DEMO && (
              <span className="lb" style={{ marginLeft: 8 }}>
                未保存の変更があります
              </span>
            )}
          </div>
          {!canManage && (
            <p className="setting-note">
              設定の変更は管理者のみ行えます。閲覧者の権限では内容の確認のみです。
            </p>
          )}
          <StaticDemoNote what="設定の値" />
        </div>
      </div>
    </div>
  );
}

function FrequencyField({
  label,
  note,
  value,
  nextRun,
  onChange,
}: {
  label: string;
  note: string;
  value: ScanFrequency;
  nextRun: Date | null;
  onChange: (value: ScanFrequency) => void;
}) {
  return (
    <div>
      <div className="setting-label" style={{ marginBottom: 7 }}>
        {label}
        <small>{note}</small>
      </div>
      <div className="seg" style={{ width: 'fit-content' }}>
        {SCAN_FREQUENCIES.map((frequency) => (
          <button
            key={frequency}
            aria-pressed={value === frequency}
            title={SCAN_FREQUENCY_NOTE[frequency]}
            onClick={() => onChange(frequency)}
          >
            {SCAN_FREQUENCY_LABEL[frequency]}
          </button>
        ))}
      </div>
      <div className="setting-next">
        次回：
        <b>{nextRun ? formatJst(nextRun) : '自動実行なし'}</b>
      </div>
    </div>
  );
}

function NumberRow({
  rangeKey,
  value,
  suffix,
  hint,
  onChange,
}: {
  rangeKey: SettingsRangeKey;
  value: number;
  suffix: string;
  hint: string;
  onChange: (value: number) => void;
}) {
  const range = SETTINGS_RANGES[rangeKey];
  return (
    <div className="setting-row">
      <div className="setting-label">
        {range.label}
        <small>{[hint, range.note].filter(Boolean).join(' ／ ')}</small>
      </div>
      <div className="setting-input">
        <input
          type="number"
          min={range.min}
          max={range.max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="setting-suffix">{suffix}</span>
        <span className="setting-range">
          {range.min}〜{range.max}
        </span>
      </div>
    </div>
  );
}

function formatJst(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
