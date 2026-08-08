-- テーブル・関数の権限が誰にも付与されていなかった
--
-- RLS ポリシーは「行を絞る」ものであって、「権限を与える」ものではない。
-- Postgres はまず GRANT で操作そのものが許されているかを見て、
-- 許されていればそのうえで RLS が行を絞る。GRANT が無ければ、
-- ポリシーがどう書いてあっても "permission denied for table ..." で止まる。
--
-- 0001〜0010 は一度も GRANT を書いていなかった。学校登録（/onboarding）で
-- 呼ぶ `create_organization_with_school` は security invoker（0009 のコメントの
-- とおり）なので、実行するユーザー本人が organizations 等への INSERT 権限を
-- 持っている必要があるが、その権限が無かったため新規登録が
-- 「permission denied for table organizations」で失敗していた。
--
-- 対象は authenticated のみ。ポリシーはすべて `to authenticated` で書かれており
-- （anon 向けのポリシーは無い）、anon に権限だけ与えても読める行が無い。
-- service_role は RLS を迂回するが、テーブルの GRANT 自体は別に必要なため含める。

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

grant all
  on all tables in schema public
  to service_role;

grant execute
  on all functions in schema public
  to authenticated, service_role;

-- 以後のマイグレーション（0012〜）で新しく作るテーブル・関数にも、
-- 同じ役割の GRANT を毎回書かなくて済むようにする。
-- この db:migrate を実行する接続ユーザーが以後も作成者になるので、
-- role 指定なしの ALTER DEFAULT PRIVILEGES で十分。
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant execute on functions to authenticated, service_role;
