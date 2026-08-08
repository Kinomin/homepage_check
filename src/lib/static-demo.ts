/**
 * 静的デモ（GitHub Pages）で動いているかの判定と、ブラウザ内の保存。
 *
 * GitHub Pages はファイルを配るだけなのでサーバが無い。API を叩く操作
 * （対応済みトグル・設定の保存）はそのままでは 404 になる。
 * 押せるのに何も起きない要素を作らないため（handoff.md 10章-5）、
 * 静的デモではブラウザ内（localStorage）に保存して動くようにする。
 *
 * 保存先が違うことは画面にも明示する。デモの操作が本物の記録だと
 * 誤解させないため。
 */

export const IS_STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === '1';

const PREFIX = 'school-insight-demo:';

export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 保存できなくても表示は動かす（プライベートモードなど）
  }
  cache.delete(key);
  for (const listener of listeners) listener();
}

/* ===== useSyncExternalStore 用の入口 =====
 *
 * localStorage は React の外にある状態なので、effect で setState して読み込むのではなく
 * ストアとして購読する。getSnapshot は毎回同じ参照を返す必要があるため（返さないと
 * 再レンダリングが止まらない）、読んだ値をここでキャッシュし、書き込み時に捨てる。
 */

const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();

export function subscribeLocal(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** クライアント側のスナップショット。同じ内容なら同じ参照を返す。 */
export function snapshotLocal<T>(key: string, fallback: T): T {
  if (!cache.has(key)) cache.set(key, readLocal(key, fallback));
  return cache.get(key) as T;
}
