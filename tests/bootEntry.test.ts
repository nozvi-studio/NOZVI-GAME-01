import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveFontUrl } from '../src/engine/core/boot/fontUrl';

describe('bootEntry', () => {
  const indexHtmlPath = resolve(__dirname, '../index.html');
  const bootTsPath = resolve(__dirname, '../src/boot.ts');

  it('shortens the intro hold and loading minimum while keeping reduced motion', () => {
    const boot = readFileSync(bootTsPath, 'utf-8');
    const loading = readFileSync(resolve(__dirname, '../src/presentation/scenes/LoadingScene.ts'), 'utf-8');
    expect(boot).toMatch(/const holdMs = reduced \? 650 : 3500;/);
    expect(loading).toMatch(/const MIN_MS = 2000;/);
  });

  it('finishes finite intro animations before the 3.5 second hold ends', () => {
    const css = readFileSync(resolve(__dirname, '../src/boot.css'), 'utf-8');
    const html = readFileSync(indexHtmlPath, 'utf-8');
    const inlineDelays = [...html.matchAll(/animation-delay:\s*([\d.]+)s/g)].map((match) => Number(match[1]));
    const maxInlineDelay = Math.max(...inlineDelays);
    let checked = 0;
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const animation = /\banimation:\s*([^;]+);/.exec(rule[2]);
      if (!animation) continue;
      for (const part of animation[1].split(/,\s*(?![^()]*\))/)) {
        if (part.includes('infinite')) continue;
        const timing = /^\s*[\w-]+\s+([\d.]+)s(?:\s+([\d.]+)s)?/.exec(part);
        if (!timing) continue;
        const inline = /\.(?:f|intro-ring)\s*$/.test(rule[1]) ? maxInlineDelay : 0;
        const end = Number(timing[1]) + Math.max(Number(timing[2] ?? 0), inline);
        expect(end, rule[1].trim()).toBeLessThan(3.5);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(8);
  });

  it('prevents browser gestures and context menus on the game', () => {
    const css = readFileSync(resolve(__dirname, '../src/style.css'), 'utf-8');
    const main = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf-8');
    expect(css).toMatch(/#game(?:\s+canvas)?\s*\{[^}]*touch-action:\s*none\s*;/);
    expect(main).toMatch(/new Phaser\.Game\(\{[^]*?disableContextMenu:\s*true/);
  });

  it('verifies index.html uses /src/boot.ts and removes legacy #boot spinner and eager main.ts', () => {
    const html = readFileSync(indexHtmlPath, 'utf-8');

    // Eager entry must be boot.ts
    expect(html).toMatch(/<script\s+type="module"\s+src="\/src\/boot\.ts"><\/script>/);

    // No eager main.ts script
    expect(html).not.toMatch(/<script\s+type="module"\s+src="\/src\/main\.ts"><\/script>/);

    // No legacy #boot element or spinner
    expect(html).not.toMatch(/id="boot"/);
    expect(html).not.toMatch(/boot-spin/);
    // The portrait intro stays visible until Phaser's real loading frame.
    expect(html).toMatch(/id="intro"/);
    expect(html).not.toMatch(/id="loading-shell"/);
    expect(html).toMatch(/class="intro-error"/);
  });

  it('verifies boot.ts has no static imports of main.ts, phaser, or scenes', () => {
    const bootSource = readFileSync(bootTsPath, 'utf-8');

    // No static import of main or phaser
    expect(bootSource).not.toMatch(/import\s+[^;]*from\s+['"][^'"]*main(\.ts)?['"]/);
    expect(bootSource).not.toMatch(/import\s+[^;]*from\s+['"]phaser['"]/);
    expect(bootSource).not.toMatch(/import\s+[^;]*from\s+['"][^'"]*presentation\//);

    // Must use dynamic import for main
    expect(bootSource).toMatch(/import\(['"]\.\/main(\.ts)?['"]\)/);
  });

  it('resolves font URLs correctly under root and non-root Vite bases', () => {
    expect(resolveFontUrl('/', 'fonts/unbounded-500.ttf')).toBe('/fonts/unbounded-500.ttf');
    expect(resolveFontUrl('/mirror/', 'fonts/unbounded-500.ttf')).toBe('/mirror/fonts/unbounded-500.ttf');
    expect(resolveFontUrl('./', 'fonts/unbounded-500.ttf')).toBe('./fonts/unbounded-500.ttf');
    expect(resolveFontUrl('', 'fonts/unbounded-500.ttf')).toBe('fonts/unbounded-500.ttf');
  });

  it('keeps the two expanding rings but removes the disk and rays behind Alpaca', () => {
    const html = readFileSync(indexHtmlPath, 'utf-8');
    const css = readFileSync(resolve(__dirname, '../src/boot.css'), 'utf-8');

    expect(html.match(/class="intro-ring"/g)).toHaveLength(2);
    expect(html).not.toMatch(/class="(?:glow|raysW|rays)"/);
    expect(css).toMatch(/\.intro-ring\s*\{/);
    expect(css).not.toMatch(/\.(?:glow|raysW|rays)\s*\{/);
  });
});
