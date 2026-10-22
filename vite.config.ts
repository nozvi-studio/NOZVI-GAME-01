import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { studioPlugin } from './scripts/studio/studioPlugin.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig(({ command }) => {
  return {
    // Relative by default so the build works from any sub-path or iframe (CanzyGames SDK,
    // Android WebView). The GitHub Pages deploy workflow overrides it with VITE_BASE.
    base: process.env.VITE_BASE ?? './',
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: command === 'serve' ? [studioPlugin()] : [],
    build: {
      // Never ship source maps: the deployed bundle must not expose the original source.
      sourcemap: false,
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
