/**
 * データベースへの死活アクセス。
 *
 *   npm run keepalive
 *
 * Supabase の無料プランは、一定期間アクセスが無いとプロジェクトを一時停止する。
 * 停止すると「URLを開いたら壊れている」状態になる。
 *
 * 走査を週1回にすると、その間隔が停止までの猶予（7日）と並んでしまう。
 * 走査だけに頼らず、短い間隔で軽く触っておく。
 *
 * 読むのは調査項目の件数だけ。書き込みはしない。
 */

import { createServiceClient } from '../src/lib/supabase/server';

async function main() {
  const supabase = createServiceClient();
  if (!supabase) {
    console.error(
      'Supabase が未接続です。NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。',
    );
    process.exit(1);
  }

  const { count, error } = await supabase
    .from('criteria')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error(`データベースに接続できません: ${error.message}`);
    process.exit(1);
  }

  console.log(`接続しました（調査項目 ${count}件）`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
