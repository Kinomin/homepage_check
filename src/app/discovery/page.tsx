import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar } from '@/components/shell/Topbar';
import { CRITERIA } from '@/lib/analysis/criteria';
import { loadDashboard } from '@/lib/data/repository';
import { SCREENS } from '@/lib/screens';

export default async function DiscoveryPage() {
  const { schools, scan, isDemo } = await loadDashboard();

  return (
    <>
      <Topbar
        screen={SCREENS.discovery}
        scan={scan}
        competitorCount={schools.length - 1}
        criteriaCount={CRITERIA.length}
      />
      <div className="wrap">
        <DemoNote isDemo={isDemo} />
        <div className="card">
          <div className="card-h">
            <h2>
              <span className="id">SE</span>
              {SCREENS.discovery.title}は Phase 2 で実装します
            </h2>
          </div>
          <div className="card-b">
            <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--ink-2)' }}>
              この画面の主役は「一般検索（地域名・沿線名・特色語）での自校と比較校の順位」です。順位の取得には外部の順位計測 API が必要で、学校数 × キーワード数 × 頻度で課金されます。課金設計を決めてから実装するため、Phase 1 では見送っています（handoff.md 9章D）。
            </p>
            <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--ink-2)', marginTop: 12 }}>
              Phase 2 では「一般検索キーワード5語 × 月次」程度に絞る想定です。技術チェックの羅列は制作会社の無料診断と同じ土俵になるため、主役にはしません。
            </p>
            <p style={{ fontSize: 11.5, lineHeight: 1.8, color: 'var(--mute)', marginTop: 12 }}>
              なお {SCREENS.gap.title} と {SCREENS.measurement.title} は「すでにサイトに来た人」を扱い、この画面だけが「まだ学校名を知らない人」を扱います。役割が違うため、他の画面で代替はできません。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
