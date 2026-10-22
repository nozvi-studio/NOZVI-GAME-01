import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import type { LevelSource } from '../src/content/authoring.ts';
import { authorLevel } from '../src/content/authorLevel.ts';
import { LEVEL_SOURCES } from '../src/content/sources/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEVELS_DIR = resolve(HERE, '../src/content/levels');
const REPORTS_DIR = resolve(HERE, '../docs/testing/levels');

function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

describe('authorLevel - In-memory level authoring pipeline', () => {
  test('kết quả trên 1-1 trùng khớp từng byte với JSON, SVG và báo cáo đã commit', () => {
    const source = LEVEL_SOURCES['1-1'];
    expect(source).toBeDefined();

    const res = authorLevel(source);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.doc.id).toBe('1-1');
    expect(res.report.solutionCount).toBe(1);
    // Free placement inflates the pose space, so the score and a difficulty-mismatch warning are not checked here

    const committedJson = normalizeEol(readFileSync(resolve(LEVELS_DIR, '1-1.json'), 'utf8'));
    const committedSvg = normalizeEol(readFileSync(resolve(REPORTS_DIR, '1-1.svg'), 'utf8'));
    const committedMd = normalizeEol(readFileSync(resolve(REPORTS_DIR, '1-1-report.md'), 'utf8'));

    expect(normalizeEol(res.json)).toBe(committedJson);
    expect(normalizeEol(res.svg)).toBe(committedSvg);
    // Free-placement reports print the solve time, which varies run to run
    const withoutTiming = (md: string) => md.replace(/^- Thời gian giải:.*$/m, '');
    expect(withoutTiming(normalizeEol(res.markdown))).toBe(withoutTiming(committedMd));
  });

  test('nguồn không hợp lệ trả về ok: false kèm issues và không ném lỗi', () => {
    const invalidSource: LevelSource = {
      ...structuredClone(LEVEL_SOURCES['1-1']),
      chapter: 99 as any, // invalid chapter
    };

    const res = authorLevel(invalidSource);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.issues.length).toBeGreaterThan(0);
    expect(res.issues.some((i) => i.field === 'chapter')).toBe(true);
  });

  test('nguồn lỗi hình học trong buildLevelDocument trả về ok: false kèm issues', () => {
    const badGeometrySource: LevelSource = {
      ...structuredClone(LEVEL_SOURCES['1-1']),
      pieces: [
        {
          id: 'D1',
          shapeKind: 'diamond',
          orientation: 0,
          frameSize: 13, // invalid frameSize (not multiple of 16/structural)
          anchors: [{ id: 'A', x: 0, y: 0 }],
        },
      ],
    };

    const res = authorLevel(badGeometrySource);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.issues.length).toBeGreaterThan(0);
  });
});
