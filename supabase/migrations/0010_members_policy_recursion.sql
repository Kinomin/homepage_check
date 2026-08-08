-- organization_members のポリシーが無限再帰していた
--
-- 0006_auth.sql の members_insert は、こう書いていた：
--
--   with check (
--     user_id = auth.uid()
--     and not exists (
--       select 1 from organization_members existing
--       where existing.org_id = organization_members.org_id
--     )
--     or org_id in (select auth_admin_org_ids())
--   )
--
-- ポリシーの中で organization_members を直接読んでいるため、その読み取りに
-- また organization_members のポリシーが適用され、Postgres が
-- 「infinite recursion detected in policy for relation "organization_members"」
-- で止める。つまり所属を作れず、**新規登録が最初の一歩で失敗していた**。
--
-- 0002_rls.sql は同じ理由で auth_org_ids() を security definer にしており
-- （「RLS ポリシー内の再帰を避けるため」とコメントもある）、0006 でその作法から
-- 外れていた。判定を security definer の関数に出して同じ形に戻す。

-- 組織にすでに所属者がいるか。
-- security definer なので、この中の読み取りには RLS が適用されない。
create or replace function org_has_members(target_org_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members where org_id = target_org_id);
$$;

comment on function org_has_members is
  'RLS ポリシーから呼ぶ。ポリシー内で organization_members を直接読むと再帰する。';

-- 許すのは2つだけ（意図は 0006 のまま）：
--  1. 自分が作ったばかりの（まだ誰も所属していない）組織に、自分を入れる
--  2. その組織の管理者が、誰かを追加する
drop policy if exists members_insert on organization_members;

create policy members_insert on organization_members for insert to authenticated
  with check (
    (user_id = auth.uid() and not org_has_members(org_id))
    or org_id in (select auth_admin_org_ids())
  );
