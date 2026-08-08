import { describe, expect, it } from 'vitest';

import { CRITERIA, CRITERIA_BY_ID } from '../src/lib/analysis/criteria';
import type { ExtractedPage } from '../src/lib/crawl/extract';
import { selectCandidates, scorePage } from '../src/lib/judge/candidates';
import { toJudgeResult, unknownResult } from '../src/lib/judge/judge';
import { criterionForSchool, isApplicable } from '../src/lib/judge/pipeline';
import { buildJudgeUserMessage } from '../src/lib/judge/prompt';
import type { School } from '../src/lib/types';

function page(partial: Partial<ExtractedPage> & { url: string }): ExtractedPage {
  return {
    title: null,
    metaDescription: null,
    h1Count: 1,
    wordCount: 100,
    imageCount: 0,
    imageWithoutAltCount: 0,
    hasJsonLd: false,
    jsonLdTypes: [],
    lastModified: null,
    httpStatus: 200,
    isPdf: false,
    text: '',
    headings: [],
    depth: 1,
    links: [],
    ...partial,
  };
}

const school: School = {
  id: 's1',
  name: 'テスト校',
  url: 'https://example.ed.jp',
  prefecture: null,
  schoolType: null,
  coedType: null,
  hasJuniorAdmission: true,
  hasSeniorAdmission: false,
  hasAffiliatedUniversity: false,
  robotsAllowed: true,
  role: 'self',
  sortOrder: 0,
};

describe('調査項目', () => {
  it('31項目ある', () => {
    expect(CRITERIA).toHaveLength(31);
  });

  it('IDが重複していない', () => {
    expect(new Set(CRITERIA.map((c) => c.id)).size).toBe(31);
  });

  it('全項目に判定基準が書かれている', () => {
    expect(CRITERIA.every((c) => c.judgePrompt.length > 20)).toBe(true);
  });
});

describe('判定対象外の扱い（handoff.md 4章）', () => {
  it('系列大学を持たない学校で D4 は対象外', () => {
    expect(isApplicable(CRITERIA_BY_ID.D4, school)).toBe(false);
    expect(isApplicable(CRITERIA_BY_ID.D4, { ...school, hasAffiliatedUniversity: true })).toBe(true);
  });

  it('募集していない課程の要項を欠落として扱わない', () => {
    const adjusted = criterionForSchool(CRITERIA_BY_ID.F1, school);
    expect(adjusted.judgePrompt).toContain('中学入試');
    expect(adjusted.judgePrompt).not.toContain('高校入試');
  });

  it('中学も高校も募集していない学校では F1 は対象外', () => {
    expect(
      isApplicable(CRITERIA_BY_ID.F1, {
        ...school,
        hasJuniorAdmission: false,
        hasSeniorAdmission: false,
      }),
    ).toBe(false);
  });
});

describe('候補ページの抽出（語句一致で判定しない）', () => {
  const pages = [
    page({
      url: 'https://example.ed.jp/education/beyond',
      title: 'BEYOND プログラム',
      headings: ['BEYOND', '課題研究の流れ'],
      text: '生徒が自ら課題を設定し、1年かけて調査・考察し発表します。',
      depth: 2,
    }),
    page({ url: 'https://example.ed.jp/access', title: 'アクセス', depth: 1 }),
    page({ url: 'https://example.ed.jp/news/2026', title: 'お知らせ', depth: 1 }),
  ];

  it('項目名と一致しないページも URL パスの手がかりで候補に残る', () => {
    const candidates = selectCandidates(pages, CRITERIA_BY_ID.B2, 3);
    expect(candidates[0].page.url).toContain('/education/');
  });

  it('候補が足りないときも空にせず、浅い階層のページで補完する', () => {
    const candidates = selectCandidates(pages, CRITERIA_BY_ID.E2, 3);
    expect(candidates).toHaveLength(3);
  });

  it('スコアの理由を残す（なぜ候補にしたか根拠になる）', () => {
    const scored = scorePage(pages[1], CRITERIA_BY_ID.F6);
    expect(scored.score).toBeGreaterThan(0);
    expect(scored.reasons.join()).toContain('/access');
  });
});

describe('プロンプト', () => {
  const message = buildJudgeUserMessage({
    criterion: CRITERIA_BY_ID.C6,
    schoolName: 'テスト校',
    role: 'self',
    candidates: selectCandidates([page({ url: 'https://example.ed.jp/voice' })], CRITERIA_BY_ID.C6),
    outline: '- /voice',
    pageCount: 42,
    previous: { level: 'mid', evidenceText: '前回は生徒コメントが1件' },
  });

  it('前回の判定をコンテキストに渡す（判定の揺れ対策：要確定事項E）', () => {
    expect(message).toContain('前回の判定');
    expect(message).toContain('前回は生徒コメントが1件');
  });

  it('名称ゆれは「手がかり」として渡し、一致条件として渡さない', () => {
    expect(message).toContain('一致条件ではなく手がかり');
  });

  it('特殊ルールを渡す', () => {
    expect(message).toContain('独立ページの有無で判定しない');
  });
});

describe('判定結果の変換', () => {
  it('evidence_counts を key-value に畳む', () => {
    const result = toJudgeResult({
      level: 'thin',
      evidence_text: '写真が2点のみ',
      evidence_urls: ['https://example.ed.jp/about'],
      evidence_counts: [{ key: '画像点数', value: '2' }],
      change_reason: '',
    });
    expect(result.evidenceCounts).toEqual({ 画像点数: '2' });
  });

  it('判定できなかった場合は unknown であって none ではない', () => {
    const result = unknownResult('タイムアウト');
    expect(result.level).toBe('unknown');
    expect(result.evidenceText).toContain('取得できませんでした');
  });
});
