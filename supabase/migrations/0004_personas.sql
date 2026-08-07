-- 05 ペルソナ仮説（handoff.md 5章 05）
--
-- 生成物は「サイトの記載内容から自動生成した仮説」であり、計測結果ではない。
-- 各仮説には根拠となる調査項目ID（criterion_id）を必ず持たせる。
-- 根拠のない読み取りを保存させないため、hypotheses の形を制約で縛る。

create type persona_stage as enum ('e6', 'j3', 'parent');
create type persona_gender as enum ('f', 'm');

create table personas (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references scans (id) on delete cascade,
  stage persona_stage not null,
  gender persona_gender not null,
  quote text not null,
  -- [{ kind: 'support'|'gap'|'check', body: text, criterionIds: text[] }]
  hypotheses jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),

  -- 根拠のない仮説を保存しない（handoff.md 5章 05）
  constraint hypotheses_have_evidence check (
    not exists (
      select 1
      from jsonb_array_elements(hypotheses) as item
      where jsonb_array_length(coalesce(item -> 'criterionIds', '[]'::jsonb)) = 0
    )
  )
);

create index personas_scan_idx on personas (scan_id, generated_at desc);

comment on table personas is
  'サイトの記載内容から自動生成した仮説。実際の受験生・保護者の声ではない。';

alter table personas enable row level security;

create policy personas_read on personas for select to authenticated
  using (scan_id is null or auth_can_read_scan(scan_id));
