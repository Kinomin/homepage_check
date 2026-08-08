/**
 * 設定画面（08）のスケジュールに従って、いま走査すべき学校を判定する。
 *
 *   npm run scan:due            対象を一覧表示するだけ（実行しない）
 *   npm run scan:due -- --run   対象校の走査と判定まで実行する
 *
 * 自動実行は Vercel Cron から `/api/cron/scan` を1時間ごとに叩く（vercel.json）。
 * このスクリプトはその手動版で、同じ runner を通る。cron を使えない環境では
 * これを crontab に置いてもよい。
 *
 * 「どの学校をいつ走査するか」の判断は settings.ts の純関数
 * （isScanDue / nextScanAt）に閉じてあり、ここでは入出力だけを扱う。
 */

import { loadSettings } from '../src/lib/data/settings-repository';
import { notifyScanRun, recordScanRun, summarizeRun } from '../src/lib/scan/notify';
import { loadScanTargets, runDueScans, selectDueSchools } from '../src/lib/scan/runner';
import { SCAN_FREQUENCY_LABEL } from '../src/lib/settings';

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function formatJst(date: Date | null): string {
  if (!date) return '自動実行なし';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

async function main() {
  const now = new Date();

  const groups = await loadScanTargets();
  if (!groups) {
    console.error(
      'Supabase が未接続です。走査対象の学校一覧を読めないため、判定できません。' +
        '\nSUPABASE_SERVICE_ROLE_KEY と NEXT_PUBLIC_SUPABASE_URL を設定してください。',
    );
    process.exit(1);
  }

  console.log(`現在時刻: ${formatJst(now)}（日本時間）`);
  if (groups.length === 0) {
    console.log('登録された学校がありません。');
    return;
  }

  let anyFailure = false;

  // 学校法人ごとに、その組織の設定で判定・実行する。
  // 組織をまたいで1つの設定を使うと、他組織の頻度で走査してしまう。
  for (const group of groups) {
    const { settings } = await loadSettings(group.orgId);

    console.log(`\n■ ${group.orgName}`);
    console.log(
      `  スケジュール: 自校 ${SCAN_FREQUENCY_LABEL[settings.schedule.selfFrequency]} ／ ` +
        `比較校 ${SCAN_FREQUENCY_LABEL[settings.schedule.competitorFrequency]}`,
    );

    const evaluated = selectDueSchools(group.schools, group.lastScanBySchool, settings, now);
    for (const entry of evaluated) {
      console.log(
        `  ${entry.due ? '● 対象' : '  対象外'}  ${entry.school.name}（${entry.school.role}）` +
          ` 前回 ${entry.lastScanAt ? formatJst(entry.lastScanAt) : 'なし'}` +
          ` ／ 次回 ${formatJst(entry.nextScanAt)}`,
      );
    }

    const due = evaluated.filter((entry) => entry.due);
    console.log(`  走査対象: ${due.length}校`);
    if (!flag('run') || due.length === 0) {
      if (due.length > 0) console.log('  実行するには --run を付けてください。');
      continue;
    }

    const result = await runDueScans(due, settings, {
      onProgress: (message) => console.log(`\n  ${message}`),
    });

    for (const entry of result.entries) {
      console.log(
        `  ${entry.schoolName}: status=${entry.status} pages=${entry.pageCount}` +
          ` 判定できず=${entry.unknownCount}件` +
          (entry.savedTo ? ` ／ 保存先 ${entry.savedTo}` : '') +
          (entry.reason ? ` ／ ${entry.reason}` : ''),
      );
    }

    await recordScanRun(result, 'manual', group.orgId);
    const notified = await notifyScanRun(
      result,
      settings.notify.onFailure ? settings.notify.webhookUrl || null : null,
    );

    console.log(`  ${summarizeRun(result)}`);
    if (notified.reason === 'delivery-failed') console.log('  ※ 通知の送信に失敗しました');
    if (notified.reason === 'no-webhook' && settings.notify.onFailure) {
      console.log('  ※ 通知先が未設定のため、記録のみ残しました');
    }

    if (result.failures.length > 0) anyFailure = true;
  }

  // 失敗を含む場合は異常終了にする。cron のログで気づけるようにするため。
  if (anyFailure) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
