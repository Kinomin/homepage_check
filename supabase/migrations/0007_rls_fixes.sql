-- RLS の抜けの修正（レビューで見つかったもの）
--
-- 1. personas が組織を越えて読めた
-- 2. personas に INSERT ポリシーが無く、05 の生成が保存できなかった
-- 3. rankings に INSERT ポリシーが無く、04 の順位記録が保存できなかった
--
-- 2 と 3 は RLS が有効なテーブルでポリシーの無い操作が拒否されるため、
-- Supabase を接続した時点で保存が全て失敗する状態だった。
-- デモ動作では Supabase を通らないので気づけなかった。

-- ===== 1. personas を組織に紐付ける =====
--
-- 0004 の読み取りポリシーは `scan_id is null or auth_can_read_scan(scan_id)` で、
-- アプリは scan_id を入れずに保存していた。その結果、認証済みなら他組織の
-- ペルソナまで読めていた。ペルソナはサイトの記載内容から導いた解釈であり、
-- 組織の外に出してはいけない（handoff.md 7章）。
--
-- 走査に紐付ける形にはしない。ペルソナは複数回の走査結果をまとめた解釈で、
-- 特定の1走査に属するものではないため。組織を持たせるのが正しい。

alter table personas add column org_id uuid references organizations (id) on delete cascade;

comment on column personas.org_id is
  'ペルソナは組織の分析結果。RLS はこの列で絞る（scan_id では絞らない）。';

create index personas_org_idx on personas (org_id, generated_at desc);

-- 旧ポリシーは組織を見ていないので差し替える。
-- org_id が入っていない行は読めなくなる（0004 適用直後で行は無い想定）。
drop policy if exists personas_read on personas;

create policy personas_read on personas for select to authenticated
  using (org_id in (select auth_org_ids()));

-- ===== 2. personas の生成を保存できるようにする =====
--
-- 生成は解釈を作る操作なので管理者のみ（閲覧者は閲覧のみ：handoff.md 7章）。
create policy personas_insert on personas for insert to authenticated
  with check (org_id in (select auth_admin_org_ids()));

-- 作り直しのために消せるようにしておく（同じ組織の管理者のみ）
create policy personas_delete on personas for delete to authenticated
  using (org_id in (select auth_admin_org_ids()));

-- ===== 3. rankings の手動記録を保存できるようにする =====
--
-- 順位は外部APIの選定が済むまで手で入れる（handoff.md 9章D）。
-- 記録できるのは、自組織が登録している学校の分だけ。
create policy rankings_insert on rankings for insert to authenticated
  with check (
    exists (
      select 1 from org_schools os
      where os.school_id = rankings.school_id
        and os.org_id in (select auth_admin_org_ids())
    )
  );

create policy rankings_delete on rankings for delete to authenticated
  using (
    exists (
      select 1 from org_schools os
      where os.school_id = rankings.school_id
        and os.org_id in (select auth_admin_org_ids())
    )
  );
