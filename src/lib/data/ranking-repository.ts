/**
 * 04 の順位記録。
 *
 * 順位の取得には外部の順位計測 API が必要で、学校数 × キーワード数 × 頻度で
 * 課金される。どの API をどの頻度で使うかは未確定のため（handoff.md 9章D）、
 * Phase 1 では手動記録の受け皿だけを用意する。
 *
 * API を導入するときは rankings テーブルに書き込む処理を足すだけでよく、
 * 画面が見る形（RankingRow）は変えなくてよい。
 */

import { createDataClient } from '../supabase/server';
import { DEMO_RANKINGS } from './demo-extras';
import type { KeywordType, School } from '../types';

/** 画面に出す1キーワードぶんの記録 */
export interface RankingRow {
  keyword: string;
  keywordType: KeywordType;
  /** 月間検索数（推定値。分かる場合のみ） */
  monthlySearches: number | null;
  /** 自校の順位。圏外は null（0 や 999 で表さない） */
  selfPosition: number | null;
  /** 比較校で最上位の学校名と順位 */
  bestCompetitorName: string | null;
  bestCompetitorPosition: number | null;
  /** 1位のサイト */
  topDomain: string | null;
  measuredAt: string | null;
}

/** デモ動作時の記録。Route Handler と Server Component で同じ実体を見る。 */
const demoRankings: { rows: RankingRow[] } = ((
  globalThis as { __demoRankings?: { rows: RankingRow[] } }
).__demoRankings ??= {
  rows: DEMO_RANKINGS.map((row) => ({
    keyword: row.keyword,
    keywordType: 'generic' as KeywordType,
    monthlySearches: row.monthlySearches,
    selfPosition: row.selfPosition,
    bestCompetitorName: row.bestCompetitor,
    bestCompetitorPosition: row.bestCompetitorPosition,
    topDomain: row.topDomain,
    measuredAt: '2026-08-03',
  })),
});

/**
 * 学校ごとの順位行を、キーワード単位の1行にまとめる。
 * 自校がどれかを判定する必要があるため、学校一覧を受け取る。
 */
export async function loadRankings(schools: School[] = []): Promise<RankingRow[]> {
  const supabase = await createDataClient();
  if (!supabase) return demoRankings.rows;

  const selfSchool = schools.find((school) => school.role === 'self');
  const nameById = new Map(schools.map((school) => [school.id, school.name]));

  const { data, error } = await supabase
    .from('rankings')
    .select('keyword, keyword_type, position, top_domain, measured_at, school_id')
    .order('measured_at', { ascending: false });
  if (error || !data?.length) return [];

  const byKeyword = new Map<string, RankingRow>();
  for (const row of data) {
    const keyword = String(row.keyword);
    const current: RankingRow = byKeyword.get(keyword) ?? {
      keyword,
      keywordType: row.keyword_type as KeywordType,
      monthlySearches: null,
      selfPosition: null,
      bestCompetitorName: null,
      bestCompetitorPosition: null,
      topDomain: (row.top_domain as string) ?? null,
      measuredAt: (row.measured_at as string) ?? null,
    };

    const position = row.position === null ? null : Number(row.position);
    if (selfSchool && row.school_id === selfSchool.id) {
      current.selfPosition = position;
    } else if (position !== null) {
      // 比較校のうち最上位（数値が小さい方）を採る
      if (current.bestCompetitorPosition === null || position < current.bestCompetitorPosition) {
        current.bestCompetitorPosition = position;
        current.bestCompetitorName = nameById.get(String(row.school_id)) ?? null;
      }
    }

    byKeyword.set(keyword, current);
  }

  return [...byKeyword.values()];
}

/**
 * 手動記録の保存。
 *
 * Supabase 接続時は学校ごとに1行として rankings に書き込む
 * （自校と、指定された比較校のぶん）。同じキーワード・同じ測定日の記録は上書きする。
 */
export async function saveRanking(row: RankingRow, schools: School[] = []): Promise<void> {
  const supabase = await createDataClient();
  if (!supabase) {
    const index = demoRankings.rows.findIndex((r) => r.keyword === row.keyword);
    if (index === -1) demoRankings.rows.push(row);
    else demoRankings.rows[index] = row;
    return;
  }

  const selfSchool = schools.find((school) => school.role === 'self');
  if (!selfSchool) throw new Error('自校が登録されていません');

  const measuredAt = row.measuredAt ?? new Date().toISOString().slice(0, 10);
  const records: Record<string, unknown>[] = [
    {
      school_id: selfSchool.id,
      keyword: row.keyword,
      keyword_type: row.keywordType,
      position: row.selfPosition,
      top_domain: row.topDomain,
      measured_at: measuredAt,
    },
  ];

  const competitor = schools.find(
    (school) => school.role === 'competitor' && school.name === row.bestCompetitorName,
  );
  if (competitor) {
    records.push({
      school_id: competitor.id,
      keyword: row.keyword,
      keyword_type: row.keywordType,
      position: row.bestCompetitorPosition,
      top_domain: row.topDomain,
      measured_at: measuredAt,
    });
  }

  const { error } = await supabase.from('rankings').insert(records);
  if (error) throw new Error(error.message);
}
