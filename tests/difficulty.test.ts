import { describe, expect, test } from 'vitest';
import { buildLevelDocument } from '../src/content/authoring.ts';
import { searchSolutions } from '../src/content/authoringReport.ts';
import type { LevelDocument } from '../src/content/document.ts';
import { LEVEL_SOURCES } from '../src/content/sources/index.ts';
import { ANCHOR_SOURCES, anchorDocument } from './fixtures/anchorLevels.ts';
import {
  DIFFICULTY_THRESHOLDS,
  DIFFICULTY_WEIGHTS,
  collectWarnings,
  scoreDifficulty,
} from '../src/content/difficulty.ts';

function squareCells(size: number) {
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cells.push([x, y]);
    }
  }
  return cells;
}

describe('scoreDifficulty - Fixture tay', () => {
  test('single: một mảnh vuông 16, không chồng lấn, điểm 1', () => {
    const doc: LevelDocument = {
      schemaVersion: 1,
      id: 'fixture-single',
      title: 'Single',
      chapter: 2,
      order: 1,
      contentRevision: 'rev-1',
      board: { width: 128, height: 160 },
      rotationEnabled: false,
      learningObjective: 'test',
      difficultyEstimate: 1,
      pieces: [
        {
          id: 'S1',
          shapeKind: 'square',
          frameSize: 16,
          cells: squareCells(16),
          anchors: [{ id: 'A', x: 0, y: 0 }],
          color: 'amber',
        },
      ],
      targetCells: squareCells(16),
      sampleSolutions: [[{ pieceId: 'S1', anchorId: 'A', turns: 0 }]],
      distractors: [],
      ftueSteps: [],
    };

    const report = {
      solutionCount: 1,
      fewerPieceSolutions: 0,
      proven: true,
      poseCounts: [1],
      elapsedMs: 1,
      distractors: [],
    };

    const res = scoreDifficulty(doc, report);
    expect(res.parts.pieces).toBe(0);
    expect(res.parts.choices).toBe(0);
    expect(res.parts.hollow).toBe(0);
    expect(res.parts.revive).toBe(0);
    expect(res.parts.nearMiss).toBe(0);
    expect(res.parts.hiddenEdges).toBe(0);
    expect(res.raw).toBe(0);
    expect(res.score).toBe(1);
  });

  test('pair: hai mảnh vuông 16 chồng một nửa, có gây nhiễu, điểm 1', () => {
    const s1Cells = squareCells(16);
    const s2Cells = squareCells(16);

    // Target là XOR của S1(0,0) và S2(8,0)
    // S1: [0, 15] x [0, 15], S2: [8, 23] x [0, 15]
    // XOR: [0, 7] x [0, 15] và [16, 23] x [0, 15] -> 256 cells
    const targetCells: Array<[number, number]> = [];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 8; x++) targetCells.push([x, y]);
      for (let x = 16; x < 24; x++) targetCells.push([x, y]);
    }

    const doc: LevelDocument = {
      schemaVersion: 1,
      id: 'fixture-pair',
      title: 'Pair',
      chapter: 2,
      order: 2,
      contentRevision: 'rev-1',
      board: { width: 128, height: 160 },
      rotationEnabled: false,
      learningObjective: 'test',
      difficultyEstimate: 1,
      pieces: [
        {
          id: 'S1',
          shapeKind: 'square',
          frameSize: 16,
          cells: s1Cells,
          anchors: [
            { id: 'A', x: 0, y: 0 },
            { id: 'B', x: 0, y: 8 },
          ],
          color: 'amber',
        },
        {
          id: 'S2',
          shapeKind: 'square',
          frameSize: 16,
          cells: s2Cells,
          anchors: [{ id: 'A', x: 8, y: 0 }],
          color: 'amber',
        },
      ],
      targetCells,
      sampleSolutions: [
        [
          { pieceId: 'S1', anchorId: 'A', turns: 0 },
          { pieceId: 'S2', anchorId: 'A', turns: 0 },
        ],
      ],
      distractors: [{ pieceId: 'S1', anchorId: 'B', reason: 'gây nhiễu' }],
      ftueSteps: [],
    };

    const report = {
      solutionCount: 1,
      fewerPieceSolutions: 0,
      proven: true,
      poseCounts: [2, 1],
      elapsedMs: 1,
      distractors: [{ pieceId: 'S1', anchorId: 'B', reason: 'gây nhiễu', changedCells: 256 }],
    };

    const res = scoreDifficulty(doc, report);
    expect(res.parts.pieces).toBeCloseTo(1 / 6, 6);
    expect(res.parts.choices).toBeCloseTo(1 / 20, 6);
    expect(res.parts.hollow).toBeCloseTo(1 / 3, 6);
    expect(res.parts.revive).toBe(0);
    expect(res.parts.nearMiss).toBe(0);
    expect(res.parts.hiddenEdges).toBeCloseTo(32 / 128, 6);
    expect(res.raw).toBeCloseTo(31 / 240, 6);
    expect(res.score).toBe(1);
  });

  test('triple: 3 mảnh, có ô 3 lớp (revive), điểm 2', () => {
    // S1: 16x16 (0,0)
    // S2: 16x16 (8,0)
    // S3: 32x32 (0,0)
    // Layer counts:
    // [0, 7] x [0, 15]: S1 + S3 = 2
    // [8, 15] x [0, 15]: S1 + S2 + S3 = 3 (revive, 128 cells)
    // [16, 23] x [0, 15]: S2 + S3 = 2
    // còn lại của S3: 1 lớp
    // Target cells: những ô lớp lẻ = 128 (3 lớp) + 640 (1 lớp) = 768 cells
    const targetCells: Array<[number, number]> = [];
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const inS1 = x < 16 && y < 16;
        const inS2 = x >= 8 && x < 24 && y < 16;
        const inS3 = true;
        const count = (inS1 ? 1 : 0) + (inS2 ? 1 : 0) + (inS3 ? 1 : 0);
        if (count % 2 === 1) targetCells.push([x, y]);
      }
    }

    const doc: LevelDocument = {
      schemaVersion: 1,
      id: 'fixture-triple',
      title: 'Triple',
      chapter: 2,
      order: 3,
      contentRevision: 'rev-1',
      board: { width: 128, height: 160 },
      rotationEnabled: false,
      learningObjective: 'test',
      difficultyEstimate: 2,
      pieces: [
        {
          id: 'S1',
          shapeKind: 'square',
          frameSize: 16,
          cells: squareCells(16),
          anchors: [{ id: 'A', x: 0, y: 0 }],
          color: 'amber',
        },
        {
          id: 'S2',
          shapeKind: 'square',
          frameSize: 16,
          cells: squareCells(16),
          anchors: [{ id: 'A', x: 8, y: 0 }],
          color: 'amber',
        },
        {
          id: 'S3',
          shapeKind: 'square',
          frameSize: 32,
          cells: squareCells(32),
          anchors: [{ id: 'A', x: 0, y: 0 }],
          color: 'amber',
        },
      ],
      targetCells,
      sampleSolutions: [
        [
          { pieceId: 'S1', anchorId: 'A', turns: 0 },
          { pieceId: 'S2', anchorId: 'A', turns: 0 },
          { pieceId: 'S3', anchorId: 'A', turns: 0 },
        ],
      ],
      distractors: [],
      ftueSteps: [],
    };

    const report = {
      solutionCount: 1,
      fewerPieceSolutions: 0,
      proven: true,
      poseCounts: [1, 1, 1],
      elapsedMs: 1,
      distractors: [],
    };

    const res = scoreDifficulty(doc, report);
    expect(res.parts.pieces).toBeCloseTo(2 / 6, 6);
    expect(res.parts.choices).toBe(0);
    expect(res.parts.hollow).toBeCloseTo(1 / 4, 6);
    expect(res.parts.revive).toBeCloseTo(1 / 6, 6);
    expect(res.parts.nearMiss).toBe(0);
    expect(res.parts.hiddenEdges).toBeCloseTo(0.3125, 6);
    expect(res.raw).toBeCloseTo(41 / 240, 6);
    expect(res.score).toBe(2);
  });

  test('free: đặt tự do, S1 khung 32 (0,0), S2 khung 16 (8,8), điểm 3', () => {
    // S1 khung 32 (0,0), S2 khung 16 (8,8)
    // S2 lọt trong S1 -> 256 ô 2 lớp, 768 ô 1 lớp (target)
    const targetCells: Array<[number, number]> = [];
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const inS2 = x >= 8 && x < 24 && y >= 8 && y < 24;
        if (!inS2) targetCells.push([x, y]);
      }
    }

    const doc: LevelDocument = {
      schemaVersion: 1,
      id: 'fixture-free',
      title: 'Free',
      chapter: 2,
      order: 4,
      contentRevision: 'rev-1',
      board: { width: 128, height: 160 },
      rotationEnabled: false,
      placement: 'free',
      learningObjective: 'test',
      difficultyEstimate: 3,
      pieces: [
        {
          id: 'S1',
          shapeKind: 'square',
          frameSize: 32,
          cells: squareCells(32),
          anchors: [{ id: 'A', x: 0, y: 0 }],
          color: 'amber',
        },
        {
          id: 'S2',
          shapeKind: 'square',
          frameSize: 16,
          cells: squareCells(16),
          anchors: [{ id: 'A', x: 8, y: 8 }],
          color: 'amber',
        },
      ],
      targetCells,
      sampleSolutions: [
        [
          { pieceId: 'S1', anchorId: 'A', turns: 0 },
          { pieceId: 'S2', anchorId: 'A', turns: 0 },
        ],
      ],
      distractors: [],
      ftueSteps: [],
    };

    const report = {
      solutionCount: 1,
      fewerPieceSolutions: 0,
      proven: true,
      poseCounts: [221, 285],
      elapsedMs: 1,
      distractors: [],
    };

    const res = scoreDifficulty(doc, report);
    expect(res.parts.pieces).toBeCloseTo(1 / 6, 6);
    expect(res.parts.choices).toBeCloseTo(Math.log2(62985) / 20, 6);
    expect(res.parts.hollow).toBeCloseTo(1 / 4, 6);
    expect(res.parts.revive).toBe(0);
    expect(res.parts.nearMiss).toBeCloseTo(1 - 256 / 768, 6);
    expect(res.parts.hiddenEdges).toBe(0);
    expect(res.raw).toBeCloseTo(0.357617, 5);
    expect(res.score).toBe(3);
  });

  test('nearMiss màn free: bỏ qua các hướng làm mảnh vượt biên bàn', () => {
    // Đặt mảnh sát mép trên-trái (0,0): hướng dx=-8 và dy=-8 sẽ vượt biên bàn
    const doc: LevelDocument = {
      schemaVersion: 1,
      id: 'fixture-free-corner',
      title: 'Free Corner',
      chapter: 2,
      order: 5,
      contentRevision: 'rev-1',
      board: { width: 128, height: 160 },
      rotationEnabled: false,
      placement: 'free',
      learningObjective: 'test',
      difficultyEstimate: 1,
      pieces: [
        {
          id: 'S1',
          shapeKind: 'square',
          frameSize: 16,
          cells: squareCells(16),
          anchors: [{ id: 'A', x: 0, y: 0 }],
          color: 'amber',
        },
      ],
      targetCells: squareCells(16),
      sampleSolutions: [[{ pieceId: 'S1', anchorId: 'A', turns: 0 }]],
      distractors: [],
      ftueSteps: [],
    };

    const report = {
      solutionCount: 1,
      fewerPieceSolutions: 0,
      proven: true,
      poseCounts: [100],
      elapsedMs: 1,
      distractors: [],
    };

    const res = scoreDifficulty(doc, report);
    // Ở góc (0,0), chỉ dịch được sang phải (8,0) và xuống dưới (0,8).
    // Mỗi hướng làm đổi 128 ô (256 - 128 = 128 overlap). Số ô đổi = 128 + 128 = 256.
    // minChanged = 256, target = 256 -> nearMiss = 1 - 256/256 = 0.
    expect(res.parts.nearMiss).toBe(0);
  });

  test('hiddenEdges: mép ngoài bàn cờ coi là không phải mục tiêu', () => {
    // Mảnh ở sát mép (0,0), toàn bộ biên ngoài bàn (nx < 0 hoặc ny < 0) coi là non-target
    const doc: LevelDocument = {
      schemaVersion: 1,
      id: 'fixture-border',
      title: 'Border',
      chapter: 2,
      order: 6,
      contentRevision: 'rev-1',
      board: { width: 128, height: 160 },
      rotationEnabled: false,
      learningObjective: 'test',
      difficultyEstimate: 1,
      pieces: [
        {
          id: 'S1',
          shapeKind: 'square',
          frameSize: 16,
          cells: squareCells(16),
          anchors: [{ id: 'A', x: 0, y: 0 }],
          color: 'amber',
        },
      ],
      // Target là rỗng (0 ô) để thử biên: C_in là non-target, C_out là non-target -> hidden!
      targetCells: [],
      sampleSolutions: [[{ pieceId: 'S1', anchorId: 'A', turns: 0 }]],
      distractors: [],
      ftueSteps: [],
    };

    const report = {
      solutionCount: 1,
      fewerPieceSolutions: 0,
      proven: true,
      poseCounts: [1],
      elapsedMs: 1,
      distractors: [],
    };

    const res = scoreDifficulty(doc, report);
    // Khi target rỗng: mọi ô trên bàn và ngoài bàn đều là non-target.
    // Vì vậy inTarget (false) === outTarget (false) với toàn bộ 64 đoạn biên -> hiddenEdges = 1.
    expect(res.parts.hiddenEdges).toBe(1);
  });
});

describe('scoreDifficulty - Hiệu chỉnh 6 màn Chương 1', () => {
  const EXPECTED_CH1: Record<
    string,
    {
      pieces: number;
      choices: number;
      hollow: number;
      revive: number;
      nearMiss: number;
      hiddenEdges: number;
      raw: number;
      score: 1 | 2 | 3 | 4 | 5;
    }
  > = {
    '1-1': {
      pieces: 1 / 6,
      choices: 2 / 20,
      hollow: 0,
      revive: 0,
      nearMiss: 1 - 1280 / 2304,
      hiddenEdges: 0 / 380,
      raw: 0.125,
      score: 1,
    },
    '1-2': {
      pieces: 3 / 6,
      choices: 2 / 20,
      hollow: 0,
      revive: 0,
      nearMiss: 1 - 352 / 3904,
      hiddenEdges: 222 / 586,
      raw: 0.3372,
      score: 3,
    },
    '1-3': {
      pieces: 3 / 6,
      choices: 0,
      hollow: 0,
      revive: 0,
      nearMiss: 0,
      hiddenEdges: 90 / 518,
      raw: 0.1347,
      score: 1,
    },
    '1-4': {
      pieces: 6 / 6,
      choices: 1 / 20,
      hollow: 0,
      revive: 0,
      nearMiss: 1 - 768 / 5208,
      hiddenEdges: 284 / 840,
      raw: 0.408,
      score: 3,
    },
    '1-5': {
      pieces: 4 / 6,
      choices: 0,
      hollow: 0,
      revive: 0,
      nearMiss: 0,
      hiddenEdges: 176 / 568,
      raw: 0.1953,
      score: 2,
    },
    '1-6': {
      pieces: 2 / 6,
      choices: 3 / 20,
      hollow: 0,
      revive: 0,
      nearMiss: 1 - 704 / 3456,
      hiddenEdges: 188 / 570,
      raw: 0.2896,
      score: 3,
    },
  };

  for (const [id, expected] of Object.entries(EXPECTED_CH1)) {
    test(`Màn ${id} khớp chính xác các thành phần và điểm độ khó`, () => {
      // Calibrated on the anchor-mode copy of chapter 1 (the live levels are free placement now)
      const doc = anchorDocument(id);
      const report = searchSolutions(doc);
      const res = scoreDifficulty(doc, report);

      expect(res.parts.pieces).toBeCloseTo(expected.pieces, 4);
      expect(res.parts.choices).toBeCloseTo(expected.choices, 4);
      expect(res.parts.hollow).toBeCloseTo(expected.hollow, 4);
      expect(res.parts.revive).toBeCloseTo(expected.revive, 4);
      expect(res.parts.nearMiss).toBeCloseTo(expected.nearMiss, 4);
      expect(res.parts.hiddenEdges).toBeCloseTo(expected.hiddenEdges, 4);
      expect(res.raw).toBeCloseTo(expected.raw, 4);
      expect(res.score).toBe(expected.score);
    });
  }
});

describe('scoreDifficulty - Hiệu chỉnh màn spec C còn giữ nguyên (2-1, 2-4…2-6 và 2-7…2-13 chuyển từ chương 3 cũ; 2-2/2-3 là bản remake chưa hiệu chỉnh)', () => {
  const EXPECTED_SPEC_C: Record<
    string,
    {
      pieces: number;
      choices: number;
      hollow: number;
      revive: number;
      nearMiss: number;
      hiddenEdges: number;
      raw: number;
      score: 1 | 2 | 3 | 4 | 5;
    }
  > = {
    '2-1': {
      pieces: 1 / 6,
      choices: 4 / 20,
      hollow: 576 / 2304,
      revive: 0 / 1728,
      nearMiss: 1 - 352 / 1728,
      hiddenEdges: 94 / 428,
      raw: 0.2717,
      score: 3,
    },
    '2-4': {
      pieces: 2 / 6,
      choices: 6 / 20,
      hollow: 384 / 3584,
      revive: 128 / 3200,
      nearMiss: 1 - 192 / 3200,
      hiddenEdges: 4 / 570,
      raw: 0.2988,
      score: 3,
    },
    '2-5': {
      pieces: 3 / 6,
      choices: 8 / 20,
      hollow: 1284 / 3196,
      revive: 512 / 1912,
      nearMiss: 1 - 224 / 1912,
      hiddenEdges: 2 / 636,
      raw: 0.4,
      score: 3,
    },
    '2-6': {
      pieces: 3 / 6,
      choices: 8 / 20,
      hollow: 1536 / 4096,
      revive: 512 / 2560,
      nearMiss: 1 - 448 / 2560,
      hiddenEdges: 24 / 764,
      raw: 0.3875,
      score: 3,
    },
    '2-7': {
      pieces: 2 / 6,
      choices: 6 / 20,
      hollow: 1116 / 5148,
      revive: 128 / 4032,
      nearMiss: 1 - 192 / 4032,
      hiddenEdges: 4 / 574,
      raw: 0.3108,
      score: 3,
    },
    '2-8': {
      pieces: 3 / 6,
      choices: 7 / 20,
      hollow: 217 / 4163,
      revive: 0 / 3946,
      nearMiss: 1 - 456 / 3946,
      hiddenEdges: 68 / 698,
      raw: 0.3449,
      score: 3,
    },
    '2-9': {
      pieces: 1, // 6/6
      choices: 13 / 20,
      hollow: 256 / 4096,
      revive: 0 / 3840,
      nearMiss: 1 - 184 / 3840,
      hiddenEdges: 68 / 788,
      raw: 0.5288,
      score: 5,
    },
    '2-10': {
      pieces: 4 / 6,
      choices: 10 / 20,
      hollow: 288 / 4192,
      revive: 0 / 3904,
      nearMiss: 1 - 256 / 3904,
      hiddenEdges: 8 / 822,
      raw: 0.4073,
      score: 3,
    },
    '2-11': {
      pieces: 3 / 6,
      choices: Math.log2(3 * 4 * 4 * 4) / 20,
      hollow: 812 / 5164,
      revive: 0 / 4352,
      nearMiss: 1 - 224 / 4352,
      hiddenEdges: 66 / 732,
      raw: 0.3708,
      score: 3,
    },
    '2-12': {
      pieces: 2 / 6,
      choices: 6 / 20,
      hollow: 980 / 2560,
      revive: 812 / 1580,
      nearMiss: 1 - 512 / 1580,
      hiddenEdges: 16 / 574,
      raw: 0.3383,
      score: 3,
    },
    '2-13': {
      pieces: 4 / 6,
      choices: 10 / 20,
      hollow: 2732 / 7200,
      revive: 1364 / 4468,
      nearMiss: 1 - 192 / 4468,
      hiddenEdges: 8 / 1084,
      raw: 0.4718,
      score: 4,
    },
  };

  for (const [id, expected] of Object.entries(EXPECTED_SPEC_C)) {
    test(`Màn ${id} khớp chính xác các thành phần và điểm độ khó`, () => {
      // Calibrated on the anchor-mode copy (chapter 2 is free placement now)
      const source = ANCHOR_SOURCES[id];
      expect(source).toBeDefined();
      const doc = buildLevelDocument(source);
      const report = searchSolutions(doc);
      const res = scoreDifficulty(doc, report);

      expect(res.parts.pieces).toBeCloseTo(expected.pieces, 4);
      expect(res.parts.choices).toBeCloseTo(expected.choices, 4);
      expect(res.parts.hollow).toBeCloseTo(expected.hollow, 4);
      expect(res.parts.revive).toBeCloseTo(expected.revive, 4);
      expect(res.parts.nearMiss).toBeCloseTo(expected.nearMiss, 4);
      expect(res.parts.hiddenEdges).toBeCloseTo(expected.hiddenEdges, 4);
      expect(res.raw).toBeCloseTo(expected.raw, 4);
      expect(res.score).toBe(expected.score);
    });
  }
});

describe('collectWarnings', () => {
  test('cảnh báo difficulty-mismatch khi lệch > 1 và không cảnh báo khi lệch <= 1', () => {
    const doc = anchorDocument('1-1'); // difficultyEstimate: 1
    const report = searchSolutions(doc);
    const score = scoreDifficulty(doc, report); // score: 1

    expect(collectWarnings(doc, score)).toEqual([]);

    // Giả lập điểm lệch 1: estimate 1, score 2 -> không cảnh báo
    expect(collectWarnings(doc, { ...score, score: 2 })).toEqual([]);

    // Giả lập điểm lệch 2: estimate 1, score 3 -> cảnh báo
    const warnings = collectWarnings(doc, { ...score, score: 3 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('difficulty-mismatch');
    expect(warnings[0].message).toContain('3');
    expect(warnings[0].message).toContain('1');
  });
});

