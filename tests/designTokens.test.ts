import { describe, expect, test } from 'vitest';
import {
  COLOR_TOKENS,
  COLOR_NUMBERS,
  TYPO_TOKENS,
  LAYOUT_TOKENS,
  ANIM_TOKENS,
  DEPTH_TOKENS,
  GRID_TOKENS,
  GLASS_TOKENS,
  PIECE_TOKENS,
  AUDIO_TOKENS,
} from '../src/presentation/designTokens.ts';

describe('Design Tokens Validation', () => {
  test('bảng màu trời bốn chặng theo mockup improve-v1', () => {
    expect(COLOR_TOKENS.sky.stops).toEqual(['#1A2470', '#1E2A80', '#24307F', '#1B2563']);
    expect(COLOR_TOKENS.sky.nebulaBlue).toBe('#7FB8FF');
    expect(COLOR_TOKENS.sky.nebulaPink).toBe('#FF9FD2');
    expect(COLOR_TOKENS.sky.moonCore).toBe('#FFF4D6');
  });

  test('mặt bàn và viền băng dùng màu mới, không còn màu navy phẳng cũ', () => {
    expect(COLOR_TOKENS.board.surfaceTop).toBe('#1D3482');
    expect(COLOR_TOKENS.board.surfaceBottom).toBe('#14215E');
    expect(COLOR_TOKENS.iceGlass.primaryBorder).toBe('#A9E3FF');

    const allColors = JSON.stringify(COLOR_TOKENS).toUpperCase();
    expect(allColors.includes('#080E24')).toBe(false);
    expect(allColors.includes('#4ECDC4')).toBe(false);
  });

  test('COLOR_NUMBERS phản chiếu đúng COLOR_TOKENS dưới dạng số hex', () => {
    expect(COLOR_NUMBERS.boardSurfaceTop).toBe(0x1d3482);
    expect(COLOR_NUMBERS.icePrimary).toBe(0xa9e3ff);
    expect(COLOR_NUMBERS.gridModule).toBe(0xffd27a);
    expect(COLOR_NUMBERS.jewelFaceNorth).toBe(0xffeaa8);
  });

  test('GRID_TOKENS khớp quy tắc hình học GridSpec', () => {
    expect(GRID_TOKENS.logicCellPx).toBe(5);
    expect(GRID_TOKENS.displayCellInLogicCells).toBe(8);
    expect(GRID_TOKENS.moduleInDisplayCells).toBe(3);
    // Ô lưới hiển thị 40px, module 120px
    expect(GRID_TOKENS.logicCellPx * GRID_TOKENS.displayCellInLogicCells).toBe(40);
    expect(
      GRID_TOKENS.logicCellPx *
        GRID_TOKENS.displayCellInLogicCells *
        GRID_TOKENS.moduleInDisplayCells
    ).toBe(120);
  });

  test('PIECE_TOKENS định nghĩa đủ bốn mặt vát theo chiều sáng trên-trái', () => {
    expect(PIECE_TOKENS.faceNorth).toBe('#FFEAA8');
    expect(PIECE_TOKENS.faceEast).toBe('#FFD56E');
    expect(PIECE_TOKENS.faceSouth).toBe('#EFA53A');
    expect(PIECE_TOKENS.faceWest).toBe('#F9BF4F');
    expect(PIECE_TOKENS.outline).toBe('#FFF4CC');
    expect(PIECE_TOKENS.outlineWidth).toBe(2);
    expect(PIECE_TOKENS.tableRatio).toBe(0.45);
  });

  test('GLASS_TOKENS mô tả khung kính dùng chung cho bàn và khay', () => {
    expect(GLASS_TOKENS.frameStops).toEqual(['#E6F7FF', '#8BD3F5', '#4E9BD0', '#2D5E9A']);
    expect(GLASS_TOKENS.cornerRadius).toBe(30);
    expect(GLASS_TOKENS.padding).toBe(6);
  });

  test('LAYOUT_TOKENS theo bố cục dọc mới, tổng chiều cao không vượt canvas', () => {
    expect(LAYOUT_TOKENS.board).toEqual({
      x: 40,
      y: 200,
      width: 640,
      height: 800,
      cornerRadius: 30,
      borderWidth: 6,
    });
    expect(LAYOUT_TOKENS.tray).toEqual({ x: 40, y: 1016, width: 640, height: 136, cornerRadius: 24 });
    expect(LAYOUT_TOKENS.header).toEqual({ y: 0, height: 96 });
    expect(LAYOUT_TOKENS.bottomBar).toEqual({ y: 1164, height: 116 });
    expect(LAYOUT_TOKENS.targetBadge).toEqual({ x: 360, y: 158, size: 188, radius: 94 });

    const used =
      LAYOUT_TOKENS.header.height +
      LAYOUT_TOKENS.board.height +
      LAYOUT_TOKENS.tray.height +
      LAYOUT_TOKENS.bottomBar.height;
    expect(used).toBe(1148);
    expect(used).toBeLessThanOrEqual(LAYOUT_TOKENS.canvas.height);
  });

  test('bàn chơi căn giữa theo chiều ngang canvas', () => {
    expect(LAYOUT_TOKENS.board.x * 2 + LAYOUT_TOKENS.board.width).toBe(
      LAYOUT_TOKENS.canvas.width
    );
  });

  test('giữ nguyên font và thời gian animation chuẩn', () => {
    expect(TYPO_TOKENS.fontFamily.serif).toContain('Baloo 2');
    expect(TYPO_TOKENS.fontFamily.sans).toContain('Be Vietnam Pro');
    expect(ANIM_TOKENS.duration.snapMs).toBe(120);
    expect(ANIM_TOKENS.duration.overlapInversionMs).toBe(150);
    expect(ANIM_TOKENS.duration.buttonTapMs).toBe(90);
  });

  test('định nghĩa các layer depth có thứ bậc hợp lý', () => {
    expect(DEPTH_TOKENS.backgroundSky).toBeLessThan(DEPTH_TOKENS.steleBoard);
    expect(DEPTH_TOKENS.steleBoard).toBeLessThan(DEPTH_TOKENS.placedPieces);
    expect(DEPTH_TOKENS.placedPieces).toBeLessThan(DEPTH_TOKENS.draggingPiece);
    expect(DEPTH_TOKENS.draggingPiece).toBeLessThan(DEPTH_TOKENS.modalOverlay);
  });
  test('audio tokens keep music under effects and match spec G timings', () => {
    expect(AUDIO_TOKENS.musicVolume).toBeLessThan(AUDIO_TOKENS.sfxVolume);
    expect(AUDIO_TOKENS.duck).toEqual({ level: 0.3, holdMs: 1500, downMs: 200, upMs: 800 });
    expect(AUDIO_TOKENS.maxVoices).toBe(6);
    expect(AUDIO_TOKENS.repeatGapMs).toBe(40);
    expect(AUDIO_TOKENS.overlapDelayMs).toBe(60);
  });
});
