import { describe, expect, test } from 'vitest';
import { buildLevelDocument } from '../src/content/authoring.ts';
import type { LevelSource, PieceSource } from '../src/content/authoring.ts';
import type { LevelDocument } from '../src/content/document.ts';
import { FREE_DEMO_SOURCE } from '../src/content/devLevels.ts';
import { NO_OVERLAP_CHAPTERS } from '../src/content/chapters.ts';
import { LEVEL_SOURCES } from '../src/content/sources/index.ts';
import { anchorDocument } from './fixtures/anchorLevels.ts';
import {
  SOLVER_LIMIT,
  balancedSplit,
  buildPoseSpace,
  solveLevel,
  solvePoseSpace,
} from '../src/content/solver.ts';
import type { PoseSpace } from '../src/content/solver.ts';

function p(
  id: string,
  shapeKind: PieceSource['shapeKind'],
  orientation: PieceSource['orientation'],
  frameSize: number,
  x: number,
  y: number
): PieceSource {
  return { id, shapeKind, orientation, frameSize, anchors: [{ id: 'A', x, y }] };
}

/** Màn free; nghiệm mẫu gồm `inSample` mảnh đầu tại neo A, turns 0. */
function freeDoc(
  id: string,
  pieces: PieceSource[],
  options: { inSample?: number; rotationEnabled?: boolean } = {}
): LevelDocument {
  const rotationEnabled = options.rotationEnabled ?? false;
  const used = pieces.slice(0, options.inSample ?? pieces.length);
  const source: LevelSource = {
    id,
    title: 'Thử bộ giải',
    chapter: rotationEnabled ? 4 : 2,
    order: 900,
    contentRevision: 'test-v1',
    rotationEnabled,
    placement: 'free',
    pieces,
    sampleSolutions: [used.map((piece) => ({ pieceId: piece.id, anchorId: 'A', turns: 0 as const }))],
    learningObjective: 'thử bộ giải',
    difficultyEstimate: 1,
    distractors: [],
    ftueSteps: [],
  };
  return buildLevelDocument(source);
}

/** Duyệt hết mọi tổ hợp của cùng không gian tư thế, không dùng băm. */
function bruteForce(space: PoseSpace): { count: number; fewer: number } {
  const target = new Uint8Array(space.width * space.height);
  for (const c of space.target) target[c] = 1;
  const mask = new Uint8Array(target.length);
  const picks: string[] = [];
  const solutions = new Set<string>();
  const fewer = new Set<string>();
  const visit = (index: number): void => {
    if (index === space.pieces.length) {
      for (let i = 0; i < mask.length; i++) if (mask[i] !== target[i]) return;
      const groups = new Map<string, string[]>();
      space.pieces.forEach((piece, i) => {
        groups.set(piece.group, [...(groups.get(piece.group) ?? []), picks[i]]);
      });
      const key = [...groups.keys()]
        .sort()
        .map((g) => `${g}=${groups.get(g)!.sort().join('|')}`)
        .join('/');
      solutions.add(key);
      if (picks.includes('khay')) fewer.add(key);
      return;
    }
    picks[index] = 'khay';
    visit(index + 1);
    for (const pose of space.pieces[index].poses) {
      for (const c of pose.cells) mask[c] ^= 1;
      picks[index] = `${pose.x},${pose.y},${pose.turns}`;
      visit(index + 1);
      for (const c of pose.cells) mask[c] ^= 1;
    }
  };
  visit(0);
  return { count: solutions.size, fewer: fewer.size };
}

const demo = buildLevelDocument(FREE_DEMO_SOURCE);

describe('Không gian tư thế (FP-06)', () => {
  test('màn thử free: 165/165/165/198 tư thế, 2904 ô mục tiêu (số tính bằng prototype)', () => {
    expect(demo.targetCells).toHaveLength(2904);
    const space = buildPoseSpace(demo);
    expect(space.pieces.map((piece) => piece.poses.length)).toEqual([165, 165, 165, 198]);
    // Mọi gốc là bội của 8
    for (const piece of space.pieces) {
      for (const pose of piece.poses) {
        expect(pose.x % 8).toBe(0);
        expect(pose.y % 8).toBe(0);
      }
    }
  });

  test('màn neo: tư thế là các neo, turns 0 khi không xoay', () => {
    const space = buildPoseSpace(anchorDocument('1-1'));
    expect(space.pieces.map((piece) => piece.poses.map((pose) => [pose.x, pose.y, pose.turns]))).toEqual([
      [
        [16, 56, 0],
        [16, 72, 0],
      ],
      [
        [64, 56, 0],
        [64, 72, 0],
      ],
    ]);
  });

  test('mục tiêu ra ngoài bàn thu nhỏ thì báo lỗi', () => {
    expect(() => buildPoseSpace(demo, { width: 32, height: 32 })).toThrow(/solver:target-outside-board/);
  });
});

describe('balancedSplit (FP-08, FP-09)', () => {
  test('4 và 5 mảnh khung 48 (số tính bằng prototype)', () => {
    expect(balancedSplit([166, 166, 166, 199]).maxProduct).toBe(33_034);
    const five = balancedSplit([166, 166, 166, 199, 166]);
    expect(five.maxProduct).toBe(4_574_296);
    expect(five.maxProduct).toBeLessThanOrEqual(SOLVER_LIMIT);
    expect([...five.table, ...five.scan].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('solveLevel (FP-07, FP-08)', () => {
  test('màn thử free 4 mảnh khung 48: proven, đúng 1 nghiệm', () => {
    expect(solveLevel(demo)).toMatchObject({
      solutionCount: 1,
      fewerPieceSolutions: 0,
      proven: true,
      poseCounts: [165, 165, 165, 198],
    });
  });

  test('fixture một nghiệm: vuông và thoi tách rời', () => {
    const doc = freeDoc('t-one', [p('S1', 'square', 0, 48, 16, 16), p('D1', 'diamond', 0, 48, 64, 64)]);
    expect(solveLevel(doc)).toMatchObject({ solutionCount: 1, fewerPieceSolutions: 0, proven: true });
  });

  test('fixture hai nghiệm: hai tam giác ghép thành vuông đổi chỗ được với mảnh vuông', () => {
    const doc = freeDoc('t-two', [
      p('S1', 'square', 0, 48, 16, 16),
      p('T1', 'triangle', 0, 48, 64, 96),
      p('T2', 'triangle', 2, 48, 64, 96),
    ]);
    expect(solveLevel(doc)).toMatchObject({ solutionCount: 2, fewerPieceSolutions: 0, proven: true });
  });

  test('fixture vô nghiệm: mục tiêu lệch 4 ô khỏi lưới', () => {
    const doc = freeDoc('t-zero', [p('S1', 'square', 0, 48, 16, 16)]);
    doc.targetCells = doc.targetCells.map(([x, y]) => [x + 4, y] as const);
    expect(solveLevel(doc)).toMatchObject({ solutionCount: 0, fewerPieceSolutions: 0, proven: true });
  });

  test('hai mảnh giống hệt đổi chỗ cho nhau chỉ tính một nghiệm', () => {
    const doc = freeDoc('t-twins', [p('S1', 'square', 0, 48, 16, 16), p('S2', 'square', 0, 48, 64, 64)]);
    expect(solveLevel(doc).solutionCount).toBe(1);
  });

  test('mảnh thừa không trong nghiệm mẫu: 1 nghiệm, và đó là nghiệm ít mảnh hơn', () => {
    const doc = freeDoc(
      't-extra',
      [p('S1', 'square', 0, 48, 16, 16), p('D1', 'diamond', 0, 48, 64, 64), p('X1', 'triangle', 0, 48, 40, 104)],
      { inSample: 2 }
    );
    expect(solveLevel(doc)).toMatchObject({ solutionCount: 1, fewerPieceSolutions: 1, proven: true });
  });

  test('vượt giới hạn thì dừng ngay với proven = false', () => {
    expect(solveLevel(demo, { limit: 1000 })).toMatchObject({
      solutionCount: 0,
      fewerPieceSolutions: 0,
      proven: false,
      poseCounts: [165, 165, 165, 198],
    });
  });
});

describe('Kiểm chéo với duyệt hết trên bàn 32 × 32', () => {
  const pieces = [
    p('S1', 'square', 0, 16, 0, 0),
    p('T1', 'triangle', 0, 16, 16, 16),
    p('T2', 'triangle', 2, 16, 16, 16),
  ];

  test('xoay được: 9/36/36 tư thế, 8 nghiệm, bằng kết quả duyệt hết (số tính bằng prototype)', () => {
    const space = buildPoseSpace(freeDoc('t-small-rot', pieces, { rotationEnabled: true }), {
      width: 32,
      height: 32,
    });
    expect(space.pieces.map((piece) => piece.poses.length)).toEqual([9, 36, 36]);
    const solved = solvePoseSpace(space);
    expect(solved.solutionCount).toBe(8);
    expect({ count: solved.solutionCount, fewer: solved.fewerPieceSolutions }).toEqual(bruteForce(space));
  });

  test('không xoay: 9/9/9 tư thế, 2 nghiệm, bằng kết quả duyệt hết', () => {
    const space = buildPoseSpace(freeDoc('t-small', pieces), { width: 32, height: 32 });
    expect(space.pieces.map((piece) => piece.poses.length)).toEqual([9, 9, 9]);
    const solved = solvePoseSpace(space);
    expect(solved.solutionCount).toBe(2);
    expect({ count: solved.solutionCount, fewer: solved.fewerPieceSolutions }).toEqual(bruteForce(space));
  });
});

describe('Hồi quy: mọi màn chế độ neo có nguồn (FP-10)', () => {
  test.each(Object.keys(LEVEL_SOURCES))('%s vẫn đúng 1 nghiệm, không nghiệm ít mảnh, proven', (id) => {
    const doc = buildLevelDocument(LEVEL_SOURCES[id]);
    if (doc.allowUnproven) {
      // 2-9 and 2-25: free placement with overlaps is beyond the solver; the source says so (reviewer-approved)
      expect(solveLevel(doc, { tilingOnly: false }).proven).toBe(false);
      return;
    }
    // Chương chỉ xếp hình dùng bộ giải phủ chính xác khi gặp-nhau-ở-giữa vượt trần (như content:author)
    expect(solveLevel(doc, { tilingOnly: NO_OVERLAP_CHAPTERS.includes(doc.chapter) })).toMatchObject({
      // Free-placement chapter 1 has extra tilings: 1-8 two, 1-10 three, remakes 3-12 and 3-16 two (accepted by the reviewer), 2-3/2-18/2-21/2-23 two
      solutionCount: ({ '1-8': 2, '1-10': 3, '3-12': 2, '3-16': 2, '2-3': 2, '2-18': 2, '2-21': 2, '2-23': 2 } as Record<string, number>)[id] ?? 1,
      fewerPieceSolutions: 0,
      proven: true,
    });
  });
});
