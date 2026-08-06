-- School Insight AI — 初期スキーマ（handoff.md 3章）
--
-- enum は Postgres の型として定義する。TypeScript 側の Union 型
-- （src/lib/types.ts）と1対1で対応させ、フリーテキストで持たない。
-- handoff.md 10章-2「分類ラベルを変更した際、データ側のラベルだけ変え忘れた」への対策。

create extension if not exists "pgcrypto";

-- ===== enum =====

create type finding_level as enum ('full', 'mid', 'thin', 'none', 'n/a', 'unknown');
create type scan_status as enum ('queued', 'running', 'done', 'blocked', 'failed');
create type judged_by as enum ('rule', 'llm');
create type school_role as enum ('self', 'competitor');
create type measurement_method as enum ('scan', 'operate', 'external');
create type action_priority as enum ('high', 'mid', 'low');
create type action_difficulty as enum ('low', 'mid', 'high');
create type action_status as enum ('open', 'doing', 'done', 'wontfix');
create type action_source as enum ('gap', 'measurement', 'discovery', 'persona');
create type org_member_role as enum ('admin', 'viewer');
create type thread_role as enum ('user', 'assistant');
create type keyword_type as enum ('branded', 'generic');

-- ===== 組織 =====

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'standard',
  created_at timestamptz not null default now()
);

-- 権限設計（handoff.md 7章）：組織単位で分離し、自校のデータは組織外から見えない。
create table organization_members (
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role org_member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- ===== 学校 =====

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  prefecture text,
  school_type text,
  coed_type text,
  has_junior_admission boolean not null default true,
  has_senior_admission boolean not null default true,
  has_affiliated_university boolean not null default false,
  -- robots.txt で走査が拒否されている学校。走査せず findings は unknown とする。
  robots_allowed boolean not null default true,
  created_at timestamptz not null default now()
);

create table org_schools (
  org_id uuid not null references organizations (id) on delete cascade,
  school_id uuid not null references schools (id) on delete cascade,
  role school_role not null,
  sort_order integer not null default 0,
  primary key (org_id, school_id)
);

-- 比較校は4〜5校まで（handoff.md 3章）
create or replace function check_competitor_limit() returns trigger as $$
begin
  if new.role = 'competitor' and (
    select count(*) from org_schools
    where org_id = new.org_id and role = 'competitor' and school_id <> new.school_id
  ) >= 5 then
    raise exception '比較校は5校までです';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger org_schools_competitor_limit
  before insert or update on org_schools
  for each row execute function check_competitor_limit();

-- ===== 調査項目 =====

create table criteria (
  id text primary key,                      -- 'A1' 〜 'G3'
  category text not null,
  label text not null,
  audience text not null,
  judge_prompt text not null,
  -- 名称ゆれの例。判定条件ではなく候補ページ抽出と画面表示のためのヒント。
  aliases text[] not null default '{}',
  path_hints text[] not null default '{}',
  applicable_when text,                     -- 例: 'has_affiliated_university'
  special_rule text,
  sort_order integer not null
);

-- ===== 走査 =====

create table scans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status scan_status not null default 'queued',
  page_count integer not null default 0,
  indexed_count integer not null default 0,
  image_count integer not null default 0,
  pdf_only_count integer not null default 0,
  crawl_depth integer not null default 4
);

create index scans_school_started_idx on scans (school_id, started_at desc);

create table pages (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans (id) on delete cascade,
  url text not null,
  title text,
  meta_description text,
  h1_count integer not null default 0,
  word_count integer not null default 0,
  image_count integer not null default 0,
  image_without_alt_count integer not null default 0,
  has_json_ld boolean not null default false,
  json_ld_types text[] not null default '{}',
  last_modified timestamptz,
  http_status integer not null,
  is_pdf boolean not null default false,
  depth integer not null default 0,
  unique (scan_id, url)
);

comment on table pages is
  '比較校のページ本文はここに保存しない（handoff.md 6章）。判定に必要な集計値と URL のみ保持する。';

-- ===== 判定結果 =====

create table findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans (id) on delete cascade,
  criterion_id text not null references criteria (id),
  level finding_level not null,
  evidence_text text not null default '',
  evidence_urls text[] not null default '{}',
  evidence_counts jsonb not null default '{}'::jsonb,
  judged_by judged_by not null,
  judged_at timestamptz not null default now(),
  unique (scan_id, criterion_id)
);

comment on column findings.level is
  'unknown は走査失敗・robots 拒否・タイムアウト。none（欠落）と必ず区別し、欠落件数に数えない。';

-- ===== 03 計測値 =====

create table measurements (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans (id) on delete cascade,
  key text not null,
  value numeric not null,
  unit text not null,
  method measurement_method not null,
  unique (scan_id, key)
);

comment on column measurements.method is
  '再現性の水準（走査／操作／外部測定）。値と必ずセットで持ち、画面でもタグとして示す。';

-- ===== 04 順位（Phase 2） =====

create table rankings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  keyword text not null,
  keyword_type keyword_type not null,
  position integer,
  top_domain text,
  measured_at timestamptz not null default now()
);

-- ===== 06 改善アクション =====

create table actions (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans (id) on delete cascade,
  action_key text not null,
  priority action_priority not null,
  difficulty action_difficulty not null,
  source action_source not null,
  source_criterion_id text references criteria (id),
  status action_status not null default 'open',
  assignee_note text,
  updated_at timestamptz not null default now(),
  unique (scan_id, action_key)
);

comment on column actions.status is
  '01 サマリーの SM-04 と 06 改善アクションが同じ状態を参照する。所要時間・期限は持たない（handoff.md 5章）。';

create table action_threads (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references actions (id) on delete cascade,
  role thread_role not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ===== 07 レポート =====

create table reports (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans (id) on delete cascade,
  included_blocks text[] not null default '{}',
  anonymize_competitors boolean not null default false,
  generated_at timestamptz not null default now(),
  pdf_path text
);
