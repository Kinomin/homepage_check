-- 自動実行の記録と、失敗時の通知先
--
-- handoff.md 8章が Phase 2 に置いていた「自動実行の登録と失敗時の通知」。
-- 走査が失敗したまま気づかれない状態を作らないため、実行のたびに結果を残す。
--
-- 走査失敗と「情報がない」を混ぜないという原則（4章）は保存側でも守る：
-- 失敗した走査は scans に保存されないので、ここが唯一の記録になる。

create type scan_run_trigger as enum ('cron', 'manual');

create table scan_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  trigger scan_run_trigger not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  due_count integer not null default 0,
  succeeded_count integer not null default 0,
  failed_count integer not null default 0,
  -- 画面と通知で同じ文面を使う
  summary text not null default '',
  -- 学校ごとの結末。ページ本文は含めない（6章）
  entries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index scan_runs_org_started_idx on scan_runs (org_id, started_at desc);

comment on column scan_runs.entries is
  '学校ごとの結末（学校名・status・理由・ページ数・判定できなかった件数）。ページ本文は保存しない。';

alter table scan_runs enable row level security;

create policy scan_runs_read on scan_runs for select to authenticated
  using (org_id in (select auth_org_ids()));

-- 走査の記録を書けるのは service_role のバッチのみ（authenticated には書かせない）

-- ===== 失敗時の通知先 =====
--
-- メール配信ベンダーを勝手に選ばず、任意の Webhook URL を設定できる形にする。
-- Slack・Google Chat・自前の受け口のいずれでも使える。

alter table organization_settings
  add column notify_webhook_url text,
  add column notify_on_failure boolean not null default true;

comment on column organization_settings.notify_webhook_url is
  '走査で確認が必要になったときの通知先。未設定なら記録だけ残す。';
