import { DiscoveryChecks } from '@/components/discovery/DiscoveryChecks';
import { RankingTable } from '@/components/discovery/RankingTable';
import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar } from '@/components/shell/Topbar';
import { CRITERIA } from '@/lib/analysis/criteria';
import { analyzeDiscovery, findNamingGaps } from '@/lib/analysis/discovery';
import { loadRankings } from '@/lib/data/ranking-repository';
import { loadDashboard } from '@/lib/data/repository';
import { SCREENS } from '@/lib/screens';

export default async function DiscoveryPage() {
  const { schools, scan, selfPages, actions, isDemo } = await loadDashboard();
  const selfName = schools[0]?.name ?? '';
  const discovery = analyzeDiscovery({ pages: selfPages, schoolName: selfName });
  const namingGaps = findNamingGaps(selfPages, CRITERIA);
  const rankings = await loadRankings(schools);

  return (
    <>
      <Topbar
        screen={SCREENS.discovery}
        scan={scan}
        competitorCount={schools.length - 1}
        criteriaCount={CRITERIA.length}
      />
      <div className="wrap">
        <DemoNote isDemo={isDemo} />
        <div className="stack">
          {/* SE-01 この画面の主役 */}
          <RankingTable
            rankings={rankings}
            selfName={selfName}
            competitorNames={schools.slice(1).map((s) => s.name)}
          />

          {/* SE-03 名称のズレ */}
          <div className="card">
            <div className="card-h">
              <h2>
                <span className="id">SE-03</span>ページ名称と検索語のズレ
              </h2>
              <span className="note">校内の呼称のままページ名にしている箇所</span>
            </div>
            <div className="card-b">
              {namingGaps.length === 0 ? (
                <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--ink-2)' }}>
                  {selfPages.length === 0
                    ? '走査結果がないため判定していません。'
                    : '校内の呼称だけでページ名を付けている箇所は見つかりませんでした。'}
                </p>
              ) : (
                <table className="dt">
                  <thead>
                    <tr>
                      <th>本校のページ名</th>
                      <th>実際に検索されている語</th>
                      <th>該当ページ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {namingGaps.map((gap) => (
                      <tr key={gap.criterionId}>
                        <td>
                          {gap.usedName}
                          <span className="sub2">{gap.pageTitle}</span>
                        </td>
                        <td>{gap.searchedName}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{gap.url}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="evidence" style={{ marginTop: 14 }}>
                <div className="ttl">
                  {SCREENS.gap.title}と同じ問題が、順位として現れる箇所です
                </div>
                <p>
                  {SCREENS.gap.title}では「名称が違っても内容で判定する」としています。
                  <strong>検索エンジンは、そこまで汲み取ってくれません。</strong>
                  校内の正式名称を変える必要はなく、見出しに「学費（学納金）」のように併記するだけで解決します。
                </p>
              </div>
            </div>
          </div>

          {/* SE-04 設定状況の点検 */}
          <DiscoveryChecks
            summary={discovery}
            actions={actions}
            hasScanResult={selfPages.length > 0}
          />
        </div>
      </div>
    </>
  );
}
