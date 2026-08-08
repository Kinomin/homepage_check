'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { env, isSupabaseConfigured } from '../env';

let client: SupabaseClient | null = null;

/** ログイン画面から使う。未設定なら null（デモ動作） */
export function getBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  client ??= createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
