import { describe, expect, it } from 'vitest';

import { CRITERIA_BY_ID } from '../src/lib/analysis/criteria';
import type { GapRow } from '../src/lib/analysis/summary';
import { DEMO_PERSONAS } from '../src/lib/data/demo-personas';
import { buildSurveyQuestions, findingsDigest, toPersona } from '../src/lib/persona/generate';
import { genderLabel, personaKey, PERSONA_GENDERS, PERSONA_STAGES } from '../src/lib/persona/types';
import type { Level } from '../src/lib/types';

function row(criterionId: string, levels: Level[]): GapRow {
  return { criterion: CRITERIA_BY_ID[criterionId], levels };
}

describe('ペルソナの6パターン', () => {
  it('学年3種 × 性別2種を網羅している', () => {
    const keys = new Set(DEMO_PERSONAS.map((p) => personaKey(p.stage, p.gender)));
    for (const stage of PERSONA_STAGES) {
      for (const gender of PERSONA_GENDERS) {
        expect(keys.has(personaKey(stage, gender))).toBe(true);
      }
    }
    expect(keys.size).toBe(6);
  });

  it('保護者は母親／父親で表記する', () => {
    expect(genderLabel('parent', 'f')).toBe('母親');
    expect(genderLabel('parent', 'm')).toBe('父親');
    expect(genderLabel('e6', 'f')).toBe('女子');
  });

  it('すべての仮説に根拠の調査項目が紐付いている', () => {
    for (const persona of DEMO_PERSONAS) {
      for (const hypothesis of persona.hypotheses) {
        expect(hypothesis.criterionIds.length).toBeGreaterThan(0);
        for (const id of hypothesis.criterionIds) {
          expect(CRITERIA_BY_ID[id]).toBeDefined();
        }
      }
    }
  });

  it('支持と欠落の両方を含む（欠落だけを並べない）', () => {
    for (const persona of DEMO_PERSONAS) {
      const kinds = new Set(persona.hypotheses.map((h) => h.kind));
      expect(kinds.has('gap')).toBe(true);
      expect(kinds.has('support') || kinds.has('check')).toBe(true);
    }
  });
});

describe('生成結果の検証', () => {
  it('根拠のない読み取りは捨てる', () => {
    const persona = toPersona(
      {
        quote: 'テスト',
        hypotheses: [
          { kind: 'gap', body: '根拠あり', criterion_ids: ['C6'] },
          { kind: 'gap', body: '根拠なし', criterion_ids: [] },
        ],
      },
      'e6',
      'f',
    );
    expect(persona.hypotheses).toHaveLength(1);
    expect(persona.hypotheses[0].body).toBe('根拠あり');
  });

  it('存在しない調査項目IDは落とす', () => {
    const persona = toPersona(
      {
        quote: 'テスト',
        hypotheses: [{ kind: 'gap', body: '本文', criterion_ids: ['C6', 'Z9'] }],
      },
      'e6',
      'f',
    );
    expect(persona.hypotheses[0].criterionIds).toEqual(['C6']);
  });

  it('未知の種別は要確認として扱う', () => {
    const persona = toPersona(
      { quote: '', hypotheses: [{ kind: 'unknown', body: '本文', criterion_ids: ['C6'] }] },
      'e6',
      'f',
    );
    expect(persona.hypotheses[0].kind).toBe('check');
  });
});

describe('判定結果の要約（LLM に渡す材料）', () => {
  const rows = [
    row('C4', ['full', 'full', 'full', 'full', 'full']),
    row('E1', ['thin', 'full', 'mid', 'full', 'mid']),
    row('D1', ['full', 'full', 'full', 'mid', 'full']),
  ];

  it('本校の水準と比較校の公開校数を渡す', () => {
    const digest = findingsDigest(rows, 'parent');
    expect(digest).toContain('E1 学費');
    expect(digest).toContain('比較校4校中4校が公開');
  });

  it('その人が見る項目に絞る', () => {
    // C4 制服紹介は受験生向けなので、保護者の要約には入らない
    expect(findingsDigest(rows, 'parent')).not.toContain('C4');
    expect(findingsDigest(rows, 'e6')).toContain('C4');
  });
});

describe('検証用アンケート設問', () => {
  it('欠落として挙がった項目から設問を組み立てる', () => {
    const questions = buildSurveyQuestions(DEMO_PERSONAS);
    const choice = questions.find((q) => q.options && q.no === 'Q3');
    expect(choice?.options?.length).toBeGreaterThan(0);
    expect(questions.some((q) => q.text.includes('きっかけ'))).toBe(true);
  });

  it('仮説がなくても最低限の設問は出る', () => {
    expect(buildSurveyQuestions([]).length).toBeGreaterThanOrEqual(3);
  });
});
