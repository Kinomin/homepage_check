/**
 * 静的デモ（GitHub Pages）のビルド。
 *
 *   npm run build:demo
 *
 * GitHub Pages はファイルを配るだけなのでサーバが無い。そのため
 * `output: 'export'` で書き出すが、この形式では次のものが使えない：
 *
 *   ・Route Handler（POST/PUT/DELETE を持つ /api/*）
 *   ・middleware（セッション更新と未ログイン時の振り分け）
 *   ・force-dynamic なページ
 *
 * どれも本番では必要なものなので消せない。ビルドの間だけ脇に寄せ、
 * 終わったら必ず戻す（成功しても失敗しても finally で戻す）。
 *
 * 出力される画面はサンプルデータ表示。ログイン・走査・LLM判定は動かない。
 * 「デモなので保存されない」ことは画面にも出す（handoff.md 10章-5）。
 */

import { rename, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const STASH = path.join(ROOT, '.static-demo-stash');

/** ビルド中だけ脇に寄せるもの */
const MOVES = [
  { from: 'src/app/api', to: 'api' },
  { from: 'src/middleware.ts', to: 'middleware.ts' },
  // ログインと初回登録はサーバが要る。静的デモには含めない
  { from: 'src/app/signin', to: 'signin' },
  { from: 'src/app/onboarding', to: 'onboarding' },
];

/** force-dynamic を外すファイル。静的書き出しと両立しない */
const DYNAMIC_FILES = ['src/app/layout.tsx', 'src/app/(app)/layout.tsx'];

async function moveIfExists(from: string, to: string): Promise<boolean> {
  try {
    await rename(from, to);
    return true;
  } catch {
    return false;
  }
}

function run(command: string, args: string[], env: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} が終了コード ${code} で終わりました`)),
    );
    child.on('error', reject);
  });
}

async function main() {
  const basePath = process.env.STATIC_DEMO_BASE_PATH ?? '';
  const moved: { from: string; to: string }[] = [];
  const patched: { file: string; original: string }[] = [];

  /**
   * 脇に寄せたものと書き換えたものを戻す。
   * finally だけでは Ctrl-C（SIGINT）で戻らず、API と middleware が
   * 消えたままのリポジトリが残る。シグナルでも必ず通す。
   */
  let restored = false;
  async function restore() {
    if (restored) return;
    restored = true;
    for (const item of patched) await writeFile(item.file, item.original, 'utf8');
    for (const item of [...moved].reverse()) await rename(item.to, item.from);
    await rm(STASH, { recursive: true, force: true });
  }

  const onSignal = (signal: NodeJS.Signals) => {
    void restore().then(() => {
      console.error(`\n${signal} で中断しました。移動したファイルは元に戻しています。`);
      process.exit(1);
    });
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  await mkdir(STASH, { recursive: true });

  try {
    for (const move of MOVES) {
      const from = path.join(ROOT, move.from);
      const to = path.join(STASH, move.to);
      if (await moveIfExists(from, to)) moved.push({ from, to });
    }

    for (const file of DYNAMIC_FILES) {
      const full = path.join(ROOT, file);
      const original = await readFile(full, 'utf8');
      patched.push({ file: full, original });
      await writeFile(
        full,
        original.replace(
          /^export const dynamic = 'force-dynamic';$/m,
          '// 静的デモのビルド中のみ無効化（scripts/build-static-demo.ts が元に戻す）',
        ),
        'utf8',
      );
    }

    // Next が生成したルートの型は、脇に寄せたファイル（/api・/signin など）を
    // 参照している。残っていると型検査が「そんなモジュールは無い」で落ちる。
    // dev サーバを一度動かした環境で必ず踏むため、生成物ごと捨てる。
    await rm(path.join(ROOT, '.next'), { recursive: true, force: true });

    console.log(`静的デモをビルドします（basePath: ${basePath || '(なし)'}）\n`);
    await run('npx', ['next', 'build'], {
      STATIC_DEMO: '1',
      STATIC_DEMO_BASE_PATH: basePath,
    });

    // GitHub Pages は _next のような _ 始まりのパスを Jekyll が無視するため
    await writeFile(path.join(ROOT, 'out', '.nojekyll'), '', 'utf8');
    console.log('\nout/ に書き出しました。');
  } finally {
    // 戻し損ねると、次の本番ビルドから API と middleware が消える
    await restore();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
