/**
 * マイグレーションと点検が使う Postgres 接続。
 *
 * 以前は `rejectUnauthorized: false` を固定で入れていた。接続は通るが、
 * 証明書を検証しないので、経路上で別のサーバに差し替えられても気づけない。
 * データベースの資格情報をそのまま渡す接続でこれを既定にしてはいけない。
 *
 * 既定は検証する。Supabase の証明書が Node の既定のルート証明書で
 * 検証できない構成もあるため、逃げ道を2つ用意し、どちらも**明示**させる：
 *
 *   DATABASE_CA_CERT       … CA 証明書のパス、または PEM そのもの（推奨）
 *   DATABASE_SSL_NO_VERIFY … '1' で検証を切る（最後の手段。警告を出す）
 */

import { readFileSync } from 'node:fs';

import { Client } from 'pg';

/** 証明書エラーだと分かるコード（pg / Node TLS が返すもの） */
const CERT_ERROR_CODES = new Set([
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

function sslOptions(connectionString: string) {
  // ローカルの Postgres は TLS を張っていないことが多い
  if (/localhost|127\.0\.0\.1/.test(connectionString)) return undefined;

  if (process.env.DATABASE_SSL_NO_VERIFY === '1') {
    console.warn(
      '警告: DATABASE_SSL_NO_VERIFY=1 のため、サーバ証明書を検証していません。' +
        '一時的な確認以外では使わないでください。',
    );
    return { rejectUnauthorized: false };
  }

  const ca = process.env.DATABASE_CA_CERT?.trim();
  if (ca) {
    // PEM をそのまま渡す運用（環境変数に入れる）と、ファイルパスの両方を受ける
    const pem = ca.startsWith('-----BEGIN') ? ca : readFileSync(ca, 'utf8');
    return { ca: pem, rejectUnauthorized: true };
  }

  return { rejectUnauthorized: true };
}

/** 証明書の検証で失敗したときに、次に何をすればよいか分かる文言にする */
export function describeConnectionError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message : String(error);

  if (code && CERT_ERROR_CODES.has(code)) {
    return (
      `${message}\n\n` +
      'サーバ証明書を検証できませんでした。次のいずれかで解決できます。\n' +
      '  1. Supabase の管理画面 → Project Settings → Database から CA 証明書を\n' +
      '     ダウンロードし、DATABASE_CA_CERT にそのパスを設定する（推奨）\n' +
      '  2. 一時的な確認だけなら DATABASE_SSL_NO_VERIFY=1 を付ける\n' +
      '     （経路上でサーバを差し替えられても気づけなくなります）'
    );
  }
  return message;
}

/** 接続済みのクライアントを返す。呼び出し側が end() する。 */
export async function connect(connectionString: string): Promise<Client> {
  const client = new Client({ connectionString, ssl: sslOptions(connectionString) });
  await client.connect();
  return client;
}
