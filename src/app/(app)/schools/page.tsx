import { SchoolsPanel } from '@/components/schools/SchoolsPanel';
import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar } from '@/components/shell/Topbar';
import { CRITERIA } from '@/lib/analysis/criteria';
import { canManage, getCurrentSession, isAuthEnabled } from '@/lib/auth/session';
import { loadDashboard } from '@/lib/data/repository';
import { loadOrgSchools } from '@/lib/data/school-repository';
import { SCREENS } from '@/lib/screens';

export default async function SchoolsPage() {
  const { schools, scan, isDemo } = await loadDashboard();
  const session = isAuthEnabled() ? await getCurrentSession() : null;
  const registered = await loadOrgSchools();

  // 未接続のときは、画面の並びが分かるようデモの学校一覧をそのまま出す
  const self = registered?.self ?? schools.find((school) => school.role === 'self') ?? null;
  const competitors =
    registered?.competitors ?? schools.filter((school) => school.role === 'competitor');

  return (
    <>
      <Topbar
        screen={SCREENS.schools}
        scan={scan}
        competitorCount={competitors.length}
        criteriaCount={CRITERIA.length}
        subOverride={SCREENS.schools.sub}
      />
      <div className="wrap">
        <DemoNote isDemo={isDemo} />
        <SchoolsPanel
          self={self}
          competitors={competitors}
          canManage={canManage(session)}
          orgName={session?.membership?.orgName ?? null}
          editable={registered !== null}
        />
      </div>
    </>
  );
}
