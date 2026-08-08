import { NextResponse } from 'next/server';

import { canManage, getCurrentSession } from '@/lib/auth/session';
import { removeCompetitor } from '@/lib/data/school-repository';

/**
 * 比較校を外す。schools マスタからは消さない（他組織が使っていることがある）。
 * 自校は外せない。外すと走査対象が無くなり、画面がすべて空になる。
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!canManage(await getCurrentSession())) {
    return NextResponse.json({ error: '比較校の変更は管理者のみ行えます' }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await removeCompetitor(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
