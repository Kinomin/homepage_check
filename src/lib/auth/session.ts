/**
 * ログイン中のユーザーと、その所属組織・役割（handoff.md 7章）。
 *
 * 役割は2つだけ：
 * ・admin  … 比較校の設定・設定変更・レポート出力ができる
 * ・viewer … 閲覧のみ
 *
 * Supabase 未接続のときは null を返す。画面はデモ表示に切り替わる。
 * 「ログインしていない」と「そもそも認証を使っていない」を区別するため、
 * isAuthEnabled() を別に持つ。
 */

import { isSupabaseConfigured } from '../env';
import { createSessionClient } from '../supabase/server';

export type MemberRole = 'admin' | 'viewer';

export interface CurrentUser {
  id: string;
  email: string;
}

export interface Membership {
  orgId: string;
  orgName: string;
  role: MemberRole;
}

export interface CurrentSession {
  user: CurrentUser;
  /** 組織に未所属なら null（学校登録がまだ済んでいない） */
  membership: Membership | null;
}

/** 認証を使う構成か（Supabase が設定されているか） */
export function isAuthEnabled(): boolean {
  return isSupabaseConfigured();
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const supabase = await createSessionClient();
  if (!supabase) return null;

  // getSession() ではなく getUser()。Cookie の中身をそのまま信用せず、
  // Auth サーバに検証させる。
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('organization_members')
    .select('org_id, role, organizations(name)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const organization = data?.organizations as unknown as { name?: string } | null;

  return {
    user: { id: user.id, email: user.email ?? '' },
    membership: data
      ? {
          orgId: String(data.org_id),
          orgName: String(organization?.name ?? ''),
          role: data.role as MemberRole,
        }
      : null,
  };
}

/** 管理者だけが行える操作の判定（比較校の変更・設定変更・レポート出力） */
export function canManage(session: CurrentSession | null): boolean {
  // 認証を使っていない構成では制限しない（デモ動作を壊さないため）
  if (!isAuthEnabled()) return true;
  return session?.membership?.role === 'admin';
}
