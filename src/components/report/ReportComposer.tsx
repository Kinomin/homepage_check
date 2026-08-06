'use client';

import { useState } from 'react';

import { REPORT_CONFIDENTIALITY } from '@/lib/data/demo-extras';
import { SCREENS } from '@/lib/screens';
import { DIFFICULTY_LABEL, PRIORITY_LABEL, type Action, type Measurement } from '@/lib/types';

export interface ReportGapItem {
  label: string;
  audience: string;
  /** 一部の比較校のみ公開している場合の「N / M校」 */
  publishedRatio?: string;
}

export interface ReportStrength {
  label: string;
  note: string;
}

export interface ReportBlockData {
  schoolName: string;
  competitorNames: string[];
  scanDate: string;
  pageCount: number;
  criteriaCount: number;
  allCompetitorsHave: ReportGapItem[];
  someCompetitorsHave: ReportGapItem[];
  strengths: ReportStrength[];
  measurements: Measurement[];
  highPriorityActions: Action[];
  unknownCount: number;
}

const BLOCKS = [
  { id: 'gapDiff', label: '比較校との情報差', phase1: true },
  { id: 'strengths', label: '本校の強み', phase1: true },
  { id: 'measurement', label: SCREENS.measurement.title, phase1: true },
  { id: 'discovery', label: SCREENS.discovery.title, phase1: false },
  { id: 'persona', label: SCREENS.persona.title, phase1: false },
  { id: 'actions', label: SCREENS.action.title, phase1: true },
] as const;

type BlockId = (typeof BLOCKS)[number]['id'];

/**
 * 07 レポート出力。
 *
 * ・含める内容をチェックで選択
 * ・比較校名を伏せるオプション
 * ・末尾に注記を必ず付ける（handoff.md 5章 07）
 *
 * 04・05 は Phase 2 のため選択できない状態にし、理由を明示する。
 * 押せそうに見えて何も起きない要素を作らないため（handoff.md 10章-5）。
 */
export function ReportComposer({ data }: { data: ReportBlockData }) {
  const [enabled, setEnabled] = useState<Record<BlockId, boolean>>({
    gapDiff: true,
    strengths: true,
    measurement: true,
    discovery: false,
    persona: false,
    actions: true,
  });
  const [anonymize, setAnonymize] = useState(false);

  const competitorLabel = (index: number) =>
    anonymize ? `比較校${String.fromCharCode(65 + index)}` : data.competitorNames[index];

  return (
    <>
      <div className="optbar">
        <div className="optgrp">
          <div className="glbl">含める内容</div>
          <div className="checks">
            {BLOCKS.map((block) => (
              <label key={block.id} title={block.phase1 ? undefined : 'Phase 2 で対応します'}>
                <input
                  type="checkbox"
                  checked={enabled[block.id]}
                  disabled={!block.phase1}
                  onChange={(event) =>
                    setEnabled((previous) => ({ ...previous, [block.id]: event.target.checked }))
                  }
                />
                {block.label}
                {!block.phase1 && (
                  <span className="tag t-neu" style={{ marginLeft: 4 }}>
                    Phase2
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
        <div className="optgrp">
          <div className="glbl">出力</div>
          <div className="btnrow" style={{ margin: 0 }}>
            <button className="btn" onClick={() => window.print()}>
              PDFで書き出す
            </button>
            <button
              className="btn ghost"
              aria-pressed={anonymize}
              onClick={() => setAnonymize((v) => !v)}
            >
              比較校名を伏せる
            </button>
          </div>
        </div>
      </div>

      <div className="sheet">
        <div className="sheet-h">
          <div className="t">ホームページ現状レポート</div>
          <div className="d">
            {data.schoolName} ／ 広報部
            <br />
            作成 {data.scanDate} ／ {data.pageCount}ページ走査 ／ 調査{data.criteriaCount}項目 ／ 比較
            {data.competitorNames.length}校
          </div>
        </div>

        {enabled.gapDiff && (
          <section className="blk">
            <h3>1. 比較{data.competitorNames.length}校との情報差（事実）</h3>
            <table>
              <tbody>
                <tr>
                  <th>{data.competitorNames.length}校すべてが公開し、本校になし</th>
                  <th>主に参照する人</th>
                </tr>
                {data.allCompetitorsHave.map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td>{item.audience}</td>
                  </tr>
                ))}
                {data.allCompetitorsHave.length === 0 && (
                  <tr>
                    <td colSpan={2}>該当する項目はありません</td>
                  </tr>
                )}
              </tbody>
            </table>
            {data.someCompetitorsHave.length > 0 && (
              <table style={{ marginTop: 8 }}>
                <tbody>
                  <tr>
                    <th>一部が公開し、本校になし</th>
                    <th>公開校数</th>
                  </tr>
                  {data.someCompetitorsHave.map((item) => (
                    <tr key={item.label}>
                      <td>{item.label}</td>
                      <td>{item.publishedRatio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {data.unknownCount > 0 && (
              <p style={{ fontSize: 11, color: 'var(--mute)', marginTop: 5 }}>
                ※ 走査できなかった項目が{data.unknownCount}
                件あります。取得できなかったものは欠落として数えていません。
              </p>
            )}
          </section>
        )}

        {enabled.strengths && (
          <section className="blk">
            <h3>2. 本校が比較校より整っている情報</h3>
            <table>
              <tbody>
                <tr>
                  <th>項目</th>
                  <th>状況</th>
                </tr>
                {data.strengths.map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td>{item.note}</td>
                  </tr>
                ))}
                {data.strengths.length === 0 && (
                  <tr>
                    <td colSpan={2}>該当する項目はありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {enabled.measurement && (
          <section className="blk">
            <h3>3. {SCREENS.measurement.title}</h3>
            <table>
              <tbody>
                <tr>
                  <th>項目</th>
                  <th>本校</th>
                  <th>比較{data.competitorNames.length}校 中央値</th>
                </tr>
                {data.measurements.map((measurement) => (
                  <tr key={measurement.key}>
                    <td>{measurement.label}</td>
                    <td>
                      {measurement.value}
                      {measurement.unit}
                    </td>
                    <td>
                      {measurement.median}
                      {measurement.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: 'var(--mute)', marginTop: 5 }}>
              ※
              クリック数は最短経路。表示速度のみ外部の測定ツールに依存し、測るたびに値が変動します。
            </p>
          </section>
        )}

        {enabled.actions && (
          <section className="blk">
            <h3>4. {SCREENS.action.title}（優先度 高）</h3>
            <table>
              <tbody>
                <tr>
                  <th>ID</th>
                  <th>内容</th>
                  <th>優先度</th>
                  <th>難易度</th>
                  <th>想定担当</th>
                </tr>
                {data.highPriorityActions.map((action) => (
                  <tr key={action.id}>
                    <td>{action.id}</td>
                    <td>{action.title}</td>
                    <td>{PRIORITY_LABEL[action.priority]}</td>
                    <td>{DIFFICULTY_LABEL[action.difficulty]}</td>
                    <td>{action.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: 'var(--mute)', marginTop: 5 }}>
              ※
              優先度が高いものを抜粋しています。所要時間・期限は校内の体制により変動するため記載していません。
            </p>
          </section>
        )}

        <div className="conf">
          {REPORT_CONFIDENTIALITY.map((line) => (
            <div key={line.slice(0, 12)}>{line}</div>
          ))}
          {anonymize && (
            <div>
              比較校名は伏せて出力しています（{data.competitorNames.map((_, i) => competitorLabel(i)).join('／')}）。
            </div>
          )}
        </div>
      </div>
    </>
  );
}
