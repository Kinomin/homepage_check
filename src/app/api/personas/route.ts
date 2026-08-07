import { NextResponse } from 'next/server';

import { loadPersonas, regeneratePersonas } from '@/lib/data/persona-repository';
import { loadDashboard } from '@/lib/data/repository';
import { PERSONA_GENDERS, PERSONA_STAGES } from '@/lib/persona/types';

export async function GET() {
  return NextResponse.json(await loadPersonas());
}

/**
 * 6パターンの仮説を走査結果から生成し直す。
 * 材料は findings（02 の判定結果）のみで、サイト本文は渡さない。
 */
export async function POST() {
  try {
    const { schools, gapRows } = await loadDashboard();
    const source = await regeneratePersonas({
      schoolName: schools[0]?.name ?? '',
      gapRows,
      stages: [...PERSONA_STAGES],
      genders: [...PERSONA_GENDERS],
    });
    return NextResponse.json(source);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成に失敗しました' },
      { status: 500 },
    );
  }
}
