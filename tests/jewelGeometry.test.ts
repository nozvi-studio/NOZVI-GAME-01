import { describe, expect, test } from 'vitest';
import {
  jewelOutline,
  jewelFaces,
  jewelTable,
  jewelSpineLines,
  polygonCentroid,
  polygonFaces,
  polygonTable,
  scalePolygon,
  polygonStrokeOutline,
} from '../src/presentation/board/jewelGeometry.ts';
import { PIECE_TOKENS } from '../src/presentation/designTokens.ts';

const CX = 360;
const CY = 600;
const R = 120; // một module

describe('viền trong theo khoảng cách vuông góc', () => {
  const roof = [{ x: 0, y: 48 }, { x: 48, y: 48 }, { x: 24, y: 24 }];

  test('mái: mỗi cạnh viền cách cạnh ngoài đúng nửa nét', () => {
    const inner = polygonStrokeOutline(roof, 2);
    roof.forEach((a, i) => {
      const b = roof[(i + 1) % roof.length];
      for (const p of [inner[i], inner[(i + 1) % inner.length]]) {
        const distance = Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
        expect(distance).toBeCloseTo(1, 9);
      }
    });
    expect(inner[0].y).toBe(47);
    expect(inner[2].y).toBeCloseTo(24 + Math.SQRT2, 9);
  });

  test('đổi chiều đỉnh giữ nguyên viền trong', () => {
    const forward = polygonStrokeOutline(roof, 2);
    const reversed = polygonStrokeOutline([...roof].reverse(), 2).reverse();
    forward.forEach((p, i) => {
      expect(reversed[i].x).toBeCloseTo(p.x, 9);
      expect(reversed[i].y).toBeCloseTo(p.y, 9);
    });
  });

  test('vuông: viền co đúng một pixel trên mọi cạnh', () => {
    expect(polygonStrokeOutline([{ x: 0, y: 0 }, { x: 48, y: 0 }, { x: 48, y: 48 }, { x: 0, y: 48 }], 2)).toEqual([
      { x: 1, y: 1 }, { x: 47, y: 1 }, { x: 47, y: 47 }, { x: 1, y: 47 },
    ]);
  });

  test('thoi giữ nguyên viền cũ cả khi đổi chiều đỉnh', () => {
    const diamond = jewelOutline(CX, CY, R);
    expect(polygonStrokeOutline(diamond, 2)).toEqual(jewelOutline(CX, CY, R - 1));
    expect(polygonStrokeOutline([...diamond].reverse(), 2).reverse()).toEqual(jewelOutline(CX, CY, R - 1));
  });
});

describe('jewelGeometry', () => {
  test('viền ngoài là bốn đỉnh, bắt đầu từ Bắc theo chiều kim đồng hồ', () => {
    expect(jewelOutline(CX, CY, R)).toEqual([
      { x: CX, y: CY - R },
      { x: CX + R, y: CY },
      { x: CX, y: CY + R },
      { x: CX - R, y: CY },
    ]);
  });

  test('thoi là hình vuông xoay 45 độ: hai đường chéo bằng nhau và vuông góc', () => {
    const [n, e, s, w] = jewelOutline(CX, CY, R);
    expect(Math.hypot(s.x - n.x, s.y - n.y)).toBeCloseTo(2 * R, 6);
    expect(Math.hypot(e.x - w.x, e.y - w.y)).toBeCloseTo(2 * R, 6);
    // Đường chéo dọc và ngang vuông góc
    expect((s.x - n.x) * (e.x - w.x) + (s.y - n.y) * (e.y - w.y)).toBeCloseTo(0, 6);
  });

  test('mỗi cạnh có hệ số góc 45 độ, nên nằm trên đường chéo của lưới', () => {
    const pts = jewelOutline(CX, CY, R);
    for (let i = 0; i < 4; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 4];
      expect(Math.abs((b.y - a.y) / (b.x - a.x))).toBeCloseTo(1, 6);
    }
  });

  test('bốn mặt vát, mỗi mặt một tam giác từ tâm, màu sáng ở trên-trái', () => {
    const faces = jewelFaces(CX, CY, R);
    expect(faces.map((f) => f.name)).toEqual(['north', 'east', 'south', 'west']);
    for (const face of faces) {
      expect(face.points).toHaveLength(3);
      expect(face.points).toContainEqual({ x: CX, y: CY });
    }
    expect(faces[0].color).toBe(PIECE_TOKENS.faceNorth);
    expect(faces[1].color).toBe(PIECE_TOKENS.faceEast);
    expect(faces[2].color).toBe(PIECE_TOKENS.faceSouth);
    expect(faces[3].color).toBe(PIECE_TOKENS.faceWest);
  });

  test('bốn mặt phủ kín mảnh, không chừa khe và không chồng nhau', () => {
    const faces = jewelFaces(CX, CY, R);
    const area = (pts: Array<{ x: number; y: number }>) =>
      Math.abs(
        pts.reduce((sum, p, i) => {
          const q = pts[(i + 1) % pts.length];
          return sum + (p.x * q.y - q.x * p.y);
        }, 0) / 2
      );
    const total = faces.reduce((sum, f) => sum + area(f.points), 0);
    // Diện tích hình thoi hai đường chéo 2R là 2R^2
    expect(total).toBeCloseTo(2 * R * R, 6);
  });

  test('mặt bàn là thoi nhỏ đồng tâm, bán kính theo tỉ lệ token', () => {
    const table = jewelTable(CX, CY, R);
    expect(table).toHaveLength(4);
    const expectedR = R * PIECE_TOKENS.tableRatio;
    expect(table[0]).toEqual({ x: CX, y: CY - expectedR });
    expect(table[2]).toEqual({ x: CX, y: CY + expectedR });
  });

  test('bốn đoạn nối từ đỉnh vào mặt bàn, không cắt qua tâm', () => {
    const lines = jewelSpineLines(CX, CY, R);
    expect(lines).toHaveLength(4);
    const tableR = R * PIECE_TOKENS.tableRatio;
    for (const line of lines) {
      const distFrom = Math.hypot(line.from.x - CX, line.from.y - CY);
      const distTo = Math.hypot(line.to.x - CX, line.to.y - CY);
      expect(distFrom).toBeCloseTo(R, 6);
      expect(distTo).toBeCloseTo(tableR, 6);
    }
  });

  test('đỉnh mảnh rơi đúng giao điểm lưới khi tâm và bán kính là bội số ô lưới', () => {
    // Tâm (40*5, 80*5) = (200, 400) trên canvas, bán kính một module
    const pts = jewelOutline(200, 400, 120);
    for (const p of pts) {
      expect((p.x - 200) % 40 === 0 || (p.y - 400) % 40 === 0).toBe(true);
    }
  });
});

describe('mặt vát cho đa giác bất kỳ', () => {
  const sortedFace = (f: { name: string; color: string; points: Array<{ x: number; y: number }> }) => ({
    name: f.name,
    color: f.color,
    points: [...f.points].sort((a, b) => a.x - b.x || a.y - b.y),
  });

  test('thoi dựng bằng polygonFaces giống hệt jewelFaces (bỏ qua thứ tự đỉnh)', () => {
    const generic = polygonFaces(jewelOutline(CX, CY, R)).map(sortedFace);
    const legacy = jewelFaces(CX, CY, R).map(sortedFace);
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    expect(generic.sort(byName)).toEqual(legacy.sort(byName));
  });

  test('hình vuông: cạnh trên và trái sáng nhất, phải là Đông, dưới là Tây', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(polygonFaces(sq).map((f) => f.name)).toEqual(['north', 'east', 'west', 'north']);
  });

  test('mái hướng 4: hai cạnh xiên là Bắc và Đông, cạnh huyền ở đáy là Tây', () => {
    const roof = [
      { x: 0, y: 48 },
      { x: 48, y: 48 },
      { x: 24, y: 24 },
    ];
    expect(polygonFaces(roof).map((f) => f.name)).toEqual(['west', 'east', 'north']);
  });

  test('mặt bàn đa giác trùng mặt bàn thoi cũ', () => {
    const generic = polygonTable(jewelOutline(CX, CY, R));
    const legacy = jewelTable(CX, CY, R);
    generic.forEach((p, i) => {
      expect(p.x).toBeCloseTo(legacy[i].x, 9);
      expect(p.y).toBeCloseTo(legacy[i].y, 9);
    });
  });

  test('trọng tâm và phép co giãn quanh trọng tâm', () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 0, y: 30 },
    ];
    expect(polygonCentroid(tri)).toEqual({ x: 10, y: 10 });
    expect(scalePolygon(tri, { x: 10, y: 10 }, 0.5)).toEqual([
      { x: 5, y: 5 },
      { x: 20, y: 5 },
      { x: 5, y: 20 },
    ]);
  });
});
