/**
 * 環境変数。API キーはすべてここ経由で読む（handoff.md 2章）。
 *
 * Supabase を設定していない場合は、プロトタイプ由来のデモデータで動作する。
 * デモ動作中は画面上部にその旨を明示する（架空データを分析結果と誤認させないため）。
 */

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  /** 判定に使うモデル。既定は最も高性能な Claude Opus 5。 */
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',
  /**
   * 判定の思考深度。31項目 × 6校 = 186判定／回の規模のため、
   * 既定は low に置いてコストを抑える（handoff.md 9章A）。
   */
  judgeEffort: (process.env.JUDGE_EFFORT ?? 'low') as 'low' | 'medium' | 'high' | 'xhigh' | 'max',
  crawlUserAgent:
    process.env.CRAWL_USER_AGENT ?? 'SchoolInsightBot/1.0 (+https://example.com/bot)',
  /**
   * 自動実行エンドポイント（/api/cron/scan）の共有シークレット。
   * 未設定なら自動実行は無効。走査は外部サイトへのリクエストを伴うため、
   * 誰でも叩ける口を開けない。
   */
  cronSecret: process.env.CRON_SECRET ?? '',
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function isAnthropicConfigured(): boolean {
  return Boolean(env.anthropicApiKey);
}

/** 自動実行が有効か（設定画面に状態を出すために使う） */
export function isCronConfigured(): boolean {
  return Boolean(env.cronSecret);
}
