import { CHECK_STATUS_MARK, type DiscoverySummary } from '@/lib/analysis/discovery';

/**
 * SE-04 設定状況の点検。
 *
 * 冒頭に「先に直す5つ」を置く（handoff.md 5章 04）。
 * 技術チェックの羅列は制作会社の無料診断と同じ土俵なので、主役にはしない。
 * 走査できていない場合は「未設定」と断定せず、判定していないことを示す。
 *
 * 表に出すのは「検索した家庭から見て何が起きているか」を先にする。
 * 用語（構造化データ・h1 など）を見出しにすると、読む側が判断できない。
 */
export function DiscoveryChecks({
  summary,
  hasScanResult,
}: {
  summary: DiscoverySummary;
  hasScanResult: boolean;
}) {
  return (
    <div className="card">
      <div className="card-h">
        <h2>
          <span className="id">SE-04</span>検索から見つけてもらう設定
        </h2>
        <span className="note">
          {hasScanResult ? `全${summary.pageCount}ページを走査` : '走査結果がありません'}
        </span>
      </div>
      <div className="card-b">
        {!hasScanResult ? (
          <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--ink-2)' }}>
            走査結果がないため点検していません。
            <strong>「設定されていない」ことを意味しません。</strong>
          </p>
        ) : (
          <>
            {summary.priorityChecks.length > 0 && (
              <>
                <div className="eyebrow">先に直す{summary.priorityChecks.length}つ</div>
                <table className="dt" style={{ marginBottom: 18 }}>
                  <thead>
                    <tr>
                      <th>いま何が起きているか</th>
                      <th>直すと</th>
                      <th>直せるのは</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.priorityChecks.map((check) => (
                      <tr key={check.key}>
                        <td>
                          {check.reader}
                          <span className="sub2">
                            {check.label}／{check.situation}
                          </span>
                        </td>
                        <td>{check.effect}</td>
                        <td>
                          <b>{check.fixedBy}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div className="eyebrow">点検結果</div>
            {summary.checks.map((check) => (
              <div className="chk" key={check.key}>
                <div className={`st2 ${check.status}`}>{CHECK_STATUS_MARK[check.status]}</div>
                <div className="nm2">
                  {check.label}
                  <small>
                    {check.situation}
                    <br />
                    {check.reader}
                  </small>
                </div>
                <div className="rt">{check.status === 'ok' ? '対応不要' : check.fixedBy}</div>
              </div>
            ))}

            <p
              style={{
                fontSize: 11,
                lineHeight: 1.8,
                color: 'var(--mute)',
                marginTop: 14,
                paddingTop: 10,
                borderTop: '1px solid var(--line)',
              }}
            >
              補足：検索結果の上位には、本校が手を入れられない領域があります。受験情報サイトに過年度の説明会日程が残っている場合は、掲載元に更新を依頼できます。予約サービスのイベントページ自体も検索対象になるため、そこに学校紹介を入れておけます。口コミサイトの記述は制御できません。
              <br />
              比較校の設定状況はここでは点検していません。比較校について記録するのは、公開ページの有無と掲載量という事実だけです。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
