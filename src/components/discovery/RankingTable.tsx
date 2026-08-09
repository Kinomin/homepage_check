'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { StaticDemoNote } from '@/components/shell/StaticDemoNote';
import type { RankingRow } from '@/lib/data/ranking-repository';
import { IS_STATIC_DEMO } from '@/lib/static-demo';

/**
 * SE-01 まだ学校名を知らない層への接点。この画面の主役。
 *
 * 順位の取得には外部の順位計測 API が必要で、学校数 × キーワード数 × 頻度で
 * 課金される（handoff.md 9章D）。API の選定が済むまでは手動記録で受ける。
 * どちらの経路でも表の形は同じなので、API 導入時に画面は変えなくてよい。
 *
 * 順位の「圏外」は null で持つ。0 や 999 で表すと平均や比較を誤らせる。
 */
export function RankingTable({
  rankings,
  selfName,
  competitorNames,
  canManage,
}: {
  rankings: RankingRow[];
  selfName: string;
  competitorNames: string[];
  /** 順位を記録できる権限があるか（管理者のみ：handoff.md 7章） */
  canManage: boolean;
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RankingRow>(emptyRow());

  function save() {
    if (!draft.keyword.trim()) return;
    startSaving(async () => {
      const response = await fetch('/api/rankings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (response.ok) {
        setDraft(emptyRow());
        setEditing(false);
        router.refresh();
      }
    });
  }

  const outOfRange = rankings.filter((row) => row.selfPosition === null).length;

  return (
    <div className="card">
      <div className="card-h">
        <h2>
          <span className="id">SE-01</span>まだ学校名を知らない層への接点
        </h2>
        <span className="note">地域名で探している家庭に、どの学校が届いているか</span>
      </div>
      <div className="card-b">
        {rankings.length === 0 ? (
          /* 何を記録すればよいかまで書く。「記録がありません」だけでは手が動かない。 */
          <div style={{ fontSize: 12.5, lineHeight: 1.95, color: 'var(--ink-2)' }}>
            <p>
              まだ記録がありません。ここに入れるのは
              <strong>学校名を含まない検索語</strong>です。学校名で検索する家庭はすでに本校を知っているので、
              この画面の問い（まだ知らない家庭に届いているか）には答えられません。
            </p>
            <p style={{ marginTop: 8 }}>記録する検索語の例：</p>
            <ul style={{ margin: '5px 0 0', paddingLeft: '1.15em' }}>
              <li>市区町村名 + 私立中学（例：○○市 私立中学）</li>
              <li>沿線名 + 中高一貫</li>
              <li>市区町村名 + 中学 説明会</li>
            </ul>
            <p style={{ marginTop: 8 }}>
              順位はブラウザのシークレットウィンドウで実際に検索して数えるのが確実です
              （ログイン状態や履歴で順位が変わるため）。下の「順位を記録する」から入力してください。
            </p>
          </div>
        ) : (
          <table className="dt">
            <thead>
              <tr>
                <th>検索語</th>
                <th>月間検索数</th>
                <th>本校</th>
                <th>比較{competitorNames.length}校で最上位</th>
                <th>1位のサイト</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((row) => (
                <tr key={row.keyword}>
                  <td>{row.keyword}</td>
                  <td className="n">{row.monthlySearches ?? '—'}</td>
                  <td className="n" style={{ color: 'var(--rose)' }}>
                    {row.selfPosition === null ? '圏外' : `${row.selfPosition}位`}
                  </td>
                  <td className="n">
                    {row.bestCompetitorName
                      ? `${row.bestCompetitorName} ${row.bestCompetitorPosition}位`
                      : '—'}
                  </td>
                  <td>{row.topDomain ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {rankings.length > 0 && (
          <div className="evidence" style={{ marginTop: 14 }}>
            <div className="ttl">この画面だけが答えている問い</div>
            <p>
              欠落マップと導線の実測は、<strong>すでに本校のサイトに来た人</strong>
              の話です。この画面は、<strong>まだ本校を知らない人に届いているか</strong>を見ています。
              {outOfRange > 0 && (
                <>
                  <br />
                  記録した{rankings.length}語のうち{outOfRange}
                  語で本校は圏外です。上位の多くは受験情報サイトと塾ポータルで、そこを学校が取り切ることはできませんが、
                  <strong>比較校は取れていて本校は取れていない</strong>という差は埋められます。
                </>
              )}
            </p>
            <div className="src">
              測定方法：外部測定（順位は測定地点・端末により変動します）
              {rankings[0]?.measuredAt ? ` ／ 記録日 ${rankings[0].measuredAt}` : ''}
            </div>
          </div>
        )}

        <div className="btnrow" style={{ marginTop: 14, marginBottom: 0 }}>
          <button className="btn ghost" aria-pressed={editing} onClick={() => setEditing(!editing)}>
            {editing ? '入力を閉じる' : '順位を記録する'}
          </button>
          <span className="lb">
            順位計測 API の選定後は自動記録に切り替えます（handoff.md 9章D）
          </span>
        </div>

        {editing && (
          <div className="ask" style={{ marginTop: 12 }}>
            <div className="ah">順位の手動記録</div>
            <div className="ab">
              <div className="setting-row">
                <div className="setting-label">
                  検索語
                  <small>地域名・沿線名・特色語など、学校名を含まない語</small>
                </div>
                <div className="setting-input">
                  <input
                    type="text"
                    style={{ width: 220, textAlign: 'left' }}
                    value={draft.keyword}
                    placeholder="○○市 私立中学"
                    onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                  />
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-label">
                  本校の順位
                  <small>圏外の場合は空欄のまま</small>
                </div>
                <div className="setting-input">
                  <input
                    type="number"
                    min={1}
                    value={draft.selfPosition ?? ''}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        selfPosition: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                  <span className="setting-suffix">位</span>
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-label">
                  比較校で最上位
                  <small>学校名と順位</small>
                </div>
                <div className="setting-input">
                  <select
                    value={draft.bestCompetitorName ?? ''}
                    onChange={(event) =>
                      setDraft({ ...draft, bestCompetitorName: event.target.value || null })
                    }
                    style={{
                      border: '1px solid var(--line-2)',
                      borderRadius: 3,
                      padding: '6px 9px',
                      fontSize: 12.5,
                      background: 'var(--surface)',
                    }}
                  >
                    <option value="">—</option>
                    {competitorNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={draft.bestCompetitorPosition ?? ''}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        bestCompetitorPosition: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  />
                  <span className="setting-suffix">位</span>
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-label">
                  1位のサイト
                  <small>受験情報サイト・塾ポータル・学校サイトなど</small>
                </div>
                <div className="setting-input">
                  <input
                    type="text"
                    style={{ width: 220, textAlign: 'left' }}
                    value={draft.topDomain ?? ''}
                    onChange={(event) => setDraft({ ...draft, topDomain: event.target.value })}
                  />
                </div>
              </div>
              <div className="btnrow" style={{ margin: '12px 0 0' }}>
                <button
                  className="btn"
                  onClick={save}
                  disabled={saving || !draft.keyword.trim() || IS_STATIC_DEMO || !canManage}
                >
                  {saving ? '記録中…' : '記録する'}
                </button>
                <span className="lb">対象：{selfName}</span>
              </div>
            </div>
          </div>
        )}
        {!canManage && (
          <p className="setting-note">
            順位の記録は管理者のみ行えます。閲覧者の権限では一覧の確認のみです。
          </p>
        )}
        <StaticDemoNote what="順位の記録" />
      </div>
    </div>
  );
}

function emptyRow(): RankingRow {
  return {
    keyword: '',
    keywordType: 'generic',
    monthlySearches: null,
    selfPosition: null,
    bestCompetitorName: null,
    bestCompetitorPosition: null,
    topDomain: null,
    measuredAt: new Date().toISOString().slice(0, 10),
  };
}
