/**
 * ログイン後に戻る先の検証。
 *
 * 戻り先は URL のクエリや確認メールのリンクに載って外から入ってくるため、
 * そのまま使うと外部サイトへ飛ばせてしまう（オープンリダイレクト）。
 * 受けるのは自サイト内のパスだけに限る。
 */

/** 自サイト内のパスだけを通す。それ以外はトップに落とす。 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return '/';

  // `//evil.example.com` はブラウザに「スキーム相対URL」として解釈され、
  // 外部サイトへ飛ぶ。`/\evil.example.com` も同様に扱う実装がある。
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.startsWith('/\\')) return '/';

  // `https://...` のような絶対URLが混ざっていないか（大文字小文字も見る）
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '/';

  return value;
}
