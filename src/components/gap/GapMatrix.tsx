'use client';

import { Fragment, useState } from 'react';

import {
  GAP_FILTERS,
  GAP_FILTER_LABEL,
  matchesGapFilter,
  type GapFilter,
  type GapRow,
} from '@/lib/analysis/summary';
import { CATEGORY_LABEL, LEVEL_LABEL, LEVEL_MARK, type Level } from '@/lib/types';

/**
 * 02 欠落マップ。31項目 × 自校＋比較校のマトリクス。
 *
 * ・マーク：● full ／ ◐ mid ／ ○ thin ／ — none ／ 空欄 n/a・unknown
 * ・セルクリックで根拠パネル（判定理由＋使用URL）
 * ・比較校のセルには評価文を出さない。公開の有無と掲載量の記録のみ（設計原則3）
 */
export function GapMatrix({ rows, schoolNames }: { rows: GapRow[]; schoolNames: string[] }) {
  const [filter, setFilter] = useState<GapFilter>('all');
  const [selected, setSelected] = useState<{ rowId: string; column: number } | null>(null);

  const visible = rows.filter((row) => matchesGapFilter(row, filter));
  const selectedRow = selected ? rows.find((r) => r.criterion.id === selected.rowId) : null;

  return (
    <>
      <div className="btnrow">
        <span className="lb">FILTER</span>
        {GAP_FILTERS.map((key) => (
          <button
            key={key}
            className="btn ghost"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {key === 'all' ? `全${rows.length}項目` : GAP_FILTER_LABEL[key]}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-h">
          <h2>
            <span className="id">GM</span>欠落マップ
          </h2>
          <span className="note">
            ページの有無と掲載量のみを機械判定。内容の優劣は評価しません
          </span>
        </div>
        <div className="card-b">
          <div className="gapwrap">
            <table className="gap">
              <thead>
                <tr>
                  <th className="item">受験生・保護者・塾が探す情報（{rows.length}項目）</th>
                  <th className="whoh">主に見る人</th>
                  {schoolNames.map((name, index) => (
                    <th key={name} className={index === 0 ? 'mine' : undefined}>
                      {name}
                      {index === 0 && <small>SELF</small>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => {
                  const previous = visible[index - 1];
                  const newCategory = previous?.criterion.category !== row.criterion.category;
                  return (
                    <Fragment key={row.criterion.id}>
                      {newCategory && filter === 'all' && (
                        <tr className="catrow">
                          <th colSpan={schoolNames.length + 2}>
                            <span className="ck">{row.criterion.category}</span>
                            {CATEGORY_LABEL[row.criterion.category]}
                          </th>
                        </tr>
                      )}
                      <tr>
                        <th className="item">
                          <span className="rowlbl">
                            <span className="rid">{row.criterion.id}</span>
                            {row.criterion.label}
                          </span>
                        </th>
                        <td>
                          <span className="who">{row.criterion.audience}</span>
                        </td>
                        {row.levels.map((level, column) => (
                          <td key={column} className={column === 0 ? 'mine' : undefined}>
                            <button
                              className={`mk-cell ${markClass(level)}`}
                              aria-pressed={
                                selected?.rowId === row.criterion.id && selected.column === column
                              }
                              aria-label={`${row.criterion.label}：${schoolNames[column]} ${LEVEL_LABEL[level]}`}
                              onClick={() => setSelected({ rowId: row.criterion.id, column })}
                            >
                              {LEVEL_MARK[level]}
                            </button>
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="legend">
            <span>
              <b style={{ color: 'var(--sage)' }}>●</b>詳細ページあり
            </span>
            <span>
              <b style={{ color: 'var(--ink-2)' }}>◐</b>記載はあるが浅い
            </span>
            <span>
              <b style={{ color: 'var(--amber)' }}>○</b>一言のみ
            </span>
            <span>
              <b style={{ color: 'var(--rose)' }}>—</b>該当情報なし
            </span>
            <span>
              <b>　</b>空欄＝判定対象外・取得できず
            </span>
            <span style={{ marginLeft: 'auto' }}>セルを押すと判定の根拠を表示</span>
          </div>

          <EvidencePanel
            row={selectedRow ?? null}
            column={selected?.column ?? null}
            schoolNames={schoolNames}
          />
        </div>
      </div>
    </>
  );
}

function EvidencePanel({
  row,
  column,
  schoolNames,
}: {
  row: GapRow | null;
  column: number | null;
  schoolNames: string[];
}) {
  if (!row || column === null) {
    return (
      <div className="evidence">
        <div className="ttl">セルを選択してください</div>
        <p>
          この表は学校の優劣を評価するものではありません。「その情報が公開されているか」という事実だけを並べています。会議で使うときも、この事実のまま提示してください。
        </p>
      </div>
    );
  }

  const level = row.levels[column];
  const evidence = row.evidence?.[column] ?? null;
  const isSelf = column === 0;

  return (
    <div className="evidence">
      <div className="ttl">
        {row.criterion.id}　{row.criterion.label}　—　{schoolNames[column]}
      </div>
      {level === 'unknown' ? (
        <p>
          取得できませんでした。robots.txt による拒否・タイムアウト等で走査できなかった項目です。
          <strong>「情報がない」ことを意味しません。</strong>欠落件数にも数えていません。
        </p>
      ) : level === 'n/a' ? (
        <p>判定対象外の項目です（{row.criterion.specialRule ?? 'この学校には該当しません'}）。欠落として数えていません。</p>
      ) : isSelf ? (
        <p>{evidence?.text ?? `判定：${LEVEL_LABEL[level]}。`}</p>
      ) : (
        <p>
          判定：{LEVEL_LABEL[level]}。
          <br />
          比較校については、公開ページの有無と掲載量のみを記録しています。内容の評価や優劣の判定は行いません。
        </p>
      )}
      <div className="src">
        {isSelf
          ? `判定に使ったページ：${evidence?.source ?? '—'}`
          : '各校が一般に公開しているページに基づく記録'}
      </div>
    </div>
  );
}

function markClass(level: Level): string {
  switch (level) {
    case 'full':
      return 'full';
    case 'thin':
      return 'thin';
    case 'none':
      return 'none';
    default:
      return '';
  }
}
