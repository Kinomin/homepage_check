import { createServerClient as createSsrClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { env, isSupabaseConfigured } from '../env';

/**
 * ログイン中のユーザーとして読み書きする（RLS がそのユーザーの権限で効く）。
 * 画面・API はこれを使う。組織の分離（handoff.md 7章）は RLS に任せ、
 * アプリ側で org_id を絞る実装を重ねない（片方だけ漏れる形にしないため）。
 */
export async function createSessionClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  // リクエストの外（走査スクリプトなど）では Cookie が無い。
  // ここで落とさず null を返し、呼び出し側でサービスキーへ切り替える。
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch {
    return null;
  }

  return createSsrClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component からは Cookie を書けない。
          // セッションの更新は middleware が行うので、ここでは黙って無視してよい。
        }
      },
    },
  });
}

/**
 * 画面・API・スクリプトが共通で使うデータ読み書きの入口。
 *
 * ・リクエスト内 … ログイン中のユーザーとして読む（RLS がそのユーザーの権限で効く）
 * ・リクエスト外（走査スクリプト）… サービスキーで読む
 *
 * どちらも使えなければ null。呼び出し側はデモデータに切り替える。
 *
 * 匿名キーのままでは RLS（すべて `to authenticated`）に阻まれて何も読めず、
 * ログインしていても画面がデモ表示のままになる。ここで確実に使い分ける。
 */
export async function createDataClient(): Promise<SupabaseClient | null> {
  return (await createSessionClient()) ?? createServiceClient();
}

/**
 * セッションを持たない匿名の読み取り用。
 * RLS が `to anon` を許している範囲しか読めない。
 */
export function createServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

/**
 * 走査・判定の書き込み用（RLS を迂回する）。
 * サーバ側のバッチ処理からのみ使うこと。
 */
export function createServiceClient(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null;
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}
