'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  HYPOTHESIS_KIND_LABEL,
  PERSONA_GENDERS,
  PERSONA_STAGES,
  PERSONA_STAGE_LABEL,
  genderLabel,
  personaKey,
  type Hypothesis,
  type Persona,
  type PersonaGender,
  type PersonaStage,
  type SurveyQuestion,
} from '@/lib/persona/types';
import type { Criterion } from '@/lib/types';

const KIND_TAG_CLASS: Record<Hypothesis['kind'], string> = {
  support: 't-ok',
  gap: 't-gap',
  check: 't-warn',
};

/**
 * 05 ペルソナ仮説。
 *
 * 6パターン（小6・中3・保護者 × 男女）。保護者は「母親／父親」表記に切り替える。
 * 各仮説には根拠となる調査項目を必ず表示する。
 *
 * この画面を「分析結果」として提示させないため、
 * 注意書きと検証用アンケート設問を必ず併置する（handoff.md 5章 05）。
 */
export function PersonaPanel({
  personas,
  criteria,
  survey,
  generated,
  canGenerate,
}: {
  personas: Persona[];
  criteria: Record<string, Criterion>;
  survey: SurveyQuestion[];
  generated: boolean;
  canGenerate: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<PersonaStage>('e6');
  const [gender, setGender] = useState<PersonaGender>('f');
  const [showSurvey, setShowSurvey] = useState(false);
  const [regenerating, startRegenerating] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const byKey = new Map(personas.map((persona) => [personaKey(persona.stage, persona.gender), persona]));
  const current = byKey.get(personaKey(stage, gender)) ?? null;

  function regenerate() {
    startRegenerating(async () => {
      setError(null);
      const response = await fetch('/api/personas', { method: 'POST' });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? '生成に失敗しました');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="card">
      <div className="card-h">
        <h2>
          <span className="id">PS</span>ペルソナ仮説
        </h2>
        <span className="note">
          サイトの記載内容から自動生成した読み取り。実際の反応とは異なります
        </span>
      </div>
      <div className="card-b">
        <div className="psel">
          <div className="pgroup">
            <div className="glbl">誰の目線で見るか</div>
            <div className="seg">
              {PERSONA_STAGES.map((key) => (
                <button key={key} aria-pressed={stage === key} onClick={() => setStage(key)}>
                  {PERSONA_STAGE_LABEL[key]}
                </button>
              ))}
            </div>
          </div>
          <div className="pgroup">
            <div className="glbl">性別</div>
            <div className="seg">
              {PERSONA_GENDERS.map((key) => (
                <button key={key} aria-pressed={gender === key} onClick={() => setGender(key)}>
                  {genderLabel(stage, key)}
                </button>
              ))}
            </div>
          </div>
          <div className="pgroup" style={{ marginLeft: 'auto' }}>
            <div className="glbl">生成</div>
            <button
              className="btn ghost"
              onClick={regenerate}
              disabled={regenerating || !canGenerate}
              title={canGenerate ? undefined : 'ANTHROPIC_API_KEY が未設定です'}
            >
              {regenerating ? '生成中…' : '走査結果から生成し直す'}
            </button>
          </div>
        </div>

        {error && (
          <div className="caution" style={{ marginTop: 0, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {!current ? (
          <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--ink-2)' }}>
            この目線の仮説はまだ生成されていません。
          </p>
        ) : (
          <>
            <div className="pcard">
              <div className="pmeta">
                {PERSONA_STAGE_LABEL[current.stage]}・{genderLabel(current.stage, current.gender)}
                {generated ? ' ／ 走査結果から生成' : ' ／ サンプル'}
              </div>
              <div className="quote">「{current.quote}」</div>
            </div>

            <div className="eyebrow">根拠となった調査項目</div>
            {current.hypotheses.map((hypothesis, index) => (
              <div className="hyp" key={`${hypothesis.body}-${index}`}>
                <span className={`tag ${KIND_TAG_CLASS[hypothesis.kind]} b`}>
                  {HYPOTHESIS_KIND_LABEL[hypothesis.kind]}
                </span>
                <div>
                  {hypothesis.body}
                  <span className="src">
                    {hypothesis.criterionIds
                      .map((id) => `${id} ${criteria[id]?.label ?? ''}`.trim())
                      .join(' ／ ')}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        <div className="caution">
          <b>この画面の扱い</b>
          <br />
          ここに出るのはサイトの記載内容から機械的に生成した仮説であり、実際の受験生・保護者の声ではありません。会議で「分析結果です」と提示すると必ず反発されます。
          <strong>説明会アンケートに数問足して、この仮説が当たっているかを確かめてください。</strong>
          <div style={{ marginTop: 9 }}>
            <button className="btn ghost" onClick={() => setShowSurvey(!showSurvey)}>
              {showSurvey ? '設問案を閉じる' : '検証用の設問を作る'}
            </button>
          </div>
          {showSurvey && (
            <div className="qs on">
              <h5>説明会アンケート 追加設問案</h5>
              <ul>
                {survey.map((question) => (
                  <li key={question.no}>
                    <b>{question.no}</b>
                    {question.text}
                    {question.options && (
                      <>
                        <br />［{question.options.join('／')}］
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
