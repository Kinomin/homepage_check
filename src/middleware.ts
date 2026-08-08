import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * セッションの更新と、未ログイン時の入口の制御。
 *
 * Supabase が未設定のときは何もしない。鍵を入れずにデモデータで動かす、
 * という起動方法を壊さないため（README の起動手順）。
 *
 * 自動実行の口（/api/cron/scan）はここを通さない。cron は Cookie を持たず、
 * CRON_SECRET で自分を認証する。
 */

/** ログインしていなくても開いてよいパス */
const PUBLIC_PATHS = ['/signin', '/auth', '/api/cron'];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() を呼ぶことでセッションが更新される。呼ばないと期限切れに気づけない。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/signin';
    // ログイン後に元の画面へ戻す
    redirect.searchParams.set('next', pathname);
    return NextResponse.redirect(redirect);
  }

  if (user && pathname === '/signin') {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/';
    redirect.search = '';
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
