/**
 * 調査項目 31件（handoff.md 4章）。criteria テーブルの初期投入元。
 *
 * 重要：`aliases` は判定条件ではない。学校ごとに名称が全く異なるため、
 * 語句一致で判定してはならない（handoff.md 4章「判定ルール」）。
 * ここに書いた別名は
 *   - 候補ページ抽出（ルールベースの絞り込み）のヒント
 *   - 02 画面の「判定方式の説明カード」の表示
 * のためだけに使う。該当するかどうかはページ内容から LLM が判定する。
 */

import type { Criterion } from '../types';

export const CRITERIA: Criterion[] = [
  {
    id: 'A1',
    category: 'A',
    label: '建学の精神・教育理念',
    audience: '保護者・塾',
    judgePrompt:
      '学校の建学の精神・教育理念・校訓を説明したページがあるか。理念の言葉だけでなく、それが何を指すのか（対応する取り組み・行事・授業へのリンクや説明）まで書かれていれば full。理念の文章のみなら mid。他ページ内に一文あるだけなら thin。',
    aliases: ['建学の精神', '教育理念', '校訓', '本校について', '教育方針'],
    pathHints: ['/about', '/philosophy', '/policy', '/spirit', '/idea'],
  },
  {
    id: 'A2',
    category: 'A',
    label: '校長・学園長挨拶',
    audience: '保護者',
    judgePrompt:
      '校長・学園長・理事長のいずれかによる挨拶文が掲載されているか。独立ページで本人の言葉として掲載されていれば full。学校紹介ページ内の短い挨拶なら mid。',
    aliases: ['校長挨拶', '学園長挨拶', 'ごあいさつ', '理事長メッセージ'],
    pathHints: ['/about', '/greeting', '/message', '/principal'],
  },
  {
    id: 'A3',
    category: 'A',
    label: 'スクールポリシー（3つの方針）',
    audience: '保護者・塾',
    judgePrompt:
      '育成を目指す資質・能力／教育課程の編成・実施／入学者の受入れ の3つの方針を示しているか。3方針が揃って独立ページにあれば full。理念ページ内に記載があれば mid。高校での策定が求められている項目で、今後標準化していく。',
    aliases: ['スクールポリシー', '3つの方針', 'グラデュエーションポリシー', 'アドミッションポリシー'],
    pathHints: ['/about', '/policy', '/school-policy'],
  },

  {
    id: 'B1',
    category: 'B',
    label: '6年間のカリキュラム・教育課程',
    audience: '保護者',
    judgePrompt:
      '学年ごとの教育課程・単位配当・コース編成が分かる説明があるか。表や図で学年別に示されていれば full。全体方針の文章のみなら mid。',
    aliases: ['カリキュラム', '教育課程', '学びの6年間', 'コース紹介'],
    pathHints: ['/education', '/curriculum', '/course', '/study'],
  },
  {
    id: 'B2',
    category: 'B',
    label: '探究学習',
    audience: '保護者・塾',
    judgePrompt:
      '生徒が自ら課題を設定して調査・考察し発表する活動（探究・課題研究・論文・ゼミ等）の紹介があるか。名称は学校ごとに全く異なるため、名称ではなく活動内容で判定すること。独立した紹介ページがあり、取り組みの流れや生徒のテーマが分かれば full。行事一覧に発表会名があるだけなら thin。',
    aliases: [
      '探究学習',
      '自調自考論文',
      '総合学習',
      '総合的な学習の時間',
      '探究コース',
      '課題研究',
      'ゼミ',
    ],
    pathHints: ['/education', '/inquiry', '/research', '/study', '/program'],
  },
  {
    id: 'B3',
    category: 'B',
    label: 'グローバル教育・英語・留学',
    audience: '受験生・保護者',
    judgePrompt:
      '英語教育の特色、海外研修・留学制度・提携校・国際交流のいずれかについての説明があるか。独立ページで制度や実績まで分かれば full。行事一覧に海外研修が数行あるだけなら thin。',
    aliases: ['グローバル教育', '国際教育', '英語教育', '留学', '海外研修'],
    pathHints: ['/global', '/international', '/english', '/education', '/study-abroad'],
  },
  {
    id: 'B4',
    category: 'B',
    label: 'ICT教育・1人1台端末',
    audience: '保護者',
    judgePrompt:
      '端末の導入状況、授業での使い方、家庭での扱い（持ち帰り・費用負担・制限）についての説明があるか。使い方まで説明されていれば full。導入の事実のみなら mid。',
    aliases: ['ICT教育', '一人一台', 'iPad', 'BYOD', 'デジタル学習'],
    pathHints: ['/education', '/ict', '/digital'],
  },
  {
    id: 'B5',
    category: 'B',
    label: '学習サポート・補習体制',
    audience: '保護者',
    judgePrompt:
      '補習・個別指導・小テスト・面談・自習環境など、日常の学習フォローに関する説明があるか。名称は学校ごとに異なるため内容で判定する。独立ページで頻度や体制まで分かれば full。保護者の検索が最も多い項目のひとつ。',
    aliases: ['学習フォロー体制', '学習支援プログラム', '特別講座', 'サポート体制', '進学指導'],
    pathHints: ['/education', '/support', '/study', '/course'],
  },

  {
    id: 'C1',
    category: 'C',
    label: '年間行事',
    audience: '受験生',
    judgePrompt:
      '年間の学校行事が一覧または月別で掲載されているか。写真や説明が添えられていれば full。名称の羅列のみなら mid。',
    aliases: ['年間行事', '学校行事', 'イベント', 'スクールライフ'],
    pathHints: ['/school-life', '/event', '/calendar', '/campuslife'],
  },
  {
    id: 'C2',
    category: 'C',
    label: '部活動の個別ページ',
    audience: '受験生',
    judgePrompt:
      '部活動が部ごとに独立したページまたは十分な分量の紹介を持つか。活動日・実績・写真が部ごとに揃っていれば full。一覧表に名称と実績が並ぶだけなら mid。',
    aliases: ['部活動', 'クラブ活動', '課外活動'],
    pathHints: ['/club', '/school-life', '/activity', '/bukatsu'],
  },
  {
    id: 'C3',
    category: 'C',
    label: '施設・設備',
    audience: '受験生',
    judgePrompt:
      '教室・図書室・実験室・体育施設・食堂などの校内施設の紹介があるか。名称は学校ごとに異なる。複数の施設が写真と説明で紹介されていれば full。校舎外観の写真が数点あるだけなら thin。',
    aliases: ['施設・設備', '施設紹介', '施設案内', 'キャンパスマップ', '学校案内'],
    pathHints: ['/about', '/facility', '/campus', '/school-life'],
  },
  {
    id: 'C4',
    category: 'C',
    label: '制服紹介',
    audience: '受験生',
    judgePrompt:
      '制服の紹介があるか。夏服・冬服・体育着などの着用写真と説明が揃っていれば full。写真1点のみなら thin。',
    aliases: ['制服', 'ユニフォーム', '標準服'],
    pathHints: ['/school-life', '/uniform', '/about'],
  },
  {
    id: 'C5',
    category: 'C',
    label: '1日の流れ・時程',
    audience: '受験生',
    judgePrompt:
      '登校から下校までの時程・1日の過ごし方の説明があるか。時程表に加えて放課後の過ごし方など文章の説明があれば full。時程表の画像1点のみなら mid。',
    aliases: ['1日の流れ', '時程', 'デイリースケジュール', 'ある一日'],
    pathHints: ['/school-life', '/schedule', '/day'],
  },
  {
    id: 'C6',
    category: 'C',
    label: '在校生の声',
    audience: '受験生',
    judgePrompt:
      '在校生本人の一人称の発言（インタビュー・コメント・体験記）がサイト内に存在するか。掲載場所は問わない。生徒名や学年とともに本人の言葉が複数掲載されていれば full。1〜2件のコメントが他ページに埋め込まれている場合も mid 以上として扱う。',
    aliases: ['在校生の声', '生徒紹介', '生徒インタビュー', '生徒の活躍'],
    pathHints: ['/school-life', '/student', '/voice', '/interview', '/education'],
    specialRule:
      '独立ページの有無で判定しない。実在6校のうち専用ページを持つのは1校のみで、探究・留学の紹介ページ内に埋め込む形が主流。独立ページで判定すると「あるのに、ない」と誤判定する。',
  },
  {
    id: 'C7',
    category: 'C',
    label: '授業風景の写真・動画',
    audience: '受験生',
    judgePrompt:
      '授業中の様子が分かる写真・動画があるか。生徒が写っている授業写真が複数点あれば full。設備のみの写真や数点のみなら thin。判定には画像点数を根拠として保存すること。',
    aliases: ['授業風景', '学びの様子', '授業紹介'],
    pathHints: ['/education', '/school-life', '/curriculum'],
  },

  {
    id: 'D1',
    category: 'D',
    label: '進学実績（過去3年）',
    audience: '保護者・塾',
    judgePrompt:
      '大学合格実績が掲載されているか。過去3年分あり、大学別・現役／既卒別など内訳が整理されていれば full。直近1年のみ・主要大学のみなら mid。',
    aliases: ['進学実績', '合格実績', '進路状況', '大学合格状況'],
    pathHints: ['/course', '/career', '/results', '/shinro'],
  },
  {
    id: 'D2',
    category: 'D',
    label: '進路指導・進路サポート',
    audience: '保護者',
    judgePrompt:
      '進路指導の方針・体制の説明があるか。学年ごとに何を行うかまで書かれていれば full。方針の文章のみなら mid。',
    aliases: ['進路指導', '進路サポート', 'キャリア教育'],
    pathHints: ['/course', '/career', '/guidance'],
  },
  {
    id: 'D3',
    category: 'D',
    label: '卒業生の声',
    audience: '受験生・保護者',
    judgePrompt:
      '卒業生本人の言葉（インタビュー・メッセージ）が掲載されているか。氏名と進学先の一覧だけで本人の言葉がない場合は thin。',
    aliases: ['卒業生の声', 'OB・OG', '先輩からのメッセージ', '卒業生インタビュー'],
    pathHints: ['/course', '/career', '/graduate', '/ob', '/voice'],
  },
  {
    id: 'D4',
    category: 'D',
    label: '系列大学への内部進学・推薦制度',
    audience: '保護者',
    judgePrompt:
      '系列・附属大学への内部進学制度、推薦枠、進学率の説明があるか。独立ページで制度と進学率が分かれば full。募集要項PDF内に1行あるだけなら thin。',
    aliases: ['内部進学', '推薦制度', '系列大学', '併設大学への進学'],
    pathHints: ['/course', '/career', '/university', '/admission'],
    applicableWhen: 'has_affiliated_university',
    specialRule: '系列大学を持たない学校は n/a。欠落として数えない（handoff.md 4章）。',
  },

  {
    id: 'E1',
    category: 'E',
    label: '学費（ページ本文への掲載）',
    audience: '保護者',
    judgePrompt:
      '学費・納入金の金額が HTML ページの本文に掲載されているか。名称は学校ごとに異なるため内容で判定する。金額の表がページ上にあれば full。PDF のみでページ上に金額の記載がない場合は thin（スマートフォンで読めず、検索の対象にもならないため）。',
    aliases: ['学費', '諸費用', '学納金', '入学金・学費', '授業料等'],
    pathHints: ['/admission', '/fee', '/tuition', '/nyushi'],
  },
  {
    id: 'E2',
    category: 'E',
    label: '奨学金・特待制度',
    audience: '保護者',
    judgePrompt:
      '奨学金・特待生制度・授業料減免の条件が掲載されているか。独立ページで条件ごとに整理されていれば full。学費PDFの末尾に条件が書かれているだけなら thin。',
    aliases: ['奨学金', '特待生', '授業料減免', '奨学制度'],
    pathHints: ['/admission', '/fee', '/scholarship', '/support'],
  },
  {
    id: 'E3',
    category: 'E',
    label: '学校評価・安全対策',
    audience: '保護者',
    judgePrompt:
      '学校評価（自己評価・学校関係者評価）の公開、またはいじめ対策・相談窓口・安全対策の説明があるか。独立ページで公開されていれば full。報告書PDFのみなら thin。',
    aliases: ['学校評価', '学校自己評価', 'いじめ防止基本方針', '安全対策'],
    pathHints: ['/about', '/report', '/evaluation', '/safety', '/disclosure'],
  },

  {
    id: 'F1',
    category: 'F',
    label: '募集要項（一般・帰国生）',
    audience: '保護者・塾',
    judgePrompt:
      '入試の募集要項（日程・科目・配点・出願方法）が掲載されているか。学校が募集している課程（中学／高校）の要項が揃い、帰国生入試を実施している場合はその要項もあれば full。',
    aliases: ['募集要項', '入学者選抜要項', '入試概要', '生徒募集要項'],
    pathHints: ['/admission', '/nyushi', '/exam', '/entrance'],
    specialRule:
      '中学／高校／帰国生で系統が分かれる。has_junior_admission / has_senior_admission に応じて判定対象を変える（handoff.md 4章）。',
  },
  {
    id: 'F2',
    category: 'F',
    label: '説明会の日程・申込',
    audience: '保護者',
    judgePrompt:
      '学校説明会・オープンスクールの日程と申込方法が掲載されているか。日程ごとに申込ボタン等の明確な導線があれば full。本文中のテキストリンクのみ、または申込方法が不明瞭なら thin。外部予約サービスへ遷移すること自体は業界標準であり、減点材料にしない。',
    aliases: ['学校説明会', 'オープンスクール', '説明会日程', '入試説明会', '体験入学'],
    pathHints: ['/admission', '/briefing', '/event', '/open', '/setsumeikai'],
  },
  {
    id: 'F3',
    category: 'F',
    label: '塾・教育関係者対象説明会',
    audience: '塾',
    judgePrompt:
      '塾・教育関係者を対象とした説明会の案内があるか。独立ページで日程・申込方法が示されていれば full。他の説明会ページ内に日程が1行あるだけなら thin。',
    aliases: ['塾対象説明会', '教育関係者対象', '学習塾の皆様へ'],
    pathHints: ['/admission', '/briefing', '/juku', '/for-teachers'],
  },
  {
    id: 'F4',
    category: 'F',
    label: '合同相談会・外部フェアの日程掲載',
    audience: '保護者',
    judgePrompt:
      '自校が出展する合同相談会・進学フェアなど校外イベントの日程が掲載されているか。日付順の一覧があれば full。1〜2件のお知らせのみなら thin。',
    aliases: ['合同相談会', '進学フェア', '私学展', '外部イベント出展'],
    pathHints: ['/admission', '/event', '/news', '/fair'],
  },
  {
    id: 'F5',
    category: 'F',
    label: '入試データ（結果・出願状況・過去問）',
    audience: '塾',
    judgePrompt:
      '入試結果（受験者数・合格者数・実質倍率）、出願状況、過去問のいずれかが公開されているか。3年分の入試結果と過去問が揃っていれば full。過去問のみなら thin。業界全体でも公開校は多くないため、公開していないこと自体を欠陥として記述しない。',
    aliases: ['入試結果', '入試データ', '過去問', '出願状況'],
    pathHints: ['/admission', '/exam', '/past', '/result', '/data'],
  },
  {
    id: 'F6',
    category: 'F',
    label: 'アクセス・通学',
    audience: '保護者',
    judgePrompt:
      '所在地・最寄駅・地図に加えて、主要駅からの所要時間・利用可能路線・通学圏の説明があるか。通学の判断ができる情報まで揃っていれば full。地図と最寄駅からの徒歩分数のみなら mid。',
    aliases: ['アクセス', '交通', '通学', '所在地'],
    pathHints: ['/access', '/about', '/map', '/location'],
  },

  {
    id: 'G1',
    category: 'G',
    label: 'デジタルパンフレット・資料請求',
    audience: '保護者',
    judgePrompt:
      'その場で読める学校案内（PDF・電子ブック）があるか、または資料請求の導線があるか。デジタルパンフレットが公開されていれば full。郵送用の資料請求フォームのみなら mid（読み手が求めているのは郵送ではなく、いま読めること）。',
    aliases: ['デジタルパンフレット', '学校案内', '資料請求', 'パンフレット'],
    pathHints: ['/admission', '/request', '/pamphlet', '/document', '/digital'],
  },
  {
    id: 'G2',
    category: 'G',
    label: '公式SNS（媒体と導線）',
    audience: '受験生',
    judgePrompt:
      '公式SNSアカウントへの導線がサイト上にあるか。複数媒体を運用し、フッター以外にも導線があれば full。フッターにアイコンが1つあるだけなら thin。',
    aliases: ['公式SNS', 'Instagram', 'X', 'YouTube', 'LINE公式アカウント'],
    pathHints: ['/', '/sns', '/social'],
  },
  {
    id: 'G3',
    category: 'G',
    label: 'ブログ・お知らせ',
    audience: '受験生・保護者',
    judgePrompt:
      'お知らせ・ブログが更新されているか。直近90日に更新があり、学校の様子が伝わる記事（事務連絡以外）が含まれ、カテゴリ分けされていれば full。更新はあるが事務連絡が大半なら mid。判定には直近90日の件数と内訳を根拠として保存すること。',
    aliases: ['お知らせ', 'ニュース', 'ブログ', 'トピックス', '日誌'],
    pathHints: ['/news', '/blog', '/topics', '/information'],
  },
];

export const CRITERIA_BY_ID: Record<string, Criterion> = Object.fromEntries(
  CRITERIA.map((c) => [c.id, c]),
);

/** 02 画面に常設する「判定方式の説明カード」の中身（handoff.md 5章 02） */
export const NAMING_VARIATION_EXAMPLES: { label: string; examples: string }[] = [
  { label: '探究学習', examples: '探究学習／自調自考論文／総合学習／探究コース／課題研究・ゼミ' },
  { label: '学費', examples: '諸費用／学納金／入学金・学費／授業料等' },
  { label: '施設・設備', examples: '施設・設備／施設紹介／施設案内／キャンパスマップ' },
  { label: '学習サポート', examples: '学習フォロー体制／学習支援プログラム／特別講座／サポート体制' },
  {
    label: '在校生の声',
    examples: '生徒紹介／生徒の活躍／各ページ内に埋め込み（独立ページを持たない例が多数）',
  },
];

if (CRITERIA.length !== 31) {
  throw new Error(`調査項目は31件でなければならない（現在 ${CRITERIA.length} 件）`);
}
