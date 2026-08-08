import { NextResponse } from 'next/server';

import { canManage, getCurrentSession } from '@/lib/auth/session';
import { SettingsValidationFailure, loadSettings, saveSettings } from '@/lib/data/settings-repository';
import type { OrgSettings } from '@/lib/settings';

export async function GET() {
  const source = await loadSettings();
  return NextResponse.json(source);
}

/**
 * 設定の保存。検証は saveSettings 内の validateSettings が行う
 * （画面側の入力制限とサーバ側の検証を同じ関数に通す）。
 */
export async function PUT(request: Request) {
  if (!canManage(await getCurrentSession())) {
    return NextResponse.json({ error: '設定の変更は管理者のみ行えます' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as OrgSettings | null;
  if (!body?.schedule || !body?.crawl || !body?.judge) {
    return NextResponse.json({ error: '設定の形式が正しくありません' }, { status: 400 });
  }

  try {
    const source = await saveSettings(body);
    return NextResponse.json(source);
  } catch (error) {
    if (error instanceof SettingsValidationFailure) {
      return NextResponse.json({ error: error.message, messages: error.messages }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存に失敗しました' },
      { status: 500 },
    );
  }
}
