-- 学校・学校法人の登録を1トランザクションにまとめる
--
-- アプリ側から複数回に分けて書き込んでいたため、途中で失敗すると
-- どこからも見えない行が残っていた。
--
-- 1. 学校の追加：schools を作る → org_schools に紐付ける
--    紐付けが失敗（比較校5校の上限・同一URLの重複）すると schools だけが残る。
--    org_schools が無い行は schools_read の条件を満たさないので誰にも見えず、
--    気づかないまま溜まる。片付けようとしても schools_delete が
--    「自組織が登録している学校」を条件にしているため、まさにこの場合は消せない。
--
-- 2. 学校法人の作成：organizations → organization_members → schools → org_schools
--    途中で失敗すると、自校の無い学校法人や、所属者のいない学校法人が残る。
--    自校の無い状態は初回登録の画面にも戻れず、行き止まりになる。
--
-- 3. さらに、そもそも登録が成立していなかった
--    supabase-js の .insert().select() は INSERT ... RETURNING を発行する。
--    RETURNING は返す行に対する SELECT 権限を要求するが、
--    ・organizations は「所属している組織」しか読めない（まだ所属していない）
--    ・schools は「自組織が登録している学校」しか読めない（まだ紐付けていない）
--    ため、どちらも RLS に拒否されていた。つまり新規登録と比較校の追加は
--    Supabase を接続した時点で必ず失敗する状態だった。
--
--    ここでは id を先に gen_random_uuid() で決め、RETURNING を使わない。
--    「入れた直後にまだ読めない行を読み返す」形をやめる。
--
-- 関数にまとめることで 1〜2 を、RETURNING を使わないことで 3 を解決する。
-- security invoker（既定）なので RLS は呼び出した利用者の権限で効く。
-- 権限の判定はポリシー側に任せ、ここでは重複させない。

-- ===== 学校の追加 =====
create or replace function add_school_to_org(
  p_org_id uuid,
  p_name text,
  p_url text,
  p_role school_role,
  p_prefecture text default null,
  p_school_type text default null,
  p_coed_type text default null,
  p_has_junior_admission boolean default true,
  p_has_senior_admission boolean default true,
  p_has_affiliated_university boolean default false
) returns uuid
language plpgsql
as $$
declare
  -- id は先に決める。RETURNING で読み返すと、まだ紐付いていないため
  -- schools_read に拒否される（この関数を作った理由のひとつ）。
  new_school_id uuid := gen_random_uuid();
  next_order integer;
begin
  insert into schools (
    id, name, url, prefecture, school_type, coed_type,
    has_junior_admission, has_senior_admission, has_affiliated_university
  ) values (
    new_school_id, p_name, p_url, p_prefecture, p_school_type, p_coed_type,
    p_has_junior_admission, p_has_senior_admission, p_has_affiliated_university
  );

  -- 並び順は自校を先頭に、比較校は登録順に続ける
  if p_role = 'self' then
    next_order := 0;
  else
    select coalesce(max(sort_order), 0) + 1 into next_order
    from org_schools where org_id = p_org_id;
  end if;

  insert into org_schools (org_id, school_id, role, sort_order)
  values (p_org_id, new_school_id, p_role, next_order);

  return new_school_id;
end;
$$;

comment on function add_school_to_org is
  '学校の作成と組織への紐付けを1トランザクションで行う。途中で失敗しても行が残らない。';

-- ===== 学校法人の作成（初回登録） =====
--
-- 作った人が管理者になる。組織を作った直後は自分しかいないため。
-- schools_insert は「どこかの組織の管理者であること」を求めるが、
-- 同じトランザクション内で先に所属を作っているので条件を満たす。
create or replace function create_organization_with_school(
  p_org_name text,
  p_name text,
  p_url text,
  p_prefecture text default null,
  p_school_type text default null,
  p_coed_type text default null,
  p_has_junior_admission boolean default true,
  p_has_senior_admission boolean default true,
  p_has_affiliated_university boolean default false
) returns uuid
language plpgsql
as $$
declare
  -- 同じ理由で id を先に決める。組織はまだ自分の所属ではないので読み返せない。
  new_org_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  insert into organizations (id, name) values (new_org_id, p_org_name);

  insert into organization_members (org_id, user_id, role)
  values (new_org_id, auth.uid(), 'admin');

  perform add_school_to_org(
    new_org_id, p_name, p_url, 'self'::school_role,
    p_prefecture, p_school_type, p_coed_type,
    p_has_junior_admission, p_has_senior_admission, p_has_affiliated_university
  );

  return new_org_id;
end;
$$;

comment on function create_organization_with_school is
  '学校法人・管理者・自校をまとめて作る。途中で失敗すると何も残らない（行き止まりを作らない）。';
