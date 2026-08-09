import { DiscoveryChecks } from '@/components/discovery/DiscoveryChecks';
import { RankingTable } from '@/components/discovery/RankingTable';
import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar } from '@/components/shell/Topbar';
import { CRITERIA } from '@/lib/analysis/criteria';
import { analyzeDiscovery, findNamingGaps } from '@/lib/analysis/discovery';
import { loadRankings } from '@/lib/data/ranking-repository';
import { canManage, getCurrentSession, isAuthEnabled } from '@/lib/auth/session';
import { loadDashboard } from '@/lib/data/repository';
import { SCREENS } from '@/lib/screens';

export default async function DiscoveryPage() {
  const { schools, scan, selfPages, isDemo } = await loadDashboard();
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

        {/* この画面が何を見ているのかを最初に書く。前回は一文に詰め込みすぎて
            伝わらなかった。短い文を積む形にし、抽象的な言い回し（「その手前」
            「見え方」など）をやめて、具体例を先に出す。 */}
        <div className="lead">
          <p>
            「○○中学 説明会」のように<strong>学校名で検索する家庭</strong>は、
            塾や知人からすでに名前を聞いています。もう本校を見つけています。
          </p>
          <p>
            「○○市 私立中学」のように<strong>地域や条件だけで検索する家庭</strong>は、
            まだ本校の名前を知りません。
            <strong>この画面が見ているのは、この家庭たちに本校が見つかっているかどうかです。</strong>
          </p>
          <p>
            見つかるかどうかは、下の3つで決まります。上から順に見てください。
          </p>
          <ol className="lead-steps">
            <li>
              <b>SE-01</b> 検索した結果、本校は何位に出ているか（自分で記録した順位）
            </li>
            <li>
              <b>SE-03</b> 家庭が検索する言葉と、本校のページ名が合っているか
            </li>
            <li>
              <b>SE-04</b> 検索結果に情報が正しく出る作りになっているか
            </li>
          </ol>
        </div>

        <div className="stack">
          {/* SE-01 この画面の主役 */}
          <RankingTable
            rankings={rankings}
            selfName={selfName}
            competitorNames={schools.slice(1).map((s) => s.name)}
            canManage={canManage(isAuthEnabled() ? await getCurrentSession() : null)}
          />

          {/* SE-03 届いていない原因① 検索語とページ名の食い違い */}
          <div className="card">
            <div className="card-h">
              <h2>
                <span className="id">SE-03</span>探している言葉でページ名が付いているか
              </h2>
              <span className="note">届かない原因①：検索する言葉と、ページ名の食い違い</span>
            </div>
            <div className="card-b">
              <p style={{ fontSize: 12.5, lineHeight: 1.95, color: 'var(--ink-2)', marginBottom: 13 }}>
                家庭は<strong>自分が知っている言葉で検索します。</strong>
                校内で使っている呼び方でページ名を付けていると、内容は載っているのに検索では出てきません。
                校内の正式名称を変える必要はありません。
                <strong>ページ名に一般的な言葉を併記するだけで解決します。</strong>
              </p>
              {namingGaps.length === 0 ? (
                <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--ink-2)' }}>
                  {selfPages.length === 0
                    ? '走査結果がないため判定していません。'
                    : '校内の呼び方だけでページ名を付けている箇所は見つかりませんでした。'}
                </p>
              ) : (
                <table className="dt">
                  <thead>
                    <tr>
                      <th>いまのページ名</th>
                      <th>家庭が検索する言葉</th>
                      <th>ページ名の案</th>
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
                        <td>
                          {/* 併記の形をそのまま出す。言い換えではなく足すだけ、が伝わるように */}
                          <b>
                            {gap.searchedName}（{gap.usedName}）
                          </b>
                          <span className="sub2" style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>
                            {gap.url}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* SE-04 設定状況の点検 */}
          <DiscoveryChecks summary={discovery} hasScanResult={selfPages.length > 0} />
        </div>
      </div>
    </>
  );
}
