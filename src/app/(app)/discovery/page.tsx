import { DiscoveryChecks } from '@/components/discovery/DiscoveryChecks';
import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar } from '@/components/shell/Topbar';
import { CRITERIA } from '@/lib/analysis/criteria';
import { analyzeDiscovery, findNamingGaps } from '@/lib/analysis/discovery';
import { loadDashboard } from '@/lib/data/repository';
import { SCREENS } from '@/lib/screens';

/**
 * SE-01（検索順位）は画面に出さない。
 * 記録機能・API（/api/rankings）・DB（rankings テーブル）は残してある。
 * 順位計測 API の選定後に再度出す可能性があるため（handoff.md 9章D）。
 */
export default async function DiscoveryPage() {
  const { schools, scan, selfPages, isDemo } = await loadDashboard();
  const selfName = schools[0]?.name ?? '';
  const discovery = analyzeDiscovery({ pages: selfPages, schoolName: selfName });
  const namingGaps = findNamingGaps(selfPages, CRITERIA);

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

        {/* 前は冒頭に説明文を置いていたが、読まれず伝わらなかった。
            各カードの見出し自体で内容が分かる形にし、説明文は置かない。 */}
        <div className="stack">
          {/* SE-03 検索語とページ名の食い違い */}
          <div className="card">
            <div className="card-h">
              <h2>
                <span className="id">SE-03</span>検索語とページ名の食い違い
              </h2>
              <span className="note">校内の呼び方のままページ名にしている箇所</span>
            </div>
            <div className="card-b">
              {namingGaps.length === 0 ? (
                <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--ink-2)' }}>
                  {selfPages.length === 0
                    ? '走査結果がないため判定していません。'
                    : '該当する箇所は見つかりませんでした。'}
                </p>
              ) : (
                <table className="dt">
                  <thead>
                    <tr>
                      <th>いまのページ名</th>
                      <th>検索される言葉</th>
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

          {/* SE-04 検索エンジン向けの設定 */}
          <DiscoveryChecks summary={discovery} hasScanResult={selfPages.length > 0} />
        </div>
      </div>
    </>
  );
}
