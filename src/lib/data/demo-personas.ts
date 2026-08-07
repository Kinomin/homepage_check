/**
 * デモ用のペルソナ仮説。prototype.html の PERSONA を移したもの。
 *
 * プロトタイプでは根拠がURLだけの項目もあったが、実装では根拠を
 * 調査項目ID（criterion_id）で持つ。根拠のない読み取りを画面に出さないため。
 * ここでは元の記述に対応する項目IDを明示している。
 *
 * ANTHROPIC_API_KEY を設定すると、この固定値ではなく findings から
 * その場で生成した仮説を表示する。
 */

import type { Persona } from '../persona/types';

const GENERATED_AT = '2026-08-03T06:00:00+09:00';

export const DEMO_PERSONAS: Persona[] = [
  {
    stage: 'e6',
    gender: 'f',
    quote:
      '制服はかわいい。でも、授業がどんな感じなのか分からないから、通っている自分をうまく想像できない。',
    generatedAt: GENERATED_AT,
    hypotheses: [
      {
        kind: 'support',
        body: '制服紹介に着用写真が8点。夏服・冬服・体育着まで揃っている',
        criterionIds: ['C4'],
      },
      {
        kind: 'support',
        body: '体育祭・文化祭の写真が計62点。行事の様子は伝わる',
        criterionIds: ['C1'],
      },
      {
        kind: 'gap',
        body: '授業中の写真は3点のみ。うち2点は実験設備の写真で生徒が写っていない',
        criterionIds: ['C7'],
      },
      {
        kind: 'gap',
        body: '在校生本人の言葉が載っているページが見つからない',
        criterionIds: ['C6'],
      },
    ],
  },
  {
    stage: 'e6',
    gender: 'm',
    quote:
      '部活のページはすごく詳しい。でも、勉強がどれくらい大変なのか書いていないから、部活と両立できるのか分からない。',
    generatedAt: GENERATED_AT,
    hypotheses: [
      {
        kind: 'support',
        body: '全27部の個別ページに活動日・実績・写真が掲載されている',
        criterionIds: ['C2'],
      },
      {
        kind: 'gap',
        body: '1日の流れは時程表の画像1点のみ。放課後の過ごし方の記述がない',
        criterionIds: ['C5'],
      },
      {
        kind: 'gap',
        body: '宿題量・小テスト・補習の頻度など、学習負荷が分かる記述がない',
        criterionIds: ['B5'],
      },
      {
        kind: 'check',
        body: '中学生の部活動加入率・活動時間の記載がなく、実態が読み取れない',
        criterionIds: ['C2'],
      },
    ],
  },
  {
    stage: 'j3',
    gender: 'f',
    quote:
      '高校から入った人が、中学からの人となじめているのか分からない。ページは全部、中1から通っている前提で書かれている。',
    generatedAt: GENERATED_AT,
    hypotheses: [
      {
        kind: 'support',
        body: '高校からの募集要項・日程は入試情報に明記されている',
        criterionIds: ['F1'],
      },
      {
        kind: 'gap',
        body: '高校入学生の学級編成（混合か別クラスか）の説明が見つからない',
        criterionIds: ['F1', 'B1'],
      },
      {
        kind: 'gap',
        body: '在校生インタビューがないため、高校から入った先輩の声も存在しない',
        criterionIds: ['C6'],
      },
      {
        kind: 'check',
        body: 'カリキュラム表は中1起点の6年一貫で示され、高校3年間の履修が読み取りにくい',
        criterionIds: ['B1'],
      },
    ],
  },
  {
    stage: 'j3',
    gender: 'm',
    quote:
      '進学実績は分かった。でも、それが中学から通った人の実績なのか、高校から入った人も含むのかが書いていない。',
    generatedAt: GENERATED_AT,
    hypotheses: [
      {
        kind: 'support',
        body: '大学別・現役／既卒別の合格実績を3年分掲載',
        criterionIds: ['D1'],
      },
      {
        kind: 'gap',
        body: '実績の内訳（一貫生／高入生）が示されていない',
        criterionIds: ['D1'],
      },
      {
        kind: 'gap',
        body: '高校からの入学生向けの補習・接続カリキュラムの記述がない',
        criterionIds: ['B5'],
      },
      {
        kind: 'support',
        body: '部活動の実績が部ごとに具体的に書かれており、判断材料になる',
        criterionIds: ['C2'],
      },
    ],
  },
  {
    stage: 'parent',
    gender: 'f',
    quote: '進学実績は分かった。ただ、成績が伸び悩んだときに誰がどう見てくれるのかが書かれていない。',
    generatedAt: GENERATED_AT,
    hypotheses: [
      {
        kind: 'support',
        body: '過去3年の合格実績を大学別・現役／既卒別に掲載',
        criterionIds: ['D1'],
      },
      {
        kind: 'gap',
        body: '補習・個別指導・面談頻度など、日常のサポート体制の記述がない',
        criterionIds: ['B5'],
      },
      {
        kind: 'gap',
        body: '学費ページはPDF1枚のみ。奨学金・特待の条件がページ上で読めない',
        criterionIds: ['E1', 'E2'],
      },
      {
        kind: 'check',
        body: 'いじめ対策・相談窓口の記載が学校評価報告書PDF内のみ',
        criterionIds: ['E3'],
      },
    ],
  },
  {
    stage: 'parent',
    gender: 'm',
    quote:
      '6年間で総額いくらかかるのかが、どこにも書いていない。初年度納入金だけ見せられても判断できない。',
    generatedAt: GENERATED_AT,
    hypotheses: [
      {
        kind: 'gap',
        body: '6年間の総額や、制服・教材・修学旅行費などの実費の記載がない',
        criterionIds: ['E1'],
      },
      {
        kind: 'gap',
        body: '比較校は学費をページ本文に掲載しており、費用の比較がしにくい',
        criterionIds: ['E1'],
      },
      {
        kind: 'support',
        body: '進学実績は3年分が整理され、出口の水準は把握できる',
        criterionIds: ['D1'],
      },
      {
        kind: 'check',
        body: '教育理念が抽象語中心で、投じる費用に対する特色が読み取りにくい',
        criterionIds: ['A1'],
      },
    ],
  },
];
