import { describe, expect, test } from 'vitest';
import { buildGridLayers, buildCornerMarks } from '../src/presentation/board/gridLayers.ts';
import { LAYOUT_TOKENS } from '../src/presentation/designTokens.ts';

const BOARD = LAYOUT_TOKENS.board;

describe('gridLayers', () => {
  const layers = buildGridLayers(BOARD);
  const byName = (name: string) => layers.find((l) => l.name === name)!;

  test('đủ năm lớp theo đúng thứ tự vẽ của mockup', () => {
    expect(layers.map((l) => l.name)).toEqual([
      'fine',
      'diagonal',
      'module',
      'axis',
      'tick',
    ]);
  });

  test('lưới mảnh cách nhau 40px, phủ kín bàn theo cả hai chiều', () => {
    const fine = byName('fine').segments;
    const verticals = fine.filter((s) => s.x1 === s.x2);
    const horizontals = fine.filter((s) => s.y1 === s.y2);

    expect(verticals).toHaveLength(BOARD.width / 40 + 1); // 17
    expect(horizontals).toHaveLength(BOARD.height / 40 + 1); // 21

    const xs = verticals.map((s) => s.x1).sort((a, b) => a - b);
    expect(xs[0]).toBe(BOARD.x);
    expect(xs.at(-1)).toBe(BOARD.x + BOARD.width);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBe(40);
    }
  });

  test('lưới module cách nhau 120px', () => {
    const module = byName('module').segments;
    const verticals = module.filter((s) => s.x1 === s.x2).map((s) => s.x1).sort((a, b) => a - b);
    for (let i = 1; i < verticals.length; i++) {
      expect(verticals[i] - verticals[i - 1]).toBe(120);
    }
    expect(verticals.every((x) => (x - BOARD.x) % 120 === 0)).toBe(true);
  });

  test('trục giữa đi qua đúng tâm bàn, một ngang một dọc', () => {
    const axis = byName('axis').segments;
    expect(axis).toHaveLength(2);
    const vertical = axis.find((s) => s.x1 === s.x2)!;
    const horizontal = axis.find((s) => s.y1 === s.y2)!;
    expect(vertical.x1).toBe(BOARD.x + BOARD.width / 2);
    expect(horizontal.y1).toBe(BOARD.y + BOARD.height / 2);
  });

  test('đường chéo 45 độ có hệ số góc đúng bằng 1 hoặc -1', () => {
    const diagonal = byName('diagonal').segments;
    expect(diagonal.length).toBeGreaterThan(0);
    for (const s of diagonal) {
      const slope = Math.abs((s.y2 - s.y1) / (s.x2 - s.x1));
      expect(slope).toBeCloseTo(1, 6);
    }
  });

  test('vạch thước nằm ở bốn mép, vạch module dài hơn vạch thường', () => {
    const ticks = byName('tick').segments;
    const lengths = ticks.map((s) => Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1));
    expect(new Set(lengths)).toEqual(new Set([5, 9]));
    expect(lengths.filter((l) => l === 9).length).toBeGreaterThan(0);
  });

  test('mọi đoạn nằm trong biên bàn chơi', () => {
    for (const layer of layers) {
      for (const s of layer.segments) {
        for (const x of [s.x1, s.x2]) {
          expect(x).toBeGreaterThanOrEqual(BOARD.x);
          expect(x).toBeLessThanOrEqual(BOARD.x + BOARD.width);
        }
        for (const y of [s.y1, s.y2]) {
          expect(y).toBeGreaterThanOrEqual(BOARD.y);
          expect(y).toBeLessThanOrEqual(BOARD.y + BOARD.height);
        }
      }
    }
  });

  test('bốn dấu góc chữ L, mỗi dấu hai đoạn', () => {
    const marks = buildCornerMarks(BOARD);
    expect(marks).toHaveLength(8);
  });
});
