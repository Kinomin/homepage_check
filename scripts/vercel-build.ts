/**
 * 本番ビルド（Vercel の Build Command）。
 *
 * デプロイのたびに、未適用のマイグレーションを当ててからビルドする。
 * これで初回の設定が済んだあとは、push するだけで済む。
 * 「URLを開くために毎回コマンドを叩く」状態を作らないため。
 *
 * 流さない場面をはっきり決めてある。ここを緩めると、
 * プレビュー環境のビルドが本番のデータベースを書き換える：
 *
 * ・DATABASE_URL が無い → 流さない（ビルドは続ける）
 * ・本番デプロイ以外（プレビュー・開発）→ 流さない
 * ・SKIP_DB_MIGRATE=1 → 流さない（手で当てたいとき用）
 *
 * マイグレーション自体は冪等（適用済みは schema_migrations に記録済み）なので、
 * 同じデプロイが2回走っても二重には当たらない。
 */

import { spawn } from 'node:child_process';

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} が終了コード ${code} で終わりました`)),
    );
    child.on('error', reject);
  });
}

function skipReason(): string | null {
  if (process.env.SKIP_DB_MIGRATE === '1') return 'SKIP_DB_MIGRATE=1 が指定されています';
  if (!process.env.DATABASE_URL) return 'DATABASE_URL が設定されていません';

  // VERCEL_ENV は production / preview / development のいずれか。
  // Vercel 以外（自前のサーバなど）では未設定なので、その場合は流す。
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv && vercelEnv !== 'production') {
    return `${vercelEnv} デプロイのため本番のデータベースには触りません`;
  }
  return null;
}

async function main() {
  const skip = skipReason();

  if (skip) {
    console.log(`マイグレーションは流しません：${skip}\n`);
  } else {
    console.log('マイグレーションを適用します\n');
    await run('npx', ['tsx', 'scripts/db-migrate.ts']);
    console.log('');
  }

  await run('npx', ['next', 'build']);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
