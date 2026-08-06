import { ActionList } from '@/components/actions/ActionList';
import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar } from '@/components/shell/Topbar';
import { CRITERIA } from '@/lib/analysis/criteria';
import { loadDashboard } from '@/lib/data/repository';
import { SCREENS } from '@/lib/screens';
import {
  DIFFICULTIES,
  DIFFICULTY_DEFINITION,
  DIFFICULTY_LABEL,
  PRIORITIES,
  PRIORITY_DEFINITION,
} from '@/lib/types';

export default async function ActionsPage() {
  const { schools, scan, actions, isDemo } = await loadDashboard();

  return (
    <>
      <Topbar
        screen={SCREENS.action}
        scan={scan}
        competitorCount={schools.length - 1}
        criteriaCount={CRITERIA.length}
        subOverride={`${actions.length}件。優先度・難易度でグループ化しています`}
      />
      <div className="wrap">
        <DemoNote isDemo={isDemo} />
        <ActionList actions={actions} />

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h">
            <h2>
              <span className="id">AC-00</span>優先度・難易度の基準
            </h2>
          </div>
          <div className="card-b">
            <table className="dt">
              <thead>
                <tr>
                  <th>区分</th>
                  <th>高</th>
                  <th>中</th>
                  <th>低</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <b>優先度</b>
                    <span className="sub2">誰の判断に影響するか</span>
                  </td>
                  {PRIORITIES.map((key) => (
                    <td key={key}>{PRIORITY_DEFINITION[key]}</td>
                  ))}
                </tr>
                <tr>
                  <td>
                    <b>難易度</b>
                    <span className="sub2">校内で完結するか</span>
                  </td>
                  {[...DIFFICULTIES].reverse().map((key) => (
                    <td key={key}>{DIFFICULTY_DEFINITION[key]}</td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: 'var(--mute)', marginTop: 9 }}>
              所要時間や期限は学校ごとの体制によって大きく変わるため、この画面では提示していません。担当の割り当てと期限は校内でご判断ください。
              <br />
              難易度を作業量ではなく「どこまで話を通す必要があるか」で定義しています（
              {DIFFICULTIES.map((key) => `${DIFFICULTY_LABEL[key]}＝${DIFFICULTY_DEFINITION[key]}`).join(
                '／',
              )}
              ）。学校で施策が止まる主因は工数ではなく合意形成にあるためです。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
