/**
 * 画面名称の唯一の定義元。
 *
 * handoff.md 10章-3 の教訓：画面タイトルを複数箇所にハードコードすると、
 * 名称を変えたときに別画面のボタンラベルだけ取り残される。
 * 他画面から参照するときは必ずここを経由すること。
 */

import type { ActionSource } from './types';

export const SCREEN_IDS = [
  'summary',
  'gap',
  'measurement',
  'discovery',
  'persona',
  'action',
  'report',
] as const;

export type ScreenId = (typeof SCREEN_IDS)[number];

export interface Screen {
  id: ScreenId;
  /** サイドバー・URL に使う番号 */
  no: string;
  /** ヘッダの英字コード */
  code: string;
  /** 画面タイトル */
  title: string;
  /** タイトル下の説明 */
  sub: string;
  /** ルーティングのパス */
  href: string;
  /** Phase 1 の対象外（04・05）は false */
  phase1: boolean;
}

export const SCREENS: Record<ScreenId, Screen> = {
  summary: {
    id: 'summary',
    no: '01',
    code: '01 ／ SUMMARY',
    title: '診断サマリー',
    // ヘッダ既定の「実施日／比較対象校数／項目数」と重複するため空にする
    sub: '',
    href: '/',
    phase1: true,
  },
  gap: {
    id: 'gap',
    no: '02',
    code: '02 ／ GAP MAP',
    title: '欠落マップ',
    sub: '受験生・保護者・塾が探す31項目 × 自校＋比較4校（実在6校の構造をもとに設計）',
    href: '/gap',
    phase1: true,
  },
  measurement: {
    id: 'measurement',
    no: '03',
    code: '03 ／ MEASUREMENT',
    title: '導線の実測',
    sub: '実在6校の実測値で中央値を検証しています',
    href: '/measurement',
    phase1: true,
  },
  discovery: {
    id: 'discovery',
    no: '04',
    code: '04 ／ DISCOVERY',
    title: '発見のされ方',
    sub: 'まだ学校名を知らない層に届いているか（Phase 2）',
    href: '/discovery',
    phase1: false,
  },
  persona: {
    id: 'persona',
    no: '05',
    code: '05 ／ PERSONA',
    title: 'ペルソナ仮説',
    sub: '6つの目線でサイトを読み直します（Phase 2）',
    href: '/persona',
    phase1: false,
  },
  action: {
    id: 'action',
    no: '06',
    code: '06 ／ ACTION',
    title: '改善アクション',
    sub: '優先度・難易度でグループ化しています',
    href: '/actions',
    phase1: true,
  },
  report: {
    id: 'report',
    no: '07',
    code: '07 ／ REPORT',
    title: 'レポート出力',
    sub: '必要な項目だけを選んで書き出せます',
    href: '/report',
    phase1: true,
  },
};

export const SCREEN_LIST: Screen[] = SCREEN_IDS.map((id) => SCREENS[id]);

/** 改善アクションの出典 → 検出元の画面。フィルタのラベルもここから引く。 */
export const ACTION_SOURCE_SCREEN: Record<ActionSource, ScreenId> = {
  gap: 'gap',
  measurement: 'measurement',
  discovery: 'discovery',
  persona: 'persona',
};

/** 例：'02 欠落マップ' */
export function sourceLabel(source: ActionSource): string {
  const screen = SCREENS[ACTION_SOURCE_SCREEN[source]];
  return `${screen.no} ${screen.title}`;
}
