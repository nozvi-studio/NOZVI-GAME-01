import { describe, expect, test } from 'vitest';
import { makeAdjacentFixture } from '../src/content/fixtures.ts';
import { validateLevel } from '../src/content/validate.ts';
import { applyCommand, createPuzzle, placementsOf } from '../src/domain/session.ts';
import type { Level } from '../src/domain/model.ts';
import { GRID_HEIGHT, GRID_WIDTH } from '../src/domain/model.ts';
import { rotateCells } from '../src/domain/geometry.ts';

describe('Puzzle Session Commands and State Machine', () => {
  test('thả tạm gỡ placement cũ; reset trả góc về 0', () => {
    const parsed = validateLevel(makeAdjacentFixture());
    if (!parsed.ok) throw new Error('invalid test fixture');
    const level = parsed.level;

    const initial = createPuzzle(level);
    expect(initial.pieces.D1).toEqual({ kind: 'tray', turns: 0 });

    // Snap vào neo A (24, 76)
    const snapped = applyCommand(level, initial, { type: 'drop', pieceId: 'D1', x: 24, y: 76 });
    expect(snapped.outcome).toBe('snapped');
    expect(snapped.state.pieces.D1.kind).toBe('snapped');
    expect(snapped.mask.some(Boolean)).toBe(true);

    // Thả tạm ngoài bán kính 6 -> mask phải trở về trống
    const temp = applyCommand(level, snapped.state, { type: 'drop', pieceId: 'D1', x: 48, y: 120 });
    expect(temp.outcome).toBe('temporary');
    expect(temp.mask.some(Boolean)).toBe(false);

    // Reset -> mọi mảnh về tray turns 0
    const reset = applyCommand(level, temp.state, { type: 'reset' });
    expect(reset.state.pieces.D1).toEqual({ kind: 'tray', turns: 0 });
    expect(reset.state.phase).toBe('playing');
  });

  test('bán kính snap 6: d <= 6 snap, d > 6 temporary', () => {
    const parsed = validateLevel(makeAdjacentFixture());
    if (!parsed.ok) throw new Error('invalid test fixture');
    const level = parsed.level;
    const initial = createPuzzle(level);

    // Neo A của D1 là (24, 76)
    // Thả tại (24 + 6, 76) = (30, 76) -> khoảng cách đúng bằng 6 (d^2 = 36) -> snap
    const edge6 = applyCommand(level, initial, { type: 'drop', pieceId: 'D1', x: 30, y: 76 });
    expect(edge6.outcome).toBe('snapped');
    if (edge6.state.pieces.D1.kind === 'snapped') {
      expect(edge6.state.pieces.D1.anchorId).toBe('A');
    }

    // Thả tại (24 + 6, 76 + 1) = (30, 77) -> khoảng cách > 6 (36 + 1 = 37) -> temporary
    const over6 = applyCommand(level, initial, { type: 'drop', pieceId: 'D1', x: 30, y: 77 });
    expect(over6.outcome).toBe('temporary');
    expect(over6.state.pieces.D1.kind).toBe('temporary');
  });

  test('tie khoảng cách giữa 2 neo: ưu tiên neo khai báo trước', () => {
    // Tạo level có 2 neo cách đều điểm thả
    const level: Level = {
      id: 'tie-level',
      title: 'Tie',
      chapter: 1,
      contentRevision: 'test',
      rotationEnabled: false,
      placement: 'anchors',
      targetMask: new Uint8Array(GRID_WIDTH * GRID_HEIGHT),
      pieces: [
        {
          id: 'P',
          frameSize: 2,
          cells: [[0, 0]],
          anchors: [
            { id: 'FIRST', x: 10, y: 10 },
            { id: 'SECOND', x: 12, y: 10 },
          ],
          color: 'amber',
        },
      ],
    };

    const initial = createPuzzle(level);
    // Thả tại x=11, y=10. Khoảng cách tới FIRST là 1, tới SECOND là 1 (bằng nhau).
    const res = applyCommand(level, initial, { type: 'drop', pieceId: 'P', x: 11, y: 10 });
    expect(res.outcome).toBe('snapped');
    if (res.state.pieces.P.kind === 'snapped') {
      expect(res.state.pieces.P.anchorId).toBe('FIRST');
    }
  });

  test('mảnh không thể cùng tọa độ neo khi neo đã có mảnh khác chiếm (IPA single-occupancy)', () => {
    const targetMask = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    targetMask[0] = 1; // Đảm bảo không vô tình trigger chiến thắng khi mask rỗng

    const level: Level = {
      id: 'same-anchor',
      title: 'Same Anchor',
      chapter: 2,
      contentRevision: 'test',
      rotationEnabled: false,
      placement: 'anchors',
      targetMask,
      pieces: [
        { id: 'P1', frameSize: 2, cells: [[0, 0]], anchors: [{ id: 'A', x: 20, y: 20 }], color: 'amber' },
        { id: 'P2', frameSize: 2, cells: [[0, 0]], anchors: [{ id: 'A', x: 20, y: 20 }], color: 'amber' },
      ],
    };

    let state = createPuzzle(level);
    state = applyCommand(level, state, { type: 'drop', pieceId: 'P1', x: 20, y: 20 }).state;
    const res2 = applyCommand(level, state, { type: 'drop', pieceId: 'P2', x: 20, y: 20 });

    expect(res2.outcome).toBe('temporary');
    expect(res2.state.pieces.P1.kind).toBe('snapped');
    expect(res2.state.pieces.P2.kind).toBe('temporary');
  });

  test('thắng màn qua hoàn thành các mảnh snap và becameWon flag', () => {
    const parsed = validateLevel(makeAdjacentFixture());
    if (!parsed.ok) throw new Error('invalid test fixture');
    const level = parsed.level;

    let state = createPuzzle(level);
    const drop1 = applyCommand(level, state, { type: 'drop', pieceId: 'D1', x: 24, y: 76 });
    expect(drop1.becameWon).toBe(false);
    expect(drop1.state.phase).toBe('playing');

    // Thả mảnh D2 vào neo A (64, 76) -> khớp 100% targetMask
    const drop2 = applyCommand(level, drop1.state, { type: 'drop', pieceId: 'D2', x: 64, y: 76 });
    expect(drop2.becameWon).toBe(true);
    expect(drop2.state.phase).toBe('won');
    expect(drop2.outcome).toBe('won');
  });

  test('khi phase won, từ chối mọi lệnh ngoại trừ reset', () => {
    const parsed = validateLevel(makeAdjacentFixture());
    if (!parsed.ok) throw new Error('invalid test fixture');
    const level = parsed.level;

    let state = createPuzzle(level);
    state = applyCommand(level, state, { type: 'drop', pieceId: 'D1', x: 24, y: 76 }).state;
    state = applyCommand(level, state, { type: 'drop', pieceId: 'D2', x: 64, y: 76 }).state;
    expect(state.phase).toBe('won');

    // Cố gắng drop mảnh khác
    const rejectedDrop = applyCommand(level, state, { type: 'drop', pieceId: 'D1', x: 0, y: 0 });
    expect(rejectedDrop.accepted).toBe(false);

    // Cố gắng rotate
    const rejectedRotate = applyCommand(level, state, { type: 'rotate', pieceId: 'D1' });
    expect(rejectedRotate.accepted).toBe(false);

    // Reset được chấp nhận
    const reset = applyCommand(level, state, { type: 'reset' });
    expect(reset.accepted).toBe(true);
    expect(reset.state.phase).toBe('playing');
  });

  test('xoay mở ở Chapter 3 và có thể dẫn tới won', () => {
    // Tạo level Chapter 3 với 1 mảnh chữ L cần xoay 1 nấc để win
    const lShape: [number, number][] = [[0, 0], [0, 1], [1, 1]];
    const frameSize = 3;
    const targetMask = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    // Target là hình chữ L xoay 1 nấc tại neo (10, 10)
    const rotated = rotateCells(lShape, frameSize, 1);
    for (const [cx, cy] of rotated) {
      targetMask[(10 + cy) * GRID_WIDTH + (10 + cx)] = 1;
    }

    const level: Level = {
      id: 'rotate-ch3',
      title: 'Rotate Win',
      chapter: 3,
      contentRevision: 'test',
      rotationEnabled: true,
      placement: 'anchors',
      targetMask,
      pieces: [
        {
          id: 'L',
          frameSize: 3,
          cells: lShape,
          anchors: [{ id: 'A', x: 10, y: 10 }],
          color: 'amber',
        },
      ],
    };

    let state = createPuzzle(level);
    // Đặt mảnh vào neo A khi chưa xoay (turns 0)
    const placed = applyCommand(level, state, { type: 'drop', pieceId: 'L', x: 10, y: 10 });
    expect(placed.becameWon).toBe(false);

    // Xoay mảnh tại neo A
    const rotatedTrans = applyCommand(level, placed.state, { type: 'rotate', pieceId: 'L' });
    expect(rotatedTrans.accepted).toBe(true);
    expect(rotatedTrans.state.pieces.L.turns).toBe(1);
    expect(rotatedTrans.becameWon).toBe(true);
    expect(rotatedTrans.state.phase).toBe('won');
  });

  test('Chapter 1 từ chối lệnh rotate', () => {
    const parsed = validateLevel(makeAdjacentFixture());
    if (!parsed.ok) throw new Error('invalid test fixture');
    const level = parsed.level;
    const state = createPuzzle(level);

    const res = applyCommand(level, state, { type: 'rotate', pieceId: 'D1' });
    expect(res.accepted).toBe(false);
    expect(res.outcome).toBe('rotation-disabled');
  });

  test('tính bất biến (immutability) của input state', () => {
    const parsed = validateLevel(makeAdjacentFixture());
    if (!parsed.ok) throw new Error('invalid test fixture');
    const level = parsed.level;
    const state = createPuzzle(level);

    const frozenSnapshot = JSON.stringify(state);
    applyCommand(level, state, { type: 'drop', pieceId: 'D1', x: 24, y: 76 });
    expect(JSON.stringify(state)).toBe(frozenSnapshot);
  });
});
