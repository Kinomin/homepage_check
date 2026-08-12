import { NextResponse } from 'next/server';

import { canManage, getCurrentSession } from '@/lib/auth/session';
import { loadSettings } from '@/lib/data/settings-repository';
import { notifyScanRun, recordScanRun, summarizeRun } from '@/lib/scan/notify';
import { allSchoolsAsDue, loadScanTargets, runDueScans } from '@/lib/scan/runner';

/**
 * 09設定画面の「今すぐ走査する」ボタンの入口。
 *
 * 自動実行（/api/cron/scan・GitHub Actions）は「スケジュールに達した学校」だけを
 * 対象にするが、ここは押した時点で自分の組織の全校を対象にする。
 * 「手動のみ」に設定した学校も含める——手動のみはまさにこのボタンで動かすための
 * 設定であり、除外すると押しても何も起きないボタンになる（handoff.md 10章-5）。
 *
 * サーバレス関数の中で走査本体（クロール＋LLM判定）を実行する。自校のみ・
 * 比較校が少ない組織なら収まるが、Vercel の実行時間上限（Hobby 60秒／
 * Pro 800秒）を超えると打ち切られる。大きい組織や Hobby プランでは
 * GitHub Actions の「Run workflow」を使うほうが確実（docs/SETUP.md 7-3）。
 * ボタンにもその旨を添えている。
 *
 * 同じ組織を GitHub Actions と同時に走査する可能性はあるが、互いにロックは
 * しない。二重に走っても scans 行が2つ増えるだけで、データが壊れることは
 * ない（handoff.md の設計上、走査は追記のみ）。
 */
export const maxDuration = 800;

export async function POST() {
  const session = await getCurrentSession();
  if (!canManage(session)) {
    return NextResponse.json({ error: '走査の実行は管理者のみ行えます' }, { status: 403 });
  }

  const orgId = session?.membership?.orgId;
  if (!orgId) {
    return NextResponse.json({ error: '学校法人の登録が済んでいません' }, { status: 400 });
  }

  const groups = await loadScanTargets();
  const mine = groups?.find((group) => group.orgId === orgId);
  if (!mine) {
    return NextResponse.json(
      { error: 'Supabase が未接続、または学校が登録されていません' },
      { status: 503 },
    );
  }
  if (mine.schools.length === 0) {
    return NextResponse.json({ error: '走査対象の学校がありません' }, { status: 400 });
  }

  const { settings } = await loadSettings(orgId);
  const due = allSchoolsAsDue(mine.schools, mine.lastScanBySchool, settings);
  const result = await runDueScans(due, settings);
  await recordScanRun(result, 'manual', orgId);
  await notifyScanRun(result, settings.notify.onFailure ? settings.notify.webhookUrl || null : null);

  return NextResponse.json({ summary: summarizeRun(result), result });
}
