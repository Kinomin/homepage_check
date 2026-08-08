import { describe, expect, it } from 'vitest';

import {
  MEASUREMENT_DEFINITIONS,
  composeMeasurements,
  deriveMeasurements,
  median,
} from '../src/lib/analysis/measurements';
import type { MeasurementMethod } from '../src/lib/types';

const NOW = new Date('2026-08-08T00:00:00.000Z');

function selfValue(key: string, value: number, unit: string, method: MeasurementMethod = 'scan') {
  return new Map([[key, { value, unit, method }]]);
}

describe('03 計測値の算出（handoff.md 5章 03）', () => {
  it('直近90日に更新されたページを数える', () => {
    const derived = deriveMeasurements(
      {
        imageCount: 340,
        pageLastModified: [
          '2026-08-01T00:00:00.000Z', // 7日前
          '2026-06-01T00:00:00.000Z', // 68日前
          '2026-01-01T00:00:00.000Z', // 90日より前
        ],
      },
      NOW,
    );
    expect(derived.find((m) => m.key === 'm03')?.value).toBe(2);
  });

  it('更新日を返さなかったページを「更新なし」として数えない', () => {
    // Last-Modified が無いのは「更新がない」ではなく「分からない」（設計原則4）
    const derived = deriveMeasurements(
      { imageCount: 0, pageLastModified: [null, null, '2026-08-01T00:00:00.000Z'] },
      NOW,
    );
    expect(derived.find((m) => m.key === 'm03')?.value).toBe(1);
  });

  it('壊れた更新日を数に入れない', () => {
    const derived = deriveMeasurements({ imageCount: 0, pageLastModified: ['not a date'] }, NOW);
    expect(derived.find((m) => m.key === 'm03')?.value).toBe(0);
  });

  it('未来の日付を直近の更新として数えない', () => {
    const derived = deriveMeasurements(
      { imageCount: 0, pageLastModified: ['2027-01-01T00:00:00.000Z'] },
      NOW,
    );
    expect(derived.find((m) => m.key === 'm03')?.value).toBe(0);
  });

  it('写真の点数は走査した画像数をそのまま使う', () => {
    const derived = deriveMeasurements({ imageCount: 340, pageLastModified: [] }, NOW);
    expect(derived.find((m) => m.key === 'm07')?.value).toBe(340);
  });

  it('走査から出せる指標だけを返す（クリック数・表示速度は返さない）', () => {
    const derived = deriveMeasurements({ imageCount: 0, pageLastModified: [] }, NOW);
    const derivableKeys = MEASUREMENT_DEFINITIONS.filter((d) => d.derivable).map((d) => d.key);
    expect(derived.map((m) => m.key).sort()).toEqual(derivableKeys.sort());
    expect(derived.map((m) => m.key)).not.toContain('m01');
    expect(derived.map((m) => m.key)).not.toContain('m10');
  });
});

describe('03 画面に渡す形の組み立て', () => {
  it('計測できていない指標はサンプル値で埋めず、null と理由を返す', () => {
    const composed = composeMeasurements(selfValue('m07', 340, '点'), new Map());
    const photos = composed.find((m) => m.key === 'm07')!;
    const clicks = composed.find((m) => m.key === 'm01')!;

    expect(photos.value).toBe(340);
    expect(clicks.value).toBeNull();
    expect(clicks.unmeasuredReason).not.toBe('');
  });

  it('未計測の指標も一覧から消さない（測っていないことが分かるようにする）', () => {
    const composed = composeMeasurements(new Map(), new Map());
    expect(composed).toHaveLength(MEASUREMENT_DEFINITIONS.length);
    expect(composed.every((m) => m.value === null)).toBe(true);
  });

  it('中央値は比較校の実際の値から出す', () => {
    const composed = composeMeasurements(
      selfValue('m07', 100, '点'),
      new Map([['m07', [200, 400, 600]]]),
    );
    expect(composed.find((m) => m.key === 'm07')?.median).toBe(400);
  });

  it('比較校の値が1つも無ければ中央値は null（0 と区別する）', () => {
    const composed = composeMeasurements(selfValue('m07', 100, '点'), new Map());
    expect(composed.find((m) => m.key === 'm07')?.median).toBeNull();
  });
});

describe('中央値', () => {
  it('奇数件は中央の値', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('偶数件は中央2つの平均', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('空なら null', () => {
    expect(median([])).toBeNull();
  });
});
