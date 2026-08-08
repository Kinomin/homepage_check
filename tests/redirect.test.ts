import { describe, expect, it } from 'vitest';

import { safeNextPath } from '../src/lib/auth/redirect';

describe('ログイン後の戻り先の検証', () => {
  it('自サイト内のパスは通す', () => {
    expect(safeNextPath('/')).toBe('/');
    expect(safeNextPath('/gap')).toBe('/gap');
    expect(safeNextPath('/settings?tab=1')).toBe('/settings?tab=1');
  });

  it('外部サイトへ飛ばす値は落とす（オープンリダイレクト）', () => {
    // 戻り先は確認メールのリンクやクエリに載って外から入ってくる
    for (const value of [
      '//evil.example.com',
      '/\\evil.example.com',
      'https://evil.example.com',
      'http://evil.example.com',
      'HTTPS://evil.example.com',
      'javascript:alert(1)',
      'gap',
    ]) {
      expect(safeNextPath(value), value).toBe('/');
    }
  });

  it('未指定はトップにする', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath('')).toBe('/');
  });
});
