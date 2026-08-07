import { SettingsForm } from '@/components/settings/SettingsForm';
import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar } from '@/components/shell/Topbar';
import { CRITERIA } from '@/lib/analysis/criteria';
import { loadDashboard } from '@/lib/data/repository';
import { loadSettings } from '@/lib/data/settings-repository';
import { SCREENS } from '@/lib/screens';

export default async function SettingsPage() {
  const { schools, scan, isDemo } = await loadDashboard();
  const { settings, persisted } = await loadSettings();
  const competitorCount = schools.length - 1;

  return (
    <>
      <Topbar
        screen={SCREENS.settings}
        scan={scan}
        competitorCount={competitorCount}
        criteriaCount={CRITERIA.length}
        subOverride={SCREENS.settings.sub}
      />
      <div className="wrap">
        <DemoNote isDemo={isDemo} />
        {!persisted && (
          <div className="caution" style={{ marginTop: 0, marginBottom: 14 }}>
            <b>設定はまだ保存先に接続されていません</b>
            <br />
            Supabase が未接続のため、変更はこのプロセス内にのみ保持されます。サーバを再起動すると初期設定に戻ります。
          </div>
        )}
        <SettingsForm
          initialSettings={settings}
          persisted={persisted}
          competitorCount={competitorCount}
          criteriaCount={CRITERIA.length}
          lastScanAt={scan.startedAt}
        />
      </div>
    </>
  );
}
