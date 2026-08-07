/**
 * 01 SM-02 比較校の更新記録。
 *
 * 前回の走査と今回の走査を突き合わせ、**事実だけ**を並べる。
 * 出せるのは「公開しているかどうか」「いつ更新されたか」「何件あるか」の3つで、
 * 評価文・優劣の断定は生成しない（handoff.md 4章・5章）。
 *
 * 差分を出さない場面を先に決めてある。ここを緩めると、走査の都合が
 * 「相手校が変えた」という事実の主張に化ける：
 *
 * ・どちらかの走査が完了していない → 何も出さない
 * ・判定が unknown だった項目 → その項目は比較しない
 * ・ページ数上限に当たった走査 → ページの増減を出さない
 *   （上限で切られただけのページを「公開をやめた」と書かない）
 */

import { isPresent, type CriterionId, type Level, type ScanStatus } from '../types';
import { CRITERIA_BY_ID } from './criteria';

export interface ScanSnapshot {
  scanId: string;
  /** 走査の開始時刻（ISO） */
  startedAt: string;
  status: ScanStatus;
  pages: { url: string; title: string | null; lastModified: string | null }[];
  findings: { criterionId: CriterionId; level: Level }[];
  /** ページ数上限に当たったか。当たっていればページの増減を出さない */
  truncated: boolean;
}

export const COMPETITOR_CHANGE_KINDS = [
  'criterion-published',
  'criterion-unavailable',
  'page-added',
] as const;

export type CompetitorChangeKind = (typeof COMPETITOR_CHANGE_KINDS)[number];

export interface CompetitorChange {
  kind: CompetitorChangeKind;
  schoolId: string;
  schoolName: string;
  /** 変化を確認した走査の日時（今回の走査） */
  observedAt: string;
  /** 画面に出す一文。事実のみ */
  body: string;
  /** 根拠。項目の変化なら調査項目ID、ページなら URL */
  criterionId: CriterionId | null;
  url: string | null;
}

/**
 * 1校ぶんの差分。
 * previous が無い（初回の走査）場合は空。比較する相手がいない。
 */
export function diffCompetitorScans(
  school: { id: string; name: string },
  previous: ScanSnapshot | null,
  current: ScanSnapshot,
): CompetitorChange[] {
  // 走り切っていない回を根拠にしない。取得できなかったことは変化ではない。
  if (!previous || previous.status !== 'done' || current.status !== 'done') return [];

  const changes: CompetitorChange[] = [];
  const base = { schoolId: school.id, schoolName: school.name, observedAt: current.startedAt };

  const previousLevels = new Map(previous.findings.map((f) => [f.criterionId, f.level]));

  for (const finding of current.findings) {
    const before = previousLevels.get(finding.criterionId);
    if (!before) continue;

    // 判定できなかった回は比較の材料にしない。
    // unknown は「無い」ではなく「分からなかった」なので、
    // これを起点にすると公開状況が変わったという誤った記録になる。
    if (before === 'unknown' || finding.level === 'unknown') continue;
    if (before === 'n/a' || finding.level === 'n/a') continue;

    const label = CRITERIA_BY_ID[finding.criterionId]?.label ?? finding.criterionId;

    if (!isPresent(before) && isPresent(finding.level)) {
      changes.push({
        ...base,
        kind: 'criterion-published',
        body: `${finding.criterionId} ${label} の掲載を確認`,
        criterionId: finding.criterionId,
        url: null,
      });
    } else if (isPresent(before) && !isPresent(finding.level)) {
      changes.push({
        ...base,
        kind: 'criterion-unavailable',
        body: `${finding.criterionId} ${label} の掲載を確認できず`,
        criterionId: finding.criterionId,
        url: null,
      });
    }
  }

  // ページ数上限に当たった走査では、ページ集合が走査ごとに揺れる。
  // 揺れを「新しく公開した」と書かないため、上限に当たっていない回だけを比べる。
  if (!previous.truncated && !current.truncated) {
    const previousUrls = new Set(previous.pages.map((page) => page.url));
    for (const page of current.pages) {
      if (previousUrls.has(page.url)) continue;
      changes.push({
        ...base,
        kind: 'page-added',
        body: `新しいページを確認：${page.title?.trim() || page.url}`,
        criterionId: null,
        url: page.url,
      });
    }
  }

  return changes;
}

/** 複数校ぶんをまとめ、新しい順に並べる。 */
export function collectCompetitorChanges(
  entries: {
    school: { id: string; name: string };
    previous: ScanSnapshot | null;
    current: ScanSnapshot;
  }[],
  limit = 8,
): CompetitorChange[] {
  return entries
    .flatMap((entry) => diffCompetitorScans(entry.school, entry.previous, entry.current))
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    .slice(0, limit);
}

/** 走査記録から、差分を出せる状態かどうか。画面の文言を分けるために使う。 */
export function diffAvailability(
  entries: { previous: ScanSnapshot | null; current: ScanSnapshot | null }[],
): 'ready' | 'first-scan' | 'no-scan' {
  if (entries.length === 0 || entries.every((entry) => !entry.current)) return 'no-scan';
  if (entries.every((entry) => !entry.previous)) return 'first-scan';
  return 'ready';
}
