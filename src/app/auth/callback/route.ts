import { NextResponse } from 'next/server';

import { safeNextPath } from '@/lib/auth/redirect';
import { createSessionClient } from '@/lib/supabase/server';

/**
 * 確認メールのリンクを受ける口。
 *
 * Supabase の既定（PKCE）では、確認メールのリンクは最終的に
 * `<アプリ>/auth/callback?code=...` に戻ってくる。この `code` を
 * セッションに交換しないとログイン状態にならない。
 *
 * この経路が無いと、リンクを開いた人は `?code=` を付けたまま middleware に
 * 未ログインと判定され、/signin に送り返される。**登録を完了できない。**
 *
 * middleware は /auth を公開パスにしてあるので、未ログインでもここは通る。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  /** ログイン後に開く画面。外部サイトへ飛ばさないよう、パスだけを受ける */
  const next = safeNextPath(url.searchParams.get('next'));

  // Vercel などのプロキシ配下では request.url が内部のホストになる。
  // 転送元のホストを優先しないと、リダイレクト先が本番のURLにならない。
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/signin?error=missing-code`);
  }

  const supabase = await createSessionClient();
  if (!supabase) {
    // 認証を使わない構成（Supabase 未接続）でここに来ることはない
    return NextResponse.redirect(`${origin}/`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // 期限切れ・使用済みのリンクはここに来る。理由を画面側で出す
    return NextResponse.redirect(`${origin}/signin?error=link-expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
