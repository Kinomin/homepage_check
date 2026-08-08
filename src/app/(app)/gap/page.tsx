import { GapMatrix } from '@/components/gap/GapMatrix';
import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar } from '@/components/shell/Topbar';
import { CRITERIA, NAMING_VARIATION_EXAMPLES } from '@/lib/analysis/criteria';
import { loadDashboard } from '@/lib/data/repository';
import { SCREENS } from '@/lib/screens';

export default async function GapPage() {
  const { schools, scan, gapRows, isDemo } = await loadDashboard();

  return (
    <>
      <Topbar
        screen={SCREENS.gap}
        scan={scan}
        competitorCount={schools.length - 1}
        criteriaCount={CRITERIA.length}
      />
      <div className="wrap">
        <DemoNote isDemo={isDemo} />
        <GapMatrix rows={gapRows} schoolNames={schools.map((s) => s.name)} />

        {/* 判定方式の説明カード。常設する（handoff.md 5章 02） */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-h">
            <h2>
              <span className="id">GM-00</span>判定方式について
            </h2>
            <span className="note">語句の一致では判定できません</span>
          </div>
          <div className="card-b">
            <p
              style={{
                fontSize: 12.5,
                lineHeight: 1.9,
                color: 'var(--ink-2)',
                marginBottom: 14,
              }}
            >
              同じ内容でも、学校によってページの名称がまったく異なります。語句の一致で走査すると、
              <strong>実際にはある情報を「ない」と誤判定します</strong>
              。本ツールはページの内容から判定しています。
            </p>
            <table className="dt">
              <thead>
                <tr>
                  <th>項目</th>
                  <th>実在校で使われている名称の例</th>
                </tr>
              </thead>
              <tbody>
                {NAMING_VARIATION_EXAMPLES.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11.5, lineHeight: 1.8, color: 'var(--mute)', marginTop: 12 }}>
              在校生の声については、独立ページの有無ではなく「生徒本人の一人称の発言がサイト内にあるか」で判定しています。調査した6校のうち専用ページを持つのは1校のみで、探究や留学の紹介ページ内に生徒のコメントを置く形が主流でした。
              <br />
              自動アクセスを拒否している学校は走査せず、該当項目は空欄とし、欠落としては扱いません。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
