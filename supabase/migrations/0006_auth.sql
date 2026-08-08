-- サインアップと学校登録に必要な書き込み権限（handoff.md 7章）
--
-- 0002_rls.sql は読み取りと、既に組織がある前提の書き込みだけを定義していた。
-- 新規登録の経路（組織を作る → 自分を管理者にする → 学校を登録する）を通す。
--
-- 比較校として登録された事実は相手校に通知しない、という前提は維持する。
-- 登録の関係は org_schools に閉じ、schools（組織横断のマスタ）には
-- 「誰が登録したか」を持たせない。

-- ===== 学校法人を作る =====
--
-- 作った直後は誰も所属していないので、auth_org_ids() では判定できない。
-- 空の組織を作れても他人のデータには届かない（読み取りは所属で絞られる）。
create policy organizations_insert on organizations for insert to authenticated
  with check (true);

-- 組織名の変更は管理者のみ
create policy organizations_update on organizations for update to authenticated
  using (id in (select auth_admin_org_ids()))
  with check (id in (select auth_admin_org_ids()));

-- ===== 所属を作る =====
--
-- 許すのは2つだけ：
--  1. 自分が作ったばかりの（まだ誰も所属していない）組織に、自分を入れる
--  2. その組織の管理者が、誰かを追加する
-- これ以外は、他人の組織に自分を紛れ込ませる経路になる。
create policy members_insert on organization_members for insert to authenticated
  with check (
    (
      user_id = auth.uid()
      and not exists (
        select 1 from organization_members existing
        where existing.org_id = organization_members.org_id
      )
    )
    or org_id in (select auth_admin_org_ids())
  );

create policy members_update on organization_members for update to authenticated
  using (org_id in (select auth_admin_org_ids()))
  with check (org_id in (select auth_admin_org_ids()));

create policy members_delete on organization_members for delete to authenticated
  using (org_id in (select auth_admin_org_ids()));

-- ===== 学校マスタ =====
--
-- schools は組織横断の共通マスタ。同じ学校を複数の組織が比較校に挙げるため、
-- 1組織の所有物にはできない。作成は認証済みユーザーに許す。
create policy schools_insert on schools for insert to authenticated
  with check (true);

-- 変更できるのは、自組織が「自校」として登録している学校だけ。
-- 比較校の情報を登録側が書き換えられると、相手校の記録を他組織が動かせてしまう。
create policy schools_update on schools for update to authenticated
  using (
    exists (
      select 1 from org_schools os
      where os.school_id = schools.id
        and os.role = 'self'
        and os.org_id in (select auth_admin_org_ids())
    )
  )
  with check (
    exists (
      select 1 from org_schools os
      where os.school_id = schools.id
        and os.role = 'self'
        and os.org_id in (select auth_admin_org_ids())
    )
  );

-- 同じ学校を二重に登録しないための突き合わせキー。
-- アプリ側（normalizeSchoolUrl）で正規化した URL を入れる。
create unique index if not exists schools_url_key on schools (url);
