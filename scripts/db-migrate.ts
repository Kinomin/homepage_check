/**
 * マイグレーションの適用。
 *
 *   npm run db:migrate           未適用のものだけを順に適用し、シードを流す
 *   npm run db:migrate -- --dry  何が適用されるかだけを表示する
 *
 * psql を手で6回叩く手順を置き換える。手順書に「この順番で流す」と書いても、
 * 1つ飛ばした状態に気づけない。適用済みを DB 側に記録して、そこを機械に持たせる。
 *
 * ・ファイル名の昇順に適用する（0001 → 0006）
 * ・1ファイル=1トランザクション。途中で失敗したらそのファイルは丸ごと巻き戻す
 * ・適用済みのファイルが後から書き換わっていたら止める。
 *   黙って読み飛ばすと、手元のファイルと DB の状態が食い違ったまま進む
 * ・シード（criteria）は on conflict do update なので毎回流してよい
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const SEED_FILE = path.join(process.cwd(), 'supabase', 'seed', 'criteria.sql');

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      'DATABASE_URL が設定されていません。\n' +
        'Supabase の管理画面 → Project Settings → Database → Connection string（URI）を' +
        ' .env.local に DATABASE_URL として設定してください。',
    );
    process.exit(1);
  }

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.error(`${MIGRATIONS_DIR} に .sql がありません。`);
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    // Supabase は TLS 必須。自己署名の中間証明書を使う構成があるため検証は緩める
    ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);

    // デプロイが2つ同時に走ると、同じマイグレーションを2回当てようとする。
    // 先に取った方だけを通し、もう片方は待つ（接続が切れると自動で解放される）。
    await client.query('select pg_advisory_lock(hashtext($1))', ['school-insight:migrate']);

    const { rows } = await client.query<{ version: string; checksum: string }>(
      'select version, checksum from schema_migrations',
    );
    const applied = new Map(rows.map((row) => [row.version, row.checksum]));

    const pending: { version: string; sql: string; sum: string }[] = [];
    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const sum = checksum(sql);
      const previous = applied.get(file);

      if (previous === undefined) {
        pending.push({ version: file, sql, sum });
        continue;
      }
      // 適用済みのファイルが書き換わっている＝手元と DB の状態が食い違う
      if (previous !== sum) {
        console.error(
          `${file} は適用済みですが、内容が変わっています。\n` +
            '既に流した SQL を編集しても DB には反映されません。' +
            '変更は新しい番号のマイグレーションとして追加してください。',
        );
        process.exit(1);
      }
      console.log(`  適用済み  ${file}`);
    }

    if (pending.length === 0) {
      console.log('\n未適用のマイグレーションはありません。');
    } else if (flag('dry')) {
      console.log('\n適用されるもの（--dry のため実行しません）:');
      for (const item of pending) console.log(`  ${item.version}`);
    } else {
      for (const item of pending) {
        process.stdout.write(`  適用中    ${item.version} ... `);
        try {
          await client.query('begin');
          await client.query(item.sql);
          await client.query(
            'insert into schema_migrations (version, checksum) values ($1, $2)',
            [item.version, item.sum],
          );
          await client.query('commit');
          console.log('完了');
        } catch (error) {
          await client.query('rollback');
          console.log('失敗');
          console.error(`\n${item.version} の適用に失敗しました。この1ファイルは巻き戻しています。`);
          throw error;
        }
      }
    }

    if (!flag('dry')) {
      // 31項目のシード。on conflict do update なので何度流してもよい
      const seed = await readFile(SEED_FILE, 'utf8');
      await client.query(seed);
      const { rows: criteria } = await client.query<{ count: string }>(
        'select count(*)::text as count from criteria',
      );
      console.log(`\n調査項目のシード: ${criteria[0].count}件`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
