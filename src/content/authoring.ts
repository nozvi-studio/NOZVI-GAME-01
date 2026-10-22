import type { Cell, Orientation, ShapeKind } from '../domain/model.ts';
import { GRID_HEIGHT, GRID_WIDTH, TOTAL_CELLS } from '../domain/model.ts';
import { turnedCells } from '../domain/geometry.ts';
import { isValidFrame, shapeCells } from '../domain/shapes.ts';
import { parFromSolution } from '../domain/starRating.ts';
import type { LevelDocument } from './document.ts';

/** Neo phải rơi vào giao điểm lưới hiển thị: 1 ô hiển thị = 8 ô logic. */
export const ANCHOR_STEP = 8;

export type PieceSource = {
  id: string;
  shapeKind: ShapeKind;
  orientation: Orientation;
  frameSize: number;
  anchors: Array<{ id: string; x: number; y: number }>;
  /** Id các mảnh xoay theo khi mảnh này xoay (xoay liên động, chương 3) */
  drives?: string[];
};

/**
 * Nguồn mô tả một màn: mọi thứ của LevelDocument trừ những phần được sinh ra
 * (cells của mảnh, targetCells, board, schemaVersion). Cells và target không
 * bao giờ gõ tay.
 */
export type LevelSource = Omit<LevelDocument, 'schemaVersion' | 'board' | 'pieces' | 'targetCells'> & {
  pieces: PieceSource[];
};

/**
 * Mảnh đặt ở neo này có nằm trong bàn không.
 *
 * Màn không xoay: chỉ cần mọi **ô thật** của mảnh trong bàn — hộp khung được
 * phép thò ra, vì tam giác mái và bình hành không lấp kín khung (ví dụ `3-5
 * H1` và `3-6 T1` của spec C). Cùng ngữ nghĩa với `fitsBoard` lúc chơi.
 *
 * Màn bật xoay: đòi cả hộp khung vừa bàn, vì bốn nấc xoay quay trong khung
 * nên ô ở nấc khác có thể chạm tới mép khung.
 *
 * Gốc khung âm luôn bị từ chối: renderer đặt khung từ gốc này.
 */
export function anchorFitsBoard(
  piece: PieceSource,
  anchor: { x: number; y: number },
  rotationEnabled: boolean
): boolean {
  if (anchor.x < 0 || anchor.y < 0) return false;
  if (rotationEnabled) {
    return anchor.x + piece.frameSize <= GRID_WIDTH && anchor.y + piece.frameSize <= GRID_HEIGHT;
  }
  return shapeCells(piece.shapeKind, piece.orientation, piece.frameSize).every(
    ([cx, cy]) =>
      anchor.x + cx >= 0 &&
      anchor.y + cy >= 0 &&
      anchor.x + cx < GRID_WIDTH &&
      anchor.y + cy < GRID_HEIGHT
  );
}

export function checkSourceGeometry(source: LevelSource): string[] {
  const problems: string[] = [];
  for (const piece of source.pieces) {
    if (!isValidFrame(piece.shapeKind, piece.orientation, piece.frameSize)) {
      problems.push(
        `${piece.id}: khung ${piece.frameSize} không hợp lệ cho ${piece.shapeKind} hướng ${piece.orientation}`
      );
    }
    for (const anchor of piece.anchors) {
      const label = `${piece.id}.${anchor.id} tại (${anchor.x}, ${anchor.y})`;
      if (anchor.x % ANCHOR_STEP !== 0 || anchor.y % ANCHOR_STEP !== 0) {
        problems.push(`${label}: neo không phải bội của ${ANCHOR_STEP}`);
      }
      if (!anchorFitsBoard(piece, anchor, source.rotationEnabled)) {
        problems.push(
          source.rotationEnabled
            ? `${label}: khung mảnh vượt biên bàn khi xoay`
            : `${label}: mảnh vượt biên bàn`
        );
      }
    }
  }
  return problems;
}

/** Neo bị luật KIT-03 bỏ, liệt kê trong báo cáo `<id>-report.md`. */
export type DroppedDecoy = {
  pieceId: string;
  anchorId: string;
  reason: 'out-of-bounds' | 'clashes-identical-piece';
};

/** Neo đúng của mỗi mảnh; không bao giờ bị lọc. */
export const TRUE_ANCHOR_ID = 'A';

/**
 * Luật neo nhiễu KIT-03, chạy trước kiểm hình học:
 * - bỏ neo nhiễu có khung vượt biên bàn;
 * - bỏ neo nhiễu trùng neo A của một mảnh khác cùng hình, cùng hướng, cùng
 *   khung (hai mảnh giống hệt đổi chỗ được sẽ sinh nghiệm thứ hai — lỗi gặp ở
 *   bản nháp 3-8).
 * Neo A và neo mà nghiệm mẫu trỏ tới luôn được giữ. Gây nhiễu trỏ vào neo bị
 * bỏ cũng bị bỏ. Không sửa `source`.
 */
export function filterDecoys(source: LevelSource): { source: LevelSource; dropped: DroppedDecoy[] } {
  const usedBySolution = new Set(
    source.sampleSolutions.flat().map((step) => `${step.pieceId}.${step.anchorId}`)
  );
  const dropped: DroppedDecoy[] = [];
  const pieces = source.pieces.map((piece) => {
    const anchors = piece.anchors.filter((anchor) => {
      if (anchor.id === TRUE_ANCHOR_ID || usedBySolution.has(`${piece.id}.${anchor.id}`)) {
        return true;
      }
      const outside = !anchorFitsBoard(piece, anchor, source.rotationEnabled);
      if (outside) {
        dropped.push({ pieceId: piece.id, anchorId: anchor.id, reason: 'out-of-bounds' });
        return false;
      }
      const clashes = source.pieces.some(
        (other) =>
          other !== piece &&
          other.shapeKind === piece.shapeKind &&
          other.orientation === piece.orientation &&
          other.frameSize === piece.frameSize &&
          other.anchors.some((a) => a.id === TRUE_ANCHOR_ID && a.x === anchor.x && a.y === anchor.y)
      );
      if (clashes) {
        dropped.push({ pieceId: piece.id, anchorId: anchor.id, reason: 'clashes-identical-piece' });
        return false;
      }
      return true;
    });
    return { ...piece, anchors: anchors.map((a) => ({ ...a })) };
  });
  const droppedKeys = new Set(dropped.map((d) => `${d.pieceId}.${d.anchorId}`));
  const distractors = source.distractors.filter(
    (d) => d.anchorId === undefined || !droppedKeys.has(`${d.pieceId}.${d.anchorId}`)
  );
  return { source: { ...source, pieces, distractors }, dropped };
}

export function buildLevelDocument(input: LevelSource): LevelDocument {
  // KIT-03 chạy trước kiểm hình học: neo nhiễu vượt biên bị bỏ thay vì báo lỗi
  const { source } = filterDecoys(input);
  const problems = checkSourceGeometry(source);
  if (problems.length > 0) {
    throw new Error(`authoring:${source.id}\n${problems.join('\n')}`);
  }

  const pieces: LevelDocument['pieces'] = source.pieces.map((p) => ({
    id: p.id,
    shapeKind: p.shapeKind,
    ...(p.shapeKind === 'triangle' || p.shapeKind === 'parallelogram'
      ? { orientation: p.orientation }
      : {}),
    frameSize: p.frameSize,
    cells: shapeCells(p.shapeKind, p.orientation, p.frameSize),
    anchors: p.anchors.map((a) => ({ id: a.id, x: a.x, y: a.y })),
    ...(p.drives && p.drives.length > 0 ? { drives: [...p.drives] } : {}),
    color: 'amber' as const,
  }));

  // Target = mask chẵn/lẻ của nghiệm mẫu thứ nhất. Validator sẽ tính lại từ
  // nghiệm và so với target đã lưu (LVL-03).
  const mask = new Uint8Array(TOTAL_CELLS);
  for (const step of source.sampleSolutions[0] ?? []) {
    const piece = pieces.find((p) => p.id === step.pieceId);
    const anchor = piece?.anchors.find((a) => a.id === step.anchorId);
    if (!piece || !anchor) {
      throw new Error(
        `authoring:${source.id}\nnghiệm mẫu trỏ tới ${step.pieceId}.${step.anchorId} không tồn tại`
      );
    }
    for (const [cx, cy] of turnedCells(piece, step.turns)) {
      mask[(anchor.y + cy) * GRID_WIDTH + anchor.x + cx] ^= 1;
    }
  }
  const targetCells: Cell[] = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (mask[i]) targetCells.push([i % GRID_WIDTH, Math.floor(i / GRID_WIDTH)]);
  }

  // Thứ tự khoá giữ đúng thứ tự trong file JSON hiện có để diff dễ đọc.
  const doc: LevelDocument = {
    schemaVersion: 1,
    id: source.id,
    title: source.title,
    chapter: source.chapter,
    order: source.order,
    contentRevision: source.contentRevision,
    board: { width: GRID_WIDTH, height: GRID_HEIGHT },
    rotationEnabled: source.rotationEnabled,
    pieces,
    targetCells,
    sampleSolutions: source.sampleSolutions,
    learningObjective: source.learningObjective,
    difficultyEstimate: source.difficultyEstimate,
    distractors: source.distractors,
    ftueSteps: source.ftueSteps,
  };
  if (source.victoryVerse !== undefined) {
    doc.victoryVerse = source.victoryVerse;
  }
  // Chỉ ghi khi có, để JSON của các màn neo đã commit không đổi
  if (source.placement !== undefined) {
    doc.placement = source.placement;
  }
  if (source.allowUnproven !== undefined) {
    doc.allowUnproven = { reason: source.allowUnproven.reason };
  }
  doc.parMs = parFromSolution(source.sampleSolutions[0] ?? []);
  return doc;
}

export function serializeLevelDocument(doc: LevelDocument): string {
  return JSON.stringify(doc, null, 2) + '\n';
}
