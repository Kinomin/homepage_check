import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar } from '@/components/shell/Topbar';
import { CRITERIA } from '@/lib/analysis/criteria';
import { loadDashboard } from '@/lib/data/repository';
import { SCREENS } from '@/lib/screens';

export default async function PersonaPage() {
  const { schools, scan, isDemo } = await loadDashboard();

  return (
    <>
      <Topbar
        screen={SCREENS.persona}
        scan={scan}
        competitorCount={schools.length - 1}
        criteriaCount={CRITERIA.length}
      />
      <div className="wrap">
        <DemoNote isDemo={isDemo} />
        <div className="card">
          <div className="card-h">
            <h2>
              <span className="id">PS</span>
              {SCREENS.persona.title}は Phase 2 で実装します
            </h2>
          </div>
          <div className="card-b">
            <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--ink-2)' }}>
              6パターン（小学6年生・中学3年生・保護者 × 男女）の目線でサイトを読み直す画面です。生成物は必ず「サイトの記載内容から自動生成した仮説」と明示し、各仮説に {SCREENS.gap.title} の criterion_id を紐付けて根拠を表示します。
            </p>
            <div className="caution">
              <b>この画面の扱い</b>
              <br />
              ここに出るのはサイトの記載内容から機械的に生成した仮説であり、実際の受験生・保護者の声ではありません。会議で「分析結果です」と提示すると必ず反発され、製品全体の信用を損ないます。
              <strong>説明会アンケートに数問足して、この仮説が当たっているかを確かめる</strong>
              使い方を前提に実装します（handoff.md 5章 05）。
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
