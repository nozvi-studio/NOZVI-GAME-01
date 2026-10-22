import { describe, expect, test } from 'vitest';
import { diffLayers, layerKey, overlapLayers, perimeterSegment } from '../src/presentation/feedback/parityDiff.ts';

const sq = (x: number, y: number, s: number) => [
  { x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s },
];

describe('lớp giao', () => {
  test('overlapLayers bỏ lớp đơn, giữ lớp 2 và 3', () => {
    const layers = overlapLayers([sq(0, 0, 16), sq(8, 0, 16), sq(4, 0, 16)]);
    expect(layers.every((l) => l.depth >= 2)).toBe(true);
    expect(layers.some((l) => l.depth === 3 && l.filled)).toBe(true);
    expect(layers.some((l) => l.depth === 2 && !l.filled)).toBe(true);
  });

  test('khoá không phụ thuộc đỉnh bắt đầu', () => {
    const a = { points: sq(0, 0, 8), depth: 2, filled: false };
    const b = { points: [...sq(0, 0, 8).slice(2), ...sq(0, 0, 8).slice(0, 2)], depth: 2, filled: false };
    expect(layerKey(a)).toBe(layerKey(b));
    expect(layerKey({ ...a, depth: 3, filled: true })).not.toBe(layerKey(a));
  });

  test('diffLayers tách lớp giữ và lớp mới', () => {
    const before = overlapLayers([sq(0, 0, 16), sq(8, 0, 16)]);
    const after = overlapLayers([sq(0, 0, 16), sq(8, 0, 16), sq(4, 0, 16)]);
    const { kept, added } = diffLayers(before, after);
    expect(kept.map(layerKey)).toEqual(before.map(layerKey).filter((k) => after.map(layerKey).includes(k)));
    expect(added.length).toBe(after.length - kept.length);
    expect(added.some((l) => l.depth === 3)).toBe(true);
  });
});

describe('perimeterSegment', () => {
  const box = sq(0, 0, 10); // chu vi 40

  test('đoạn 25% từ đầu đi hết cạnh trên rồi xuống', () => {
    const seg = perimeterSegment(box, 0, 0.25);
    expect(seg[0]).toEqual({ x: 0, y: 0 });
    expect(seg[seg.length - 1]).toEqual({ x: 10, y: 0 });
  });

  test('đoạn vắt qua điểm đầu thì quấn vòng', () => {
    const seg = perimeterSegment(box, 0.9, 0.25);
    expect(seg[0]).toEqual({ x: 0, y: 4 });
    expect(seg[seg.length - 1]).toEqual({ x: 6, y: 0 });
  });

  test('độ dài 0 hoặc đa giác suy biến thì rỗng', () => {
    expect(perimeterSegment(box, 0.3, 0)).toEqual([]);
    expect(perimeterSegment([{ x: 0, y: 0 }], 0, 0.5)).toEqual([]);
  });
});
