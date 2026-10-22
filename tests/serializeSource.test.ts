import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { constNameFromTitle } from '../src/content/newLevel.ts';
import { serializeLevelSource } from '../src/content/serializeSource.ts';
import { LEVEL_SOURCES } from '../src/content/sources/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCES_DIR = resolve(HERE, '../src/content/sources');

function stripLeadingComment(fileContent: string): string {
  // Chuẩn hoá xuống dòng CRLF/LF về LF
  const normalized = fileContent.replace(/\r\n/g, '\n');
  // Bỏ khối comment /** ... */ hoặc /* ... */ trước export const
  return normalized.replace(/\/\*\*[\s\S]*?\*\/\n/g, '').replace(/\/\*[\s\S]*?\*\/\n/g, '');
}

describe('serializeLevelSource - Byte lock', () => {
  test('trùng từng byte với nguồn 1-1 sau khi bỏ comment đầu', () => {
    const raw = readFileSync(resolve(SOURCES_DIR, '1-1.ts'), 'utf8');
    const expected = stripLeadingComment(raw);
    const actual = serializeLevelSource(LEVEL_SOURCES['1-1'], 'songTinh');
    expect(actual).toBe(expected);
  });

  test('trùng từng byte với nguồn 1-3, 1-4, 1-6 sau khi bỏ comment đầu', () => {
    for (const [id, constName] of [
      ['1-3', 'canhChim'],
      ['1-4', 'haiDang'],
      ['1-6', 'vuongMien'],
    ]) {
      const raw = readFileSync(resolve(SOURCES_DIR, `${id}.ts`), 'utf8');
      const expected = stripLeadingComment(raw);
      const actual = serializeLevelSource(LEVEL_SOURCES[id], constName);
      expect(actual).toBe(expected);
    }
  });
});

describe('serializeLevelSource - Khứ hồi (round-trip)', () => {
  const tempDir = resolve(tmpdir(), `mirror-serialize-test-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  for (const [id, source] of Object.entries(LEVEL_SOURCES)) {
    test(`Khứ hồi nguồn màn ${id}`, async () => {
      const constName = constNameFromTitle(source.title);
      let text = serializeLevelSource(source, constName);
      // Chuyển import path để file tạm import được LevelSource từ game-next
      const authoringUrl = pathToFileURL(resolve(HERE, '../src/content/authoring.ts')).href;
      text = text.replace(
        "import type { LevelSource } from '../authoring.ts';",
        `import type { LevelSource } from '${authoringUrl}';`
      );

      const filePath = resolve(tempDir, `${id}.ts`);
      writeFileSync(filePath, text, 'utf8');

      const imported = await import(pathToFileURL(filePath).href);
      const loadedSource = imported[constName];
      expect(loadedSource).toBeDefined();
      expect(loadedSource).toEqual(source);
    });
  }
});
