/**
 * 設定の点検。
 *
 *   npm run doctor
 *
 * 手順書のどこまで済んでいるかを機械が判定する。
 * 「動かない」ときに何が足りないのかを人が推測しなくて済むようにする。
 *
 * 判定は3段階。**未設定と失敗を分ける**（走査の扱いと同じ考え方）：
 *   ok    設定済みで、実際に疎通した
 *   skip  設定していない。その機能を使わない選択なので異常ではない
 *   ng    設定してあるのに動かない。手を入れる必要がある
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { connect, describeConnectionError } from '../src/lib/db/connection';

type Status = 'ok' | 'skip' | 'ng';

interface Check {
  name: string;
  status: Status;
  detail: string;
  /** 直し方。ng / skip のときに出す */
  hint?: string;
}

const MARK: Record<Status, string> = { ok: '✓', skip: '−', ng: '✗' };

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

/** 端末上の表示幅。全角は2、半角は1として数える */
function displayWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    width += /[　-ヿ㐀-鿿＀-｠￠-￦]/.test(char) ? 2 : 1;
  }
  return width;
}

async function checkDatabase(): Promise<Check[]> {
  const connectionString = env('DATABASE_URL');
  if (!connectionString) {
    return [
      {
        name: 'データベース接続',
        status: 'skip',
        detail: 'DATABASE_URL 未設定（サンプルデータで動作）',
        hint: 'Supabase → Project Settings → Database → Connection string (URI) を .env.local に設定',
      },
    ];
  }

  let client;
  try {
    client = await connect(connectionString);
  } catch (error) {
    return [
      {
        name: 'データベース接続',
        status: 'ng',
        detail: describeConnectionError(error),
        hint: 'DATABASE_URL のホスト名・パスワードを確認してください',
      },
    ];
  }

  const checks: Check[] = [{ name: 'データベース接続', status: 'ok', detail: '疎通しました' }];

  try {
    // マイグレーションの適用漏れ
    const files = (await readdir(path.join(process.cwd(), 'supabase', 'migrations')))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    const { rows } = await client.query<{ version: string }>(
      `select version from schema_migrations`,
    );
    const applied = new Set(rows.map((row) => row.version));
    const missing = files.filter((file) => !applied.has(file));

    checks.push(
      missing.length === 0
        ? {
            name: 'マイグレーション',
            status: 'ok',
            detail: `${files.length}件すべて適用済み`,
          }
        : {
            name: 'マイグレーション',
            status: 'ng',
            detail: `未適用 ${missing.length}件（${missing.join(', ')}）`,
            hint: 'npm run db:migrate',
          },
    );

    // 調査項目のシード
    const { rows: criteria } = await client.query<{ count: string }>(
      'select count(*)::text as count from criteria',
    );
    const count = Number(criteria[0].count);
    checks.push(
      count === 31
        ? { name: '調査項目', status: 'ok', detail: '31件' }
        : {
            name: '調査項目',
            status: 'ng',
            detail: `${count}件（31件であるべき）`,
            hint: 'npm run db:migrate（シードも流し直します）',
          },
    );

    // 学校の登録。0件なら「まだ登録していない」だけなので異常ではない
    const { rows: schools } = await client.query<{ role: string; count: string }>(
      'select role, count(*)::text as count from org_schools group by role',
    );
    const self = Number(schools.find((r) => r.role === 'self')?.count ?? 0);
    const competitors = Number(schools.find((r) => r.role === 'competitor')?.count ?? 0);
    checks.push(
      self > 0
        ? {
            name: '学校の登録',
            status: 'ok',
            detail: `自校 ${self}校 ／ 比較校 ${competitors}校`,
          }
        : {
            name: '学校の登録',
            status: 'skip',
            detail: '未登録',
            hint: 'アプリを起動し、/signin から登録 → /onboarding で自校を登録',
          },
    );

    // 走査の実績
    const { rows: scans } = await client.query<{ count: string; last: string | null }>(
      `select count(*)::text as count, max(started_at)::text as last from scans where status = 'done'`,
    );
    checks.push(
      Number(scans[0].count) > 0
        ? {
            name: '走査の実績',
            status: 'ok',
            detail: `完了 ${scans[0].count}回（直近 ${scans[0].last?.slice(0, 16) ?? '—'}）`,
          }
        : {
            name: '走査の実績',
            status: 'skip',
            detail: 'まだ走査していません（画面はサンプル表示のまま）',
            hint: 'npm run scan:due -- --run',
          },
    );
  } catch (error) {
    checks.push({
      name: 'テーブルの確認',
      status: 'ng',
      detail: error instanceof Error ? error.message : String(error),
      hint: 'npm run db:migrate でマイグレーションを適用してください',
    });
  } finally {
    await client.end();
  }

  return checks;
}

async function checkAnthropic(): Promise<Check> {
  const key = env('ANTHROPIC_API_KEY');
  if (!key) {
    return {
      name: '判定（Claude API）',
      status: 'skip',
      detail: '未設定。判定はすべて unknown になります',
      hint: 'https://console.anthropic.com で API キーを発行し ANTHROPIC_API_KEY に設定',
    };
  }

  const model = env('ANTHROPIC_MODEL') || 'claude-opus-5';
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (response.ok) {
      return { name: '判定（Claude API）', status: 'ok', detail: `${model} に疎通しました` };
    }
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    return {
      name: '判定（Claude API）',
      status: 'ng',
      detail: `${response.status} ${body?.error?.message ?? ''}`.trim(),
      hint:
        response.status === 401
          ? 'ANTHROPIC_API_KEY が無効です'
          : response.status === 404
            ? `ANTHROPIC_MODEL（${model}）が利用できません`
            : '時間をおいて再度お試しください',
    };
  } catch (error) {
    return {
      name: '判定（Claude API）',
      status: 'ng',
      detail: error instanceof Error ? error.message : String(error),
      hint: 'ネットワーク（プロキシ設定）を確認してください',
    };
  }
}

function checkStatic(): Check[] {
  const checks: Check[] = [];

  const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  checks.push(
    supabaseUrl && anonKey
      ? { name: 'アプリからの接続情報', status: 'ok', detail: supabaseUrl }
      : {
          name: 'アプリからの接続情報',
          status: 'skip',
          detail: '未設定。ログインを使わず、サンプルデータで動作します',
          hint: 'Supabase → Project Settings → API の Project URL と anon key を設定',
        },
  );

  checks.push(
    env('SUPABASE_SERVICE_ROLE_KEY')
      ? { name: '走査の書き込み権限', status: 'ok', detail: '設定済み' }
      : {
          name: '走査の書き込み権限',
          status: 'skip',
          detail: 'SUPABASE_SERVICE_ROLE_KEY 未設定。走査結果を保存できません',
          hint: 'Supabase → Project Settings → API の service_role key を設定',
        },
  );

  const cronSecret = env('CRON_SECRET');
  if (!cronSecret) {
    checks.push({
      name: '自動実行',
      status: 'skip',
      detail: 'CRON_SECRET 未設定。/api/cron/scan は 503 を返します',
      hint: 'npm run init:env で生成するか、openssl rand -hex 32 の出力を設定',
    });
  } else if (cronSecret.length < 32) {
    checks.push({
      name: '自動実行',
      status: 'ng',
      detail: `CRON_SECRET が短すぎます（${cronSecret.length}文字）`,
      hint: '32文字以上にしてください（openssl rand -hex 32）',
    });
  } else {
    checks.push({ name: '自動実行', status: 'ok', detail: 'CRON_SECRET 設定済み' });
  }

  const userAgent = env('CRAWL_USER_AGENT');
  checks.push(
    userAgent && !userAgent.includes('example.com')
      ? { name: 'クロールの名乗り', status: 'ok', detail: userAgent }
      : {
          name: 'クロールの名乗り',
          status: 'ng',
          detail: userAgent ? '既定値のままです' : '未設定',
          hint:
            'CRAWL_USER_AGENT に自校の連絡先URLを入れてください。' +
            '相手校が問い合わせ先を辿れる状態にしておくためです',
        },
  );

  return checks;
}

async function main() {
  console.log('School Insight AI ／ 設定の点検\n');

  const checks = [...checkStatic(), ...(await checkDatabase()), await checkAnthropic()];

  // 日本語は全角なので、文字数ではなく表示幅で揃える
  const width = Math.max(...checks.map((check) => displayWidth(check.name)));
  for (const check of checks) {
    const pad = ' '.repeat(width - displayWidth(check.name));
    console.log(`${MARK[check.status]} ${check.name}${pad}  ${check.detail}`);
    if (check.hint && check.status !== 'ok') console.log(`    → ${check.hint}`);
  }

  const failed = checks.filter((check) => check.status === 'ng');
  const skipped = checks.filter((check) => check.status === 'skip');

  console.log(
    `\n設定済み ${checks.length - failed.length - skipped.length}` +
      ` ／ 未設定 ${skipped.length} ／ 要対応 ${failed.length}`,
  );
  if (skipped.length > 0 && failed.length === 0) {
    console.log('未設定のものは、その機能を使わない選択であれば問題ありません。');
  }
  console.log('手順は docs/SETUP.md を参照してください。');

  // 要対応があるときだけ異常終了にする。未設定は異常ではない
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
