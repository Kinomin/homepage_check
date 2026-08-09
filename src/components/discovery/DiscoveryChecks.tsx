import { CHECK_STATUS_MARK, type DiscoverySummary } from '@/lib/analysis/discovery';

/**
 * SE-04 検索エンジン向けの設定点検。
 *
 * 冒頭に「先に直す」項目を置く（handoff.md 5章 04）。
 * 技術チェックの羅列は制作会社の無料診断と同じ土俵なので、主役にはしない。
 * 走査できていない場合は「未設定」と断定せず、判定していないことを示す。
 *
 * 「誰が直すか」の列は置かない。実際の担当は学校ごとに違い、
 * こちらが決めつけると誤りになる（handoff.md 5章 06 と同じ理由）。
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
          <span className="id">SE-04</span>検索エンジン向けの設定
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
                  <small>{check.situation}</small>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
