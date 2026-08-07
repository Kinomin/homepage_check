import { NextResponse } from 'next/server';

import { canManage, getCurrentSession } from '@/lib/auth/session';
import { addSchool } from '@/lib/data/school-repository';
import type { SchoolInput } from '@/lib/schools/schema';
import { SCHOOL_ROLES, type SchoolRole } from '@/lib/types';

/** 比較校（または自校）の追加。変更できるのは管理者のみ（handoff.md 7章）。 */
export async function POST(request: Request) {
  if (!canManage(await getCurrentSession())) {
    return NextResponse.json({ error: '比較校の変更は管理者のみ行えます' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    school?: SchoolInput;
    role?: SchoolRole;
  } | null;

  const role = body?.role ?? 'competitor';
  if (!body?.school) {
    return NextResponse.json({ error: '学校の情報を入力してください' }, { status: 400 });
  }
  if (!SCHOOL_ROLES.includes(role)) {
    return NextResponse.json({ error: '区分が正しくありません' }, { status: 400 });
  }

  const result = await addSchool(body.school, role);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
