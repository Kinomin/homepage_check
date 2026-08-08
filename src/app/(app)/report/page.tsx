import { ReportComposer, type ReportBlockData } from '@/components/report/ReportComposer';
import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar, formatDate } from '@/components/shell/Topbar';
import { CRITERIA } from '@/lib/analysis/criteria';
import { analyzeDiscovery } from '@/lib/analysis/discovery';
import {
  competitorsWithInfo,
  isAbsentAtSelfAndSomeCompetitorsHave,
  summarizeGap,
  weakerCompetitorCount,
} from '@/lib/analysis/summary';
import { loadPersonas } from '@/lib/data/persona-repository';
import { loadDashboard } from '@/lib/data/repository';
import { PERSONA_STAGE_LABEL, genderLabel } from '@/lib/persona/types';
import { SCREENS } from '@/lib/screens';

export default async function ReportPage() {
  const { schools, scan, gapRows, measurements, actions, selfPages, isDemo } =
    await loadDashboard();
  const summary = summarizeGap(gapRows);
  const competitorNames = schools.slice(1).map((s) => s.name);

  const discovery = analyzeDiscovery({
    pages: selfPages,
    schoolName: schools[0]?.name ?? '',
  });
  const { personas } = await loadPersonas();

  const data: ReportBlockData = {
    schoolName: schools[0]?.name ?? '—',
    competitorNames,
    scanDate: formatDate(scan.startedAt),
    pageCount: scan.pageCount,
    criteriaCount: CRITERIA.length,
    allCompetitorsHave: summary.absentEverywhereElse.map((row) => ({
      label: row.criterion.label,
      audience: row.criterion.audience,
    })),
    someCompetitorsHave: gapRows.filter(isAbsentAtSelfAndSomeCompetitorsHave).map((row) => {
      const { have, measured } = competitorsWithInfo(row);
      return {
        label: row.criterion.label,
        audience: row.criterion.audience,
        publishedRatio: `${have} / ${measured}校`,
      };
    }),
    strengths: summary.strengths.map((row) => ({
      label: row.criterion.label,
      note: `比較${competitorNames.length}校中${weakerCompetitorCount(row)}校は本校より掲載量が少ない`,
    })),
    measurements,
    // 04 は機械判定のみ。数えた事実をそのまま載せる（評価文にしない）
    discovery: discovery.priorityChecks.map((check) => ({
      label: check.label,
      state: check.situation,
    })),
    // 05 は解釈。根拠の調査項目を必ず併記する（handoff.md 5章 05）
    personas: personas.flatMap((persona) =>
      persona.hypotheses
        .filter((hypothesis) => hypothesis.kind === 'gap')
        .map((hypothesis) => ({
          who: `${PERSONA_STAGE_LABEL[persona.stage]}・${genderLabel(persona.stage, persona.gender)}`,
          body: hypothesis.body,
          basis: hypothesis.criterionIds.join('・'),
        })),
    ),
    highPriorityActions: actions.filter((action) => action.priority === 'high'),
    unknownCount: summary.unknownRows.length,
  };

  return (
    <>
      <Topbar
        screen={SCREENS.report}
        scan={scan}
        competitorCount={competitorNames.length}
        criteriaCount={CRITERIA.length}
      />
      <div className="wrap">
        <DemoNote isDemo={isDemo} />
        <ReportComposer data={data} />
      </div>
    </>
  );
}
