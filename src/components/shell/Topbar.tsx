import type { Screen } from '@/lib/screens';
import type { ScanMeta } from '@/lib/data/repository';

/**
 * 画面ヘッダ。タイトル・説明は SCREENS から受け取り、ここでは文言を持たない。
 */
export function Topbar({
  screen,
  scan,
  competitorCount,
  criteriaCount,
  subOverride,
}: {
  screen: Screen;
  scan: ScanMeta;
  competitorCount: number;
  criteriaCount: number;
  subOverride?: string;
}) {
  return (
    <div className="topbar">
      <div className="code">{screen.code}</div>
      <h1>{screen.title}</h1>
      <div className="sub">
        {subOverride ??
          [
            `${formatDate(scan.startedAt)} 実施`,
            `比較対象${competitorCount}校`,
            `情報${criteriaCount}項目`,
            screen.sub,
          ]
            .filter(Boolean)
            .join(' ／ ')}
      </div>
      <div className="statstrip">
        <Stat k="PAGES" v={scan.pageCount} />
        <Stat k="INDEXED" v={scan.indexedCount} em={`/${scan.pageCount}`} />
        <Stat k="IMAGES" v={scan.imageCount} />
        <Stat k="PDF ONLY" v={scan.pdfOnlyCount} />
        {/* 未計測は 0 ではなく — と出す（測っていないことを 0件と読ませない） */}
        <Stat k="UPDATES 90D" v={scan.updates90d ?? '—'} />
        <Stat k="CATEGORIES" v={scan.newsCategories ?? '—'} />
        <Stat
          k="MOBILE LCP"
          v={scan.mobileLcpSeconds ?? '—'}
          em={scan.mobileLcpSeconds === null ? undefined : 's'}
        />
        <Stat k="COMPARED" v={competitorCount} em="校" />
      </div>
    </div>
  );
}

function Stat({ k, v, em }: { k: string; v: number | string; em?: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">
        {v}
        {em && <em>{em}</em>}
      </div>
    </div>
  );
}

/** 走査時刻は日本時間で表示する（実行環境のタイムゾーンに左右させない） */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}
