/**
 * 設定画面（08）のスケジュールに従って、いま走査すべき学校を判定する。
 *
 *   npm run scan:due            対象を一覧表示するだけ（実行しない）
 *   npm run scan:due -- --run   対象校の走査と判定まで実行する
 *
 * cron からはこのスクリプトを1時間ごとに起動する想定。
 * 「どの学校をいつ走査するか」の判断は settings.ts の純関数
 * （isScanDue / nextScanAt）に閉じてあり、ここでは入出力だけを扱う。
 *
 * 自動実行そのもの（cron 登録・失敗時の通知）は Phase 2。
 */

import { loadPreviousFindings, persistScanOutcome } from '../src/lib/data/scan-writer';
import { loadSettings } from '../src/lib/data/settings-repository';
import { runScan } from '../src/lib/judge/pipeline';
import { isScanDue, nextScanAt, SCAN_FREQUENCY_LABEL } from '../src/lib/settings';
import { createServiceClient } from '../src/lib/supabase/server';
import type { School } from '../src/lib/types';

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
  const { settings } = await loadSettings();
  const now = new Date();

  const supabase = createServiceClient();
  if (!supabase) {
    console.error(
      'Supabase が未接続です。走査対象の学校一覧を読めないため、判定できません。' +
        '\nSUPABASE_SERVICE_ROLE_KEY と NEXT_PUBLIC_SUPABASE_URL を設定してください。',
    );
    process.exit(1);
  }

  const { data: orgSchools, error } = await supabase
    .from('org_schools')
    .select('role, sort_order, schools(*)')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);

  const schools: School[] = (orgSchools ?? []).map((row) => {
    const school = row.schools as unknown as Record<string, unknown>;
    return {
      id: String(school.id),
      name: String(school.name),
      url: String(school.url),
      prefecture: (school.prefecture as string) ?? null,
      schoolType: (school.school_type as string) ?? null,
      coedType: (school.coed_type as string) ?? null,
      hasJuniorAdmission: Boolean(school.has_junior_admission),
      hasSeniorAdmission: Boolean(school.has_senior_admission),
      hasAffiliatedUniversity: Boolean(school.has_affiliated_university),
      robotsAllowed: Boolean(school.robots_allowed),
      role: row.role as School['role'],
      sortOrder: Number(row.sort_order),
    };
  });

  const { data: scans } = await supabase
    .from('scans')
    .select('school_id, started_at')
    .in(
      'school_id',
      schools.map((s) => s.id),
    )
    .order('started_at', { ascending: false });

  const lastScanBySchool = new Map<string, Date>();
  for (const scan of scans ?? []) {
    if (!lastScanBySchool.has(scan.school_id)) {
      lastScanBySchool.set(scan.school_id, new Date(scan.started_at));
    }
  }

  console.log(`現在時刻: ${formatJst(now)}（日本時間）`);
  console.log(
    `スケジュール: 自校 ${SCAN_FREQUENCY_LABEL[settings.schedule.selfFrequency]} ／ ` +
      `比較校 ${SCAN_FREQUENCY_LABEL[settings.schedule.competitorFrequency]}`,
  );

  const due: School[] = [];
  for (const school of schools) {
    const frequency =
      school.role === 'self'
        ? settings.schedule.selfFrequency
        : settings.schedule.competitorFrequency;
    const lastScan = lastScanBySchool.get(school.id) ?? null;
    const shouldScan = isScanDue(frequency, settings.schedule, lastScan, now);
    const next = lastScan ? nextScanAt(frequency, settings.schedule, lastScan) : null;

    console.log(
      `${shouldScan ? '● 対象' : '  対象外'}  ${school.name}（${school.role}）` +
        ` 前回 ${lastScan ? formatJst(lastScan) : 'なし'} ／ 次回 ${formatJst(next)}`,
    );
    if (shouldScan) due.push(school);
  }

  console.log(`\n走査対象: ${due.length}校`);
  if (!flag('run') || due.length === 0) {
    if (due.length > 0) console.log('実行するには --run を付けてください。');
    return;
  }

  for (const school of due) {
    // 前回の判定結果を渡し、判定の揺れを抑える（要確定事項E）
    const previousFindings = await loadPreviousFindings(school.id);

    console.log(`\n走査開始: ${school.name}`);
    const outcome = await runScan(school, {}, previousFindings, settings);
    const saved = await persistScanOutcome(outcome, { schoolId: school.id });
    console.log(
      `走査結果: status=${outcome.crawl.status} pages=${outcome.crawl.stats.pageCount} ／ ` +
        (saved.target === 'supabase' ? `scan_id=${saved.location}` : `保存先 ${saved.location}`),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
