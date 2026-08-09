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

        {/* この画面が何を見ているのかを最初に書く。
            02・03 との役割の違いが分からないと、数字の読み方が決まらない。 */}
        <div className="lead">
          <p>
            <strong>この画面だけが「まだ学校名を知らない家庭」を扱います。</strong>
            {SCREENS.gap.title}と{SCREENS.measurement.title}
            は、すでにサイトへ来た人が目的の情報にたどり着けるかを見ています。
            ここで見るのは、その手前
            ——「私立 中学 ○○市」のように地域や条件で探している家庭に、本校が候補として現れているかどうかです。
          </p>
          <p>
            塾や知人から名前を聞いた家庭は、学校名で検索して来ます。そこはすでに届いている層です。
            対して、名前を知らない家庭に届くかどうかは、
            <strong>検索での見え方と、ページの作りで決まります。</strong>
            下の3つは、その3段階を順に見ています。
          </p>
          <ol className="lead-steps">
            <li>
              <b>SE-01</b> <strong>まず結果を見る</strong>
              ——地域名や条件で検索したとき、本校が何位に出ているか（順位の記録が必要）
            </li>
            <li>
              <b>SE-03</b> <strong>届かない原因①</strong>
              ——家庭が検索する言葉と、ページ名が食い違っていないか
            </li>
            <li>
              <b>SE-04</b> <strong>届かない原因②</strong>
              ——検索結果での見え方の設定が足りているか
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
