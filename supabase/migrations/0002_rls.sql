-- 権限設計（handoff.md 7章）
--
-- ・組織単位（学校法人）で分離。自校のデータは組織外から見えない
-- ・役割：管理者（比較校の設定・レポート出力可）／閲覧者（閲覧のみ）
-- ・比較校として登録された学校に、登録された事実は通知されない
--   （schools は組織横断のマスタなので参照は許すが、org_schools の関係は組織内に閉じる）

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table schools enable row level security;
alter table org_schools enable row level security;
alter table scans enable row level security;
alter table pages enable row level security;
alter table findings enable row level security;
alter table measurements enable row level security;
alter table rankings enable row level security;
alter table actions enable row level security;
alter table action_threads enable row level security;
alter table reports enable row level security;
alter table criteria enable row level security;

-- 所属組織の判定。RLS ポリシー内の再帰を避けるため security definer にする。
create or replace function auth_org_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from organization_members where user_id = auth.uid();
$$;

create or replace function auth_admin_org_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from organization_members where user_id = auth.uid() and role = 'admin';
$$;

-- 走査が自組織のものかを判定する
create or replace function auth_can_read_scan(target_scan_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from scans s
    join org_schools os on os.school_id = s.school_id
    where s.id = target_scan_id and os.org_id in (select auth_org_ids())
  );
$$;

-- criteria は31項目の共通マスタ。認証済みユーザーは読み取りのみ。
create policy criteria_read on criteria for select to authenticated using (true);

create policy organizations_read on organizations for select to authenticated
  using (id in (select auth_org_ids()));

create policy members_read on organization_members for select to authenticated
  using (org_id in (select auth_org_ids()));

-- schools は自校・比較校の共通マスタ。自組織が参照している学校のみ見える。
create policy schools_read on schools for select to authenticated
  using (
    exists (
      select 1 from org_schools os
      where os.school_id = schools.id and os.org_id in (select auth_org_ids())
    )
  );

create policy org_schools_read on org_schools for select to authenticated
  using (org_id in (select auth_org_ids()));

-- 比較校の設定は管理者のみ
create policy org_schools_write on org_schools for all to authenticated
  using (org_id in (select auth_admin_org_ids()))
  with check (org_id in (select auth_admin_org_ids()));

create policy scans_read on scans for select to authenticated
  using (
    exists (
      select 1 from org_schools os
      where os.school_id = scans.school_id and os.org_id in (select auth_org_ids())
    )
  );

create policy pages_read on pages for select to authenticated
  using (auth_can_read_scan(scan_id));

create policy findings_read on findings for select to authenticated
  using (auth_can_read_scan(scan_id));

create policy measurements_read on measurements for select to authenticated
  using (auth_can_read_scan(scan_id));

create policy rankings_read on rankings for select to authenticated
  using (
    exists (
      select 1 from org_schools os
      where os.school_id = rankings.school_id and os.org_id in (select auth_org_ids())
    )
  );

create policy actions_read on actions for select to authenticated
  using (auth_can_read_scan(scan_id));

-- 対応済みトグル（01 と 06 で共有する状態）の更新。閲覧者も自組織の進捗は更新できる。
create policy actions_update on actions for update to authenticated
  using (auth_can_read_scan(scan_id))
  with check (auth_can_read_scan(scan_id));

create policy action_threads_read on action_threads for select to authenticated
  using (
    exists (
      select 1 from actions a
      where a.id = action_threads.action_id and auth_can_read_scan(a.scan_id)
    )
  );

create policy action_threads_insert on action_threads for insert to authenticated
  with check (
    exists (
      select 1 from actions a
      where a.id = action_threads.action_id and auth_can_read_scan(a.scan_id)
    )
  );

create policy reports_read on reports for select to authenticated
  using (auth_can_read_scan(scan_id));

-- レポート出力は管理者のみ
create policy reports_insert on reports for insert to authenticated
  with check (
    exists (
      select 1
      from scans s
      join org_schools os on os.school_id = s.school_id
      where s.id = reports.scan_id and os.org_id in (select auth_admin_org_ids())
    )
  );

-- 走査・判定の書き込みは service_role（サーバ側のバッチ）のみ。
-- service_role は RLS を迂回するため、ここでは authenticated 向けの書き込みを開けない。
