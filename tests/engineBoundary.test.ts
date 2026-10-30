import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { findEscapes } from './helpers/importBoundary.ts';
import type { SourceFile } from './helpers/importBoundary.ts';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const CORE = join(SRC, 'engine', 'core');
const PUZZLE = join(SRC, 'engine', 'puzzle');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
  });
}

function load(dir: string): SourceFile[] {
  return walk(dir).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
}

const shown = (offenders: string[]): string[] => offenders.map((line) => line.replaceAll(SRC, '').replaceAll('\\', '/'));

describe('findEscapes', () => {
  const at = (name: string, text: string): SourceFile => ({ path: join(CORE, name), text });

  test('allows imports that stay inside the allowed roots', () => {
    const file = at('a/x.ts', "import { y } from './y.ts';\nimport type { Z } from '../b/z.ts';");
    expect(findEscapes([file], [CORE])).toEqual([]);
  });

  test('flags a static import that leaves the roots', () => {
    const file = at('a/x.ts', "import { t } from '../../../presentation/designTokens.ts';");
    expect(findEscapes([file], [CORE])).toHaveLength(1);
  });

  test('flags export-from, side-effect and dynamic imports too', () => {
    const file = at(
      'a/x.ts',
      [
        "export { q } from '../../../content/q.ts';",
        "import '../../../style.css';",
        "const m = await import('../../../domain/m.ts');",
      ].join('\n')
    );
    expect(findEscapes([file], [CORE])).toHaveLength(3);
  });

  test('ignores bare package specifiers', () => {
    const file = at('a/x.ts', "import Phaser from 'phaser';\nimport { App } from '@capacitor/app';");
    expect(findEscapes([file], [CORE])).toEqual([]);
  });
});

describe('engine layering', () => {
  test('core has files, so the rule below is not vacuous', () => {
    expect(walk(CORE).length).toBeGreaterThan(20);
  });

  test('core imports nothing outside engine/core', () => {
    expect(shown(findEscapes(load(CORE), [CORE]))).toEqual([]);
  });

  test('puzzle imports only engine/core and itself', () => {
    expect(shown(findEscapes(load(PUZZLE), [CORE, PUZZLE]))).toEqual([]);
  });
});
