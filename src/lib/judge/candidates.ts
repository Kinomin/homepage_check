/**
 * 判定パイプライン 1段目：候補ページの抽出（ルールベース）。
 *
 * ここでは「該当するか」を決めない。決めるのは LLM（2段目）。
 * この段の役割は、URL パス・ナビゲーション階層・見出しから候補を絞り、
 * LLM に渡す本文量を制限することだけ（handoff.md 4章／9章A）。
 *
 * 語句が一致しないページを候補から落としすぎると
 * 「あるのに、ない」と誤判定するため、候補が少ないときは
 * サイト全体の見出し一覧も判定材料として添える。
 */

import type { Criterion } from '../types';
import type { ExtractedPage } from '../crawl/extract';

export interface Candidate {
  page: ExtractedPage;
  score: number;
  reasons: string[];
}

const PATH_HINT_SCORE = 3;
const TITLE_ALIAS_SCORE = 4;
const HEADING_ALIAS_SCORE = 2;
const BODY_ALIAS_SCORE = 1;
const SHALLOW_DEPTH_BONUS = 1;

export function scorePage(page: ExtractedPage, criterion: Criterion): Candidate {
  const reasons: string[] = [];
  let score = 0;

  const pathname = safePathname(page.url).toLowerCase();
  for (const hint of criterion.pathHints) {
    if (pathname.includes(hint.toLowerCase())) {
      score += PATH_HINT_SCORE;
      reasons.push(`URLパス ${hint}`);
      break;
    }
  }

  const title = page.title ?? '';
  const headings = page.headings.join(' ');
  const body = page.text ?? '';

  for (const alias of criterion.aliases) {
    if (title.includes(alias)) {
      score += TITLE_ALIAS_SCORE;
      reasons.push(`タイトルに「${alias}」`);
      continue;
    }
    if (headings.includes(alias)) {
      score += HEADING_ALIAS_SCORE;
      reasons.push(`見出しに「${alias}」`);
      continue;
    }
    if (body.includes(alias)) {
      score += BODY_ALIAS_SCORE;
      reasons.push(`本文に「${alias}」`);
    }
  }

  if (page.depth <= 1 && score > 0) {
    score += SHALLOW_DEPTH_BONUS;
    reasons.push('浅い階層');
  }

  return { page, score, reasons };
}

/**
 * 候補ページを上位 limit 件返す。
 * 一致が弱くても候補が空にならないよう、最低件数は浅い階層のページで埋める。
 */
export function selectCandidates(
  pages: ExtractedPage[],
  criterion: Criterion,
  limit = 5,
): Candidate[] {
  const scored = pages
    .map((page) => scorePage(page, criterion))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.page.depth - b.page.depth);

  if (scored.length >= limit) return scored.slice(0, limit);

  const chosen = new Set(scored.map((c) => c.page.url));
  const fillers = pages
    .filter((p) => !chosen.has(p.url) && !p.isPdf)
    .sort((a, b) => a.depth - b.depth || b.wordCount - a.wordCount)
    .slice(0, limit - scored.length)
    .map((page) => ({ page, score: 0, reasons: ['候補が少ないため階層の浅いページを補完'] }));

  return [...scored, ...fillers];
}

/**
 * サイト全体の見出し一覧（タイトルと URL のみ）。
 * 「サイト全体を走査 ｜ 該当ページ 0件」という判定の根拠に使う。
 */
export function siteOutline(pages: ExtractedPage[], limit = 120): string {
  return pages
    .slice(0, limit)
    .map((p) => `- ${safePathname(p.url)}${p.title ? ` … ${p.title}` : ''}${p.isPdf ? ' [PDF]' : ''}`)
    .join('\n');
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
