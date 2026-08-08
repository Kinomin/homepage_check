'use client';

import { useRef, useState } from 'react';

import { REPORT_CONFIDENTIALITY } from '@/lib/data/demo-extras';
import { buildStandaloneHtml, reportFileName } from '@/lib/report/document';
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

export interface ReportDiscoveryItem {
  label: string;
  /** 機械判定の結果。評価文ではなく状態 */
  state: string;
}

export interface ReportPersonaItem {
  who: string;
  body: string;
  /** 根拠の調査項目ID。解釈には必ず根拠を添える（handoff.md 5章 05） */
  basis: string;
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
  discovery: ReportDiscoveryItem[];
  personas: ReportPersonaItem[];
  highPriorityActions: Action[];
  unknownCount: number;
}

const BLOCKS = [
  { id: 'gapDiff', label: '比較校との情報差' },
  { id: 'strengths', label: '本校の強み' },
  { id: 'measurement', label: SCREENS.measurement.title },
  { id: 'discovery', label: SCREENS.discovery.title },
  { id: 'persona', label: SCREENS.persona.title },
  { id: 'actions', label: SCREENS.action.title },
] as const;

type BlockId = (typeof BLOCKS)[number]['id'];

/** A4横1枚に収めるときの、表1つあたりの最大行数 */
const ONE_PAGE_ROWS = 6;

/**
 * 07 レポート出力。
 *
 * ・含める内容をチェックで選択
 * ・比較校名を伏せるオプション
 * ・A4横1枚に収めるオプション（用紙の向きと段組を print CSS で切り替える）
 * ・末尾に注記を必ず付ける（handoff.md 5章 07）
 *
 * 1枚に収めるときは行数を絞って詰めるが、**何件省いたかを必ず書く**。
 * 黙って削ると、レポートを見た人が「該当がその件数しかない」と誤解する。
 */
export function ReportComposer({ data }: { data: ReportBlockData }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState<Record<BlockId, boolean>>({
    gapDiff: true,
    strengths: true,
    measurement: true,
    discovery: true,
    persona: false,
    actions: true,
  });
  const [anonymize, setAnonymize] = useState(false);
  const [onePage, setOnePage] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const competitorLabel = (index: number) =>
    anonymize ? `比較校${String.fromCharCode(65 + index)}` : data.competitorNames[index];

  /** 1枚モードでは行数を絞る。省いた件数は Trimmed で必ず出す。 */
  function limit<T>(rows: T[]): T[] {
    return onePage ? rows.slice(0, ONE_PAGE_ROWS) : rows;
  }

  const title = `ホームページ現状レポート ｜ ${data.schoolName}`;

  /**
   * 画面に出ているものをそのまま単体の HTML として保存する。
   * PDF はこのあとブラウザの印刷（用紙は print CSS で指定済み）で作る。
   */
  function download() {
    const body = sheetRef.current?.innerHTML;
    if (!body) return;

    const fileName = `${reportFileName(data.schoolName, data.scanDate, onePage)}.html`;
    const html = buildStandaloneHtml({
      baseName: fileName,
      title,
      bodyHtml: body,
      onePage,
    });

    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    // 文書に入れずに click すると download 属性が無視され、
    // ファイル名が「download」になる。取り出したら消す。
    document.body.append(link);
    link.click();
    link.remove();
    // 保存が始まる前に URL を捨てると中身が空になる
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setSaved(fileName);
  }

  return (
    <>
      <div className="optbar">
        <div className="optgrp">
          <div className="glbl">含める内容</div>
          <div className="checks">
            {BLOCKS.map((block) => (
              <label key={block.id}>
                <input
                  type="checkbox"
                  checked={enabled[block.id]}
                  onChange={(event) =>
                    setEnabled((previous) => ({ ...previous, [block.id]: event.target.checked }))
                  }
                />
                {block.label}
              </label>
            ))}
          </div>
        </div>
        <div className="optgrp">
          <div className="glbl">体裁</div>
          <div className="btnrow" style={{ margin: 0 }}>
            <button className="btn ghost" aria-pressed={onePage} onClick={() => setOnePage(true)}>
              A4横1枚に収める
            </button>
            <button className="btn ghost" aria-pressed={!onePage} onClick={() => setOnePage(false)}>
              A4縦（全件）
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
        <div className="optgrp">
          <div className="glbl">出力</div>
          <div className="btnrow" style={{ margin: 0 }}>
            <button className="btn" onClick={() => window.print()}>
              PDFで印刷する
            </button>
            <button className="btn ghost" onClick={download}>
              HTMLファイルで保存
            </button>
          </div>
        </div>
      </div>

      {/* 画面上の案内。レポート本体ではないので印刷には出さない */}
      <p
        className="print-hint"
        style={{ fontSize: 11, color: 'var(--mute)', lineHeight: 1.8, marginBottom: 14 }}
      >
        PDF はブラウザの印刷から「PDFに保存」を選んでください。用紙の向きと余白は
        {onePage ? '「A4横・9mm」' : '「A4縦・14mm」'}
        を指定済みです。保存したファイルを回覧する場合は HTML
        での保存が確実です（外部のフォントや配色を参照しないため、開く環境によらず同じ見た目になります）。
        {saved && <> 直近の保存：{saved}</>}
      </p>

      <div className={`sheet${onePage ? ' onepage' : ''}`} ref={sheetRef}>
        <div className="sheet-h">
          <div className="t">ホームページ現状レポート</div>
          <div className="d">
            {data.schoolName} ／ 広報部
            <br />
            作成 {data.scanDate} ／ {data.pageCount}ページ走査 ／ 調査{data.criteriaCount}項目 ／ 比較
            {data.competitorNames.length}校
          </div>
        </div>

        <div className={onePage ? 'cols' : undefined}>
          {enabled.gapDiff && (
            <section className="blk">
              <h3>比較{data.competitorNames.length}校との情報差（事実）</h3>
              <table>
                <tbody>
                  <tr>
                    <th>{data.competitorNames.length}校すべてが公開し、本校になし</th>
                    <th>主に参照する人</th>
                  </tr>
                  {limit(data.allCompetitorsHave).map((item) => (
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
              <Trimmed total={data.allCompetitorsHave.length} shown={limit(data.allCompetitorsHave).length} />

              {data.someCompetitorsHave.length > 0 && (
                <>
                  <table style={{ marginTop: 8 }}>
                    <tbody>
                      <tr>
                        <th>一部が公開し、本校になし</th>
                        <th>公開校数</th>
                      </tr>
                      {limit(data.someCompetitorsHave).map((item) => (
                        <tr key={item.label}>
                          <td>{item.label}</td>
                          <td>{item.publishedRatio}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Trimmed
                    total={data.someCompetitorsHave.length}
                    shown={limit(data.someCompetitorsHave).length}
                  />
                </>
              )}

              {data.unknownCount > 0 && (
                <p className="trimmed">
                  ※ 走査できなかった項目が{data.unknownCount}
                  件あります。取得できなかったものは欠落として数えていません。
                </p>
              )}
            </section>
          )}

          {enabled.strengths && (
            <section className="blk">
              <h3>本校が比較校より整っている情報</h3>
              <table>
                <tbody>
                  <tr>
                    <th>項目</th>
                    <th>状況</th>
                  </tr>
                  {limit(data.strengths).map((item) => (
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
              <Trimmed total={data.strengths.length} shown={limit(data.strengths).length} />
            </section>
          )}

          {enabled.measurement && (
            <section className="blk">
              <h3>{SCREENS.measurement.title}</h3>
              <table>
                <tbody>
                  <tr>
                    <th>項目</th>
                    <th>本校</th>
                    <th>比較{data.competitorNames.length}校 中央値</th>
                  </tr>
                  {/* 未計測の指標はレポートに載せない（空欄の行を並べても読み手には使えない） */}
                  {limit(measured(data.measurements)).map((measurement) => (
                    <tr key={measurement.key}>
                      <td>{measurement.label}</td>
                      <td>
                        {measurement.value}
                        {measurement.unit}
                      </td>
                      <td>
                        {measurement.median === null ? '—' : `${measurement.median}${measurement.unit}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Trimmed
                total={measured(data.measurements).length}
                shown={limit(measured(data.measurements)).length}
              />
              <p className="trimmed">
                ※
                クリック数は最短経路。表示速度のみ外部の測定ツールに依存し、測るたびに値が変動します。
              </p>
            </section>
          )}

          {enabled.discovery && (
            <section className="blk">
              <h3>{SCREENS.discovery.title}</h3>
              <table>
                <tbody>
                  <tr>
                    <th>点検項目</th>
                    <th>状態</th>
                  </tr>
                  {limit(data.discovery).map((item) => (
                    <tr key={item.label}>
                      <td>{item.label}</td>
                      <td>{item.state}</td>
                    </tr>
                  ))}
                  {data.discovery.length === 0 && (
                    <tr>
                      <td colSpan={2}>走査したページがないため点検していません</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Trimmed total={data.discovery.length} shown={limit(data.discovery).length} />
            </section>
          )}

          {enabled.persona && (
            <section className="blk">
              <h3>{SCREENS.persona.title}</h3>
              <table>
                <tbody>
                  <tr>
                    <th>読み手</th>
                    <th>読み取り</th>
                    <th>根拠</th>
                  </tr>
                  {limit(data.personas).map((item) => (
                    <tr key={`${item.who}-${item.basis}`}>
                      <td>{item.who}</td>
                      <td>{item.body}</td>
                      <td>{item.basis}</td>
                    </tr>
                  ))}
                  {data.personas.length === 0 && (
                    <tr>
                      <td colSpan={3}>仮説がまだ生成されていません</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Trimmed total={data.personas.length} shown={limit(data.personas).length} />
              <p className="trimmed">
                ※ この節のみ読み取り（解釈）です。根拠の調査項目を併記しています。
              </p>
            </section>
          )}

          {enabled.actions && (
            <section className="blk">
              <h3>{SCREENS.action.title}（優先度 高）</h3>
              <table>
                <tbody>
                  <tr>
                    <th>ID</th>
                    <th>内容</th>
                    <th>難易度</th>
                    <th>想定担当</th>
                  </tr>
                  {limit(data.highPriorityActions).map((action) => (
                    <tr key={action.id}>
                      <td>{action.id}</td>
                      <td>{action.title}</td>
                      <td>{DIFFICULTY_LABEL[action.difficulty]}</td>
                      <td>{action.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Trimmed
                total={data.highPriorityActions.length}
                shown={limit(data.highPriorityActions).length}
              />
              <p className="trimmed">
                ※ 優先度 {PRIORITY_LABEL.high}{' '}
                のものを抜粋しています。所要時間・期限は校内の体制により変動するため記載していません。
              </p>
            </section>
          )}
        </div>

        <div className="conf">
          {REPORT_CONFIDENTIALITY.map((line) => (
            <div key={line.slice(0, 12)}>{line}</div>
          ))}
          {anonymize && (
            <div>
              比較校名は伏せて出力しています（
              {data.competitorNames.map((_, i) => competitorLabel(i)).join('／')}）。
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * 省いた件数の明示。
 * 1枚に収めるために行を絞ったことを、レポートを見た人にも分かるようにする。
 * 黙って削ると「該当がこの件数しかない」と読まれてしまう。
 */
function Trimmed({ total, shown }: { total: number; shown: number }) {
  if (total <= shown) return null;
  return <p className="trimmed">他 {total - shown} 件（1枚に収めるため省略。画面では全件表示）</p>;
}

/** 計測できた指標だけ（未計測の行はレポートに載せない） */
function measured(measurements: Measurement[]): Measurement[] {
  return measurements.filter((measurement) => measurement.value !== null);
}
