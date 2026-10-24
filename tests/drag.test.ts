import { describe, expect, test } from 'vitest';
import { makeAdjacentFixture } from '../src/content/fixtures.ts';
import { validateLevel } from '../src/content/validate.ts';
import { createPuzzle } from '../src/domain/session.ts';
import { anchorLevel } from './fixtures/anchorLevels.ts';
import { computeLayout, gridToCanvas } from '../src/presentation/board/layout.ts';
import { beginDrag, cancelDrag, finishDrag, updateDrag } from '../src/application/drag.ts';

describe('Hitbox, Layout and Drag Transactions', () => {
  const layout = computeLayout(720, 1280);
  const parsed = validateLevel(makeAdjacentFixture());
  if (!parsed.ok) throw new Error('fixture validation failed');
  const level = parsed.level;
  const pieceD1 = level.pieces.find((p) => p.id === 'D1')!;

  test('beginDrag lưu lại committedState và tính toán pointerOffset', () => {
    const state = createPuzzle(level);
    const drag = beginDrag(state, pieceD1, 300, 1000, layout);

    expect(drag.pieceId).toBe('D1');
    expect(drag.committedState).toEqual(state);
    expect(drag.originState).toEqual({ kind: 'tray', turns: 0 });
  });

  test('cảm ứng: mảnh được mang lên trên ngón tay đúng `lift`, chuột thì giữ nguyên chỗ nắm', () => {
    const state = createPuzzle(level);
    const mouse = beginDrag(state, pieceD1, 300, 1000, layout);
    const touch = beginDrag(state, pieceD1, 300, 1000, layout, 0, 2, 80);
    expect(mouse.lift).toBe(0);
    expect(touch.lift).toBe(80);
    // centre = pointer - offset: the touch centre sits 80 above the mouse one, same x
    const centreY = (d: typeof mouse) => 1000 - d.pointerOffset.y;
    expect(centreY(mouse) - centreY(touch)).toBe(80);
    expect(300 - touch.pointerOffset.x).toBe(300 - mouse.pointerOffset.x);
  });

  test('cảm ứng: xem trước và vị trí thả dùng tâm đã nâng, không phải đầu ngón tay', () => {
    const state = createPuzzle(level);
    const anchorCanvas = gridToCanvas(44, 96, layout);
    const drag = beginDrag(state, pieceD1, 200, 1000, layout, 0, 2, 80);
    drag.pointerOffset = { x: 0, y: 80 }; // centre 80 above the finger
    // finger 80 below the anchor centre puts the piece centre right on the anchor
    const update = updateDrag(drag, level, anchorCanvas.x, anchorCanvas.y + 80, layout);
    expect(update.snapCandidateId).toBe('A');
    const done = finishDrag(drag, level, anchorCanvas.x, anchorCanvas.y + 80, layout);
    expect(done.accepted).toBe(true);
  });

  test('cảm ứng: điểm xét "thả vào khay" là chỗ mảnh đang nằm, không phải đầu ngón tay', () => {
    const state = createPuzzle(level);
    const tray = layout.trayBounds;
    const finger = { x: tray.x + tray.width / 2, y: tray.y + 20 };
    // Piece carried 400 above the finger: its centre is well inside the board while the finger is on the tray.
    const lifted = beginDrag(state, pieceD1, 200, 1000, layout, 0, 2, 400);
    lifted.pointerOffset = { x: 0, y: 400 };
    expect(finishDrag(lifted, level, finger.x, finger.y, layout).state.pieces.D1.kind).not.toBe('tray');
    // A mouse (no lift) with the pointer on the tray still returns the piece.
    const mouse = beginDrag(state, pieceD1, 200, 1000, layout);
    expect(finishDrag(mouse, level, finger.x, finger.y, layout).state.pieces.D1.kind).toBe('tray');
  });

  test('updateDrag nhận biết snapCandidateId khi ở gần neo và không mutate committedState', () => {
    const state = createPuzzle(level);
    // Neo A của D1: gốc (24, 76), tâm (44, 96). Kéo thả tính theo TÂM mảnh.
    const anchorCanvas = gridToCanvas(44, 96, layout);

    // Kéo từ khay lên bàn
    const drag = beginDrag(state, pieceD1, 200, 1000, layout);
    drag.pointerOffset = { x: 0, y: 0 };

    // Di chuyển tới đúng vị trí neo A
    const update = updateDrag(drag, level, anchorCanvas.x, anchorCanvas.y, layout);
    expect(update.snapCandidateId).toBe('A');
    expect(update.previewPlacement).toEqual({
      pieceId: 'D1',
      x: 24,
      y: 76,
      turns: 0,
    });
    // previewMask hiển thị preview
    expect(update.previewMask.some(Boolean)).toBe(true);

    // committedState gốc hoàn toàn không bị mutate
    expect(drag.committedState.pieces.D1).toEqual({ kind: 'tray', turns: 0 });
  });

  test('finishDrag thả vào khay (trayBounds) trả về outcome tray', () => {
    const state = createPuzzle(level);
    const drag = beginDrag(state, pieceD1, 300, 500, layout);
    drag.pointerOffset = { x: 0, y: 0 };

    // Thả tại giữa vùng khay: x=360, y=1050 (nằm trong trayBounds y=960..1160)
    const transition = finishDrag(drag, level, 360, 1050, layout);
    expect(transition.outcome).toBe('tray');
    expect(transition.state.pieces.D1).toEqual({ kind: 'tray', turns: 0 });
  });

  test('finishDrag gần neo thực hiện snap vào neo A', () => {
    const state = createPuzzle(level);
    const anchorCanvas = gridToCanvas(44, 96, layout);

    const drag = beginDrag(state, pieceD1, 200, 1000, layout);
    drag.pointerOffset = { x: 0, y: 0 };

    const transition = finishDrag(drag, level, anchorCanvas.x, anchorCanvas.y, layout);
    expect(transition.outcome).toBe('snapped');
    expect(transition.state.pieces.D1).toEqual({ kind: 'snapped', anchorId: 'A', turns: 0 });
  });

  test('finishDrag xa neo giữ ở vị trí tạm (temporary)', () => {
    const state = createPuzzle(level);
    const farCanvas = gridToCanvas(50, 110, layout);

    const drag = beginDrag(state, pieceD1, 200, 1000, layout);
    drag.pointerOffset = { x: 0, y: 0 };

    const transition = finishDrag(drag, level, farCanvas.x, farCanvas.y, layout);
    expect(transition.outcome).toBe('temporary');
    expect(transition.state.pieces.D1.kind).toBe('temporary');
  });

  test('cancelDrag phục hồi committedState nguyên vẹn', () => {
    const state = createPuzzle(level);
    const drag = beginDrag(state, pieceD1, 300, 500, layout);

    const transition = cancelDrag(drag, level);
    expect(transition.state).toEqual(state);
    expect(transition.state.pieces.D1).toEqual({ kind: 'tray', turns: 0 });
  });

  test('updateDrag dùng lại mask xem trước khi placement không đổi', () => {
    const state = createPuzzle(level);
    const drag = beginDrag(state, pieceD1, 200, 1000, layout);
    drag.pointerOffset = { x: 0, y: 0 };
    const a = gridToCanvas(44, 96, layout);
    const first = updateDrag(drag, level, a.x, a.y, layout);
    const again = updateDrag(drag, level, a.x + 1, a.y + 1, layout, { previous: first });
    expect(again.previewPlacement).toEqual(first.previewPlacement);
    expect(again.previewMask).toBe(first.previewMask);
  });

  test('computePreviewMask false trả mask rỗng dùng chung', () => {
    const state = createPuzzle(level);
    const drag = beginDrag(state, pieceD1, 200, 1000, layout);
    drag.pointerOffset = { x: 0, y: 0 };
    const a = gridToCanvas(44, 96, layout);
    const update = updateDrag(drag, level, a.x, a.y, layout, { computePreviewMask: false });
    expect(update.snapCandidateId).toBe('A');
    expect(update.previewMask.length).toBe(0);
  });
});

describe('Thả mảnh: grid luôn là tâm mảnh', () => {
  const layout = computeLayout(720, 1280);
  const level = anchorLevel('1-1'); // frozen anchor-mode copy; the live 1-1 is free placement
  const d1 = level.pieces.find((p) => p.id === 'D1')!;

  /** Kéo bằng tâm: pointerOffset = 0 nghĩa là con trỏ chính là tâm mảnh. */
  function dropAtCenter(gx: number, gy: number) {
    const state = createPuzzle(level);
    const drag = beginDrag(state, d1, 300, 1000, layout);
    drag.pointerOffset = { x: 0, y: 0 };
    const canvas = gridToCanvas(gx, gy, layout);
    return finishDrag(drag, level, canvas.x, canvas.y, layout);
  }

  test('thả lệch lên-trái khỏi tâm mục tiêu: mảnh nằm đúng chỗ thả, không nhảy xuống', () => {
    // Neo A của D1: gốc (16, 56), tâm (40, 80). Thả tâm tại (28, 64):
    // xa tâm neo hơn là xa gốc neo, đúng trường hợp làm lộ lỗi.
    const t = dropAtCenter(28, 64);

    expect(t.outcome).toBe('temporary');
    const state = t.state.pieces.D1;
    expect(state.kind).toBe('temporary');
    if (state.kind !== 'temporary') throw new Error('unreachable');

    // Gốc phải bằng tâm trừ nửa khung; nếu lấy thẳng tâm làm gốc thì
    // mảnh hiện xuống dưới-phải đúng 24 ô.
    expect({ x: state.x, y: state.y }).toEqual({ x: 28 - 24, y: 64 - 24 });
  });

  test('thả đúng tâm neo thì hít vào neo', () => {
    const t = dropAtCenter(40, 80);
    expect(t.outcome).toBe('snapped');
    expect(t.state.pieces.D1).toEqual({ kind: 'snapped', anchorId: 'A', turns: 0 });
  });

  test('thả gần gốc neo nhưng xa tâm neo thì KHÔNG được hít', () => {
    // Tâm thả tại (72,120): xa mọi tâm neo của D1 nên không được hít,
    // và gốc (48,96) vẫn lọt bàn nên mảnh nằm tạm chứ không về khay.
    const t = dropAtCenter(72, 120);
    expect(t.outcome).toBe('temporary');
    const state = t.state.pieces.D1;
    if (state.kind !== 'temporary') throw new Error('unreachable');
    expect({ x: state.x, y: state.y }).toEqual({ x: 48, y: 96 });
  });
});
