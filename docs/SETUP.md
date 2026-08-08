# セットアップ手順書

School Insight AI を実際の学校データで動かすまでの手順。

自動化できるところは `npm run` に寄せてある。この文書に残っているのは、
**外部サービスの画面でしか取得できないもの**と、**学校ごとに決める必要があるもの**だけ。

どこまで済んだかは、いつでも次のコマンドで確認できる。

```bash
npm run doctor
```

---

## 全体の流れ

| | 作業 | 所要 | 自動化 |
|---|---|---|---|
| 0 | 動かしてみる（設定なし） | すぐ | 自動 |
| 1 | Supabase プロジェクトを作る | 人 | — |
| 2 | 接続情報を `.env.local` に書く | 人 | 雛形は自動生成 |
| 3 | データベースを作る | — | `npm run db:migrate` |
| 4 | Claude API キーを取る | 人 | — |
| 5 | 学校を登録する | 人 | 画面から |
| 6 | 最初の走査を流す | — | `npm run scan:due -- --run` |
| 7 | デプロイと自動実行 | 人 | cron 定義は同梱 |

---

## 置く場所の選び方

| | 置く場所 | できること |
|---|---|---|
| 画面を見せたいだけ | GitHub Pages | サンプルデータの表示と操作 |
| 実際に運用する | Vercel など | ログイン・走査・LLM判定・自動実行 |

GitHub Pages はファイルを配るだけでサーバを持たない。走査（外部サイトへのアクセス）、
LLM判定、ログイン、データの保存はいずれもサーバが要るため、Pages では動かない。

公開デモを出すには、GitHub の **Settings → Pages → Source** を「GitHub Actions」にして
`main` に push するだけ。あとは `.github/workflows/pages.yml` が公開する。
URL は `https://<ユーザー名>.github.io/homepage_check/`。

**この手順書の 1. 以降は「実際に運用する」場合の作業。**
画面を見せるだけなら、上の公開デモで足りる。

---

## 0. まず動かしてみる（設定不要）

```bash
npm install
npm run dev
```

<http://localhost:3000> が開く。この状態では `prototype.html` 由来のサンプルデータが表示され、
画面上部に「サンプルデータを表示しています」と出る。学校名・数値・判定結果はすべて架空。

**設定を何もしなくても全画面が動く**ので、まず触って構造を掴んでから 1. に進むとよい。

---

## 1. Supabase プロジェクトを作る（人の作業）

<https://supabase.com> でプロジェクトを作成する。

- **Region** … 日本の学校サイトを対象にするので `Northeast Asia (Tokyo)` を推奨
- **Database Password** … このあと `DATABASE_URL` に含まれる。控えておく

### 認証の設定

Authentication → Providers → **Email** を有効にする。

| 設定 | 推奨 | 理由 |
|---|---|---|
| Confirm email | **有効** | 学校の担当者以外が勝手に登録するのを防ぐ |
| Site URL | 本番URL（開発中は `http://localhost:3000`） | 確認メールのリンク先になる |
| Redirect URLs | 上と同じ | ここに無いURLへは戻せない |

> Confirm email を有効にすると、新規登録の直後はログイン状態になりません。
> アプリはその場合「確認メールを送りました」と案内します。

---

## 2. 接続情報を `.env.local` に書く

雛形を作る。`CRON_SECRET` はここで生成されるので、自分で考える必要はない。

```bash
npm run init:env
```

生成された `.env.local` を開き、次の4つを埋める。

### Supabase の3つ

Supabase の管理画面 → **Project Settings → API**

| 変数 | 画面上の名前 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` `secret` |

> `service_role` は RLS を迂回します。**ブラウザに渡してはいけません。**
> 変数名に `NEXT_PUBLIC_` を付けないこと（付けるとクライアントに埋め込まれます）。

### データベース接続（マイグレーション用）

Supabase の管理画面 → **Project Settings → Database → Connection string → URI**

```
DATABASE_URL=postgresql://postgres.xxxx:【パスワード】@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

`[YOUR-PASSWORD]` の部分を 1. で控えたパスワードに置き換える。
これは `npm run db:migrate` でしか使わないので、本番環境に設定する必要はない。

### クロール時の名乗り

```
CRAWL_USER_AGENT=SchoolInsightBot/1.0 (+https://自校のドメイン/contact)
```

**必ず自校の連絡先URLに書き換える。** 比較校のサイトにアクセスする以上、
相手が問い合わせ先を辿れる状態にしておく必要がある。
`example.com` のままだと `npm run doctor` が要対応として報告する。

---

## 3. データベースを作る

```bash
npm run db:migrate
```

`supabase/migrations/` の SQL を番号順に適用し、調査項目31件のシードを流す。

- 適用済みは `schema_migrations` に記録され、**再実行しても二重には流れない**
- 途中で失敗したファイルは丸ごと巻き戻る
- 何が流れるか先に見たいときは `npm run db:migrate -- --dry`

適用済みの SQL を後から編集すると、次回の実行で止まる。
DB には既に流れたものが残っているため、**変更は新しい番号のファイルとして追加する。**

確認：

```bash
npm run doctor
```

「マイグレーション 6件すべて適用済み」「調査項目 31件」と出れば完了。

---

## 4. Claude API キーを取る（人の作業）

<https://console.anthropic.com> でキーを発行し、`.env.local` に書く。

```
ANTHROPIC_API_KEY=sk-ant-...
```

未設定でも動くが、**判定はすべて `unknown`（判定できず）になる。**
05 ペルソナ仮説と 06 照会欄も使えない。

### 費用の見積もり

判定数は **31項目 × 校数 × 走査回数**。既定（自校 週次／比較校 月次・比較4校）で
**月248判定**。この数字は 09 設定画面にその場で表示され、頻度を変えると即座に更新される。

抑えたい場合、設定画面から次を調整できる。

| 設定 | 既定 | 効果 |
|---|---|---|
| 比較校の走査頻度 | 月次 | 週次にすると判定数が4倍 |
| 思考深度 | low | 上げるほど精度もコストも上がる |
| 1ページの本文上限 | 2,500字 | 入力トークンに直結 |
| 1項目の候補ページ数 | 5 | 同上 |

---

## 5. 学校を登録する（人の作業）

```bash
npm run dev
```

1. <http://localhost:3000> を開くと `/signin` に飛ぶ
2. 「新規登録はこちら」からメールアドレスとパスワード（8文字以上）で登録
3. 確認メールのリンクを開いてからログイン
4. `/onboarding` で **学校法人名と自校** を登録する。登録した人が管理者になる
5. `08 学校と比較校` で比較校を追加する（**5校まで**）

### 比較校の選び方

同じ層を志望する学校を選ぶ。判定は「公開しているかどうか」の事実だけを記録し、
**教育内容や運営の優劣は評価しない。** 比較校として登録した事実が相手校に伝わることもない。

### 併設大学の有無だけは判定に効く

内部進学の項目（F5）が「該当なし」になるか「掲載の欠落」になるかが変わる。
ここだけは正確に入力する。

---

## 6. 最初の走査を流す

```bash
npm run scan:due          # 対象を確認するだけ
npm run scan:due -- --run # 実際に走査する
```

1校だけ試すなら：

```bash
npm run scan -- --url https://example.ed.jp --name 学校名 --role self
```

走査は **robots.txt を必ず尊重する。** 拒否されている学校は走査せず、判定は `unknown` になる
（「情報がない」とは扱わない）。リクエスト間隔と同時接続数も設定で制限している。

走査が1回終わると、画面のサンプルデータ表示が実データに切り替わる。

> 01 の「比較校の更新記録」は**2回目の走査から**表示される。
> 1回目は比べる相手がないため、その旨が画面に出る。

---

## 7. デプロイと自動実行（人の作業）

### Vercel

1. GitHub リポジトリを Vercel に接続する
2. **Settings → Environment Variables** に次を設定する（`DATABASE_URL` は不要）

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
CRAWL_USER_AGENT
CRON_SECRET          ← .env.local と同じ値
```

3. デプロイすると `vercel.json` の cron が自動で登録される（1時間ごと `/api/cron/scan`）

`CRON_SECRET` が未設定だと自動実行は無効（503）になる。
走査は外部サイトへのリクエストを伴うため、誰でも叩ける口は開けていない。

### Supabase の Site URL を本番URLに変える

1. で `localhost` にしていた場合、Authentication → URL Configuration を本番URLに変更する。
変えないと確認メールのリンクがローカルを指したままになる。

### Vercel を使わない場合

`/api/cron/scan` を1時間ごとに叩くだけでよい。crontab の例：

```cron
0 * * * * curl -fsS -X POST -H "authorization: Bearer $CRON_SECRET" https://【本番URL】/api/cron/scan
```

あるいはアプリを動かしているサーバで直接：

```cron
0 * * * * cd /path/to/app && npm run scan:due -- --run
```

### 失敗したときの通知（任意）

09 設定画面の **ST-04 自動実行と通知** に Webhook URL（https のみ）を設定すると、
走査に失敗したときだけ通知が飛ぶ。Slack・Google Chat・自前の受け口のいずれでも使える。

- 通知に載るのは**学校名・結末・理由だけ**。ページ本文は送らない
- 毎回は送らない。失敗があったときだけ送る
- 通知先が未設定でも、実行の記録は設定画面に残る

---

## 運用で人が判断すること

自動化していない、あるいはできないもの。

### 検索順位の記録（04 SE-01）

順位計測APIのベンダーが未決のため、**手動記録**にしてある。
04 の画面から、キーワード・自校順位・比較校の最上位を入力する。

Google Search Console の「検索パフォーマンス」から拾うのが手軽。
ベンダーを決めれば自動取得に差し替えられる形にしてある。

### 03 導線の実測のうち、操作が要るもの

説明会申込までのクリック数など、実際に操作しないと測れない項目がある。
09 設定の測定条件（MS-05）に、どれが走査由来でどれが操作由来かを明示している。

### 表示速度

外部の測定ツールに依存し、測るたびに値が変動する。レポートにもその旨を注記している。

---

## 困ったとき

```bash
npm run doctor
```

判定は3段階に分かれている。

| | 意味 |
|---|---|
| ✓ | 設定済みで、実際に疎通した |
| − | 設定していない。その機能を使わない選択なら問題ない |
| ✗ | 設定してあるのに動かない。手を入れる必要がある |

### よくある状態

**画面がサンプルデータのまま**
→ Supabase 未接続か、まだ1回も走査していない。`npm run doctor` の「走査の実績」を見る。

**判定がすべて「判定できず」になる**
→ `ANTHROPIC_API_KEY` 未設定。あるいは走査が robots.txt で拒否されている。
どちらなのかは 09 設定画面の直近の実行記録で分かる。

**`npm run db:migrate` が「内容が変わっています」で止まる**
→ 適用済みの SQL を編集している。編集を戻し、変更は新しい番号のファイルとして追加する。

**自動実行が動かない**
→ `/api/cron/scan` が 503 なら `CRON_SECRET` 未設定、401 なら値の不一致。
09 設定画面の ST-04 に有効かどうかが出る。

**ログイン後も他校のデータが見えない／自校のデータが見えない**
→ 組織単位の分離は Postgres の RLS で行っている。
`0002_rls.sql` と `0006_auth.sql` が適用されているかを `npm run doctor` で確認する。
