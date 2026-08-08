import { DemoNote } from '@/components/shell/DemoNote';
import { Topbar } from '@/components/shell/Topbar';
import { CRITERIA } from '@/lib/analysis/criteria';
import { DEMO_SELF_PATH, MEASUREMENT_METHOD_TARGETS } from '@/lib/data/demo-extras';
import {
  REFERENCE_COMPARISON,
  REFERENCE_PATH,
  REFERENCE_UPDATE_PRACTICE,
  type PathStep,
} from '@/lib/data/reference';
import { loadDashboard } from '@/lib/data/repository';
import { SCREENS } from '@/lib/screens';
import {
  MEASUREMENT_METHODS,
  MEASUREMENT_METHOD_LABEL,
  MEASUREMENT_REPRODUCIBILITY,
  type Measurement,
  type MeasurementMethod,
} from '@/lib/types';

const METHOD_TAG_CLASS: Record<MeasurementMethod, string> = {
  scan: 't-ok',
  operate: 't-neu',
  external: 't-warn',
};

export default async function MeasurementPage() {
  const { schools, scan, measurements, isDemo } = await loadDashboard();
  const valueOf = (key: string) => measurements.find((m) => m.key === key) ?? null;
  const unitedValue = (key: string) => {
    const measurement = valueOf(key);
    return measurement?.value === null || !measurement ? null : measurement;
  };
  // 自校の経路図は操作の記録が必要。デモでは架空の経路を出し、本番では出さない。
  const selfPath = isDemo ? DEMO_SELF_PATH : null;

  return (
    <>
      <Topbar
        screen={SCREENS.measurement}
        scan={scan}
        competitorCount={schools.length - 1}
        criteriaCount={CRITERIA.length}
      />
      <div className="wrap">
        <DemoNote isDemo={isDemo} />
        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>
                <span className="id">MS-01</span>説明会の申込にたどり着くまで
              </h2>
              <span className="note">スマートフォンでの操作記録</span>
            </div>
            <div className="card-b">
              <div className="paths">
                {selfPath ? (
                  <PathColumn
                    title={`${schools[0]?.name ?? '自校'}（自校）`}
                    clicks={selfPath.clicks}
                    steps={selfPath.steps}
                    isSelf
                  />
                ) : (
                  <SelfClickRecord
                    schoolName={schools[0]?.name ?? '自校'}
                    briefing={unitedValue('m01')}
                    brochure={unitedValue('m02')}
                  />
                )}
                <PathColumn
                  title="実在6校の標準形"
                  clicks={REFERENCE_PATH.clicks}
                  steps={REFERENCE_PATH.steps}
                />
              </div>
              <div className="evidence" style={{ marginTop: 14 }}>
                <div className="ttl">クリック数は最短経路で数えています</div>
                <p>
                  外部予約サイトへ遷移する形は業界の標準です。学校向けの予約・出願サービスは1社が全国の大半を占めており、本校が特殊なわけではありません。
                  <strong>差がついているのは遷移前の導線だけ</strong>です。クリック数は実際に操作して数える指標のため、走査では出せません。
                </p>
                <div className="src">
                  実在6校の標準形はグローバルナビ構造およびトップページ構成の記録（測定方法：操作）
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>
                <span className="id">MS-02</span>実在6校との導線比較
              </h2>
              <span className="note">学校名は伏せています</span>
            </div>
            <div className="card-b">
              <table className="dt">
                <thead>
                  <tr>
                    <th>学校</th>
                    <th>説明会申込まで</th>
                    <th>トップの常設導線</th>
                    <th>学校案内を読むまで</th>
                    <th>予約方式</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 本校の行は計測値から出す。記録がなければ未記録と書く（サンプル値で埋めない） */}
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <td>
                      <b>本校</b>
                    </td>
                    <td className="n">{unitedValue('m01')?.value ?? '未記録'}</td>
                    <td className="sub2">記録なし</td>
                    <td className="n">{unitedValue('m02')?.value ?? '未記録'}</td>
                    <td className="sub2">記録なし</td>
                  </tr>
                  {REFERENCE_COMPARISON.map((row) => (
                    <tr key={row.school}>
                      <td>{row.school}</td>
                      <td className="n">{row.toBriefing}</td>
                      <td>{row.persistentLink}</td>
                      <td className="n">{row.toBrochure}</td>
                      <td>{row.reservation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="evidence" style={{ marginTop: 14 }}>
                <div className="ttl">「資料請求フォームまでのクリック数」は使いません</div>
                <p>
                  実在6校すべてがその場で読めるデジタルパンフレットを公開しており、郵送用の請求フォームを持たない学校もありました。読み手が求めているのは資料の郵送ではなく
                  <strong>いま読めること</strong>です。指標を
                  <strong>「学校案内を読み始めるまでのクリック数」</strong>に置き換えています。
                </p>
                <div className="src">学校案内の公開形態を走査（PDF・電子ブック・郵送フォーム）</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>
                <span className="id">MS-03</span>数えた値
              </h2>
              <span className="note">縦線 ｜ は比較校の中央値</span>
            </div>
            <div className="card-b">
              <div className="meas">
                {measurements.map((measurement) => (
                  <MeasurementRow key={measurement.key} measurement={measurement} />
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>
                <span className="id">MS-04</span>更新の実態
              </h2>
              <span className="note">件数ではなく、中身と速さを見ます</span>
            </div>
            <div className="card-b">
              <table className="dt">
                <thead>
                  <tr>
                    <th>観点</th>
                    <th>本校</th>
                    <th>実在校で確認できた運用</th>
                  </tr>
                </thead>
                <tbody>
                  {REFERENCE_UPDATE_PRACTICE.map((row) => {
                    const measurement = row.measurementKey
                      ? unitedValue(row.measurementKey)
                      : null;
                    return (
                      <tr key={row.aspect}>
                        <td>
                          {row.aspect}
                          {row.note && <span className="sub2">{row.note}</span>}
                        </td>
                        <td className="n">
                          {measurement ? (
                            `${measurement.value}${measurement.unit}`
                          ) : (
                            <span className="unmeasured">未計測</span>
                          )}
                        </td>
                        <td>{row.peers}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>
                <span className="id">MS-05</span>測定条件と再現性
              </h2>
              <span className="note">誰が測っても同じ値になるか</span>
            </div>
            <div className="card-b">
              <table className="dt">
                <thead>
                  <tr>
                    <th>測定方法</th>
                    <th>再現性</th>
                    <th>該当する指標</th>
                  </tr>
                </thead>
                <tbody>
                  {MEASUREMENT_METHODS.map((method) => (
                    <tr key={method}>
                      <td>
                        <span className={`tag ${METHOD_TAG_CLASS[method]}`}>
                          {MEASUREMENT_METHOD_LABEL[method]}
                        </span>
                      </td>
                      <td>{MEASUREMENT_REPRODUCIBILITY[method]}</td>
                      <td>{MEASUREMENT_METHOD_TARGETS[method]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--ink-2)', marginTop: 12 }}>
                表示速度のみ外部の測定ツールに依存し、測るたびに値が変わります。この画面で唯一、再現性が保証できない指標です。
                <br />
                解釈を加えているのは「{SCREENS.persona.title}」と「{SCREENS.action.title}
                」で、そこには必ず根拠となるページを添えています。<strong>数えた事実</strong>と
                <strong>読み取り</strong>を混ぜないことが、この製品の設計方針です。
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PathColumn({
  title,
  clicks,
  steps,
  isSelf,
}: {
  title: string;
  clicks: number;
  steps: PathStep[];
  isSelf?: boolean;
}) {
  return (
    <div className={`path${isSelf ? ' mine' : ''}`}>
      <div className="ph">
        <span className="who2">{title}</span>
        <span className={`cnt${isSelf ? '' : ' good'}`}>{clicks}クリック</span>
      </div>
      {steps.map((step, index) => (
        <div className={`step${step.pain ? ' pain' : ''}`} key={step.label}>
          <span className={`dot${step.end ? ' end' : ''}`}>{step.end ? '✓' : index + 1}</span>
          <span className="sl">
            {step.label}
            {step.note && <small>{step.note}</small>}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 本校のクリック数。走査では出せないため、記録があれば数値を、無ければ
 * 何が必要かを書く。架空の経路図をここに出さない。
 */
function SelfClickRecord({
  schoolName,
  briefing,
  brochure,
}: {
  schoolName: string;
  briefing: Measurement | null;
  brochure: Measurement | null;
}) {
  return (
    <div className="path mine">
      <div className="ph">
        <span className="who2">{schoolName}（自校）</span>
        <span className="cnt">
          {briefing ? `${briefing.value}クリック` : <span className="unmeasured">未記録</span>}
        </span>
      </div>
      <div className="step">
        <span className="sl">
          説明会の申込完了まで
          <small>
            {briefing
              ? `${briefing.value}${briefing.unit}（操作の記録）`
              : '実際に操作した記録が必要です'}
          </small>
        </span>
      </div>
      <div className="step">
        <span className="sl">
          学校案内を読み始めるまで
          <small>
            {brochure
              ? `${brochure.value}${brochure.unit}（操作の記録）`
              : '実際に操作した記録が必要です'}
          </small>
        </span>
      </div>
      <div className="step">
        <span className="sl">
          <small>
            クリック数は走査では数えられません。スマートフォンで実際にたどった回数を記録すると、右の標準形と並べて比較できます。
          </small>
        </span>
      </div>
    </div>
  );
}

function MeasurementRow({ measurement }: { measurement: Measurement }) {
  // 測っていない指標はサンプル値で埋めない。バーも出さず、理由だけを置く。
  const measured = measurement.value !== null;
  const width = measured ? Math.min(100, (measurement.value! / measurement.scaleMax) * 100) : 0;
  const medianLeft =
    measurement.median === null
      ? null
      : Math.min(100, (measurement.median / measurement.scaleMax) * 100);

  return (
    <div className="meas-row">
      <div>
        <div className="meas-name">
          <span className={`tag ${METHOD_TAG_CLASS[measurement.method]}`} style={{ marginRight: 7 }}>
            {MEASUREMENT_METHOD_LABEL[measurement.method]}
          </span>
          {measurement.label}
          <small>{measured ? measurement.note : measurement.unmeasuredReason}</small>
        </div>
        {measured ? (
          <div className="bar">
            <i
              className={`mine${measurement.lowerIsBetter ? '' : ' good'}`}
              style={{ width: `${width}%` }}
            />
            {medianLeft !== null && <i className="avg" style={{ left: `${medianLeft}%` }} />}
          </div>
        ) : (
          <div className="bar bar-empty" />
        )}
      </div>
      <div className="meas-val">
        {measured ? (
          <>
            {measurement.value}
            <small>
              {measurement.unit}
              {measurement.median === null ? '' : `｜中央値 ${measurement.median}`}
            </small>
          </>
        ) : (
          <span className="unmeasured">未計測</span>
        )}
      </div>
    </div>
  );
}
