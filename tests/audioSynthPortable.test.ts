import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { validatePatch } from '../src/audio-synth/patch.ts';
import { renderPatch } from '../src/audio-synth/render.ts';
import { bellPreset, clickPreset, whooshPreset } from '../src/audio-synth/presets.ts';

const dir = fileURLToPath(new URL('../src/audio-synth/', import.meta.url));

/** Every .ts file under the engine folder, as paths relative to it, subfolders included. */
function listSources(root: string, rel = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root + rel, { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(...listSources(root, `${rel}${entry.name}/`));
    else if (entry.name.endsWith('.ts')) found.push(rel + entry.name);
  }
  return found;
}

/**
 * Every module specifier a file pulls in: static `from '...'`, bare `import '...'`,
 * dynamic `import('...')`, `require('...')` and `export ... from '...'`, in single,
 * double or backtick quotes.
 */
function importTargets(text: string): string[] {
  const patterns = [
    /\bfrom\s*(['"`])([^'"`]+)\1/g,
    /\bimport\s*(['"`])([^'"`]+)\1/g,
    /\bimport\s*\(\s*(['"`])([^'"`]+)\1/g,
    /\brequire\s*\(\s*(['"`])([^'"`]+)\1/g,
  ];
  return patterns.flatMap((re) => [...text.matchAll(re)].map((m) => m[2]));
}

/** Only `./...` paths that stay inside the folder (no `..` segment anywhere) are allowed. */
function isLocal(target: string): boolean {
  return target.startsWith('./') && !target.split('/').includes('..');
}

describe('the engine folder stays portable', () => {
  test('the checker recognises every import form and rejects escapes', () => {
    const bad = [
      `import { a } from 'x';`,
      `import { a } from "x";`,
      `import 'x';`,
      `const m = await import('x');`,
      `const m = require("x");`,
      `export * from '../content/x';`,
      `import { a } from './../content/x';`,
      `import { a } from './sub/../../x';`,
    ];
    for (const line of bad) {
      expect(importTargets(line).filter((t) => !isLocal(t)), line).toHaveLength(1);
    }
    expect(importTargets(`import { a } from './patch.ts';`).filter((t) => !isLocal(t))).toEqual([]);
  });

  test('no file imports anything outside src/audio-synth/', () => {
    const files = listSources(dir);
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      for (const target of importTargets(readFileSync(dir + file, 'utf8'))) {
        if (!isLocal(target)) offenders.push(`${file} -> ${target}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the README documents each of the five concepts and how to port it', () => {
    const readme = readFileSync(dir + 'README.md', 'utf8');
    for (const heading of ['Source', 'Envelope', 'Filter', 'Layer', 'normalize']) {
      expect(readme, heading).toContain(heading);
    }
    expect(readme).toContain('Porting it to another project');
    expect(readme).toContain('renderPatch');
  });
});

describe('presets', () => {
  test('each preset is valid and renders', () => {
    for (const [name, patch] of Object.entries({ clickPreset, bellPreset, whooshPreset })) {
      expect(validatePatch(patch, 44100), name).toEqual([]);
      expect(renderPatch(patch, 44100).length, name).toBeGreaterThan(0);
    }
  });
});
