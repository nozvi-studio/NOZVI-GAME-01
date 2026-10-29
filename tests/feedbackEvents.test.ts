import { describe, expect, test } from 'vitest';
import type { Level, Piece, PuzzleState, Transition } from '../src/domain/model.ts';
import { feedbackEvents } from '../src/presentation/feedback/feedbackEvents.ts';

// Ba hình vuông khung 16; neo A (0,0), B (8,0), C (4,0) cho giao 2 và 3 lớp
const square = (id: string, x: number): Piece => ({
  id, frameSize: 16, cells: [], color: 'amber', shapeKind: 'square', orientation: 0,
  anchors: [{ id: 'A', x, y: 0 }],
});
const level: Level = {
  id: 'test', title: 'Thử', chapter: 1, contentRevision: 't', rotationEnabled: true, placement: 'anchors',
  pieces: [square('P1', 0), square('P2', 8), square('P3', 4)],
  targetMask: new Uint8Array(0),
};
const tray = { kind: 'tray', turns: 0 } as const;
const snapped = { kind: 'snapped', anchorId: 'A', turns: 0 } as const;
const state = (pieces: PuzzleState['pieces'], phase: PuzzleState['phase'] = 'playing'): PuzzleState =>
  ({ levelId: 'test', phase, pieces });
const transition = (next: PuzzleState, extra: Partial<Transition> = {}): Transition => ({
  accepted: true, outcome: 'snapped', state: next, mask: new Uint8Array(0), changed: [], becameWon: false, ...extra,
});

describe('feedbackEvents', () => {
  const empty = state({ P1: tray, P2: tray, P3: tray });

  test('snap chỉ là onTarget khi mảnh nằm đúng chỗ lời giải mẫu', () => {
    const solved: Level = { ...level, targetPlacements: [{ pieceId: 'P1', x: 0, y: 0, turns: 0 }] };
    const next = state({ P1: snapped, P2: tray, P3: tray });
    const [onTarget] = feedbackEvents(empty, transition(next), solved, { command: 'move', pieceId: 'P1' });
    expect(onTarget).toMatchObject({ type: 'snap', onTarget: true });
    const [offTarget] = feedbackEvents(empty, transition(next), level, { command: 'move', pieceId: 'P1' });
    expect(offTarget).toMatchObject({ type: 'snap', onTarget: false });
  });

  test('snap đơn lẻ: chỉ có snap', () => {
    const next = state({ P1: snapped, P2: tray, P3: tray });
    expect(feedbackEvents(empty, transition(next), level, { command: 'move', pieceId: 'P1' }))
      .toEqual([{ type: 'snap', pieceId: 'P1', anchorId: 'A', onTarget: false, x: 0, y: 0 }]);
  });

  test('màn đặt tự do: thả vào giao điểm lưới (placed) là snap, không phải về khay', () => {
    const placed = state({ P1: { kind: 'placed', x: 8, y: 8, turns: 0 }, P2: tray, P3: tray });
    expect(feedbackEvents(empty, transition(placed, { outcome: 'snapped' }), level, { command: 'move', pieceId: 'P1' }))
      .toEqual([{ type: 'snap', pieceId: 'P1', anchorId: null, onTarget: false, x: 8, y: 8 }]);
    // Nhấc mảnh đã đặt trả về khay vẫn là return
    expect(feedbackEvents(placed, transition(empty, { outcome: 'tray' }), level, { command: 'move', pieceId: 'P1' }))
      .toEqual([{ type: 'return', pieceId: 'P1' }]);
  });

  test('thả tạm và về khay', () => {
    const temp = state({ P1: { kind: 'temporary', x: 40, y: 40, turns: 0 }, P2: tray, P3: tray });
    expect(feedbackEvents(empty, transition(temp, { outcome: 'temporary' }), level, { command: 'move', pieceId: 'P1' }))
      .toEqual([{ type: 'settle-temporary', pieceId: 'P1' }]);
    expect(feedbackEvents(temp, transition(empty, { outcome: 'tray' }), level, { command: 'move', pieceId: 'P1' }))
      .toEqual([{ type: 'return', pieceId: 'P1' }]);
  });

  test('giao 2 lớp sinh overlap-hollow', () => {
    const one = state({ P1: snapped, P2: tray, P3: tray });
    const two = state({ P1: snapped, P2: snapped, P3: tray });
    const events = feedbackEvents(one, transition(two), level, { command: 'move', pieceId: 'P2' });
    expect(events[0]).toEqual({ type: 'snap', pieceId: 'P2', anchorId: 'A', onTarget: false, x: 8, y: 0 });
    expect(events[1].type).toBe('overlap-hollow');
    expect(events).toHaveLength(2);
  });

  test('giao 3 lớp sinh overlap-revive', () => {
    const two = state({ P1: snapped, P2: snapped, P3: tray });
    const three = state({ P1: snapped, P2: snapped, P3: snapped });
    const types = feedbackEvents(two, transition(three), level, { command: 'move', pieceId: 'P3' }).map((e) => e.type);
    expect(types).toContain('overlap-revive');
    expect(types).toContain('overlap-hollow');
  });

  test('xoay được và xoay bị chặn', () => {
    const turned = state({ P1: { ...snapped, turns: 1 }, P2: tray, P3: tray });
    const before = state({ P1: snapped, P2: tray, P3: tray });
    expect(feedbackEvents(before, transition(turned, { outcome: 'rotated' }), level, { command: 'rotate', pieceId: 'P1' }))
      .toEqual([{ type: 'rotate', pieceId: 'P1', turns: 1 }]);
    const rejected = transition(before, { accepted: false, outcome: 'out-of-bounds' });
    expect(feedbackEvents(before, rejected, level, { command: 'rotate', pieceId: 'P1' }))
      .toEqual([{ type: 'rotate-blocked', pieceId: 'P1' }]);
  });

  test('xoay liên động: mỗi mảnh đổi nấc có một sự kiện rotate, mảnh được bấm đứng đầu', () => {
    const before = state({ P1: snapped, P2: { kind: 'tray', turns: 2 }, P3: tray });
    const turned = state({ P1: { ...snapped, turns: 1 }, P2: { kind: 'tray', turns: 3 }, P3: tray });
    expect(feedbackEvents(before, transition(turned, { outcome: 'rotated' }), level, { command: 'rotate', pieceId: 'P1' }))
      .toEqual([
        { type: 'rotate', pieceId: 'P1', turns: 1 },
        { type: 'rotate', pieceId: 'P2', turns: 3 },
      ]);
  });

  test('từ chối khác không sinh gì; đặt lại sinh reset', () => {
    expect(feedbackEvents(empty, transition(empty, { accepted: false, outcome: 'rotation-disabled' }), level,
      { command: 'rotate', pieceId: 'P1' })).toEqual([]);
    expect(feedbackEvents(empty, transition(empty, { outcome: 'reset' }), level, { command: 'reset', pieceId: null }))
      .toEqual([{ type: 'reset' }]);
  });

  test('mảnh cuối: snap rồi won', () => {
    const next = state({ P1: snapped, P2: tray, P3: tray }, 'won');
    const types = feedbackEvents(empty, transition(next, { outcome: 'won', becameWon: true }), level,
      { command: 'move', pieceId: 'P1' }).map((e) => e.type);
    expect(types).toEqual(['snap', 'won']);
  });
});
