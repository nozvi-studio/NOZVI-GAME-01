import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { buildLevelDocument } from '../src/content/authoring.ts';
import { searchSolutions } from '../src/content/authoringReport.ts';
import { loadLevel } from '../src/content/catalog.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { LEVEL_SOURCES } from '../src/content/sources/index.ts';
import { validateLevel } from '../src/content/validate.ts';

type Expectation = {
  id: string;
  pieceCount: number;
  targetCells: number;
  /** Số ô đổi so với mục tiêu của từng tư thế gây nhiễu, theo thứ tự `distractors` */
  distractorCells: number[];
};

/**
 * Khoá dữ liệu một màn. Các con số được tính trước bằng prototype độc lập
 * (raster trên-trái + duyệt tổ hợp) khi viết plan, không lấy từ chính code này.
 */
function checkLevel(e: Expectation): void {
  describe(`màn ${e.id}`, () => {
    const source = LEVEL_SOURCES[e.id];
    test('có nguồn mô tả trong LEVEL_SOURCES', () => {
      expect(source).toBeDefined();
    });
    // Chưa có nguồn thì chỉ test trên đỏ; không dựng tiếp để khỏi làm hỏng cả file
    if (!source) return;

    const doc = buildLevelDocument(source);
    const report = searchSolutions(doc);

    test('nguồn dựng được và qua validator', () => {
      const result = validateLevel(doc);
      expect(result.ok ? [] : result.issues).toEqual([]);
    });

    test('đúng số mảnh và số ô mục tiêu', () => {
      expect(doc.pieces).toHaveLength(e.pieceCount);
      expect(doc.targetCells).toHaveLength(e.targetCells);
    });

    test('đúng một nghiệm, không có nghiệm dùng ít mảnh hơn', () => {
      expect(report.solutionCount).toBe(1);
      expect(report.fewerPieceSolutions).toBe(0);
    });

    test('mỗi tư thế gây nhiễu đổi đúng số ô dự kiến', () => {
      expect(report.distractors.map((d) => d.changedCells)).toEqual(e.distractorCells);
    });

    test('JSON đã commit khớp với nguồn', () => {
      const path = fileURLToPath(new URL(`../src/content/levels/${e.id}.json`, import.meta.url));
      expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(doc);
    });

    test('manifest trỏ đúng dữ liệu; harness nạp được; campaign chỉ nạp khi approved', () => {
      const entry = campaignManifest.find((m) => m.id === e.id)!;
      expect(entry.dataPath).toBe(`src/content/levels/${e.id}.json`);
      expect(entry.contentRevision).toBe(source.contentRevision);
      expect(['validated', 'approved']).toContain(entry.status);
      expect(loadLevel(e.id, 'harness').id).toBe(e.id);
      if (entry.status === 'approved') {
        expect(loadLevel(e.id, 'campaign').id).toBe(e.id);
      } else {
        expect(() => loadLevel(e.id, 'campaign')).toThrow(`unavailable:${e.id}`);
      }
    });
  });
}

checkLevel({ id: '1-2', pieceCount: 4, targetCells: 3904, distractorCells: [] });
checkLevel({ id: '1-3', pieceCount: 4, targetCells: 2368, distractorCells: [] });
checkLevel({ id: '1-4', pieceCount: 7, targetCells: 5208, distractorCells: [] });
checkLevel({ id: '1-5', pieceCount: 5, targetCells: 3656, distractorCells: [] });
checkLevel({ id: '1-6', pieceCount: 3, targetCells: 3456, distractorCells: [] });
