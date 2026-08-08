import { NextResponse } from 'next/server';

import { canManage, getCurrentSession } from '@/lib/auth/session';
import { loadRankings, saveRanking, type RankingRow } from '@/lib/data/ranking-repository';
import { loadDashboard } from '@/lib/data/repository';

export async function GET() {
  const { schools } = await loadDashboard();
  return NextResponse.json(await loadRankings(schools));
}

/**
 * 順位の手動記録。
 * 順位計測 API を導入したら、この経路は残したまま自動記録を足す
 * （手で直した値を上書きしないよう、記録日で新しい方を採る想定）。
 */
export async function POST(request: Request) {
  if (!canManage(await getCurrentSession())) {
    return NextResponse.json({ error: '順位の記録は管理者のみ行えます' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as RankingRow | null;
  if (!body?.keyword?.trim()) {
    return NextResponse.json({ error: '検索語は必須です' }, { status: 400 });
  }

  try {
    const { schools } = await loadDashboard();
    await saveRanking(
      {
        ...body,
        keyword: body.keyword.trim(),
        keywordType: body.keywordType === 'branded' ? 'branded' : 'generic',
        measuredAt: body.measuredAt ?? new Date().toISOString().slice(0, 10),
      },
      schools,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '記録に失敗しました' },
      { status: 500 },
    );
  }
}
