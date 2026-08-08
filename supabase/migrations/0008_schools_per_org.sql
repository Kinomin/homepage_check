-- 学校マスタを組織ごとに持つ（共有をやめる）
--
-- 0006 までは schools を組織横断の共通マスタにし、同じ URL の学校は
-- 1行を使い回していた。これが3つの問題を同時に生んでいた。
--
-- 1. 名前を書き換えられる
--    schools_insert が `with check (true)` だったため、認証済みなら誰でも
--    任意の学校名で URL を先に登録できた。あとから同じ URL を登録した組織は
--    その行を使い回すので、誤った学校名を掴まされる。
--
-- 2. 他組織が起こした走査が見えてしまう
--    scans_read は org_schools 経由で許可を判定する。同じ学校を2つの組織が
--    比較校にしていると、A組織が起こした走査を B組織も読める。
--
-- 3. 走査の間隔が他組織に左右される
--    「前回走査」を school_id 単位で数えていたため、A組織が月曜に走査すると
--    B組織のスケジュールもそれを前回とみなし、B組織の走査が飛ぶ。
--    自分の設定どおりに走ったつもりで、実際は他組織の都合で動いていた。
--
-- どれも「1行を共有している」ことが原因なので、組織ごとに行を持つ形に変える。
--
-- 代償：同じ比較校を複数の組織が挙げると、その学校のサイトを組織ごとに
-- 走査することになる（相手サイトへのアクセスが増える）。
-- ただし組織ごとにクロール範囲や頻度の設定が違うため、走査結果はもともと
-- 共有できるものではなかった。間隔とリクエスト数の制限は設定側で効く。

-- 共有をやめるので、URL の一意制約も外す。
-- 同じ学校を別々の組織が登録できなければならない。
drop index if exists schools_url_key;

-- 同じ組織のなかで同じ URL を二重に登録しないための制約。
-- 以前は schools の一意制約が兼ねていた役割をこちらに移す。
create or replace function check_school_url_unique_in_org() returns trigger as $$
begin
  if exists (
    select 1
    from org_schools os
    join schools s on s.id = os.school_id
    where os.org_id = new.org_id
      and os.school_id <> new.school_id
      and s.url = (select url from schools where id = new.school_id)
  ) then
    raise exception 'この学校はすでに登録されています';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger org_schools_url_unique
  before insert or update on org_schools
  for each row execute function check_school_url_unique_in_org();

-- 作成できるのは、どこかの組織の管理者だけにする。
-- `with check (true)` だと、組織に属していない利用者でもマスタを埋められた。
drop policy if exists schools_insert on schools;

create policy schools_insert on schools for insert to authenticated
  with check (exists (select 1 from auth_admin_org_ids()));

-- 行が組織ごとになったので、更新は「自組織が登録している学校」なら許す。
-- 以前は自校のみに限っていた（比較校の行を他組織と共有していたため）。
-- 共有をやめた今は、比較校の名前を直すのも自組織の行に対する操作になる。
drop policy if exists schools_update on schools;

create policy schools_update on schools for update to authenticated
  using (
    exists (
      select 1 from org_schools os
      where os.school_id = schools.id and os.org_id in (select auth_admin_org_ids())
    )
  )
  with check (
    exists (
      select 1 from org_schools os
      where os.school_id = schools.id and os.org_id in (select auth_admin_org_ids())
    )
  );

comment on table schools is
  '学校は組織ごとに1行持つ（共有しない）。走査結果・名前が組織をまたいで混ざらないようにするため。';

-- 比較校を外すときは行ごと消す（共有していないため）。
-- DELETE ポリシーが無いと RLS に拒否され、画面上は押せるのに消えない。
create policy schools_delete on schools for delete to authenticated
  using (
    exists (
      select 1 from org_schools os
      where os.school_id = schools.id and os.org_id in (select auth_admin_org_ids())
    )
  );
