import { describe, expect, test } from 'vitest';
import type { Level, Piece } from '../src/domain/model.ts';
import { TOTAL_CELLS } from '../src/domain/model.ts';
import { evaluate } from '../src/domain/mask.ts';
import { applyCommand, createPuzzle, placementsOf } from '../src/domain/session.ts';
import { computeLayout, gridToCanvas, pieceHitbox } from '../src/presentation/board/layout.ts';
import { beginDrag, finishDrag, updateDrag } from '../src/application/drag.ts';
import { GRID_STEP, SNAP_RADIUS_SQ, nearestGridOrigin, freeSnapOrigin } from '../src/domain/freePlacement.ts';
import { shapeCells } from '../src/domain/shapes.ts';

function makePiece(
  id: string,
  kind: 'square' | 'triangle',
  orientation: 0 | 5,
  x: number,
  y: number
): Piece {
  return {
    id,
    frameSize: 48,
    cells: shapeCells(kind, orientation, 48),
    anchors: [{ id: 'A', x, y }],
    color: 'amber',
    shapeKind: kind,
    orientation,
  };
}

const square = makePiece('S1', 'square', 0, 16, 16);
/** Mái hướng 5 (cạnh huyền bên trái): ô chỉ rộng 24 cột nên gốc x đi tới 104; xoay 1 nấc thành rộng 48 cột. */
const roof = makePiece('T5', 'triangle', 5, 8, 8);

describe('nearestGridOrigin (FP-03)', () => {
  test('hằng số lưới và bán kính hít', () => {
    expect(GRID_STEP).toBe(8);
    expect(SNAP_RADIUS_SQ).toBe(36);
  });

  test('giữa bàn: chọn giao điểm gần nhất', () => {
    expect(nearestGridOrigin(square, 0, 34, 59)).toEqual({ x: 32, y: 56 });
  });

  test('điểm xa nhất trong ô lưới (cách 4 góc như nhau, d² = 32) vẫn hít, hoà thì lấy y rồi x nhỏ', () => {
    expect(nearestGridOrigin(square, 0, 36, 60)).toEqual({ x: 32, y: 56 });
  });

  test('hoà theo y: ưu tiên y nhỏ hơn', () => {
    // (40,56) và (40,64) cùng d² = 25
    expect(nearestGridOrigin(square, 0, 37, 60)).toEqual({ x: 40, y: 56 });
  });

  test('hoà theo x: ưu tiên x nhỏ hơn', () => {
    // (56,40) và (64,40) cùng d² = 25
    expect(nearestGridOrigin(square, 0, 60, 37)).toEqual({ x: 56, y: 40 });
  });

  test('sát mép phải: giao điểm ngoài bàn bị bỏ, quá bán kính thì không hít', () => {
    // Vuông 48 chỉ vừa tới gốc x = 80
    expect(nearestGridOrigin(square, 0, 84, 40)).toEqual({ x: 80, y: 40 });
    // (88,40) cách 1 ô nhưng không vừa bàn; (80,40) cách 7 ô (d² = 49)
    expect(nearestGridOrigin(square, 0, 87, 40)).toBeNull();
  });

  test('toạ độ âm sát góc trên-trái vẫn hít vào (0,0)', () => {
    expect(nearestGridOrigin(square, 0, -3, -2)).toEqual({ x: 0, y: 0 });
  });

  test('hướng mới không vừa bàn thì không hít', () => {
    expect(nearestGridOrigin(roof, 0, 104, 40)).toEqual({ x: 104, y: 40 });
    expect(nearestGridOrigin(roof, 1, 104, 40)).toBeNull();
  });
});

/** Màn free một mảnh, xoay được; mục tiêu là mái hướng 5 tại (8, 8). */
function freeLevel(): Level {
  const base: Level = {
    id: 'free-test',
    title: 'Đặt tự do',
    chapter: 3,
    contentRevision: 'test',
    rotationEnabled: true,
    placement: 'free',
    targetMask: new Uint8Array(TOTAL_CELLS),
    pieces: [roof],
  };
  return { ...base, targetMask: evaluate(base, [{ pieceId: 'T5', x: 8, y: 8, turns: 0 }]) };
}

describe('Phiên chơi màn đặt tự do (FP-03, FP-04)', () => {
  const level = freeLevel();

  test('thả gần giao điểm thì thành mảnh placed, outcome vẫn là snapped', () => {
    const t = applyCommand(level, createPuzzle(level), { type: 'drop', pieceId: 'T5', x: 82, y: 43 });
    expect(t.outcome).toBe('snapped');
    expect(t.state.pieces.T5).toEqual({ kind: 'placed', x: 80, y: 40, turns: 0 });
    expect(placementsOf(level, t.state)).toEqual([{ pieceId: 'T5', x: 80, y: 40, turns: 0 }]);
    expect(t.mask.some(Boolean)).toBe(true);
  });

  test('không có giao điểm vừa bàn trong bán kính thì thành mảnh tạm', () => {
    // (104,40) cách 7 ô; (112,40) không vừa bàn
    const t = applyCommand(level, createPuzzle(level), { type: 'drop', pieceId: 'T5', x: 111, y: 40 });
    expect(t.outcome).toBe('temporary');
    expect(t.state.pieces.T5).toEqual({ kind: 'temporary', x: 111, y: 40, turns: 0 });
  });

  test('xoay mảnh placed giữ nguyên gốc khung', () => {
    const placed = applyCommand(level, createPuzzle(level), { type: 'drop', pieceId: 'T5', x: 80, y: 40 });
    const rotated = applyCommand(level, placed.state, { type: 'rotate', pieceId: 'T5' });
    expect(rotated.accepted).toBe(true);
    expect(rotated.outcome).toBe('rotated');
    expect(rotated.state.pieces.T5).toEqual({ kind: 'placed', x: 80, y: 40, turns: 1 });
  });

  test('xoay vượt biên bị từ chối với out-of-bounds', () => {
    const placed = applyCommand(level, createPuzzle(level), { type: 'drop', pieceId: 'T5', x: 104, y: 40 });
    expect(placed.state.pieces.T5).toEqual({ kind: 'placed', x: 104, y: 40, turns: 0 });
    const rotated = applyCommand(level, placed.state, { type: 'rotate', pieceId: 'T5' });
    expect(rotated.accepted).toBe(false);
    expect(rotated.outcome).toBe('out-of-bounds');
    expect(rotated.state).toBe(placed.state);
  });

  test('hít đúng giao điểm của nghiệm thì thắng', () => {
    const t = applyCommand(level, createPuzzle(level), { type: 'drop', pieceId: 'T5', x: 10, y: 5 });
    expect(t.becameWon).toBe(true);
    expect(t.state.pieces.T5).toEqual({ kind: 'placed', x: 8, y: 8, turns: 0 });
  });

  test('hitbox của mảnh placed đặt tại gốc khung', () => {
    const layout = computeLayout(720, 1280);
    expect(pieceHitbox(roof, { kind: 'placed', x: 80, y: 40, turns: 0 }, layout)).toEqual({
      x: 440,
      y: 400,
      width: 240,
      height: 240,
    });
  });
});

describe('Kéo thả màn đặt tự do: xem trước trùng vị trí thả (FP-05)', () => {
  const layout = computeLayout(720, 1280);
  const level = freeLevel();

  /** Kéo bằng tâm mảnh (pointerOffset = 0) tới gốc khung (originX, originY). */
  function dragTo(originX: number, originY: number) {
    const drag = beginDrag(createPuzzle(level), roof, 300, 1080, layout);
    drag.pointerOffset = { x: 0, y: 0 };
    const pointer = gridToCanvas(originX + 24, originY + 24, layout);
    return {
      update: updateDrag(drag, level, pointer.x, pointer.y, layout),
      transition: finishDrag(drag, level, pointer.x, pointer.y, layout),
    };
  }

  test('gần giao điểm: nhãn grid:<x>,<y> và xem trước đúng giao điểm', () => {
    const { update, transition } = dragTo(82, 43);
    expect(update.snapCandidateId).toBe('grid:80,40');
    expect(update.previewPlacement).toEqual({ pieceId: 'T5', x: 80, y: 40, turns: 0 });
    expect(transition.state.pieces.T5).toEqual({ kind: 'placed', x: 80, y: 40, turns: 0 });
  });

  test('quét vùng sát mép phải: vị trí xem trước luôn trùng vị trí thả', () => {
    let snapped = 0;
    let missed = 0;
    for (let oy = 32; oy <= 48; oy++) {
      for (let ox = 96; ox <= 112; ox++) {
        const { update, transition } = dragTo(ox, oy);
        const placed = transition.state.pieces.T5;
        if (update.snapCandidateId === null) {
          missed++;
          expect(placed.kind).not.toBe('placed');
        } else {
          snapped++;
          if (placed.kind !== 'placed') throw new Error(`thả lệch xem trước tại (${ox}, ${oy})`);
          expect(update.snapCandidateId).toBe(`grid:${placed.x},${placed.y}`);
          expect(update.previewPlacement).toEqual({ pieceId: 'T5', x: placed.x, y: placed.y, turns: 0 });
        }
      }
    }
    // Vùng quét có cả chỗ hít lẫn chỗ không hít (sát mép, quá 6 ô)
    expect(snapped).toBeGreaterThan(0);
    expect(missed).toBeGreaterThan(0);
  });
});



/** freeLevel() with its sample placement (T5 at (8, 8), turns 0) and an optional target radius. */
function targetSnapLevel(radiusSq?: number): Level {
  return {
    ...freeLevel(),
    targetPlacements: [{ pieceId: 'T5', x: 8, y: 8, turns: 0 }],
    ...(radiusSq === undefined ? {} : { targetSnapRadiusSq: radiusSq }),
  };
}

describe('freeSnapOrigin (TSN-04)', () => {
  test('without a target radius it equals nearestGridOrigin', () => {
    const level = targetSnapLevel();
    expect(freeSnapOrigin(level, roof, 0, 18, 18)).toEqual({ x: 16, y: 16 });
    expect(freeSnapOrigin(level, roof, 0, 111, 40)).toBeNull();
  });

  test('within the radius it snaps to the target placement', () => {
    const level = targetSnapLevel(256);
    expect(freeSnapOrigin(level, roof, 0, 18, 18)).toEqual({ x: 8, y: 8 }); // 10² + 10² = 200
    expect(freeSnapOrigin(level, roof, 0, 24, 8)).toEqual({ x: 8, y: 8 }); // 16² = 256, boundary
  });

  test('outside the radius it falls back to the grid snap', () => {
    const level = targetSnapLevel(256);
    expect(freeSnapOrigin(level, roof, 0, 20, 20)).toEqual({ x: 16, y: 16 }); // 12² + 12² = 288
  });

  test('a different rotation does not snap to the target', () => {
    const level = targetSnapLevel(256);
    expect(freeSnapOrigin(level, roof, 1, 18, 18)).toEqual(nearestGridOrigin(roof, 1, 18, 18));
  });

  test('anchor levels never use the target radius', () => {
    const level: Level = { ...targetSnapLevel(256), placement: 'anchors' };
    expect(freeSnapOrigin(level, roof, 0, 18, 18)).toEqual({ x: 16, y: 16 });
  });
});

describe('Target snap in session and drag (TSN-05)', () => {
  const layout = computeLayout(720, 1280);

  /** Drag by the piece centre (pointerOffset = 0) to frame origin (originX, originY). */
  function dragTo(level: Level, originX: number, originY: number) {
    const drag = beginDrag(createPuzzle(level), roof, 300, 1080, layout);
    drag.pointerOffset = { x: 0, y: 0 };
    const pointer = gridToCanvas(originX + 24, originY + 24, layout);
    return {
      update: updateDrag(drag, level, pointer.x, pointer.y, layout),
      transition: finishDrag(drag, level, pointer.x, pointer.y, layout),
    };
  }

  test('a drop near the target lands on it and wins', () => {
    const level = targetSnapLevel(256);
    const t = applyCommand(level, createPuzzle(level), { type: 'drop', pieceId: 'T5', x: 18, y: 18 });
    expect(t.outcome).toBe('won');
    expect(t.state.pieces.T5).toEqual({ kind: 'placed', x: 8, y: 8, turns: 0 });
  });

  test('without the radius the same drop grid-snaps to (16, 16)', () => {
    const level = targetSnapLevel();
    const t = applyCommand(level, createPuzzle(level), { type: 'drop', pieceId: 'T5', x: 18, y: 18 });
    expect(t.state.pieces.T5).toEqual({ kind: 'placed', x: 16, y: 16, turns: 0 });
  });

  test('drag preview equals the drop position on the target', () => {
    const { update, transition } = dragTo(targetSnapLevel(256), 18, 18);
    expect(update.snapCandidateId).toBe('grid:8,8');
    expect(update.previewPlacement).toEqual({ pieceId: 'T5', x: 8, y: 8, turns: 0 });
    expect(transition.state.pieces.T5).toEqual({ kind: 'placed', x: 8, y: 8, turns: 0 });
  });
});
