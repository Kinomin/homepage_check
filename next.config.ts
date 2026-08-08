import type { NextConfig } from 'next';

/**
 * 静的デモ（GitHub Pages）用のビルドかどうか。
 *
 * GitHub Pages はファイルを配るだけなのでサーバが無い。ログイン・走査・LLM判定は
 * 動かせないため、サンプルデータの表示だけを書き出す。
 * 本番（Vercel など）では従来どおりサーバ側で描画する。
 */
const isStaticDemo = process.env.STATIC_DEMO === '1';

/** Pages は https://<user>.github.io/<repo>/ に置かれるため、パスの前置きが必要 */
const basePath = process.env.STATIC_DEMO_BASE_PATH ?? '';

const nextConfig: NextConfig = isStaticDemo
  ? {
      output: 'export',
      basePath,
      // 静的ホスティングは拡張子なしの URL を解決できないので /gap/index.html の形にする
      trailingSlash: true,
      images: { unoptimized: true },
      env: {
        NEXT_PUBLIC_STATIC_DEMO: '1',
        NEXT_PUBLIC_BASE_PATH: basePath,
      },
    }
  : {};

export default nextConfig;
