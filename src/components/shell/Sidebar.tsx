'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_DIVIDER_BEFORE, SCREEN_LIST } from '@/lib/screens';

/**
 * 画面名称は SCREENS（src/lib/screens.ts）から引く。
 * ここに文言をハードコードしない（handoff.md 10章-3）。
 */
export function Sidebar({
  schoolName,
  lastScan,
  nextScan,
  crawlDepth,
  account,
}: {
  schoolName: string;
  lastScan: string;
  nextScan: string | null;
  crawlDepth: number;
  /** ログイン中のアカウント。認証を使わない構成では null */
  account: { email: string; role: 'admin' | 'viewer' | null } | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="side">
      <div className="brand">
        <div className="logo">School Insight AI</div>
        <div className="tag">ADMISSIONS SITE ANALYTICS</div>
      </div>
      <div className="school">
        <div className="lbl">TARGET</div>
        <div className="nm">{schoolName}</div>
      </div>
      <nav className="nav" role="tablist">
        {SCREEN_LIST.map((screen) => (
          <div key={screen.id} style={{ display: 'contents' }}>
            {NAV_DIVIDER_BEFORE.includes(screen.id) && <div className="divider" />}
            <Link
              href={screen.href}
              role="tab"
              aria-selected={pathname === screen.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '8px 11px',
                borderRadius: 4,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              <span className="no">{screen.no}</span>
              {screen.title}
              {!screen.phase1 && (
                <span className="tag t-neu" style={{ marginLeft: 'auto' }}>
                  Phase2
                </span>
              )}
            </Link>
          </div>
        ))}
      </nav>
      <div className="side-foot">
        LAST SCAN　<b>{formatDateTime(lastScan)}</b>
        <br />
        {/* 次回走査は設定画面のスケジュールから算出する。手動のみの場合は「自動実行なし」 */}
        NEXT SCAN　<b>{nextScan ? formatDateTime(nextScan) : '自動実行なし'}</b>
        <br />
        CRAWL DEPTH　<b>{crawlDepth}</b>
        {account && (
          <>
            <div className="divider" style={{ margin: '10px 0' }} />
            <span title={account.email}>{account.email}</span>
            {account.role && <b>　{account.role === 'admin' ? '管理者' : '閲覧者'}</b>}
            <br />
            <form action="/api/auth/signout" method="post" style={{ marginTop: 6 }}>
              <button type="submit" className="side-signout">
                ログアウト
              </button>
            </form>
          </>
        )}
      </div>
    </aside>
  );
}

/** 走査時刻は日本時間で表示する（実行環境のタイムゾーンに左右させない） */
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
