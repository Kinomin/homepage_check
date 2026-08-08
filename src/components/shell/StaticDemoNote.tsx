'use client';

import { IS_STATIC_DEMO } from '@/lib/static-demo';

/**
 * 静的デモで保存ができない操作に添える説明。
 *
 * 押せるのに何も起きない要素を作らない（handoff.md 10章-5）。
 * 操作を無効にするときは、必ず理由を書く。
 */
export function StaticDemoNote({ what }: { what: string }) {
  if (!IS_STATIC_DEMO) return null;
  return (
    <p className="setting-note">
      このページは公開デモのため、保存先のサーバがありません。{what}
      は操作できますが保存されません。実際に使うには、Supabase を接続した環境で動かしてください。
    </p>
  );
}
