import { describe, expect, test } from 'vitest';
import {
  computeLayout,
  gridToCanvas,
  canvasToGrid,
  pieceCenterCanvas,
  pieceRadiusPx,
  trayPieceRadiusPx,
  pieceHitbox,
  piecePolygonCanvas,
  piecePolygonAround,
  trayWellRects,
} from '../src/presentation/board/layout.ts';
import type { Piece } from '../src/domain/model.ts';
import { GRID_WIDTH, GRID_HEIGHT } from '../src/domain/model.ts';
import { GRID_TOKENS } from '../src/presentation/designTokens.ts';

describe('Layout Metrics Specification', () => {
  const layout = computeLayout(720, 1280);

  test('lưới logic 128 x 160 theo đặc tả GridSpec', () => {
    expect(GRID_WIDTH).toBe(128);
    expect(GRID_HEIGHT).toBe(160);
  });

  test('bàn chơi 640x800 tại (40, 200) ở tỉ lệ 5px mỗi ô logic', () => {
    expect(layout.boardBounds).toEqual({ x: 40, y: 200, width: 640, height: 800 });
    expect(layout.cellPixel).toBe(5);
    expect(GRID_WIDTH * layout.cellPixel).toBe(layout.boardBounds.width);
    expect(GRID_HEIGHT * layout.cellPixel).toBe(layout.boardBounds.height);
  });

  test('khay, header và thanh dưới theo bố cục dọc mới', () => {
    expect(layout.trayBounds).toEqual({ x: 40, y: 1016, width: 640, height: 136 });
    expect(layout.headerBounds).toEqual({ y: 0, height: 96 });
    expect(layout.bottomBarBounds).toEqual({ y: 1164, height: 116 });
  });

  test('chuyển đổi grid sang canvas tính đúng gốc (40, 200)', () => {
    expect(gridToCanvas(0, 0, layout)).toEqual({ x: 40, y: 200 });
    expect(gridToCanvas(64, 80, layout)).toEqual({ x: 40 + 320, y: 200 + 400 });
  });

  test('chuyển đổi canvas sang grid nhận diện đúng trong và ngoài bàn', () => {
    expect(canvasToGrid(40 + 64 * 5, 200 + 80 * 5, layout)).toEqual({
      x: 64,
      y: 80,
      insideBoard: true,
    });
    // Ngay dưới mép dưới bàn: y logic = 160, vượt lưới
    expect(canvasToGrid(40, 200 + 160 * 5, layout).insideBoard).toBe(false);
  });

  test('một ô lưới hiển thị bằng 40px và một module bằng 120px', () => {
    const displayPx = layout.cellPixel * GRID_TOKENS.displayCellInLogicCells;
    expect(displayPx).toBe(40);
    expect(displayPx * GRID_TOKENS.moduleInDisplayCells).toBe(120);
    // Bàn chứa đúng số nguyên ô lưới hiển thị theo cả hai chiều
    expect(layout.boardBounds.width % displayPx).toBe(0);
    expect(layout.boardBounds.height % displayPx).toBe(0);
  });
});

describe('Tâm và bán kính mảnh suy ra từ frameSize', () => {
  const layout = computeLayout(720, 1280);

  test('tâm mảnh bằng gốc cộng nửa khung, không phải hằng số', () => {
    // frameSize 48: nửa khung 24 ô logic
    expect(pieceCenterCanvas(48, 16, 56, layout)).toEqual({
      x: 40 + (16 + 24) * 5,
      y: 200 + (56 + 24) * 5,
    });
    // frameSize 40: nửa khung 20 ô logic — cùng công thức, khác kết quả
    expect(pieceCenterCanvas(40, 16, 56, layout)).toEqual({
      x: 40 + (16 + 20) * 5,
      y: 200 + (56 + 20) * 5,
    });
  });

  test('bán kính vẽ bằng nửa đường chéo thật của mảnh', () => {
    expect(pieceRadiusPx(48, layout)).toBe(120);
    expect(pieceRadiusPx(40, layout)).toBe(100);
  });

  test('với màn 1-1, hai mảnh chạm đỉnh nhau đúng giữa bàn', () => {
    const left = pieceCenterCanvas(48, 16, 56, layout);
    const right = pieceCenterCanvas(48, 64, 56, layout);
    const radius = pieceRadiusPx(48, layout);

    // Đỉnh phải mảnh trái trùng đỉnh trái mảnh phải
    expect(left.x + radius).toBe(right.x - radius);
    // Và điểm chạm nằm đúng tâm bàn theo chiều ngang
    expect(left.x + radius).toBe(layout.boardBounds.x + layout.boardBounds.width / 2);
    expect(left.y).toBe(right.y);
  });
});

describe('Bán kính mảnh trong khay', () => {
  const layout = computeLayout(720, 1280);

  test('mảnh trong khay phải lọt hẳn chiều cao khay', () => {
    const r = trayPieceRadiusPx(layout);
    expect(r * 2).toBeLessThanOrEqual(layout.trayBounds.height);
    expect(r).toBeGreaterThan(0);
  });

  test('nhỏ hơn mảnh trên bàn, vì khay thấp hơn bàn nhiều', () => {
    expect(trayPieceRadiusPx(layout)).toBeLessThan(pieceRadiusPx(48, layout));
  });

  test('hai mảnh nằm cạnh nhau trong khay không chạm nhau', () => {
    const slotWidth = layout.trayBounds.width / 2;
    expect(trayPieceRadiusPx(layout) * 2).toBeLessThan(slotWidth);
  });
});

describe('Đa giác mảnh và khay N ô', () => {
  const layout = computeLayout(720, 1280);

  function makePiece(shapeKind: Piece['shapeKind'], orientation: Piece['orientation'] = 0): Piece {
    return { id: 'P', frameSize: 48, cells: [], anchors: [{ id: 'A', x: 0, y: 0 }], color: 'amber', shapeKind, orientation };
  }

  test('hình vuông gốc (40, 64) phủ đúng khung 240px trên canvas', () => {
    expect(piecePolygonCanvas(makePiece('square'), 40, 64, 0, layout)).toEqual([
      { x: 240, y: 520 },
      { x: 480, y: 520 },
      { x: 480, y: 760 },
      { x: 240, y: 760 },
    ]);
  });

  test('mảnh không ghi shapeKind được vẽ như thoi (literal viết tay trong test domain)', () => {
    const legacy: Piece = { id: 'D', frameSize: 48, cells: [], anchors: [], color: 'amber' };
    expect(piecePolygonCanvas(legacy, 16, 56, 0, layout)).toEqual([
      { x: 240, y: 480 },
      { x: 360, y: 600 },
      { x: 240, y: 720 },
      { x: 120, y: 600 },
    ]);
  });

  test('xoay một nấc dùng đa giác của hướng hiệu dụng', () => {
    // Mái hướng 4 xoay 1 nấc thành hướng 5: cạnh huyền nằm bên trái khung
    expect(piecePolygonAround(makePiece('triangle', 4), 1, 100, 100, 48)).toEqual([
      { x: 76, y: 76 },
      { x: 76, y: 124 },
      { x: 100, y: 100 },
    ]);
  });

  test('ô lõm khay: 2 ô trùng vị trí cũ, 3 ô nằm gọn và không chồng nhau', () => {
    expect(trayWellRects(layout, 2)).toEqual([
      { x: 56, y: 1030, width: 296, height: 108 },
      { x: 368, y: 1030, width: 296, height: 108 },
    ]);
    const three = trayWellRects(layout, 3);
    expect(three).toHaveLength(3);
    for (let i = 0; i < three.length; i++) {
      expect(three[i].x).toBeGreaterThanOrEqual(layout.trayBounds.x);
      expect(three[i].x + three[i].width).toBeLessThanOrEqual(layout.trayBounds.x + layout.trayBounds.width);
      if (i > 0) expect(three[i].x).toBeGreaterThan(three[i - 1].x + three[i - 1].width);
    }
  });

  test('hitbox khay 3 mảnh không chồng nhau và nằm trong khay', () => {
    const piece = makePiece('square');
    const boxes = [0, 1, 2].map((i) => pieceHitbox(piece, { kind: 'tray', turns: 0 }, layout, i, 3));
    for (let i = 0; i < boxes.length; i++) {
      expect(boxes[i].x).toBeGreaterThanOrEqual(layout.trayBounds.x);
      expect(boxes[i].x + boxes[i].width).toBeLessThanOrEqual(layout.trayBounds.x + layout.trayBounds.width + 1e-9);
      if (i > 0) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width - 1e-9);
    }
  });

  test('hitbox khay 2 mảnh không đổi so với trước', () => {
    const piece = makePiece('diamond');
    expect(pieceHitbox(piece, { kind: 'tray', turns: 0 }, layout, 1)).toEqual(
      pieceHitbox(piece, { kind: 'tray', turns: 0 }, layout, 1, 2)
    );
    expect(pieceHitbox(piece, { kind: 'tray', turns: 0 }, layout, 1, 2)).toEqual({
      x: 400,
      y: 964,
      width: 240,
      height: 240,
    });
  });

  test('bán kính mảnh trong khay co theo số ô khi khay chật', () => {
    expect(trayPieceRadiusPx(layout)).toBe(52);
    expect(trayPieceRadiusPx(layout, 3)).toBe(52);
    expect(trayPieceRadiusPx(layout, 5)).toBe(48);
  });
});
