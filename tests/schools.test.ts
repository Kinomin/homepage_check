import { describe, expect, it } from 'vitest';

import {
  MAX_COMPETITORS,
  normalizeSchoolUrl,
  SchoolInputError,
  validateSchoolInput,
} from '../src/lib/schools/schema';

describe('URL の正規化（同じ学校を二重に登録しないため）', () => {
  it('www とスキームと末尾スラッシュの違いを吸収する', () => {
    const expected = 'https://example.ed.jp';
    for (const input of [
      'https://example.ed.jp',
      'https://example.ed.jp/',
      'http://www.example.ed.jp/',
      'https://WWW.Example.ED.JP///',
      '  example.ed.jp  ',
    ]) {
      expect(normalizeSchoolUrl(input)).toBe(expected);
    }
  });

  it('パスの違いは別のものとして残す', () => {
    expect(normalizeSchoolUrl('https://gakuen.ac.jp/jhs/')).toBe('https://gakuen.ac.jp/jhs');
    expect(normalizeSchoolUrl('https://gakuen.ac.jp/shs')).toBe('https://gakuen.ac.jp/shs');
  });

  it('URL として読めないものは受け付けない', () => {
    for (const input of ['', '   ', 'ここに入れる', 'ftp://example.ed.jp', 'https://localhost']) {
      expect(() => normalizeSchoolUrl(input)).toThrow(SchoolInputError);
    }
  });
});

describe('学校の入力の検証', () => {
  it('学校名は必須', () => {
    expect(() => validateSchoolInput({ name: '  ', url: 'https://a.ed.jp' })).toThrow(
      '学校名を入力してください',
    );
  });

  it('通った入力は正規化された URL を持つ', () => {
    const result = validateSchoolInput({ name: ' ○○中学校 ', url: 'www.a.ed.jp/' });
    expect(result.name).toBe('○○中学校');
    expect(result.url).toBe('https://a.ed.jp');
  });

  it('比較校の上限は仕様どおり5校', () => {
    // handoff.md 3章。DB のトリガ（0001_init.sql）と同じ値であること
    expect(MAX_COMPETITORS).toBe(5);
  });
});
