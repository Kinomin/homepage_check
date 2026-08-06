'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SCREEN_LIST } from '@/lib/screens';

/**
 * 画面名称は SCREENS（src/lib/screens.ts）から引く。
 * ここに文言をハードコードしない（handoff.md 10章-3）。
 */
export function Sidebar({
  schoolName,
  lastScan,
  nextScan,
  crawlDepth,
}: {
  schoolName: string;
  lastScan: string;
  nextScan: string | null;
  crawlDepth: number;
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
        {SCREEN_LIST.map((screen, index) => (
          <div key={screen.id} style={{ display: 'contents' }}>
            {index === SCREEN_LIST.length - 1 && <div className="divider" />}
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
        NEXT SCAN　<b>{nextScan ? formatDateTime(nextScan) : '未設定'}</b>
        <br />
        CRAWL DEPTH　<b>{crawlDepth}</b>
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
