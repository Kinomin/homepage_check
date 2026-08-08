/**
 * prototype.html の GAP / ACTS / MEAS から src/lib/data/demo.ts を生成する。
 * プロトタイプが UI の正典であり、デモデータの正典でもあるため、
 * 手で書き写さず必ずここから生成する（写し間違いと二重管理を防ぐ）。
 *
 *   node scripts/generate-demo.mjs
 */

import fs from 'node:fs';
const html = fs.readFileSync('prototype.html','utf8');
function grab(name){
  const start = html.indexOf(`const ${name}=[`);
  const from = html.indexOf('[', start);
  let depth=0, i=from;
  for(;i<html.length;i++){
    const c=html[i];
    if(c==='[') depth++;
    else if(c===']'){ depth--; if(depth===0){ i++; break; } }
  }
  return html.slice(from,i);
}
const GAP = eval(grab('GAP'));
const ACTS = eval(grab('ACTS'));
const MEAS = eval(grab('MEAS'));



const j = (v) => JSON.stringify(v, null, 2).replace(/\n/g, '\n  ');

const PRI = {'高':'high','中':'mid','低':'low'};
const DIF = {'低':'low','中':'mid','高':'high'};
const SRC = {'02':'gap','03':'measurement','04':'discovery','05':'persona'};
const METHOD = {'走査':'scan','操作':'operate','外部測定':'external'};

const gapRows = GAP.map(r => ({
  criterionId: r.id,
  levels: r.v,
  evidenceText: r.ev,
  evidenceSource: r.src,
}));

const actions = ACTS.map(a => ({
  id: a.id,
  title: a.t,
  summary: a.s,
  priority: PRI[a.pri],
  difficulty: DIF[a.dif],
  source: SRC[a.src],
  sourceCriterionId: /^[A-G][0-9]/.test(a.from) ? a.from.split(' ')[0] : null,
  sourceLabel: a.from,
  status: 'open',
  why: a.why,
  how: a.how,
  copy: a.copy,
  owner: a.own,
  qa: Object.entries(a.qa).map(([question, answer]) => ({question, answer})),
}));

const measurements = MEAS.map((m,i) => ({
  key: `m${String(i+1).padStart(2,'0')}`,
  label: m.n,
  note: m.s,
  value: m.v,
  unit: m.u,
  median: m.med,
  scaleMax: m.max,
  lowerIsBetter: Boolean(m.bad),
  method: METHOD[m.m],
}));

const header = `/**
 * デモデータ。prototype.html の GAP / ACTS / MEAS をそのまま移したもので、
 * 学校名・数値・分析結果はすべて架空のサンプルです。
 *
 * Supabase を設定していないときに画面を動かすためのフィクスチャであり、
 * 実データではありません。デモ表示中は画面上部にその旨を必ず出すこと。
 *
 * このファイルは scripts/generate-demo.mjs が prototype.html から生成します。
 * 手で編集しないこと（プロトタイプとの二重管理になり、handoff.md 10章-2 の
 * 「データ側のラベルだけ変え忘れる」不整合が再発します）。
 */

import type { Action, Level, Measurement } from '../types';

export interface DemoGapRow {
  criterionId: string;
  /** [0] が自校、[1..] が比較校 */
  levels: Level[];
  /** 自校の判定根拠 */
  evidenceText: string;
  /** 判定に使ったページ */
  evidenceSource: string;
}
`;

const body = `
export const DEMO_SCHOOL_NAMES = ${j(['翠陵ヶ丘中学校・高等学校','白鷺学園','東雲台','清和国際','桐生ヶ丘'])};

export const DEMO_SCAN = ${j({
  startedAt: '2026-08-03T06:00:00+09:00',
  nextScanAt: '2026-08-10T06:00:00+09:00',
  crawlDepth: 4,
  pageCount: 128,
  indexedCount: 94,
  imageCount: 186,
  imageWithoutAltCount: 149,
  pdfOnlyCount: 12,
  updates90d: 12,
  newsCategories: 0,
  mobileLcpSeconds: 4.2,
})};

export const DEMO_GAP_ROWS: DemoGapRow[] = ${j(gapRows)};

export const DEMO_MEASUREMENTS: Measurement[] = ${j(measurements)};

export const DEMO_ACTIONS: Action[] = ${j(actions)};
`;

fs.mkdirSync('src/lib/data', {recursive:true});
fs.writeFileSync('src/lib/data/demo.ts', header + body);
console.log('written', actions.length, 'actions');
