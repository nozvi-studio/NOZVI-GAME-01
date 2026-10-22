import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildLevelDocument } from '../src/content/authoring.ts';
import type { LevelSource, PieceSource } from '../src/content/authoring.ts';
import type { LevelDocument } from '../src/content/document.ts';
import { anchorDocument } from './fixtures/anchorLevels.ts';
import { buildPoseSpace, solveExactCover, solveLevel, solvePoseSpace } from '../src/content/solver.ts';

const LEVELS_DIR = resolve(process.cwd(), 'src/content/levels');
const readLevel = (id: string): LevelDocument =>
  JSON.parse(readFileSync(resolve(LEVELS_DIR, `${id}.json`), 'utf8')) as LevelDocument;

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

function freeDoc(id: string, pieces: PieceSource[], inSample = pieces.length): LevelDocument {
  const source: LevelSource = {
    id,
    title: 'Thử phủ chính xác',
    chapter: 1,
    order: 900,
    contentRevision: 'test-v1',
    rotationEnabled: false,
    placement: 'free',
    pieces,
    sampleSolutions: [pieces.slice(0, inSample).map((piece) => ({ pieceId: piece.id, anchorId: 'A', turns: 0 as const }))],
    learningObjective: 'thử',
    difficultyEstimate: 1,
    distractors: [],
    ftueSteps: [],
  };
  return buildLevelDocument(source);
}

describe('bộ giải phủ chính xác = bộ giải gặp-nhau-ở-giữa trên màn chỉ xếp hình', () => {
  // Chapter 1 as anchor-mode fixtures (the live levels are free placement now, too big for the general solver)
  const ids = [
    ...Array.from({ length: 10 }, (_, i) => `1-${i + 1}`),
    ...readdirSync(LEVELS_DIR)
      .filter((f) => /^3-[1-4]\.json$/.test(f))
      .map((f) => f.replace('.json', '')),
  ];

  test('có đủ màn chương 1 và 3-1…3-4 để đối chiếu', () => {
    expect(ids.length).toBe(14);
  });

  test.each(ids)('%s: cùng số nghiệm và nghiệm ít mảnh hơn', (id) => {
    const doc = id.startsWith('1-') ? anchorDocument(id) : readLevel(id);
    const space = buildPoseSpace(doc);
    const general = solvePoseSpace(space);
    const exact = solveExactCover(space);
    expect(general.proven).toBe(true);
    expect(exact.proven).toBe(true);
    expect(exact.solutionCount).toBe(general.solutionCount);
    expect(exact.fewerPieceSolutions).toBe(general.fewerPieceSolutions);
  });

  test('fixture: một nghiệm, hai nghiệm (hoán vị vuông/hai tam giác), vô nghiệm, mảnh thừa, mảnh giống hệt', () => {
    const cases: Array<[LevelDocument, number, number]> = [
      [freeDoc('c-one', [p('S1', 'square', 0, 48, 16, 16), p('D1', 'diamond', 0, 48, 64, 64)]), 1, 0],
      [freeDoc('c-two', [p('S1', 'square', 0, 48, 16, 16), p('T1', 'triangle', 0, 48, 64, 96), p('T2', 'triangle', 2, 48, 64, 96)]), 2, 0],
      [freeDoc('c-twins', [p('S1', 'square', 0, 48, 16, 16), p('S2', 'square', 0, 48, 64, 64)]), 1, 0],
      [freeDoc('c-extra', [p('S1', 'square', 0, 48, 16, 16), p('D1', 'diamond', 0, 48, 64, 64), p('X1', 'triangle', 0, 48, 40, 104)], 2), 1, 1],
    ];
    for (const [doc, count, fewer] of cases) {
      const space = buildPoseSpace(doc);
      const exact = solveExactCover(space);
      const general = solvePoseSpace(space);
      expect(exact).toMatchObject({ solutionCount: count, fewerPieceSolutions: fewer, proven: true });
      expect(exact.solutionCount).toBe(general.solutionCount);
    }
    const zero = freeDoc('c-zero', [p('S1', 'square', 0, 48, 16, 16)]);
    zero.targetCells = zero.targetCells.map(([x, y]) => [x + 4, y] as const);
    expect(solveExactCover(buildPoseSpace(zero))).toMatchObject({ solutionCount: 0, proven: true });
  });

  test('vượt trần nút thì không khẳng định đã chứng minh', () => {
    const doc = readLevel('3-7');
    expect(solveExactCover(buildPoseSpace(doc), { nodeLimit: 5 }).proven).toBe(false);
  });
});

describe('màn đặt tự do 3-5…3-10: duy nhất một nghiệm, đã chứng minh', () => {
  test.each(['3-5', '3-6', '3-7', '3-8', '3-9', '3-10'])('%s', (id) => {
    const doc = readLevel(id);
    const result = solveLevel(doc, { tilingOnly: true });
    expect(result).toMatchObject({ solutionCount: 1, fewerPieceSolutions: 0, proven: true });
  });

  test('gặp-nhau-ở-giữa không chứng minh nổi 3-7 (nhiều mảnh xoay trên lưới tự do), nên cần bộ giải phủ chính xác', () => {
    expect(solveLevel(readLevel('3-7')).proven).toBe(false);
  });
});
