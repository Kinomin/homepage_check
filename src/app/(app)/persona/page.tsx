import { PersonaPanel } from '@/components/persona/PersonaPanel';
import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar } from '@/components/shell/Topbar';
import { CRITERIA, CRITERIA_BY_ID } from '@/lib/analysis/criteria';
import { canManage, getCurrentSession, isAuthEnabled } from '@/lib/auth/session';
import { loadPersonas } from '@/lib/data/persona-repository';
import { loadDashboard } from '@/lib/data/repository';
import { buildSurveyQuestions } from '@/lib/persona/generate';
import { SCREENS } from '@/lib/screens';

export default async function PersonaPage() {
  const { schools, scan, isDemo } = await loadDashboard();
  const { personas, generated, canGenerate } = await loadPersonas();
  const session = isAuthEnabled() ? await getCurrentSession() : null;

  return (
    <>
      <Topbar
        screen={SCREENS.persona}
        scan={scan}
        competitorCount={schools.length - 1}
        criteriaCount={CRITERIA.length}
      />
      <div className="wrap">
        <DemoNote isDemo={isDemo} />
        <PersonaPanel
          personas={personas}
          criteria={CRITERIA_BY_ID}
          survey={buildSurveyQuestions(personas)}
          generated={generated}
          canGenerate={canGenerate && canManage(session)}
        />
      </div>
    </>
  );
}
