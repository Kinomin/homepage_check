'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { getBrowserClient } from '@/lib/supabase/browser';

type Mode = 'signin' | 'signup';

/**
 * ログイン／新規登録。
 *
 * Supabase が未設定のときは、鍵を入れずにデモデータで動かしている状態なので、
 * フォームを出さずにその旨を説明する。押せるのに何も起きない入力欄を作らない
 * （handoff.md 10章-5）。
 */
export function SignInForm({ authEnabled, next }: { authEnabled: boolean; next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startPending] = useTransition();

  function submit() {
    const supabase = getBrowserClient();
    if (!supabase) return;

    startPending(async () => {
      setMessage(null);
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setMessage({ kind: 'error', text: error.message });
          return;
        }
        // 確認メールを必須にしている構成では、この時点ではまだログインしていない
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setMessage({
            kind: 'ok',
            text: '確認メールを送りました。メール内のリンクを開いてから、ログインしてください。',
          });
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage({ kind: 'error', text: 'メールアドレスまたはパスワードが違います' });
          return;
        }
      }
      // 画面側の判定と Cookie を揃えるため、遷移前に再取得する
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <div className="wrap" style={{ maxWidth: 460, paddingTop: 64 }}>
      <div className="brand" style={{ border: 0, padding: 0, marginBottom: 20 }}>
        <div className="logo">School Insight AI</div>
        <div className="tag">ADMISSIONS SITE ANALYTICS</div>
      </div>

      {!authEnabled ? (
        <div className="card">
          <div className="card-b">
            <h2 style={{ fontSize: 15, marginBottom: 8 }}>ログインは使用していません</h2>
            <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--ink-2)' }}>
              Supabase が未接続のため、サンプルデータで動作しています。この状態では利用者ごとの区別がないため、ログインは行いません。
              <br />
              実際の学校データを扱うには <code>.env.local</code> に Supabase の接続情報を設定してください。
            </p>
            <div className="btnrow" style={{ marginTop: 14 }}>
              <Link className="btn" href="/">
                サンプルデータを見る
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-h">
            <h2>{mode === 'signin' ? 'ログイン' : '新規登録'}</h2>
            <span className="note">学校法人ごとにデータを分けています</span>
          </div>
          <div className="card-b">
            <div className="setting-row">
              <div className="setting-label" style={{ width: 130 }}>
                メールアドレス
              </div>
              <div className="setting-input" style={{ flex: 1 }}>
                <input
                  type="email"
                  autoComplete="email"
                  style={{ width: '100%', textAlign: 'left' }}
                  value={email}
                  disabled={pending}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>
            <div className="setting-row">
              <div className="setting-label" style={{ width: 130 }}>
                パスワード
                {mode === 'signup' && <small>8文字以上</small>}
              </div>
              <div className="setting-input" style={{ flex: 1 }}>
                <input
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  style={{ width: '100%', textAlign: 'left' }}
                  value={password}
                  disabled={pending}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submit();
                  }}
                />
              </div>
            </div>

            {message && (
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.8,
                  marginTop: 10,
                  color: message.kind === 'ok' ? 'var(--sage)' : 'var(--rose)',
                }}
              >
                {message.text}
              </p>
            )}

            <div className="btnrow" style={{ marginTop: 14, marginBottom: 0 }}>
              <button
                className="btn"
                disabled={pending || !email.trim() || password.length < 8}
                onClick={submit}
              >
                {pending ? '処理中…' : mode === 'signin' ? 'ログイン' : '登録する'}
              </button>
              <button
                className="btn ghost"
                disabled={pending}
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setMessage(null);
                }}
              >
                {mode === 'signin' ? '新規登録はこちら' : 'ログインはこちら'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
