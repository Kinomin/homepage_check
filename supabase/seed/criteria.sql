-- 自動生成ファイル。編集しないこと。
-- 生成元: src/lib/analysis/criteria.ts
-- 生成コマンド: npx tsx scripts/generate-criteria-seed.ts

insert into criteria (
  id, category, label, audience, judge_prompt, aliases, path_hints, applicable_when, special_rule, sort_order
) values
  ('A1', 'A', '建学の精神・教育理念', '保護者・塾', '学校の建学の精神・教育理念・校訓を説明したページがあるか。理念の言葉だけでなく、それが何を指すのか（対応する取り組み・行事・授業へのリンクや説明）まで書かれていれば full。理念の文章のみなら mid。他ページ内に一文あるだけなら thin。', ARRAY['建学の精神', '教育理念', '校訓', '本校について', '教育方針']::text[], ARRAY['/about', '/philosophy', '/policy', '/spirit', '/idea']::text[], null, null, 0),
  ('A2', 'A', '校長・学園長挨拶', '保護者', '校長・学園長・理事長のいずれかによる挨拶文が掲載されているか。独立ページで本人の言葉として掲載されていれば full。学校紹介ページ内の短い挨拶なら mid。', ARRAY['校長挨拶', '学園長挨拶', 'ごあいさつ', '理事長メッセージ']::text[], ARRAY['/about', '/greeting', '/message', '/principal']::text[], null, null, 1),
  ('A3', 'A', 'スクールポリシー（3つの方針）', '保護者・塾', '育成を目指す資質・能力／教育課程の編成・実施／入学者の受入れ の3つの方針を示しているか。3方針が揃って独立ページにあれば full。理念ページ内に記載があれば mid。高校での策定が求められている項目で、今後標準化していく。', ARRAY['スクールポリシー', '3つの方針', 'グラデュエーションポリシー', 'アドミッションポリシー']::text[], ARRAY['/about', '/policy', '/school-policy']::text[], null, null, 2),
  ('B1', 'B', '6年間のカリキュラム・教育課程', '保護者', '学年ごとの教育課程・単位配当・コース編成が分かる説明があるか。表や図で学年別に示されていれば full。全体方針の文章のみなら mid。', ARRAY['カリキュラム', '教育課程', '学びの6年間', 'コース紹介']::text[], ARRAY['/education', '/curriculum', '/course', '/study']::text[], null, null, 3),
  ('B2', 'B', '探究学習', '保護者・塾', '生徒が自ら課題を設定して調査・考察し発表する活動（探究・課題研究・論文・ゼミ等）の紹介があるか。名称は学校ごとに全く異なるため、名称ではなく活動内容で判定すること。独立した紹介ページがあり、取り組みの流れや生徒のテーマが分かれば full。行事一覧に発表会名があるだけなら thin。', ARRAY['探究学習', '自調自考論文', '総合学習', '探究コース', '課題研究', 'ゼミ']::text[], ARRAY['/education', '/inquiry', '/research', '/study', '/program']::text[], null, null, 4),
  ('B3', 'B', 'グローバル教育・英語・留学', '受験生・保護者', '英語教育の特色、海外研修・留学制度・提携校・国際交流のいずれかについての説明があるか。独立ページで制度や実績まで分かれば full。行事一覧に海外研修が数行あるだけなら thin。', ARRAY['グローバル教育', '国際教育', '英語教育', '留学', '海外研修']::text[], ARRAY['/global', '/international', '/english', '/education', '/study-abroad']::text[], null, null, 5),
  ('B4', 'B', 'ICT教育・1人1台端末', '保護者', '端末の導入状況、授業での使い方、家庭での扱い（持ち帰り・費用負担・制限）についての説明があるか。使い方まで説明されていれば full。導入の事実のみなら mid。', ARRAY['ICT教育', '一人一台', 'iPad', 'BYOD', 'デジタル学習']::text[], ARRAY['/education', '/ict', '/digital']::text[], null, null, 6),
  ('B5', 'B', '学習サポート・補習体制', '保護者', '補習・個別指導・小テスト・面談・自習環境など、日常の学習フォローに関する説明があるか。名称は学校ごとに異なるため内容で判定する。独立ページで頻度や体制まで分かれば full。保護者の検索が最も多い項目のひとつ。', ARRAY['学習フォロー体制', '学習支援プログラム', '特別講座', 'サポート体制', '進学指導']::text[], ARRAY['/education', '/support', '/study', '/course']::text[], null, null, 7),
  ('C1', 'C', '年間行事', '受験生', '年間の学校行事が一覧または月別で掲載されているか。写真や説明が添えられていれば full。名称の羅列のみなら mid。', ARRAY['年間行事', '学校行事', 'イベント', 'スクールライフ']::text[], ARRAY['/school-life', '/event', '/calendar', '/campuslife']::text[], null, null, 8),
  ('C2', 'C', '部活動の個別ページ', '受験生', '部活動が部ごとに独立したページまたは十分な分量の紹介を持つか。活動日・実績・写真が部ごとに揃っていれば full。一覧表に名称と実績が並ぶだけなら mid。', ARRAY['部活動', 'クラブ活動', '課外活動']::text[], ARRAY['/club', '/school-life', '/activity', '/bukatsu']::text[], null, null, 9),
  ('C3', 'C', '施設・設備', '受験生', '教室・図書室・実験室・体育施設・食堂などの校内施設の紹介があるか。名称は学校ごとに異なる。複数の施設が写真と説明で紹介されていれば full。校舎外観の写真が数点あるだけなら thin。', ARRAY['施設・設備', '施設紹介', '施設案内', 'キャンパスマップ', '学校案内']::text[], ARRAY['/about', '/facility', '/campus', '/school-life']::text[], null, null, 10),
  ('C4', 'C', '制服紹介', '受験生', '制服の紹介があるか。夏服・冬服・体育着などの着用写真と説明が揃っていれば full。写真1点のみなら thin。', ARRAY['制服', 'ユニフォーム', '標準服']::text[], ARRAY['/school-life', '/uniform', '/about']::text[], null, null, 11),
  ('C5', 'C', '1日の流れ・時程', '受験生', '登校から下校までの時程・1日の過ごし方の説明があるか。時程表に加えて放課後の過ごし方など文章の説明があれば full。時程表の画像1点のみなら mid。', ARRAY['1日の流れ', '時程', 'デイリースケジュール', 'ある一日']::text[], ARRAY['/school-life', '/schedule', '/day']::text[], null, null, 12),
  ('C6', 'C', '在校生の声', '受験生', '在校生本人の一人称の発言（インタビュー・コメント・体験記）がサイト内に存在するか。掲載場所は問わない。生徒名や学年とともに本人の言葉が複数掲載されていれば full。1〜2件のコメントが他ページに埋め込まれている場合も mid 以上として扱う。', ARRAY['在校生の声', '生徒紹介', '生徒インタビュー', '生徒の活躍']::text[], ARRAY['/school-life', '/student', '/voice', '/interview', '/education']::text[], null, '独立ページの有無で判定しない。実在6校のうち専用ページを持つのは1校のみで、探究・留学の紹介ページ内に埋め込む形が主流。独立ページで判定すると「あるのに、ない」と誤判定する。', 13),
  ('C7', 'C', '授業風景の写真・動画', '受験生', '授業中の様子が分かる写真・動画があるか。生徒が写っている授業写真が複数点あれば full。設備のみの写真や数点のみなら thin。判定には画像点数を根拠として保存すること。', ARRAY['授業風景', '学びの様子', '授業紹介']::text[], ARRAY['/education', '/school-life', '/curriculum']::text[], null, null, 14),
  ('D1', 'D', '進学実績（過去3年）', '保護者・塾', '大学合格実績が掲載されているか。過去3年分あり、大学別・現役／既卒別など内訳が整理されていれば full。直近1年のみ・主要大学のみなら mid。', ARRAY['進学実績', '合格実績', '進路状況', '大学合格状況']::text[], ARRAY['/course', '/career', '/results', '/shinro']::text[], null, null, 15),
  ('D2', 'D', '進路指導・進路サポート', '保護者', '進路指導の方針・体制の説明があるか。学年ごとに何を行うかまで書かれていれば full。方針の文章のみなら mid。', ARRAY['進路指導', '進路サポート', 'キャリア教育']::text[], ARRAY['/course', '/career', '/guidance']::text[], null, null, 16),
  ('D3', 'D', '卒業生の声', '受験生・保護者', '卒業生本人の言葉（インタビュー・メッセージ）が掲載されているか。氏名と進学先の一覧だけで本人の言葉がない場合は thin。', ARRAY['卒業生の声', 'OB・OG', '先輩からのメッセージ', '卒業生インタビュー']::text[], ARRAY['/course', '/career', '/graduate', '/ob', '/voice']::text[], null, null, 17),
  ('D4', 'D', '系列大学への内部進学・推薦制度', '保護者', '系列・附属大学への内部進学制度、推薦枠、進学率の説明があるか。独立ページで制度と進学率が分かれば full。募集要項PDF内に1行あるだけなら thin。', ARRAY['内部進学', '推薦制度', '系列大学', '併設大学への進学']::text[], ARRAY['/course', '/career', '/university', '/admission']::text[], 'has_affiliated_university', '系列大学を持たない学校は n/a。欠落として数えない（handoff.md 4章）。', 18),
  ('E1', 'E', '学費（ページ本文への掲載）', '保護者', '学費・納入金の金額が HTML ページの本文に掲載されているか。名称は学校ごとに異なるため内容で判定する。金額の表がページ上にあれば full。PDF のみでページ上に金額の記載がない場合は thin（スマートフォンで読めず、検索の対象にもならないため）。', ARRAY['学費', '諸費用', '学納金', '入学金・学費', '授業料等']::text[], ARRAY['/admission', '/fee', '/tuition', '/nyushi']::text[], null, null, 19),
  ('E2', 'E', '奨学金・特待制度', '保護者', '奨学金・特待生制度・授業料減免の条件が掲載されているか。独立ページで条件ごとに整理されていれば full。学費PDFの末尾に条件が書かれているだけなら thin。', ARRAY['奨学金', '特待生', '授業料減免', '奨学制度']::text[], ARRAY['/admission', '/fee', '/scholarship', '/support']::text[], null, null, 20),
  ('E3', 'E', '学校評価・安全対策', '保護者', '学校評価（自己評価・学校関係者評価）の公開、またはいじめ対策・相談窓口・安全対策の説明があるか。独立ページで公開されていれば full。報告書PDFのみなら thin。', ARRAY['学校評価', '学校自己評価', 'いじめ防止基本方針', '安全対策']::text[], ARRAY['/about', '/report', '/evaluation', '/safety', '/disclosure']::text[], null, null, 21),
  ('F1', 'F', '募集要項（一般・帰国生）', '保護者・塾', '入試の募集要項（日程・科目・配点・出願方法）が掲載されているか。学校が募集している課程（中学／高校）の要項が揃い、帰国生入試を実施している場合はその要項もあれば full。', ARRAY['募集要項', '入学者選抜要項', '入試概要', '生徒募集要項']::text[], ARRAY['/admission', '/nyushi', '/exam', '/entrance']::text[], null, '中学／高校／帰国生で系統が分かれる。has_junior_admission / has_senior_admission に応じて判定対象を変える（handoff.md 4章）。', 22),
  ('F2', 'F', '説明会の日程・申込', '保護者', '学校説明会・オープンスクールの日程と申込方法が掲載されているか。日程ごとに申込ボタン等の明確な導線があれば full。本文中のテキストリンクのみ、または申込方法が不明瞭なら thin。外部予約サービスへ遷移すること自体は業界標準であり、減点材料にしない。', ARRAY['学校説明会', 'オープンスクール', '説明会日程', '入試説明会', '体験入学']::text[], ARRAY['/admission', '/briefing', '/event', '/open', '/setsumeikai']::text[], null, null, 23),
  ('F3', 'F', '塾・教育関係者対象説明会', '塾', '塾・教育関係者を対象とした説明会の案内があるか。独立ページで日程・申込方法が示されていれば full。他の説明会ページ内に日程が1行あるだけなら thin。', ARRAY['塾対象説明会', '教育関係者対象', '学習塾の皆様へ']::text[], ARRAY['/admission', '/briefing', '/juku', '/for-teachers']::text[], null, null, 24),
  ('F4', 'F', '合同相談会・外部フェアの日程掲載', '保護者', '自校が出展する合同相談会・進学フェアなど校外イベントの日程が掲載されているか。日付順の一覧があれば full。1〜2件のお知らせのみなら thin。', ARRAY['合同相談会', '進学フェア', '私学展', '外部イベント出展']::text[], ARRAY['/admission', '/event', '/news', '/fair']::text[], null, null, 25),
  ('F5', 'F', '入試データ（結果・出願状況・過去問）', '塾', '入試結果（受験者数・合格者数・実質倍率）、出願状況、過去問のいずれかが公開されているか。3年分の入試結果と過去問が揃っていれば full。過去問のみなら thin。業界全体でも公開校は多くないため、公開していないこと自体を欠陥として記述しない。', ARRAY['入試結果', '入試データ', '過去問', '出願状況']::text[], ARRAY['/admission', '/exam', '/past', '/result', '/data']::text[], null, null, 26),
  ('F6', 'F', 'アクセス・通学', '保護者', '所在地・最寄駅・地図に加えて、主要駅からの所要時間・利用可能路線・通学圏の説明があるか。通学の判断ができる情報まで揃っていれば full。地図と最寄駅からの徒歩分数のみなら mid。', ARRAY['アクセス', '交通', '通学', '所在地']::text[], ARRAY['/access', '/about', '/map', '/location']::text[], null, null, 27),
  ('G1', 'G', 'デジタルパンフレット・資料請求', '保護者', 'その場で読める学校案内（PDF・電子ブック）があるか、または資料請求の導線があるか。デジタルパンフレットが公開されていれば full。郵送用の資料請求フォームのみなら mid（読み手が求めているのは郵送ではなく、いま読めること）。', ARRAY['デジタルパンフレット', '学校案内', '資料請求', 'パンフレット']::text[], ARRAY['/admission', '/request', '/pamphlet', '/document', '/digital']::text[], null, null, 28),
  ('G2', 'G', '公式SNS（媒体と導線）', '受験生', '公式SNSアカウントへの導線がサイト上にあるか。複数媒体を運用し、フッター以外にも導線があれば full。フッターにアイコンが1つあるだけなら thin。', ARRAY['公式SNS', 'Instagram', 'X', 'YouTube', 'LINE公式アカウント']::text[], ARRAY['/', '/sns', '/social']::text[], null, null, 29),
  ('G3', 'G', 'ブログ・お知らせ', '受験生・保護者', 'お知らせ・ブログが更新されているか。直近90日に更新があり、学校の様子が伝わる記事（事務連絡以外）が含まれ、カテゴリ分けされていれば full。更新はあるが事務連絡が大半なら mid。判定には直近90日の件数と内訳を根拠として保存すること。', ARRAY['お知らせ', 'ニュース', 'ブログ', 'トピックス', '日誌']::text[], ARRAY['/news', '/blog', '/topics', '/information']::text[], null, null, 30)
on conflict (id) do update set
  category = excluded.category,
  label = excluded.label,
  audience = excluded.audience,
  judge_prompt = excluded.judge_prompt,
  aliases = excluded.aliases,
  path_hints = excluded.path_hints,
  applicable_when = excluded.applicable_when,
  special_rule = excluded.special_rule,
  sort_order = excluded.sort_order;
