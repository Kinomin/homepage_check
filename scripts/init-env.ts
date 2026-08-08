/**
 * .env.local の下書きを作る。
 *
 *   npm run init:env
 *
 * .env.example を写し、機械が決められる値（CRON_SECRET）だけ埋める。
 * 外部サービスの鍵は人が取ってくるしかないので、空のまま残して
 * どこで取るかを行末に書いておく。
 *
 * 既にある .env.local は上書きしない。書きかけの設定を消さないため。
 */

import { randomBytes } from 'node:crypto';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EXAMPLE = path.join(process.cwd(), '.env.example');
const TARGET = path.join(process.cwd(), '.env.local');

async function exists(file: string): Promise<boolean> {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (await exists(TARGET)) {
    console.log('.env.local は既にあります。上書きしません。');
    console.log('設定の状態を見るには npm run doctor を実行してください。');
    return;
  }

  await copyFile(EXAMPLE, TARGET);
  let content = await readFile(TARGET, 'utf8');

  // 自動実行の共有シークレット。人が考える必要のない値なのでここで作る
  const secret = randomBytes(32).toString('hex');
  content = content.replace(/^CRON_SECRET=.*$/m, `CRON_SECRET=${secret}`);

  await writeFile(TARGET, content, 'utf8');

  console.log('.env.local を作りました。CRON_SECRET は生成済みです。\n');
  console.log('残りは手作業です（docs/SETUP.md）:');
  console.log('  NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  console.log('    Supabase → Project Settings → API');
  console.log('  DATABASE_URL');
  console.log('    Supabase → Project Settings → Database → Connection string (URI)');
  console.log('  ANTHROPIC_API_KEY');
  console.log('    https://console.anthropic.com');
  console.log('  CRAWL_USER_AGENT');
  console.log('    自校の連絡先URLに書き換えてください');
  console.log('\n設定したら npm run doctor で確認できます。');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
