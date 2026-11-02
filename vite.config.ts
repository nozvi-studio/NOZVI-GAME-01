import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { studioPlugin } from './scripts/studio/studioPlugin.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig(({ command }) => {
  // Source map chỉ được tạo khi có token để tải lên Sentry; tải xong thì xóa khỏi dist, nên bản đóng gói
  // (APK, web) không bao giờ chứa .map. Không có token (build thường) thì không tạo gì cả.
  const uploadSourcemaps = command === 'build' && Boolean(process.env.SENTRY_AUTH_TOKEN);
  return {
    // Relative by default so the build works from any sub-path or iframe (CanzyGames SDK,
    // Android WebView). The GitHub Pages deploy workflow overrides it with VITE_BASE.
    base: process.env.VITE_BASE ?? './',
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [
      ...(command === 'serve' ? [studioPlugin()] : []),
      ...(uploadSourcemaps
        ? [
            sentryVitePlugin({
              authToken: process.env.SENTRY_AUTH_TOKEN,
              org: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT,
              // Phải trùng `release` mà sentryCrashDriver gửi lúc chạy (APP_VERSION).
              release: { name: pkg.version },
              sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
            }),
          ]
        : []),
    ],
    build: {
      // Never ship source maps: the deployed bundle must not expose the original source.
      // 'hidden' tạo .map nhưng không gắn tham chiếu vào bundle; chúng bị xóa sau khi tải lên Sentry.
      sourcemap: uploadSourcemaps ? 'hidden' : false,
      rollupOptions: {
        output: {
          // Phaser is ~1 MB gzip: its own chunk parses apart from game code and caches across releases.
          manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
        },
        input: {
          main: 'index.html',
        },
      },
    },
  };
});
