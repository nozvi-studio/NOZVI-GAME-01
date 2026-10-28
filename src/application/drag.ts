import type {
  Anchor,
  Level,
  Piece,
  PieceState,
  Placement,
  PuzzleState,
  Transition,
  Turns,
} from '../domain/model.ts';
import { fitsBoard, turnedCells } from '../domain/geometry.ts';
import { freeSnapOrigin } from '../domain/freePlacement.ts';
import { evaluate } from '../domain/mask.ts';
import { occupiedAnchorCoords } from '../domain/pieceEquivalence.ts';
import { applyCommand, placementsOf } from '../domain/session.ts';
import { isOnTarget } from '../domain/targetMatch.ts';
import type { LayoutMetrics } from '../presentation/board/layout.ts';
import {
  canvasToGrid,
  gridToCanvas,
  pieceBoardOrigin,
  pieceHitbox,
} from '../presentation/board/layout.ts';

export type DragSession = {
  pieceId: string;
  startWorld: { x: number; y: number };
  /** Pointer minus piece centre. Includes `lift`, so the centre rides `lift` px above the pointer. */
  pointerOffset: { x: number; y: number };
  /** How far above the fingertip the piece is carried (0 for a mouse). */
  lift: number;
  originState: PieceState;
  committedState: PuzzleState;
};

export type DragUpdate = {
  previewPlacement: Placement | null;
  previewMask: Uint8Array;
  snapCandidateId: string | null;
  /** The preview sits exactly where a sample solution puts this piece; a grid snap alone does not count. */
  onTarget: boolean;
};

export type UpdateDragOptions = {
  /** false: không tính mask xem trước (renderer không dùng); mặc định true để giữ test cũ */
  computePreviewMask?: boolean;
  /** Kết quả lần trước: dùng lại mask nếu placement không đổi */
  previous?: DragUpdate | null;
};

/** Mask rỗng dùng chung khi không tính xem trước */
export const EMPTY_PREVIEW_MASK = new Uint8Array(0);

function samePlacement(a: Placement | null, b: Placement | null): boolean {
  if (a === null || b === null) return a === b;
  return a.pieceId === b.pieceId && a.x === b.x && a.y === b.y && a.turns === b.turns;
}

type SnapTarget = { x: number; y: number; candidateId: string };

/**
 * Đích hít khi tâm mảnh nằm ở ô `grid`: neo gần nhất (màn neo) hoặc giao
 * điểm lưới gần nhất (màn đặt tự do). updateDrag và finishDrag cùng gọi hàm
 * này nên vị trí xem trước luôn trùng vị trí thả (FP-05).
 */
function snapTarget(
  level: Level,
  piece: Piece,
  turns: Turns,
  grid: { x: number; y: number },
  occupiedCoords: ReadonlySet<string> = new Set()
): SnapTarget | null {
  const halfFrame = piece.frameSize / 2;

  if (level.placement === 'free') {
    // Round before snapping: an unsnapped drop sends these exact integers,
    // and session.ts calls freeSnapOrigin again to produce the same result.
    const gx = Math.round(grid.x - halfFrame);
    const gy = Math.round(grid.y - halfFrame);
    const origin = freeSnapOrigin(level, piece, turns, gx, gy);
    return origin ? { x: origin.x, y: origin.y, candidateId: `grid:${origin.x},${origin.y}` } : null;
  }

  const rotatedCells = turnedCells(piece, turns);
  // Tìm neo gần nhất trong bán kính hít: d <= 36 (6 ô, tương ứng 30px canvas).
  // `grid` luôn là TÂM mảnh (pointerOffset tính từ tâm trong beginDrag); so
  // với gốc neo sẽ cho hít nhầm khi tâm mảnh rơi gần gốc neo.
  let best: Anchor | undefined;
  let bestDistance = Infinity;
  for (const anchor of piece.anchors) {
    if (occupiedCoords.has(`${anchor.x},${anchor.y}`)) continue;
    const d = (anchor.x + halfFrame - grid.x) ** 2 + (anchor.y + halfFrame - grid.y) ** 2;
    if (d <= 36 && d < bestDistance && fitsBoard(rotatedCells, anchor.x, anchor.y)) {
      best = anchor;
      bestDistance = d;
    }
  }
  return best ? { x: best.x, y: best.y, candidateId: best.id } : null;
}

export function beginDrag(
  state: PuzzleState,
  piece: Piece,
  pointerX: number,
  pointerY: number,
  layout: LayoutMetrics,
  pieceIndexInTray: number = 0,
  trayCount: number = 2,
  /** Carry the piece this far above the pointer (touch); 0 keeps it exactly where it was grabbed. */
  fingerLift: number = 0
): DragSession {
  const originState = state.pieces[piece.id] ?? { kind: 'tray', turns: 0 };
  let pieceCenterX = pointerX;
  let pieceCenterY = pointerY;

  const halfFrame = piece.frameSize / 2;
  const origin = pieceBoardOrigin(piece, originState);

  if (origin) {
    // Mảnh trên bàn (neo, giao điểm lưới hoặc vị trí tạm): tâm = gốc + nửa khung
    const pos = gridToCanvas(origin.x + halfFrame, origin.y + halfFrame, layout);
    pieceCenterX = pos.x;
    pieceCenterY = pos.y;
  } else {
    const hitbox = pieceHitbox(piece, originState, layout, pieceIndexInTray, trayCount);
    pieceCenterX = hitbox.x + hitbox.width / 2;
    pieceCenterY = hitbox.y + hitbox.height / 2;
  }

  return {
    pieceId: piece.id,
    startWorld: { x: pointerX, y: pointerY },
    pointerOffset: {
      x: pointerX - pieceCenterX,
      y: pointerY - pieceCenterY + fingerLift,
    },
    lift: fingerLift,
    originState,
    committedState: state,
  };
}

export function updateDrag(
  drag: DragSession,
  level: Level,
  pointerX: number,
  pointerY: number,
  layout: LayoutMetrics,
  options: UpdateDragOptions = {}
): DragUpdate {
  const piece = level.pieces.find((p) => p.id === drag.pieceId);
  if (!piece) {
    const committedPlacements = placementsOf(level, drag.committedState);
    return {
      previewPlacement: null,
      previewMask: evaluate(level, committedPlacements),
      snapCandidateId: null,
      onTarget: false,
    };
  }

  const turns = drag.originState.turns;
  const halfFrame = piece.frameSize / 2;
  const pieceCanvasX = pointerX - drag.pointerOffset.x;
  const pieceCanvasY = pointerY - drag.pointerOffset.y;
  const grid = canvasToGrid(pieceCanvasX, pieceCanvasY, layout);
  const occupiedCoords = occupiedAnchorCoords(level, drag.committedState, piece);
  const target = snapTarget(level, piece, turns, grid, occupiedCoords);

  let previewPlacement: Placement | null = null;

  if (target) {
    // Có đích hít (neo hoặc giao điểm): xem trước đặt đúng gốc đó
    previewPlacement = {
      pieceId: piece.id,
      x: target.x,
      y: target.y,
      turns,
    };
  } else {
    // Không có đích hít nhưng nằm gọn trong bàn: xem trước tại điểm thả tự do
    const rotatedCells = turnedCells(piece, turns);
    const dropX = Math.round(grid.x - halfFrame);
    const dropY = Math.round(grid.y - halfFrame);
    if (fitsBoard(rotatedCells, dropX, dropY)) {
      previewPlacement = { pieceId: piece.id, x: dropX, y: dropY, turns };
    }
  }

  const snapCandidateId = target ? target.candidateId : null;
  const onTarget = previewPlacement !== null && isOnTarget(level, previewPlacement);
  if (options.computePreviewMask === false) {
    return { previewPlacement, previewMask: EMPTY_PREVIEW_MASK, snapCandidateId, onTarget };
  }
  const previous = options.previous ?? null;
  if (previous && previous.previewMask.length > 0 && samePlacement(previous.previewPlacement, previewPlacement)) {
    return { previewPlacement, previewMask: previous.previewMask, snapCandidateId, onTarget };
  }

  // Tập hợp placement ngoại trừ piece đang drag
  const otherPlacements = placementsOf(level, drag.committedState).filter(
    (p) => p.pieceId !== piece.id
  );
  const previewPlacements = previewPlacement
    ? [...otherPlacements, previewPlacement]
    : otherPlacements;

  let previewMask: Uint8Array;
  try {
    previewMask = evaluate(level, previewPlacements);
  } catch {
    previewMask = evaluate(level, otherPlacements);
  }

  return { previewPlacement, previewMask, snapCandidateId, onTarget };
}

export function finishDrag(
  drag: DragSession,
  level: Level,
  pointerX: number,
  pointerY: number,
  layout: LayoutMetrics
): Transition {
  // Thả vào vùng khay mảnh (trayBounds) -> trả về khay. Với cảm ứng, mảnh nằm `lift` px trên ngón tay nên
  // điểm xét là chỗ mảnh đang ở, không phải đầu ngón tay (không thì thả sát đáy bàn bị tính là về khay).
  const refY = pointerY - drag.lift;
  const inTray =
    pointerX >= layout.trayBounds.x &&
    pointerX <= layout.trayBounds.x + layout.trayBounds.width &&
    refY >= layout.trayBounds.y &&
    refY <= layout.trayBounds.y + layout.trayBounds.height;

  if (inTray) {
    return applyCommand(level, drag.committedState, {
      type: 'return',
      pieceId: drag.pieceId,
    });
  }

  const piece = level.pieces.find((p) => p.id === drag.pieceId);
  const halfFrame = piece ? piece.frameSize / 2 : 20;
  const pieceCanvasX = pointerX - drag.pointerOffset.x;
  const pieceCanvasY = pointerY - drag.pointerOffset.y;
  const grid = canvasToGrid(pieceCanvasX, pieceCanvasY, layout);

  if (piece) {
    const turns = drag.originState.turns;
    const occupiedCoords = occupiedAnchorCoords(level, drag.committedState, piece);
    const target = snapTarget(level, piece, turns, grid, occupiedCoords);

    if (target) {
      // Hút chuẩn xác vào neo hoặc giao điểm đã thấy lúc xem trước
      return applyCommand(level, drag.committedState, {
        type: 'drop',
        pieceId: drag.pieceId,
        x: target.x,
        y: target.y,
      });
    }

    // Không hít nhưng vẫn thả trong bàn: gốc = tâm − nửa khung
    const rotatedCells = turnedCells(piece, turns);
    const dropX = Math.round(grid.x - halfFrame);
    const dropY = Math.round(grid.y - halfFrame);

    if (fitsBoard(rotatedCells, dropX, dropY)) {
      return applyCommand(level, drag.committedState, {
        type: 'drop',
        pieceId: drag.pieceId,
        x: dropX,
        y: dropY,
      });
    }
  }

  // Thả ngoài phạm vi bàn cờ: trả về khay
  return applyCommand(level, drag.committedState, {
    type: 'return',
    pieceId: drag.pieceId,
  });
}

export function cancelDrag(drag: DragSession, level: Level): Transition {
  const placements = placementsOf(level, drag.committedState);
  const mask = evaluate(level, placements);

  return {
    accepted: true,
    outcome: 'tray',
    state: drag.committedState,
    mask,
    changed: [],
    becameWon: false,
  };
}
