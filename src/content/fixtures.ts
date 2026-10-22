import type { Cell } from '../domain/model.ts';
import { GRID_HEIGHT, GRID_WIDTH } from '../domain/model.ts';
import type { LevelDocument } from './document.ts';

/**
 * Thoi tâm (cx, cy), nửa đường chéo r, theo quy tắc ô biên trên-trái của
 * shapes.ts: giữ ô có tâm trên hai cạnh bên trái, bỏ hai cạnh bên phải. Viết
 * bằng bất đẳng thức riêng để target không phụ thuộc evaluator hay rasterize.
 */
function insideDiamond(px: number, py: number, cx: number, cy: number, r: number): boolean {
  const u = px - cx;
  const v = py - cy;
  return -u - v <= r && u - v < r && u + v < r && v - u <= r;
}

/**
 * Tạo fixture kỹ thuật M0: hai thoi tiếp giáp đỉnh, không xếp chồng.
 * Target được tạo độc lập bằng giải tích hình học, không qua evaluate.
 */
export function makeAdjacentFixture(): LevelDocument {
  const diamondCells: Cell[] = [];
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      if (insideDiamond(x + 0.5, y + 0.5, 20, 20, 20)) {
        diamondCells.push([x, y]);
      }
    }
  }

  const targetCells: Cell[] = [];
  for (let wy = 0; wy < GRID_HEIGHT; wy++) {
    for (let wx = 0; wx < GRID_WIDTH; wx++) {
      const insideD1 = insideDiamond(wx + 0.5, wy + 0.5, 44, 96, 20);
      const insideD2 = insideDiamond(wx + 0.5, wy + 0.5, 84, 96, 20);
      if (insideD1 || insideD2) {
        targetCells.push([wx, wy]);
      }
    }
  }

  return {
    schemaVersion: 1,
    id: 'fixture-adjacent-diamonds',
    title: 'Song Thoi Kỹ Thuật',
    chapter: 1,
    order: 1,
    contentRevision: 'fixture-v1',
    board: { width: 128, height: 160 },
    rotationEnabled: false,
    pieces: [
      {
        id: 'D1',
        shapeKind: 'diamond',
        frameSize: 40,
        cells: diamondCells.map(([x, y]) => [x, y]),
        anchors: [
          { id: 'A', x: 24, y: 76 },
          { id: 'B', x: 24, y: 92 },
        ],
        color: 'amber',
      },
      {
        id: 'D2',
        shapeKind: 'diamond',
        frameSize: 40,
        cells: diamondCells.map(([x, y]) => [x, y]),
        anchors: [
          { id: 'A', x: 64, y: 76 },
          { id: 'B', x: 64, y: 92 },
        ],
        color: 'amber',
      },
    ],
    targetCells,
    sampleSolutions: [
      [
        { pieceId: 'D1', anchorId: 'A', turns: 0 },
        { pieceId: 'D2', anchorId: 'A', turns: 0 },
      ],
    ],
    learningObjective: 'Kéo hai mảnh tiếp giáp đỉnh, không xếp chồng',
    difficultyEstimate: 1,
    distractors: [
      { pieceId: 'D1', anchorId: 'B', reason: 'Lệch trục ngang' },
      { pieceId: 'D2', anchorId: 'B', reason: 'Lệch trục ngang' },
    ],
    ftueSteps: [],
  };
}
