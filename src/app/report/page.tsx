import { ReportComposer, type ReportBlockData } from '@/components/report/ReportComposer';
import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar, formatDate } from '@/components/shell/Topbar';
import { CRITERIA } from '@/lib/analysis/criteria';
import {
  competitorsWithInfo,
  isAbsentAtSelfAndSomeCompetitorsHave,
  summarizeGap,
  weakerCompetitorCount,
} from '@/lib/analysis/summary';
import { loadDashboard } from '@/lib/data/repository';
import { SCREENS } from '@/lib/screens';

export default async function ReportPage() {
  const { schools, scan, gapRows, measurements, actions, isDemo } = await loadDashboard();
  const summary = summarizeGap(gapRows);
  const competitorNames = schools.slice(1).map((s) => s.name);

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
