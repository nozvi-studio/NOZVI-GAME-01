import { fitsBoard, turnedCells } from '../domain/geometry.ts';
import { GRID_HEIGHT, GRID_WIDTH, TOTAL_CELLS } from '../domain/model.ts';
import type { SolutionReport } from './authoringReport.ts';
import type { LevelDocument } from './document.ts';

export type PartName =
  | 'pieces'
  | 'choices'
  | 'hollow'
  | 'revive'
  | 'nearMiss'
  | 'hiddenEdges';

export type DifficultyScore = {
  score: 1 | 2 | 3 | 4 | 5;
  raw: number;
  parts: Record<PartName, number>;
};

export const DIFFICULTY_WEIGHTS: Readonly<Record<PartName, number>> = {
  pieces: 0.2,
  choices: 0.25,
  hollow: 0.1,
  revive: 0.1,
  nearMiss: 0.15,
  hiddenEdges: 0.2,
};

export const DIFFICULTY_THRESHOLDS: readonly number[] = [0.14, 0.26, 0.43, 0.5];

export type LevelWarning = {
  code: 'difficulty-mismatch';
  message: string;
};

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Tính điểm độ khó tự động (spec E, DF-01).
 * Các thành phần đều được chặn trong khoảng 0–1.
 */
export function scoreDifficulty(
  doc: LevelDocument,
  report: SolutionReport
): DifficultyScore {
  // 1. pieces: (số mảnh − 1) / 6
  const pieces = clamp01((doc.pieces.length - 1) / 6);

  // 2. choices: Σ log2(max(1, report.poseCounts[i])) / 20
  let logChoicesSum = 0;
  for (let i = 0; i < doc.pieces.length; i++) {
    const poseCount = report.poseCounts[i] ?? 1;
    logChoicesSum += Math.log2(Math.max(1, poseCount));
  }
  const choices = clamp01(logChoicesSum / 20);

  // Chuẩn bị vị trí các mảnh và đếm số lớp trên nghiệm mẫu đầu tiên
  const layerCounts = new Uint8Array(TOTAL_CELLS);
  const placedPieces: Array<{
    pieceId: string;
    anchor: { x: number; y: number };
    cells: Array<readonly [number, number]>;
  }> = [];

  const firstSolution = doc.sampleSolutions[0] ?? [];
  for (const step of firstSolution) {
    const piece = doc.pieces.find((p) => p.id === step.pieceId);
    if (!piece) continue;
    const anchor = piece.anchors.find((a) => a.id === step.anchorId);
    if (!anchor) continue;
    const rotated = turnedCells(piece, step.turns ?? 0);
    placedPieces.push({ pieceId: piece.id, anchor, cells: rotated });
    for (const [cx, cy] of rotated) {
      const x = anchor.x + cx;
      const y = anchor.y + cy;
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        layerCounts[y * GRID_WIDTH + x]++;
      }
    }
  }

  // 3. hollow: ô có số lớp chẵn ≥ 2 / (ô đó + ô mục tiêu)
  let evenLayerCells = 0;
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const count = layerCounts[i];
    if (count >= 2 && count % 2 === 0) {
      evenLayerCells++;
    }
  }
  const targetCellsCount = doc.targetCells.length;
  const hollowDenominator = evenLayerCells + targetCellsCount;
  const hollow = clamp01(hollowDenominator > 0 ? evenLayerCells / hollowDenominator : 0);

  // 4. revive: ô có số lớp lẻ ≥ 3 / ô mục tiêu
  let oddLayerCellsGe3 = 0;
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const count = layerCounts[i];
    if (count >= 3 && count % 2 === 1) {
      oddLayerCellsGe3++;
    }
  }
  const revive = clamp01(targetCellsCount > 0 ? oddLayerCellsGe3 / targetCellsCount : 0);

  // 5. nearMiss:
  let nearMiss = 0;
  if (doc.placement === 'free') {
    // Màn free: dịch từng mảnh của nghiệm đi 8 ô theo 4 hướng, bỏ hướng làm mảnh ra ngoài bàn
    const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
      [-8, 0],
      [8, 0],
      [0, -8],
      [0, 8],
    ];
    let minChangedCells = Number.POSITIVE_INFINITY;

    for (const placed of placedPieces) {
      const oldIndices = new Set<number>();
      for (const [cx, cy] of placed.cells) {
        oldIndices.add((placed.anchor.y + cy) * GRID_WIDTH + (placed.anchor.x + cx));
      }

      for (const [dx, dy] of DIRECTIONS) {
        const newX = placed.anchor.x + dx;
        const newY = placed.anchor.y + dy;
        if (!fitsBoard(placed.cells, newX, newY)) continue;

        let diff = 0;
        const newIndices = new Set<number>();
        for (const [cx, cy] of placed.cells) {
          const idx = (newY + cy) * GRID_WIDTH + (newX + cx);
          newIndices.add(idx);
          if (!oldIndices.has(idx)) diff++;
        }
        for (const idx of oldIndices) {
          if (!newIndices.has(idx)) diff++;
        }

        if (diff < minChangedCells) {
          minChangedCells = diff;
        }
      }
    }

    if (Number.isFinite(minChangedCells) && targetCellsCount > 0) {
      nearMiss = clamp01(1 - minChangedCells / targetCellsCount);
    }
  } else {
    // Màn neo: 1 − min(changedCells) / ô mục tiêu trên các dòng report.distractors có changedCells !== null
    const validDistractors = report.distractors.filter(
      (d): d is typeof d & { changedCells: number } => typeof d.changedCells === 'number'
    );
    if (validDistractors.length > 0 && targetCellsCount > 0) {
      let minChanged = Number.POSITIVE_INFINITY;
      for (const d of validDistractors) {
        if (d.changedCells < minChanged) minChanged = d.changedCells;
      }
      nearMiss = clamp01(1 - minChanged / targetCellsCount);
    }
  }

  // 6. hiddenEdges: số đoạn biên ô của các mảnh trong nghiệm mà hai ô hai bên cùng là mục tiêu
  // hoặc cùng không là mục tiêu, chia cho tổng số đoạn biên ô của các mảnh. Phía ngoài mép bàn coi là không mục tiêu.
  const targetMask = new Uint8Array(TOTAL_CELLS);
  for (const [tx, ty] of doc.targetCells) {
    targetMask[ty * GRID_WIDTH + tx] = 1;
  }

  function isTarget(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
    return targetMask[y * GRID_WIDTH + x] === 1;
  }

  let totalBoundarySegments = 0;
  let hiddenBoundarySegments = 0;

  for (const placed of placedPieces) {
    const pieceOccupied = new Set<number>();
    for (const [cx, cy] of placed.cells) {
      pieceOccupied.add((placed.anchor.y + cy) * GRID_WIDTH + (placed.anchor.x + cx));
    }

    for (const [cx, cy] of placed.cells) {
      const px = placed.anchor.x + cx;
      const py = placed.anchor.y + cy;
      const neighbors: Array<readonly [number, number]> = [
        [px, py - 1],
        [px, py + 1],
        [px - 1, py],
        [px + 1, py],
      ];

      for (const [nx, ny] of neighbors) {
        if (pieceOccupied.has(ny * GRID_WIDTH + nx)) continue;
        totalBoundarySegments++;
        const inTarget = isTarget(px, py);
        const outTarget = isTarget(nx, ny);
        if (inTarget === outTarget) {
          hiddenBoundarySegments++;
        }
      }
    }
  }

  const hiddenEdges = clamp01(
    totalBoundarySegments > 0 ? hiddenBoundarySegments / totalBoundarySegments : 0
  );

  const parts: Record<PartName, number> = {
    pieces,
    choices,
    hollow,
    revive,
    nearMiss,
    hiddenEdges,
  };

  const raw =
    pieces * DIFFICULTY_WEIGHTS.pieces +
    choices * DIFFICULTY_WEIGHTS.choices +
    hollow * DIFFICULTY_WEIGHTS.hollow +
    revive * DIFFICULTY_WEIGHTS.revive +
    nearMiss * DIFFICULTY_WEIGHTS.nearMiss +
    hiddenEdges * DIFFICULTY_WEIGHTS.hiddenEdges;

  let score: 1 | 2 | 3 | 4 | 5 = 1;
  for (const threshold of DIFFICULTY_THRESHOLDS) {
    if (raw >= threshold) {
      score = (score + 1) as 1 | 2 | 3 | 4 | 5;
    }
  }

  return {
    score,
    raw,
    parts,
  };
}

/**
 * Thu thập cảnh báo độ khó (spec E, DF-03).
 * Chỉ cảnh báo khi độ khó tính toán lệch quá 1 so với ước lượng của tác giả.
 */
export function collectWarnings(
  doc: LevelDocument,
  score: DifficultyScore
): LevelWarning[] {
  if (Math.abs(score.score - doc.difficultyEstimate) > 1) {
    return [
      {
        code: 'difficulty-mismatch',
        message: `Độ khó tính toán (${score.score}) lệch quá 1 so với ước lượng (${doc.difficultyEstimate})`,
      },
    ];
  }
  return [];
}
