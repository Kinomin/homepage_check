/**
 * ペルソナ仮説の保存と取得。
 *
 * 生成には LLM を使う（6パターン分）。走査のたびに毎回生成すると
 * コストが積み上がるため、生成済みのものを保持し、明示的に再生成させる。
 */

import { generatePersona } from '../persona/generate';
import { personaKey, type Persona, type PersonaGender, type PersonaStage } from '../persona/types';
import type { GapRow } from '../analysis/summary';
import { isAnthropicConfigured } from '../env';
import { loadSettings } from './settings-repository';
import { createServerClient } from '../supabase/server';
import { DEMO_PERSONAS } from './demo-personas';

/** 生成済みのペルソナ。デモ／未接続時はプロセス内に保持する。 */
const personaStore: { byKey: Map<string, Persona> } = ((
  globalThis as { __personaStore?: { byKey: Map<string, Persona> } }
).__personaStore ??= { byKey: new Map() });

export interface PersonaSource {
  personas: Persona[];
  /** LLM で生成したものか（false ならデモの固定値） */
  generated: boolean;
  /** 生成できる状態か（API キーの有無） */
  canGenerate: boolean;
}

export async function loadPersonas(): Promise<PersonaSource> {
  const supabase = createServerClient();
  if (supabase) {
    const { data } = await supabase
      .from('personas')
      .select('stage, gender, quote, hypotheses, generated_at')
      .order('generated_at', { ascending: false });
    if (data?.length) {
      const byKey = new Map<string, Persona>();
      for (const row of data) {
        const key = personaKey(row.stage as PersonaStage, row.gender as PersonaGender);
        if (byKey.has(key)) continue; // 同じ組み合わせは最新のものだけ
        byKey.set(key, {
          stage: row.stage as PersonaStage,
          gender: row.gender as PersonaGender,
          quote: String(row.quote),
          hypotheses: (row.hypotheses as Persona['hypotheses']) ?? [],
          generatedAt: String(row.generated_at),
        });
      }
      return {
        personas: [...byKey.values()],
        generated: true,
        canGenerate: isAnthropicConfigured(),
      };
    }
  }

  if (personaStore.byKey.size > 0) {
    return {
      personas: [...personaStore.byKey.values()],
      generated: true,
      canGenerate: isAnthropicConfigured(),
    };
  }

  return { personas: DEMO_PERSONAS, generated: false, canGenerate: isAnthropicConfigured() };
}

/**
 * 6パターンを生成し直す。
 * 生成に失敗したパターンは既存の値を残す（画面が空になるのを避ける）。
 */
export async function regeneratePersonas(params: {
  schoolName: string;
  gapRows: GapRow[];
  stages: PersonaStage[];
  genders: PersonaGender[];
}): Promise<PersonaSource> {
  if (!isAnthropicConfigured()) {
    throw new Error('ANTHROPIC_API_KEY が設定されていないため、仮説を生成できません');
  }

  const { settings } = await loadSettings();
  const generated: Persona[] = [];

  for (const stage of params.stages) {
    for (const gender of params.genders) {
      const persona = await generatePersona({
        stage,
        gender,
        schoolName: params.schoolName,
        gapRows: params.gapRows,
        effort: settings.judge.effort,
      });
      if (persona) {
        personaStore.byKey.set(personaKey(stage, gender), persona);
        generated.push(persona);
      }
    }
  }

  const supabase = createServerClient();
  if (supabase && generated.length > 0) {
    await supabase.from('personas').insert(
      generated.map((persona) => ({
        stage: persona.stage,
        gender: persona.gender,
        quote: persona.quote,
        hypotheses: persona.hypotheses,
        generated_at: persona.generatedAt,
      })),
    );
  }

  return {
    personas: [...personaStore.byKey.values()],
    generated: true,
    canGenerate: true,
  };
}
