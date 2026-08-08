import { NextResponse } from 'next/server';

import { loadSettings } from '@/lib/data/settings-repository';
import { env } from '@/lib/env';
import { notifyScanRun, recordScanRun, summarizeRun } from '@/lib/scan/notify';
import { loadScanTargets, runDueScans, selectDueSchools } from '@/lib/scan/runner';

/**
 * 自動実行の入口。外部の cron から叩く。
 *
 * この経路も CLI（`npm run scan:due -- --run`）も、同じ runner を通る。
 * 判断も実行も1箇所に置き、自動実行のときだけ挙動が違う状態を作らない。
 *
 * 走査は外部サイトへのリクエストを伴うため、実行してよいのは cron だけに絞る。
 * CRON_SECRET が未設定なら実行しない（誰でも叩ける口を開けない）。
 *
 * ただしサーバレス環境では**時間切れになりうる**。
 * 31項目 × 校数のLLM判定と、1秒間隔のクロールを1リクエストで終わらせるには
 * 数十分かかることがあり、関数の上限（Vercel Pro でも 800 秒）を超える。
 * 定期実行は .github/workflows/scan.yml（GitHub Actions）に置いてあり、
 * そちらは時間の上限が緩いので走査が途中で切れない。
 *
 * この口は、自前のサーバから叩く場合や、自校のみの小さい走査に使う。
 */
export const maxDuration = 800;

function isAuthorized(request: Request): boolean {
  if (!env.cronSecret) return false;
  return request.headers.get('authorization') === `Bearer ${env.cronSecret}`;
}

export async function POST(request: Request) {
  if (!env.cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET が未設定のため、自動実行は無効です' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 });
  }

  const targets = await loadScanTargets();
  if (!targets) {
    return NextResponse.json(
      { error: 'Supabase が未接続のため、走査対象を確定できません' },
      { status: 503 },
    );
  }

  const { settings } = await loadSettings();
  const now = new Date();
  const due = selectDueSchools(targets.schools, targets.lastScanBySchool, settings, now).filter(
    (entry) => entry.due,
  );

  const result = await runDueScans(due, settings);
  await recordScanRun(result, 'cron');

  const notified = await notifyScanRun(
    result,
    settings.notify.onFailure ? settings.notify.webhookUrl || null : null,
  );

  return NextResponse.json({
    dueCount: result.dueCount,
    summary: summarizeRun(result),
    entries: result.entries,
    notified,
  });
}

/** Vercel Cron は GET で叩くため、同じ処理を GET でも受ける。 */
export const GET = POST;
