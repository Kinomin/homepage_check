import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env, isSupabaseConfigured } from '../env';

/** 読み取り用（RLS が効く）。未設定なら null を返し、呼び出し側でデモデータへ切り替える。 */
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
