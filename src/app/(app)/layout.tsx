import { redirect } from 'next/navigation';

import { Sidebar } from '@/components/shell/Sidebar';
import { getCurrentSession, isAuthEnabled } from '@/lib/auth/session';
import { loadDashboard } from '@/lib/data/repository';
import { loadSettings } from '@/lib/data/settings-repository';
import { nextScanAt } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * 分析画面の枠。
 *
 * 認証を使う構成で、まだ学校法人を登録していない人は初回登録へ送る。
 * 走査結果が1件も無い状態で 01〜07 を開いても、見るものが無い。
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = isAuthEnabled() ? await getCurrentSession() : null;
  if (isAuthEnabled() && session && !session.membership) redirect('/onboarding');

  const { schools, scan } = await loadDashboard();
  const { settings } = await loadSettings();
  // 次回走査は設定のスケジュールから算出する（手動のみなら null）
  const nextScan = nextScanAt(
    settings.schedule.selfFrequency,
    settings.schedule,
    new Date(scan.startedAt),
  );

  return (
    <div className="shell">
      <Sidebar
        schoolName={schools[0]?.name ?? '—'}
        lastScan={scan.startedAt}
        nextScan={nextScan ? nextScan.toISOString() : null}
        crawlDepth={settings.crawl.maxDepth}
        account={session ? { email: session.user.email, role: session.membership?.role ?? null } : null}
      />
      <main className="main">{children}</main>
    </div>
  );
}
