import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('chỉ SceneDirector được đổi scene', () => {
  test('scene.start( chỉ có trong transitions/SceneDirector.ts', () => {
    const offenders = walk(SRC)
      .filter((file) => /scene\.start\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file).replaceAll('\\', '/'));
    expect(offenders).toEqual(['presentation/transitions/SceneDirector.ts']);
  });
});
