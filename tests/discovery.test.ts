import { describe, expect, it } from 'vitest';

import { CRITERIA } from '../src/lib/analysis/criteria';
import {
  FIX_OWNERS,
  analyzeDiscovery,
  findNamingGaps,
  hasGenericTitle,
  hasYearInPath,
  looksLikeBriefingPage,
  type DiscoveryPage,
} from '../src/lib/analysis/discovery';
import { demoDiscoveryPages } from '../src/lib/data/demo-extras';

function page(partial: Partial<DiscoveryPage> & { url: string }): DiscoveryPage {
  return {
    title: null,
    metaDescription: null,
    h1Count: 1,
    imageCount: 0,
    imageWithoutAltCount: 0,
    hasJsonLd: false,
    jsonLdTypes: [],
    isPdf: false,
    ...partial,
  };
}

describe('ページ名の判定', () => {
  it('学校名だけのタイトルを検出する', () => {
    expect(hasGenericTitle('翠陵ヶ丘中学校・高等学校', '翠陵ヶ丘中学校・高等学校')).toBe(true);
    expect(hasGenericTitle('学校説明会｜翠陵ヶ丘中学校・高等学校', '翠陵ヶ丘中学校・高等学校')).toBe(
      false,
    );
  });

  it('タイトルなしは固有情報なしとして扱う', () => {
    expect(hasGenericTitle(null, '翠陵ヶ丘中学校')).toBe(true);
  });

  it('URL に年度が入っているかを見る', () => {
    expect(hasYearInPath('https://example.ed.jp/admission/briefing2026')).toBe(true);
    expect(hasYearInPath('https://example.ed.jp/admission/briefing')).toBe(false);
  });

  it('説明会ページらしさは URL と title の両方から見る', () => {
    expect(looksLikeBriefingPage('https://example.ed.jp/admission/briefing', null)).toBe(true);
    expect(looksLikeBriefingPage('https://example.ed.jp/x', '学校説明会のご案内')).toBe(true);
    expect(looksLikeBriefingPage('https://example.ed.jp/club', '部活動')).toBe(false);
  });
});

describe('SE-04 設定状況の点検', () => {
  it('走査結果がなければ点検しない（「未設定」と断定しない）', () => {
    const summary = analyzeDiscovery({ pages: [], schoolName: 'テスト校' });
    expect(summary.checks).toHaveLength(0);
    expect(summary.priorityChecks).toHaveLength(0);
  });

  it('説明会ページに Event の構造化データがなければ ng', () => {
    const summary = analyzeDiscovery({
      pages: [page({ url: 'https://example.ed.jp/admission/briefing', title: '学校説明会' })],
      schoolName: 'テスト校',
    });
    const check = summary.checks.find((c) => c.key === 'briefing-event-schema');
    expect(check?.status).toBe('ng');
    // 直せるのが誰かを出す。以前はデモ用アクションの番号（AC-04）を入れていたが、
    // 実データには存在しないため、画面に解決しない参照が並んでいた。
    expect(check?.fixedBy).toBe('制作会社');
    expect(check?.reader).toContain('検索');
  });

  it('Event が設定済みなら ok', () => {
    const summary = analyzeDiscovery({
      pages: [
        page({
          url: 'https://example.ed.jp/admission/briefing',
          title: '学校説明会',
          hasJsonLd: true,
          jsonLdTypes: ['Event'],
        }),
      ],
      schoolName: 'テスト校',
    });
    expect(summary.checks.find((c) => c.key === 'briefing-event-schema')?.status).toBe('ok');
  });

  it('説明会ページが見つからなければ unknown（ng にしない）', () => {
    const summary = analyzeDiscovery({
      pages: [page({ url: 'https://example.ed.jp/club', title: '部活動' })],
      schoolName: 'テスト校',
    });
    expect(summary.checks.find((c) => c.key === 'briefing-event-schema')?.status).toBe('unknown');
  });

  it('画像が0点なら alt の点検は unknown', () => {
    const summary = analyzeDiscovery({
      pages: [page({ url: 'https://example.ed.jp/', title: 'トップ｜テスト校' })],
      schoolName: 'テスト校',
    });
    expect(summary.checks.find((c) => c.key === 'image-alt')?.status).toBe('unknown');
  });

  it('デモデータは prototype が示していた数値と一致する', () => {
    const summary = analyzeDiscovery({
      pages: demoDiscoveryPages(),
      schoolName: '翠陵ヶ丘中学校・高等学校',
    });
    expect(summary.pageCount).toBe(128);
    expect(summary.checks.find((c) => c.key === 'image-alt')?.situation).toContain('149 / 186');
    expect(summary.checks.find((c) => c.key === 'pdf-only')?.situation).toContain('12件');
    expect(summary.checks.find((c) => c.key === 'page-title')?.situation).toContain('41件');
  });

  it('「先に直す5つ」は5件まで', () => {
    const summary = analyzeDiscovery({
      pages: demoDiscoveryPages(),
      schoolName: '翠陵ヶ丘中学校・高等学校',
    });
    expect(summary.priorityChecks.length).toBeLessThanOrEqual(5);
    expect(summary.priorityChecks.every((check) => check.priority)).toBe(true);
  });
});

describe('SE-03 ページ名称と検索語のズレ', () => {
  it('校内の呼称だけを使っているページを検出する', () => {
    const gaps = findNamingGaps(
      [page({ url: 'https://example.ed.jp/admission/fee', title: '諸費用について' })],
      CRITERIA,
    );
    const fee = gaps.find((gap) => gap.criterionId === 'E1');
    expect(fee?.usedName).toBe('諸費用');
    expect(fee?.searchedName).toBe('学費');
  });

  it('一般的な語が入っていれば検出しない', () => {
    const gaps = findNamingGaps(
      [page({ url: 'https://example.ed.jp/admission/fee', title: '学費（諸費用）について' })],
      CRITERIA,
    );
    expect(gaps.some((gap) => gap.criterionId === 'E1')).toBe(false);
  });
});

describe('点検結果の表示内容', () => {
  it('すべての点検に「誰が直せるか」が入っている（渡す先が決まる）', () => {
    const summary = analyzeDiscovery({
      pages: [page({ url: 'https://example.ed.jp/admission/briefing', title: '学校説明会' })],
      schoolName: 'テスト校',
    });
    expect(summary.checks.length).toBeGreaterThan(0);
    for (const check of summary.checks) {
      expect(FIX_OWNERS).toContain(check.fixedBy);
    }
  });

  it('見出しに用語を出さず、家庭から見た状態を書く', () => {
    const summary = analyzeDiscovery({
      pages: [page({ url: 'https://example.ed.jp/admission/briefing', title: '学校説明会' })],
      schoolName: 'テスト校',
    });
    for (const check of summary.checks) {
      // 用語をそのまま見出しにすると、読む側が判断できない
      expect(check.label).not.toMatch(/構造化データ [A-Z]|h1|alt|title/);
      expect(check.reader.length).toBeGreaterThan(0);
      expect(check.effect.length).toBeGreaterThan(0);
    }
  });
});
