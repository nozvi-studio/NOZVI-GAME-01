import { describe, expect, test } from 'vitest';
import type { Level, Placement } from '../src/domain/model.ts';
import { GRID_HEIGHT, GRID_WIDTH } from '../src/domain/model.ts';
import { fitsBoard, rotateCells } from '../src/domain/geometry.ts';
import { evaluate, matchesTarget } from '../src/domain/mask.ts';

describe('Kernel Geometry and Mask Rules', () => {
  test('vùng giao ba lớp hiện lại, bốn lớp trống', () => {
    const level: Level = {
      id: 'kernel',
      title: 'kernel',
      chapter: 2,
      contentRevision: 'test',
      rotationEnabled: false,
      placement: 'anchors',
      targetMask: new Uint8Array(GRID_WIDTH * GRID_HEIGHT),
      pieces: ['a', 'b', 'c', 'd'].map((id) => ({
        id,
        frameSize: 2,
        cells: [[0, 0]],
        anchors: [{ id: 'A', x: 4, y: 5 }],
        color: 'amber',
      })),
    };
    const all = level.pieces.map((p) => ({ pieceId: p.id, x: 4, y: 5, turns: 0 as const }));
    expect(evaluate(level, all.slice(0, 3))[5 * GRID_WIDTH + 4]).toBe(1);
    expect(evaluate(level, all).some(Boolean)).toBe(false);
    expect(evaluate(level, [...all].reverse())).toEqual(evaluate(level, all));
    const expected = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    expected[5 * GRID_WIDTH + 4] = 1;
    expect(matchesTarget(evaluate(level, all.slice(0, 3)), expected)).toBe(true);
    expect(rotateCells([[0, 0], [0, 1]], 3, 1)).toEqual([[2, 0], [1, 0]]);
    expect(fitsBoard([[0, 0]], 127.5, 10)).toBe(false);
  });

  test('0, 1, 2 lớp và tính bất biến thứ tự', () => {
    const level: Level = {
      id: 'parity',
      title: 'parity',
      chapter: 2,
      contentRevision: 'test',
      rotationEnabled: false,
      placement: 'anchors',
      targetMask: new Uint8Array(GRID_WIDTH * GRID_HEIGHT),
      pieces: [
        { id: 'p1', frameSize: 2, cells: [[0, 0]], anchors: [{ id: 'A', x: 10, y: 20 }], color: 'amber' },
        { id: 'p2', frameSize: 2, cells: [[0, 0]], anchors: [{ id: 'A', x: 10, y: 20 }], color: 'amber' },
      ],
    };

    // 0 lớp: không có placement nào -> mask trống
    expect(evaluate(level, []).some(Boolean)).toBe(false);

    // 1 lớp: hiện
    const one = [{ pieceId: 'p1', x: 10, y: 20, turns: 0 as const }];
    expect(evaluate(level, one)[20 * GRID_WIDTH + 10]).toBe(1);

    // 2 lớp: triệt tiêu thành trống
    const two = [
      { pieceId: 'p1', x: 10, y: 20, turns: 0 as const },
      { pieceId: 'p2', x: 10, y: 20, turns: 0 as const },
    ];
    expect(evaluate(level, two)[20 * GRID_WIDTH + 10]).toBe(0);
  });

  test('xoay hình bất đối xứng qua 4 nấc', () => {
    // Shape chữ L trong frame 3x3: (0,0), (0,1), (1,1)
    const original: [number, number][] = [[0, 0], [0, 1], [1, 1]];
    const frameSize = 3;

    // turns 1: (x, y) -> (frameSize - 1 - y, x)
    // (0,0) -> (2,0); (0,1) -> (1,0); (1,1) -> (1,1)
    const turn1 = rotateCells(original, frameSize, 1);
    expect(turn1).toEqual([[2, 0], [1, 0], [1, 1]]);

    // turns 4 phải quay về vị trí ban đầu
    const turn4 = rotateCells(original, frameSize, 4);
    expect(turn4).toEqual(original);
  });

  test('kiểm tra fitsBoard và mép biên', () => {
    // Ô hợp lệ ở góc trên trái
    expect(fitsBoard([[0, 0]], 0, 0)).toBe(true);
    // Ô hợp lệ ở góc dưới phải (127, 159)
    expect(fitsBoard([[0, 0]], 127, 159)).toBe(true);

    // Vượt biên phải (x + cx >= 128)
    expect(fitsBoard([[0, 0]], 128, 10)).toBe(false);
    expect(fitsBoard([[1, 0]], 127, 10)).toBe(false);

    // Vượt biên dưới (y + cy >= 160)
    expect(fitsBoard([[0, 0]], 10, 160)).toBe(false);
    expect(fitsBoard([[0, 1]], 10, 159)).toBe(false);

    // Tọa độ âm hoặc không phải số nguyên
    expect(fitsBoard([[0, 0]], -1, 0)).toBe(false);
    expect(fitsBoard([[0, 0]], 0, -1)).toBe(false);
    expect(fitsBoard([[0, 0]], 10.5, 20)).toBe(false);
    expect(fitsBoard([[0, 0]], NaN, 20)).toBe(false);
  });

  test('matchesTarget so khớp chính xác từng ô', () => {
    const maskA = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    const maskB = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    maskA[100] = 1;
    maskB[100] = 1;
    expect(matchesTarget(maskA, maskB)).toBe(true);

    // Thừa một ô
    maskB[101] = 1;
    expect(matchesTarget(maskA, maskB)).toBe(false);

    // Thiếu một ô
    maskB[100] = 0;
    maskB[101] = 0;
    expect(matchesTarget(maskA, maskB)).toBe(false);
  });

  test('evaluate ném lỗi khi pieceId không hợp lệ hoặc lặp lại hoặc ngoài biên', () => {
    const level: Level = {
      id: 'err',
      title: 'err',
      chapter: 1,
      contentRevision: 'test',
      rotationEnabled: false,
      placement: 'anchors',
      targetMask: new Uint8Array(GRID_WIDTH * GRID_HEIGHT),
      pieces: [{ id: 'p1', frameSize: 2, cells: [[0, 0]], anchors: [{ id: 'A', x: 0, y: 0 }], color: 'amber' }],
    };

    // Unknown piece
    expect(() => evaluate(level, [{ pieceId: 'unknown', x: 0, y: 0, turns: 0 }])).toThrow('unknown-piece');

    // Duplicate piece
    expect(() =>
      evaluate(level, [
        { pieceId: 'p1', x: 0, y: 0, turns: 0 },
        { pieceId: 'p1', x: 1, y: 1, turns: 0 },
      ])
    ).toThrow();

    // Out of bounds
    expect(() => evaluate(level, [{ pieceId: 'p1', x: 200, y: 0, turns: 0 }])).toThrow('out-of-bounds');
  });
});
