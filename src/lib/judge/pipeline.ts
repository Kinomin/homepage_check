/**
 * 判定パイプライン全体（handoff.md 4章）。
 *
 *   1. 候補ページの抽出（ルールベース）
 *   2. 内容判定（LLM）
 *   3. 根拠の保存（URL・画像点数・記事件数）
 *
 * 走査できなかった場合は unknown。robots.txt 拒否も unknown。
 * 判定対象外（系列大学なし等）は n/a とし、LLM を呼ばない。
 */

import { CRITERIA } from '../analysis/criteria';
import type { ExtractedPage } from '../crawl/extract';
import { crawlSite, type CrawlOptions, type CrawlResult } from '../crawl/crawler';
import type { Criterion, Finding, School } from '../types';
import { selectCandidates, siteOutline } from './candidates';
import { judgeCriterion, unknownResult, type JudgeResult } from './judge';

export interface ScanOutcome {
  school: School;
  crawl: CrawlResult;
  findings: Omit<Finding, 'scanId'>[];
}

/**
 * その学校でこの項目を判定すべきか。
 * false の場合は n/a とし、欠落として数えない（handoff.md 4章）。
 */
export function isApplicable(criterion: Criterion, school: School): boolean {
  switch (criterion.applicableWhen) {
    case 'has_affiliated_university':
      return school.hasAffiliatedUniversity;
    case 'has_junior_admission':
      return school.hasJuniorAdmission;
    case 'has_senior_admission':
      return school.hasSeniorAdmission;
    default:
      break;
  }
  // F1 募集要項は中学／高校のいずれかを募集している学校のみ対象
  if (criterion.id === 'F1') {
    return school.hasJuniorAdmission || school.hasSeniorAdmission;
  }
  return true;
}

/**
 * F1 は中学／高校／帰国生で系統が分かれるため、
 * 学校の募集区分に応じて判定対象を絞り込んだ基準文を渡す（handoff.md 4章）。
 */
export function criterionForSchool(criterion: Criterion, school: School): Criterion {
  if (criterion.id !== 'F1') return criterion;
  const targets = [
    school.hasJuniorAdmission ? '中学入試' : null,
    school.hasSeniorAdmission ? '高校入試' : null,
  ].filter(Boolean);
  return {
    ...criterion,
    judgePrompt: `${criterion.judgePrompt} この学校が募集しているのは ${targets.join('と')} です。募集していない課程の要項がないことを欠落として扱わないでください。`,
  };
}

export async function runScan(
  school: School,
  options: Partial<CrawlOptions> = {},
  previousFindings: Map<string, Pick<Finding, 'level' | 'evidenceText'>> = new Map(),
): Promise<ScanOutcome> {
  // robots.txt で拒否されている学校はそもそも走査しない（handoff.md 6章）
  if (!school.robotsAllowed) {
    return {
      school,
      crawl: {
        status: 'blocked',
        reason: 'robots.txt により走査が拒否されています',
        pages: [],
        stats: {
          pageCount: 0,
          imageCount: 0,
          imageWithoutAltCount: 0,
          pdfOnlyCount: 0,
          describedPageCount: 0,
          crawlDepth: options.maxDepth ?? 4,
        },
      },
      findings: allUnknownFindings(school, 'robots.txt により走査が拒否されています'),
    };
  }

  const crawl = await crawlSite({
    origin: school.url,
    // 比較校は判定に必要なページのみに絞る（要確定事項B の推奨）
    maxPages: school.role === 'self' ? 200 : 60,
    // 比較校のページ本文は保存しない（handoff.md 6章）
    keepBodyText: true,
    ...options,
  });

  if (crawl.status !== 'done') {
    return {
      school,
      crawl,
      findings: allUnknownFindings(school, crawl.reason ?? '走査に失敗しました'),
    };
  }

  const findings: Omit<Finding, 'scanId'>[] = [];
  const outline = siteOutline(crawl.pages);

  for (const criterion of CRITERIA) {
    findings.push(
      await judgeOne({
        criterion,
        school,
        pages: crawl.pages,
        outline,
        previous: previousFindings.get(criterion.id) ?? null,
      }),
    );
  }

  return { school, crawl, findings };
}

export async function judgeOne(params: {
  criterion: Criterion;
  school: School;
  pages: ExtractedPage[];
  outline: string;
  previous: Pick<Finding, 'level' | 'evidenceText'> | null;
}): Promise<Omit<Finding, 'scanId'>> {
  const { criterion, school, pages, outline, previous } = params;

  if (!isApplicable(criterion, school)) {
    return {
      criterionId: criterion.id,
      level: 'n/a',
      evidenceText: `判定対象外（${criterion.specialRule ?? 'この学校には該当しません'}）`,
      evidenceUrls: [],
      evidenceCounts: {},
      judgedBy: 'rule',
      judgedAt: new Date().toISOString(),
    };
  }

  const adjusted = criterionForSchool(criterion, school);
  const candidates = selectCandidates(pages, adjusted);

  const result: JudgeResult =
    pages.length === 0
      ? unknownResult('走査結果が空です')
      : await judgeCriterion({
          criterion: adjusted,
          schoolName: school.name,
          role: school.role,
          candidates,
          outline,
          pageCount: pages.length,
          previous,
        });

  return {
    criterionId: criterion.id,
    level: result.level,
    evidenceText: result.evidenceText,
    evidenceUrls: result.evidenceUrls,
    evidenceCounts: {
      ...result.evidenceCounts,
      候補ページ数: String(candidates.filter((c) => c.score > 0).length),
      走査ページ数: String(pages.length),
    },
    judgedBy: 'llm',
    judgedAt: new Date().toISOString(),
  };
}

function allUnknownFindings(school: School, reason: string): Omit<Finding, 'scanId'>[] {
  return CRITERIA.map((criterion) => ({
    criterionId: criterion.id,
    level: isApplicable(criterion, school) ? ('unknown' as const) : ('n/a' as const),
    evidenceText: isApplicable(criterion, school)
      ? `取得できませんでした（${reason}）`
      : '判定対象外',
    evidenceUrls: [],
    evidenceCounts: {},
    judgedBy: 'rule' as const,
    judgedAt: new Date().toISOString(),
  }));
}
