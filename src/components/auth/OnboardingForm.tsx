'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { SchoolFields } from '@/components/schools/SchoolFields';
import { EMPTY_SCHOOL, type SchoolInput } from '@/lib/schools/schema';

/**
 * 初回の学校登録。
 *
 * ここで登録するのは学校法人名と自校だけ。比較校は登録後に 08 で追加する。
 * 最初に5校まとめて入力させると、途中で止まったときに何も残らない。
 */
export function OnboardingForm({ email }: { email: string }) {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [school, setSchool] = useState<SchoolInput>(EMPTY_SCHOOL);
  const [error, setError] = useState<string | null>(null);
  const [pending, startPending] = useTransition();

  const ready = orgName.trim().length > 0 && school.name.trim().length > 0 && school.url.trim().length > 0;

  function submit() {
    startPending(async () => {
      setError(null);
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgName, school }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? '登録に失敗しました');
        return;
      }
      router.replace('/schools');
      router.refresh();
    });
  }

  return (
    <div className="wrap" style={{ maxWidth: 620, paddingTop: 48 }}>
      <div className="brand" style={{ border: 0, padding: 0, marginBottom: 20 }}>
        <div className="logo">School Insight AI</div>
        <div className="tag">ADMISSIONS SITE ANALYTICS</div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>学校の登録</h2>
          <span className="note">{email}</span>
        </div>
        <div className="card-b">
          <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--ink-2)', marginBottom: 14 }}>
            まず学校法人と自校を登録します。比較する学校は、このあとの画面で追加できます。
          </p>

          <div className="setting-row">
            <div className="setting-label" style={{ width: 130 }}>
              学校法人名
              <small>データを分ける単位になります</small>
            </div>
            <div className="setting-input" style={{ flex: 1 }}>
              <input
                type="text"
                style={{ width: '100%', textAlign: 'left' }}
                placeholder="学校法人○○学園"
                value={orgName}
                disabled={pending}
                onChange={(event) => setOrgName(event.target.value)}
              />
            </div>
          </div>

          <div className="divider" style={{ margin: '14px 0' }} />

          <SchoolFields value={school} disabled={pending} onChange={setSchool} />

          {error && (
            <p style={{ fontSize: 12, lineHeight: 1.8, marginTop: 10, color: 'var(--rose)' }}>
              {error}
            </p>
          )}

          <div className="btnrow" style={{ marginTop: 16, marginBottom: 0 }}>
            <button className="btn" disabled={pending || !ready} onClick={submit}>
              {pending ? '登録中…' : '登録して次へ'}
            </button>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="btn ghost" disabled={pending}>
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
