import Link from 'next/link';

import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar } from '@/components/shell/Topbar';
import { QuickWins } from '@/components/summary/QuickWins';
import { CRITERIA } from '@/lib/analysis/criteria';
import {
  actionBreakdown,
  summarizeGap,
  topQuickWins,
  weakerCompetitorCount,
} from '@/lib/analysis/summary';
import { loadCompetitorChanges } from '@/lib/data/competitor-diff-repository';
import { DEMO_COMPETITOR_UPDATES } from '@/lib/data/demo-extras';
import { loadDashboard } from '@/lib/data/repository';
import { loadSettings } from '@/lib/data/settings-repository';
import { SCREENS, sourceLabel } from '@/lib/screens';
import { ACTION_SOURCES } from '@/lib/types';

export default async function SummaryPage() {
  const { schools, scan, gapRows, actions, isDemo } = await loadDashboard();
  const competitorCount = schools.length - 1;
  const summary = summarizeGap(gapRows);
  const breakdown = actionBreakdown(actions, ACTION_SOURCES);

  const { settings } = await loadSettings();
  const competitorDiff = isDemo
    ? null
    : await loadCompetitorChanges(
        schools.filter((school) => school.role === 'competitor'),
        settings.crawl.competitorMaxPages,
      );

  return (
    <>
      <Topbar
        screen={SCREENS.summary}
        scan={scan}
        competitorCount={competitorCount}
        criteriaCount={CRITERIA.length}
      />
      <div className="wrap">
        <DemoNote isDemo={isDemo} />

        <div className="stack">
          {/* ヒーロー：比較校すべてが公開していて本校にない情報 */}
          <div className="hero">
            <div className="lead">
              比較{competitorCount}校すべてが公開していて、本校のサイトにない情報
            </div>
            <div className="big">
              <span className="num">{summary.absentEverywhereElse.length}</span>
              <span className="unit">件</span>
              <span className="of">
                調査{summary.totalCriteria}項目中
                <br />
                {scan.startedAt.slice(0, 10)} 時点
              </span>
            </div>
            <ol>
              {summary.absentEverywhereElse.map((row, index) => (
                <li key={row.criterion.id}>
                  <span className="n">{String(index + 1).padStart(2, '0')}</span>
                  <span className="it">{row.criterion.label}</span>
                  <span className="st">主に {row.criterion.audience} が探す情報</span>
                </li>
              ))}
            </ol>
            {summary.unknownRows.length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--mute)', marginTop: 10, lineHeight: 1.8 }}>
                走査できなかった項目が {summary.unknownRows.length} 件あります。取得できなかったものは
                欠落として数えていません。
              </p>
            )}
            <div style={{ marginTop: 14 }}>
              <Link className="btn" href={SCREENS.gap.href}>
                {SCREENS.gap.title}で根拠を見る
              </Link>
            </div>
          </div>

          <div className="grid2">
            <div className="card">
              <div className="card-h">
                <h2>
                  <span className="id">SM-01</span>本校が比較校より整っている情報
                </h2>
              </div>
              <div className="card-b">
                <ul className="slist">
                  {summary.strengths.map((row) => (
                    <li key={row.criterion.id}>
                      <span className="mk">●</span>
                      <span>
                        {row.criterion.label}
                        <br />
                        <span style={{ color: 'var(--mute)', fontSize: 11 }}>
                          比較{competitorCount}校中{weakerCompetitorCount(row)}校は本校より掲載量が少ない
                        </span>
                      </span>
                    </li>
                  ))}
                  {summary.strengths.length === 0 && (
                    <li>
                      <span>該当する項目はありません</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className="card">
              <div className="card-h">
                <h2>
                  <span className="id">SM-02</span>比較校の更新記録
                </h2>
                <span className="note">公開ページの差分のみ</span>
              </div>
              <div className="card-b">
                {isDemo &&
                  DEMO_COMPETITOR_UPDATES.map((update) => (
                    <div className="diff" key={`${update.date}-${update.school}`}>
                      <span className="dt2">{update.date}</span>
                      <span className="sch">{update.school}</span>
                      <span>{update.body}</span>
                    </div>
                  ))}

                {competitorDiff?.changes.map((change) => (
                  <div className="diff" key={`${change.kind}-${change.schoolId}-${change.body}`}>
                    <span className="dt2">{formatShortJst(change.observedAt)}</span>
                    <span className="sch">{change.schoolName}</span>
                    <span>{change.body}</span>
                  </div>
                ))}

                {/* 差分が出せない理由を分けて書く。「変化がない」と混ぜない */}
                {competitorDiff && competitorDiff.changes.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.9 }}>
                    {competitorDiff.availability === 'no-scan' &&
                      '比較校の走査記録がまだありません。1回目の走査が終わると記録が始まります。'}
                    {competitorDiff.availability === 'first-scan' &&
                      '比較校の走査が1回目のため、比べる相手がありません。2回目の走査から差分を表示します。'}
                    {competitorDiff.availability === 'ready' &&
                      '前回の走査から、公開状況の変化は確認できませんでした。'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>
                <span className="id">SM-03</span>指摘件数の内訳
              </h2>
              <span className="note">検出された改善余地 {actions.length}件</span>
            </div>
            <div className="card-b">
              <table className="dt">
                <thead>
                  <tr>
                    <th>検出元</th>
                    <th>件数</th>
                    <th>優先度 高</th>
                    <th>難易度 低</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row) => (
                    <tr key={row.source}>
                      <td>{sourceLabel(row.source)}</td>
                      <td className="n">{row.total}</td>
                      <td className="n">{row.highPriority}</td>
                      <td className="n">{row.lowDifficulty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>
                <span className="id">SM-04</span>優先度が高く、難易度の低いもの
              </h2>
              <span className="note">チェックすると対応済みとして記録されます</span>
            </div>
            <div className="card-b">
              <QuickWins actions={topQuickWins(actions)} />
              <div style={{ marginTop: 14 }}>
                <Link className="btn ghost" href={SCREENS.action.href}>
                  {SCREENS.action.title}
                  {actions.length}件を見る
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** 走査日は日本時間で「8/02」の形にする（実行環境のタイムゾーンに左右させない） */
function formatShortJst(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: '2-digit',
  })
    .format(date)
    .replace('/', '/');
}
