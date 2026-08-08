-- 組織ごとの設定（走査スケジュール・クロール範囲・判定コスト）
--
-- handoff.md 9章A の「自校と比較校で走査頻度を変えるか」をコードに固定せず、
-- 設定として持つ。既定値は handoff.md の推奨（自校 週次／比較校 月次）。

create type scan_frequency as enum ('weekly', 'biweekly', 'monthly', 'manual');
create type judge_effort as enum ('low', 'medium', 'high', 'xhigh', 'max');

create table organization_settings (
  org_id uuid primary key references organizations (id) on delete cascade,

  -- 走査スケジュール（時刻はすべて日本時間で解釈する）
  self_scan_frequency scan_frequency not null default 'weekly',
  competitor_scan_frequency scan_frequency not null default 'monthly',
  scan_day_of_week smallint not null default 1 check (scan_day_of_week between 0 and 6),
  scan_day_of_month smallint not null default 1 check (scan_day_of_month between 1 and 28),
  scan_hour smallint not null default 6 check (scan_hour between 0 and 23),

  -- クロール範囲
  crawl_max_depth smallint not null default 4 check (crawl_max_depth between 1 and 6),
  self_max_pages integer not null default 200 check (self_max_pages between 10 and 1000),
  competitor_max_pages integer not null default 60 check (competitor_max_pages between 10 and 500),
  request_interval_ms integer not null default 1000 check (request_interval_ms between 200 and 10000),
  crawl_concurrency smallint not null default 2 check (crawl_concurrency between 1 and 4),

  -- 判定コスト
  judge_effort judge_effort not null default 'low',
  judge_body_char_limit integer not null default 2500 check (judge_body_char_limit between 500 and 8000),
  judge_candidate_limit smallint not null default 5 check (judge_candidate_limit between 1 and 10),

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

comment on column organization_settings.scan_day_of_month is
  '月末のずれを避けるため1〜28日に制限している。';
comment on column organization_settings.competitor_max_pages is
  '比較校は判定に必要なページのみ走査する（handoff.md 9章B の推奨）。';

alter table organization_settings enable row level security;

create policy organization_settings_read on organization_settings for select to authenticated
  using (org_id in (select auth_org_ids()));

-- 設定の変更は管理者のみ（handoff.md 7章：閲覧者は閲覧のみ）
create policy organization_settings_write on organization_settings for all to authenticated
  using (org_id in (select auth_admin_org_ids()))
  with check (org_id in (select auth_admin_org_ids()));

-- 組織を作ったら既定の設定を1行入れる
create or replace function create_default_settings() returns trigger as $$
begin
  insert into organization_settings (org_id) values (new.id)
  on conflict (org_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger organizations_default_settings
  after insert on organizations
  for each row execute function create_default_settings();
