import { describe, expect, test } from 'vitest';
import { rewriteImports } from '../scripts/dev/move-files.ts';

const map = (pairs: Array<[string, string]>): ReadonlyMap<string, string> => new Map(pairs);

describe('rewriteImports', () => {
  test('recomputes the imports of a file that moved', () => {
    const text = "import { a } from './a.ts';\nimport b from '../b.ts';";
    const out = rewriteImports(text, 'src/x/f.ts', 'src/engine/core/f.ts', map([['src/x/f.ts', 'src/engine/core/f.ts']]));
    expect(out).toBe("import { a } from '../../x/a.ts';\nimport b from '../../b.ts';");
  });

  test('repoints the importers of a file that moved', () => {
    const out = rewriteImports("import { f } from './f.ts';", 'src/x/g.ts', 'src/x/g.ts', map([['src/x/f.ts', 'src/engine/core/f.ts']]));
    expect(out).toBe("import { f } from '../engine/core/f.ts';");
  });

  test('leaves ./ imports alone when both files move to the same folder', () => {
    const moved = map([
      ['src/x/f.ts', 'src/engine/core/f.ts'],
      ['src/x/g.ts', 'src/engine/core/g.ts'],
    ]);
    const text = "import { g } from './g.ts';";
    expect(rewriteImports(text, 'src/x/f.ts', 'src/engine/core/f.ts', moved)).toBe(text);
  });

  test('handles type imports, export-from, side-effect, dynamic imports and vi.mock', () => {
    const moved = map([['src/x/f.ts', 'src/engine/core/f.ts']]);
    const text = [
      "import type { F } from '../src/x/f.ts';",
      "export { f } from '../src/x/f.ts';",
      "import '../src/x/f.ts';",
      "const m = await import('../src/x/f.ts');",
      "vi.mock('../src/x/f.ts', () => ({}));",
    ].join('\n');
    const out = rewriteImports(text, 'tests/t.test.ts', 'tests/t.test.ts', moved);
    expect(out.split('\n')).toEqual([
      "import type { F } from '../src/engine/core/f.ts';",
      "export { f } from '../src/engine/core/f.ts';",
      "import '../src/engine/core/f.ts';",
      "const m = await import('../src/engine/core/f.ts');",
      "vi.mock('../src/engine/core/f.ts', () => ({}));",
    ]);
  });

  test('rewrites quoted /src/ strings and html src attributes', () => {
    const moved = map([['src/x/f.ts', 'src/engine/core/f.ts']]);
    expect(rewriteImports("await import('/src/x/f.ts')", 'scripts/c.mjs', 'scripts/c.mjs', moved)).toBe(
      "await import('/src/engine/core/f.ts')"
    );
    expect(rewriteImports('<script src="/src/x/f.ts"></script>', 'index.html', 'index.html', moved)).toBe(
      '<script src="/src/engine/core/f.ts"></script>'
    );
  });

  test('leaves bare specifiers and unmoved relative imports untouched', () => {
    const text = "import Phaser from 'phaser';\nimport { k } from './k.ts';";
    expect(rewriteImports(text, 'src/x/f.ts', 'src/x/f.ts', map([['src/y/other.ts', 'src/z/other.ts']]))).toBe(text);
  });
});
