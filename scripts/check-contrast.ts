/**
 * 文字色のコントラスト比の検算。
 *
 *   npm run check:contrast
 *
 * globals.css の :root から色を読み、文字色 × 背景色の全組み合わせを WCAG の式で測る。
 * 画面には 9.5〜12px の小さいラベルが多いため、必要なのは 4.5:1（AA・通常サイズ）。
 * 大きい字向けの 3:1 では足りない。
 *
 * 配色を変えたら必ず通すこと。見た目の印象だけで色を決めると、
 * 薄いグレーの注記が読めない状態に戻る。
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const CSS = path.join(process.cwd(), 'src', 'app', 'globals.css');

/** WCAG 2.x の相対輝度 */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** :root から --名前:#RRGGBB を拾う */
async function readTokens(): Promise<Map<string, string>> {
  const css = await readFile(CSS, 'utf8');
  const root = css.slice(css.indexOf(':root{'), css.indexOf('}', css.indexOf(':root{')));
  const tokens = new Map<string, string>();
  for (const [, name, value] of root.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) {
    tokens.set(name, value);
  }
  return tokens;
}

/** 文字色として使うもの */
const TEXT = ['ink', 'ink-2', 'mute', 'blue', 'blue-deep', 'rose', 'sage', 'amber'];
/** その文字が載る面 */
const SURFACES = ['surface', 'surface-2', 'bg', 'surface-3'];
/** タグは同系色の淡い面に載る */
const TAGS: [string, string][] = [
  ['rose', 'rose-tint'],
  ['sage', 'sage-tint'],
  ['amber', 'amber-tint'],
];

const REQUIRED = 4.5;

async function main() {
  const tokens = await readTokens();
  const missing = [...TEXT, ...SURFACES].filter((name) => !tokens.has(name));
  if (missing.length > 0) {
    console.error(`globals.css の :root に見つかりません: ${missing.join(', ')}`);
    process.exit(1);
  }

  const failures: string[] = [];

  console.log(`必要なコントラスト比: ${REQUIRED}:1（WCAG AA・通常サイズ）\n`);
  console.log(`${'色'.padEnd(12)}${SURFACES.map((s) => s.padStart(13)).join('')}`);

  for (const name of TEXT) {
    const cells = SURFACES.map((surface) => {
      const ratio = contrast(tokens.get(name)!, tokens.get(surface)!);
      if (ratio < REQUIRED) failures.push(`${name} on ${surface} = ${ratio.toFixed(2)}`);
      return `${ratio.toFixed(2)}${ratio >= REQUIRED ? ' ok' : ' NG'}`.padStart(13);
    });
    console.log(`${name.padEnd(12)}${cells.join('')}`);
  }

  console.log('\nタグ（同系色の淡い面）');
  for (const [text, tint] of TAGS) {
    if (!tokens.has(tint)) continue;
    const ratio = contrast(tokens.get(text)!, tokens.get(tint)!);
    if (ratio < REQUIRED) failures.push(`${text} on ${tint} = ${ratio.toFixed(2)}`);
    console.log(`  ${text.padEnd(10)} ${ratio.toFixed(2)} ${ratio >= REQUIRED ? 'ok' : 'NG'}`);
  }

  if (failures.length > 0) {
    console.error(`\n未達 ${failures.length}件:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log('\nすべて基準を満たしています。');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
