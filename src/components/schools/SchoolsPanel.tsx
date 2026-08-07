'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { SchoolFields } from '@/components/schools/SchoolFields';
import { EMPTY_SCHOOL, MAX_COMPETITORS, type SchoolInput } from '@/lib/schools/schema';
import type { School } from '@/lib/types';

/**
 * 08 学校と比較校。
 *
 * ・比較校は5校まで（handoff.md 3章）。上限に達したら追加欄を閉じる
 * ・比較校として登録した事実は相手校に通知しない。この画面にも
 *   「相手に知られる」といった表示は出さない（7章）
 * ・変更できるのは管理者のみ。閲覧者には理由を出したうえで操作を無効にする
 */
/**
 * サンプルの学校には URL が無い。実在しない学校に URL を書くと、
 * 架空のデータを本物の学校のものと取り違えさせる。
 */
function SchoolUrl({ url }: { url: string }) {
  if (!url) return <span style={{ color: 'var(--mute)' }}>—</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener">
      {url}
    </a>
  );
}

export function SchoolsPanel({
  self,
  competitors,
  canManage,
  orgName,
  editable,
}: {
  self: School | null;
  competitors: School[];
  canManage: boolean;
  orgName: string | null;
  /** Supabase に接続していて、実際に登録・削除できる状態か */
  editable: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<SchoolInput>(EMPTY_SCHOOL);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startPending] = useTransition();

  const atLimit = competitors.length >= MAX_COMPETITORS;
  const disabled = pending || !canManage || !editable;

  function add() {
    startPending(async () => {
      setError(null);
      const response = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ school: draft, role: 'competitor' }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? '登録に失敗しました');
        return;
      }
      setDraft(EMPTY_SCHOOL);
      setAdding(false);
      router.refresh();
    });
  }

  function remove(school: School) {
    startPending(async () => {
      setError(null);
      const response = await fetch(`/api/schools/${encodeURIComponent(school.id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? '削除に失敗しました');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="stack">
      {/* 自校 */}
      <div className="card">
        <div className="card-h">
          <h2>
            <span className="id">SC-01</span>自校
          </h2>
          <span className="note">{orgName ?? '走査と判定の基準になる学校です'}</span>
        </div>
        <div className="card-b">
          {self ? (
            <table className="dt">
              <tbody>
                <tr>
                  <td style={{ width: 130 }}>学校名</td>
                  <td>
                    <b>{self.name}</b>
                  </td>
                </tr>
                <tr>
                  <td>サイトURL</td>
                  <td>
                    <SchoolUrl url={self.url} />
                  </td>
                </tr>
                <tr>
                  <td>併設大学</td>
                  <td>{self.hasAffiliatedUniversity ? 'あり' : 'なし'}</td>
                </tr>
                <tr>
                  <td>robots.txt</td>
                  <td>{self.robotsAllowed ? '走査を許可しています' : '走査が拒否されています'}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="setting-note">自校が登録されていません。</p>
          )}
        </div>
      </div>

      {/* 比較校 */}
      <div className="card">
        <div className="card-h">
          <h2>
            <span className="id">SC-02</span>比較校
          </h2>
          <span className="note">
            {competitors.length} ／ {MAX_COMPETITORS}校
          </span>
        </div>
        <div className="card-b">
          {competitors.length > 0 ? (
            <table className="dt">
              <thead>
                <tr>
                  <th>学校名</th>
                  <th>サイトURL</th>
                  <th>走査</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {competitors.map((school) => (
                  <tr key={school.id}>
                    <td>{school.name}</td>
                    <td>
                      <SchoolUrl url={school.url} />
                    </td>
                    <td>{school.robotsAllowed ? '許可' : 'robots.txt により不可'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn ghost" disabled={disabled} onClick={() => remove(school)}>
                        外す
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="setting-note">比較校がまだ登録されていません。</p>
          )}

          {adding ? (
            <div style={{ marginTop: 14 }}>
              <div className="divider" style={{ marginBottom: 12 }} />
              <SchoolFields
                value={draft}
                disabled={pending}
                onChange={setDraft}
                showAdmissionFields={false}
              />
              <div className="btnrow" style={{ marginTop: 12, marginBottom: 0 }}>
                <button
                  className="btn"
                  disabled={pending || !draft.name.trim() || !draft.url.trim()}
                  onClick={add}
                >
                  {pending ? '登録中…' : '比較校に追加する'}
                </button>
                <button
                  className="btn ghost"
                  disabled={pending}
                  onClick={() => {
                    setAdding(false);
                    setDraft(EMPTY_SCHOOL);
                    setError(null);
                  }}
                >
                  やめる
                </button>
              </div>
            </div>
          ) : (
            <div className="btnrow" style={{ marginTop: 14, marginBottom: 0 }}>
              <button className="btn" disabled={disabled || atLimit} onClick={() => setAdding(true)}>
                比較校を追加する
              </button>
              {atLimit && (
                <span className="lb">比較校は{MAX_COMPETITORS}校までです</span>
              )}
            </div>
          )}

          {error && (
            <p style={{ fontSize: 12, lineHeight: 1.8, marginTop: 10, color: 'var(--rose)' }}>
              {error}
            </p>
          )}

          {!editable && (
            <p className="setting-note">
              Supabase が未接続のため、この一覧はサンプルです。実際の学校を登録するには接続情報を設定してください。
            </p>
          )}
          {editable && !canManage && (
            <p className="setting-note">
              比較校の変更は管理者のみ行えます。閲覧者の権限では一覧の確認のみです。
            </p>
          )}

          <p className="setting-note">
            比較校のページ本文は保存しません（判定に必要な集計値と URL のみ保持します）。
            比較校として登録した事実が相手校に伝わることはありません。
          </p>
        </div>
      </div>
    </div>
  );
}
