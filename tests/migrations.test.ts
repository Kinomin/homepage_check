import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

async function migrationFiles(): Promise<string[]> {
  return (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();
}

describe('マイグレーションの並び', () => {
  it('4桁の連番で、番号が飛ばない', async () => {
    const files = await migrationFiles();
    expect(files.length).toBeGreaterThan(0);

    files.forEach((file, index) => {
      expect(file).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
      // 適用はファイル名の昇順。番号が飛ぶと、あとで足したものの順序が読めなくなる
      expect(file.slice(0, 4)).toBe(String(index + 1).padStart(4, '0'));
    });
  });
});

describe('テーブルの CHECK 制約', () => {
  it('CHECK にサブクエリを書かない（Postgres が拒否する）', async () => {
    // 0004 で実際に踏んだ。テーブルの CHECK 制約にサブクエリは置けず、
    // 適用時に "cannot use subquery in check constraint" で落ちる。
    // 判定は immutable な関数に出すこと。
    //
    // RLS ポリシーの `with check` は別物でサブクエリを書けるため、
    // create table の中だけを見る。
    for (const file of await migrationFiles()) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const tables = sql.matchAll(/create table[\s\S]*?\n\);/gi);

      for (const [table] of tables) {
        for (const [, body] of table.matchAll(/\bcheck\s*\(([^;]*?)\)\s*[,\n]/gi)) {
          expect(body, `${file} のテーブル定義内 CHECK にサブクエリがあります`).not.toMatch(
            /\bselect\b|\bexists\s*\(/i,
          );
        }
      }
    }
  });
});

describe('シードの再実行', () => {
  it('何度流しても同じ状態になる（on conflict do update）', async () => {
    const seed = await readFile(path.join(process.cwd(), 'supabase', 'seed', 'criteria.sql'), 'utf8');
    expect(seed).toMatch(/on conflict\s*\(id\)\s*do update/i);
  });
});
