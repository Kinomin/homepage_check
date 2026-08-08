import { NextResponse } from 'next/server';

import { createOrganization } from '@/lib/data/school-repository';
import type { SchoolInput } from '@/lib/schools/schema';

/** 初回登録：学校法人を作り、作った人を管理者にし、自校を登録する。 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    orgName?: string;
    school?: SchoolInput;
  } | null;

  if (!body?.orgName || !body.school) {
    return NextResponse.json({ error: '学校法人名と自校の情報を入力してください' }, { status: 400 });
  }

  const result = await createOrganization(body.orgName, body.school);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
