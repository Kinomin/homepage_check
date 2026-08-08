/**
 * src/lib/analysis/criteria.ts から criteria テーブルのシード SQL を生成する。
 *
 *   npx tsx scripts/generate-criteria-seed.ts
 *
 * 調査項目の定義元は TypeScript 側の1箇所だけにする。SQL を手で書くと、
 * 項目を足したときに片方だけ更新されて食い違う（handoff.md 10章-2）。
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { CRITERIA } from '../src/lib/analysis/criteria';

function quote(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'null';
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteArray(values: string[]): string {
  return `ARRAY[${values.map(quote).join(', ')}]::text[]`;
}

const rows = CRITERIA.map((criterion, index) =>
  [
    quote(criterion.id),
    quote(criterion.category),
    quote(criterion.label),
    quote(criterion.audience),
    quote(criterion.judgePrompt),
    quoteArray(criterion.aliases),
    quoteArray(criterion.pathHints),
    quote(criterion.applicableWhen ?? null),
    quote(criterion.specialRule ?? null),
    String(index),
  ].join(', '),
);

const sql = `-- 自動生成ファイル。編集しないこと。
-- 生成元: src/lib/analysis/criteria.ts
-- 生成コマンド: npx tsx scripts/generate-criteria-seed.ts

insert into criteria (
  id, category, label, audience, judge_prompt, aliases, path_hints, applicable_when, special_rule, sort_order
) values
${rows.map((row) => `  (${row})`).join(',\n')}
on conflict (id) do update set
  category = excluded.category,
  label = excluded.label,
  audience = excluded.audience,
  judge_prompt = excluded.judge_prompt,
  aliases = excluded.aliases,
  path_hints = excluded.path_hints,
  applicable_when = excluded.applicable_when,
  special_rule = excluded.special_rule,
  sort_order = excluded.sort_order;
`;

async function main() {
  const outputPath = path.join(process.cwd(), 'supabase', 'seed', 'criteria.sql');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sql, 'utf8');
  console.log(`${CRITERIA.length}件の調査項目を ${outputPath} に書き出しました`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
