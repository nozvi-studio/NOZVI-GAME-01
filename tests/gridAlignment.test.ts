import { describe, expect, test } from 'vitest';
import levelDoc from '../src/content/levels/1-1.json' with { type: 'json' };
import { GRID_WIDTH, GRID_HEIGHT } from '../src/domain/model.ts';
import { GRID_TOKENS } from '../src/presentation/designTokens.ts';

const DISPLAY_CELL = GRID_TOKENS.displayCellInLogicCells; // 8 ô logic

describe('Quy tắc hình học GridSpec áp lên nội dung màn 1-1', () => {
  test('bàn chơi khai báo đúng lưới 128 x 160', () => {
    expect(levelDoc.board).toEqual({ width: GRID_WIDTH, height: GRID_HEIGHT });
  });

  test('nửa đường chéo mảnh là số nguyên ô lưới hiển thị', () => {
    for (const piece of levelDoc.pieces) {
      const halfDiagonal = piece.frameSize / 2;
      expect(halfDiagonal).toBe(24);
      expect(halfDiagonal % DISPLAY_CELL).toBe(0);
      // 24 ô logic = 3 ô lưới = đúng 1 module
      expect(halfDiagonal / DISPLAY_CELL).toBe(GRID_TOKENS.moduleInDisplayCells);
    }
  });

  test('mọi neo rơi đúng giao điểm lưới hiển thị', () => {
    for (const piece of levelDoc.pieces) {
      for (const anchor of piece.anchors) {
        expect(anchor.x % DISPLAY_CELL).toBe(0);
        expect(anchor.y % DISPLAY_CELL).toBe(0);
      }
    }
  });

  test('mọi ô của mảnh nằm trong khung frameSize', () => {
    for (const piece of levelDoc.pieces) {
      for (const [cx, cy] of piece.cells) {
        expect(cx).toBeGreaterThanOrEqual(0);
        expect(cy).toBeGreaterThanOrEqual(0);
        expect(cx).toBeLessThan(piece.frameSize);
        expect(cy).toBeLessThan(piece.frameSize);
      }
    }
  });

  test('mọi ô mục tiêu nằm trong lưới 128 x 160', () => {
    for (const [x, y] of levelDoc.targetCells) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(GRID_WIDTH);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(GRID_HEIGHT);
    }
  });

  test('lời giải mẫu phủ đúng tập ô mục tiêu', () => {
    const solution = levelDoc.sampleSolutions[0];
    const covered = new Set<string>();
    for (const step of solution) {
      const piece = levelDoc.pieces.find((p) => p.id === step.pieceId)!;
      const anchor = piece.anchors.find((a) => a.id === step.anchorId)!;
      // Neo là gốc khung mảnh (góc trên-trái), không phải tâm: drag.ts tính
      // tâm bằng anchor + frameSize/2, và fitsBoard nhận anchor làm gốc.
      const originX = anchor.x;
      const originY = anchor.y;
      for (const [cx, cy] of piece.cells) {
        covered.add(`${originX + cx},${originY + cy}`);
      }
    }
    const target = new Set(levelDoc.targetCells.map(([x, y]) => `${x},${y}`));
    expect(covered).toEqual(target);
  });

  test('màn có câu thơ hoàn thành', () => {
    expect(levelDoc.victoryVerse).toBe(
      'Hai vì sao chạm đỉnh, vũ trụ tìm thấy thế cân bằng.'
    );
  });
});
