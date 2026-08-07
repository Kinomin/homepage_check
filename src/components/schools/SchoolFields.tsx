'use client';

import type { SchoolInput } from '@/lib/schools/schema';

/**
 * 学校の入力欄。初回登録（学校法人＋自校）と 08 の比較校追加で共有する。
 *
 * 併設大学の有無だけは判定に影響する（内部進学の項目 F5 が「該当なし」になるか、
 * 掲載の欠落になるかが変わる）。他の項目は表示と絞り込みのためのもの。
 */
export function SchoolFields({
  value,
  disabled,
  onChange,
  showAdmissionFields = true,
}: {
  value: SchoolInput;
  disabled: boolean;
  onChange: (next: SchoolInput) => void;
  /** 比較校では入試区分の入力を省く（判定は本文から行うため） */
  showAdmissionFields?: boolean;
}) {
  return (
    <>
      <div className="setting-row">
        <div className="setting-label" style={{ width: 130 }}>
          学校名
        </div>
        <div className="setting-input" style={{ flex: 1 }}>
          <input
            type="text"
            style={{ width: '100%', textAlign: 'left' }}
            placeholder="○○中学校・高等学校"
            value={value.name}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
          />
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label" style={{ width: 130 }}>
          サイトURL
          <small>トップページの URL</small>
        </div>
        <div className="setting-input" style={{ flex: 1 }}>
          <input
            type="url"
            style={{ width: '100%' }}
            placeholder="https://example.ed.jp"
            value={value.url}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, url: event.target.value })}
          />
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label" style={{ width: 130 }}>
          併設大学
          <small>内部進学の項目を判定に含めるかが変わります</small>
        </div>
        <div className="seg">
          <button
            disabled={disabled}
            aria-pressed={value.hasAffiliatedUniversity === true}
            onClick={() => onChange({ ...value, hasAffiliatedUniversity: true })}
          >
            あり
          </button>
          <button
            disabled={disabled}
            aria-pressed={value.hasAffiliatedUniversity !== true}
            onClick={() => onChange({ ...value, hasAffiliatedUniversity: false })}
          >
            なし
          </button>
        </div>
      </div>

      {showAdmissionFields && (
        <div className="setting-row">
          <div className="setting-label" style={{ width: 130 }}>
            募集
            <small>行っている入試</small>
          </div>
          <div className="seg">
            <button
              disabled={disabled}
              aria-pressed={value.hasJuniorAdmission !== false}
              onClick={() =>
                onChange({ ...value, hasJuniorAdmission: value.hasJuniorAdmission === false })
              }
            >
              中学入試
            </button>
            <button
              disabled={disabled}
              aria-pressed={value.hasSeniorAdmission !== false}
              onClick={() =>
                onChange({ ...value, hasSeniorAdmission: value.hasSeniorAdmission === false })
              }
            >
              高校入試
            </button>
          </div>
        </div>
      )}
    </>
  );
}
