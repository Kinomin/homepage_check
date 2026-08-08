/**
 * 07 レポートの書き出し。
 *
 * PDF は「ブラウザの印刷（用紙・余白は print CSS で指定）」で作る。
 * サーバ側にヘッドレスブラウザを置いていないため（handoff.md 9章C で
 * Playwright を使わない判断をしている）、PDF をサーバで生成すると
 * その判断と食い違う。
 *
 * 代わりに、保存・回覧できる実ファイルとして**単体で開ける HTML**
 * を書き出す。外部の CSS やフォントを参照せず、これ1つで表示できる。
 *
 * どちらの経路でも末尾の注記は必ず入れる（handoff.md 5章 07）。
 */

export interface ReportDocument {
  /** 学校名を含むファイル名（拡張子なし） */
  baseName: string;
  title: string;
  /** レポート本体の HTML（sheet の中身） */
  bodyHtml: string;
  /** A4横1枚に収める指定で書き出したか */
  onePage: boolean;
}

/** ファイル名に使えない文字を落とす。空になったら既定名にする。 */
export function reportFileName(schoolName: string, scanDate: string, onePage: boolean): string {
  const safeSchool = schoolName.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '');
  const safeDate = scanDate.replace(/[^0-9]/g, '');
  return [safeSchool || 'report', safeDate || 'undated', onePage ? 'A4横1枚' : 'A4縦']
    .join('_')
    .slice(0, 120);
}

/**
 * 単体で開ける HTML を組み立てる。
 * 外部参照を持たせない（配布先でレイアウトが崩れないようにするため）。
 */
export function buildStandaloneHtml(document: ReportDocument): string {
  const orientation = document.onePage ? 'A4 landscape' : 'A4 portrait';
  const margin = document.onePage ? '9mm' : '14mm';

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(document.title)}</title>
<style>
@page{size:${orientation};margin:${margin}}
/* 画面側の inline style が参照している変数。ここで解決しないと色が落ちる */
:root{--ink:#2E3238;--ink-2:#5A626C;--mute:#8A929B;--line:#E2E6E9;
  --blue:#5C7FA8;--rose:#B4707E;--sage:#6D9A83}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;
  color:#2E3238;background:#fff;font-size:13px;line-height:1.7;
  font-feature-settings:"palt" 1;-webkit-font-smoothing:antialiased;
  padding:${document.onePage ? '10mm' : '16mm'};max-width:1100px;margin:0 auto}
.sheet-h{border-bottom:1.5px solid #5C7FA8;padding-bottom:9px;margin-bottom:18px;
  display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
.sheet-h .t{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:17px;font-weight:700}
.sheet-h .d{font-family:ui-monospace,monospace;font-size:10px;color:#8A929B;text-align:right;line-height:1.7}
section.blk{margin-bottom:20px;break-inside:avoid}
h3{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:13.5px;margin-bottom:7px;
  padding-left:8px;border-left:3px solid #B4707E}
table{border-collapse:collapse;width:100%;font-size:12px;break-inside:avoid}
th,td{border:1px solid #E2E6E9;padding:5px 8px;text-align:left;vertical-align:top}
th{background:#F9FAFB;font-weight:700;white-space:nowrap;color:#5A626C}
.conf{margin-top:14px;padding-top:9px;border-top:1px solid #E2E6E9;font-size:10px;color:#8A929B;line-height:1.8}
.trimmed{font-size:10px;color:#8A929B;margin-top:3px}
${
  document.onePage
    ? `.cols{column-count:2;column-gap:10mm}
section.blk{margin-bottom:11px}
h3{font-size:11.5px;margin-bottom:4px}
table{font-size:9.5px}
th,td{padding:2.5px 5px}
.conf{font-size:8.5px;line-height:1.65}
.sheet-h .t{font-size:14px}`
    : ''
}
@media print{body{padding:0;max-width:none}}
</style>
</head>
<body>
${document.bodyHtml}
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
