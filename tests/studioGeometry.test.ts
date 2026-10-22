import { describe, expect, test } from 'vitest';
import { levelTemplate } from '../src/content/sources/_template.ts';
import { layerCounts, outlinePath, snapAndClamp } from '../src/studio/geometry.ts';

describe('layerCounts (spec E, ST-03)', () => {
  test('đếm đúng số lớp của mảnh trong levelTemplate', () => {
    const counts = layerCounts(levelTemplate);
    expect(counts).toHaveLength(128 * 160);

    // Mảnh S1 vuông 48x48 ở tâm [64, 80], gốc neo A là (40, 56)
    // Các ô trong vùng (40..87, 56..103) có count = 1
    expect(counts[56 * 128 + 40]).toBe(1);
    expect(counts[103 * 128 + 87]).toBe(1);
    expect(counts[0]).toBe(0);
  });
});

describe('outlinePath (spec E, ST-03 & con số đã tính trước)', () => {
  test('khối 3 lớp của fixture triple (cột 8–15, hàng 0–15) cho đúng M32 0H64M32 64H64M32 0V64M64 0V64 ở tỉ lệ 4', () => {
    const cells: Array<[number, number]> = [];
    for (let y = 0; y < 16; y++) {
      for (let x = 8; x < 16; x++) {
        cells.push([x, y]);
      }
    }

    const path = outlinePath(cells, 4);
    expect(path).toBe('M32 0H64M32 64H64M32 0V64M64 0V64');
  });

  test('tập ô rỗng trả về chuỗi rỗng', () => {
    expect(outlinePath([], 4)).toBe('');
  });
});

describe('snapAndClamp (spec E, ST-03, Quyết định 3)', () => {
  const squarePiece = levelTemplate.pieces[0]; // frameSize 48

  test('hít vào giao điểm gần nhất khi ở trong bàn', () => {
    const res = snapAndClamp(squarePiece, 0, 34, 59);
    expect(res).toEqual({ x: 32, y: 56 });
  });

  test('kẹp khung không vượt quá mép bàn', () => {
    // Kéo gần sát mép phải (x = 100, frame 48 -> max 80)
    const res = snapAndClamp(squarePiece, 0, 100, 56);
    expect(res.x).toBe(80);
    expect(res.y).toBe(56);

    // Kéo gần mép đáy (y = 130, frame 48 -> max 112)
    const resBottom = snapAndClamp(squarePiece, 0, 40, 130);
    expect(resBottom.x).toBe(40);
    expect(resBottom.y).toBe(112);

    // Kéo âm
    const resNeg = snapAndClamp(squarePiece, 0, -20, -10);
    expect(resNeg).toEqual({ x: 0, y: 0 });
  });
});
