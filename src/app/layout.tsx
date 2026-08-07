import type { Metadata } from 'next';

import { Sidebar } from '@/components/shell/Sidebar';
import { loadDashboard } from '@/lib/data/repository';
import { loadSettings } from '@/lib/data/settings-repository';
import { nextScanAt } from '@/lib/settings';
import './globals.css';

/**
 * 走査結果と対応済み状態は毎リクエスト読み直す。
 * ビルド時に固定すると、01 と 06 の対応済みトグルが共有されなくなる。
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'School Insight AI ｜ 入試広報分析',
  description: '私立中高一貫校の入試広報担当者向け、学校ホームページ分析ツール',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { schools, scan } = await loadDashboard();
  const { settings } = await loadSettings();
  // 次回走査は設定のスケジュールから算出する（手動のみなら null）
  const nextScan = nextScanAt(
    settings.schedule.selfFrequency,
    settings.schedule,
    new Date(scan.startedAt),
  );

  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* App Router の root layout は全ページに適用されるため、この警告は当たらない */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="shell">
          <Sidebar
            schoolName={schools[0]?.name ?? '—'}
            lastScan={scan.startedAt}
            nextScan={nextScan ? nextScan.toISOString() : null}
            crawlDepth={settings.crawl.maxDepth}
          />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
