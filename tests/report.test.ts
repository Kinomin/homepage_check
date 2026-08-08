import { describe, expect, it } from 'vitest';

import { REPORT_CONFIDENTIALITY } from '../src/lib/data/demo-extras';
import { buildStandaloneHtml, reportFileName } from '../src/lib/report/document';

describe('書き出しファイル名', () => {
  it('学校名・作成日・体裁が分かる名前にする', () => {
    expect(reportFileName('翠陵ヶ丘中学校・高等学校', '2026年8月3日', true)).toBe(
      '翠陵ヶ丘中学校・高等学校_202683_A4横1枚',
    );
    expect(reportFileName('翠陵ヶ丘中学校・高等学校', '2026年8月3日', false)).toContain('A4縦');
  });

  it('ファイル名に使えない文字を落とす', () => {
    const name = reportFileName('A/B:C*学園 ?', '2026-08-03', false);
    expect(name).not.toMatch(/[\\/:*?"<>|\s]/);
    expect(name).toContain('A_B_C');
  });

  it('学校名が空でも名前を作れる', () => {
    expect(reportFileName('   ', '', false)).toBe('report_undated_A4縦');
  });
});

describe('単体で開ける HTML', () => {
  const base = {
    baseName: 'report',
    title: 'ホームページ現状レポート ｜ ○○中学校',
    bodyHtml: `<section class="blk"><h3>比較4校との情報差</h3></section><div class="conf">${REPORT_CONFIDENTIALITY[1]}</div>`,
    onePage: false,
  };

  it('外部のCSS・フォント・画像を参照しない（配布先で崩れないため）', () => {
    const html = buildStandaloneHtml(base);
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('A4縦と A4横1枚で用紙の指定が変わる', () => {
    expect(buildStandaloneHtml(base)).toContain('size:A4 portrait');
    expect(buildStandaloneHtml({ ...base, onePage: true })).toContain('size:A4 landscape');
  });

  it('1枚モードだけ2段組にする', () => {
    expect(buildStandaloneHtml(base)).not.toContain('column-count');
    expect(buildStandaloneHtml({ ...base, onePage: true })).toContain('column-count:2');
  });

  it('画面側の inline style が使う色の変数を持たせる', () => {
    // var(--mute) などを解決できないと、注記の色が落ちて本文と区別できなくなる
    const html = buildStandaloneHtml(base);
    expect(html).toContain('--mute:');
    expect(html).toContain('--line:');
  });

  it('本文はそのまま入る（注記が落ちない）', () => {
    const html = buildStandaloneHtml(base);
    expect(html).toContain('比較4校との情報差');
    expect(html).toContain('教育内容や学校運営の優劣を評価するものではありません');
  });

  it('タイトルの記号をエスケープする', () => {
    const html = buildStandaloneHtml({ ...base, title: '<script>x</script>' });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>x');
  });

  it('日本語が化けない指定を持つ', () => {
    expect(buildStandaloneHtml(base)).toContain('<meta charset="utf-8">');
    expect(buildStandaloneHtml(base)).toContain('lang="ja"');
  });
});

describe('レポート末尾の注記（handoff.md 5章 07）', () => {
  it('比較校を評価するものではないことと、校外配布を控える旨を含む', () => {
    const joined = REPORT_CONFIDENTIALITY.join('');
    expect(joined).toContain('優劣を評価するものではありません');
    expect(joined).toContain('校外への配布');
  });

  it('判定が名称の一致ではないことを書いている', () => {
    expect(REPORT_CONFIDENTIALITY.join('')).toContain('ページ名称の一致ではなく');
  });
});
