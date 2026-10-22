import { describe, expect, test, vi } from 'vitest';
import type Phaser from 'phaser';
import { BoardRenderer } from '../src/presentation/board/BoardRenderer.ts';
import { computeLayout } from '../src/presentation/board/layout.ts';
import { anchorLevel } from './fixtures/anchorLevels.ts';
import type { PieceState } from '../src/domain/model.ts';
import type { PlayViewSnapshot } from '../src/application/playController.ts';
import { COLOR_NUMBERS, DEPTH_TOKENS } from '../src/presentation/designTokens.ts';
import { createFakeScene, readyTextures } from './helpers/fakeScene.ts';

vi.mock('phaser', () => ({
  default: {
    Display: {
      Color: {
        HexStringToColor: (value: string) => ({ color: Number.parseInt(value.slice(1), 16) }),
      },
    },
    Geom: {
      Point: class {
        x: number;
        y: number;
        constructor(x: number, y: number) {
          this.x = x;
          this.y = y;
        }
      },
    },
    BlendModes: { ADD: 1 },
  },
}));

function setup(count = 2) {
  const fake = createFakeScene();
  const staticBoard = vi.spyOn(BoardRenderer.prototype, 'drawStaticBoard').mockImplementation(() => {});
  const original = anchorLevel('1-1');
  const level = { ...original, pieces: Array.from({ length: count }, (_, i) => ({ ...original.pieces[0], id: `P${i + 1}` })) };
  const renderer = new BoardRenderer(fake.scene as Phaser.Scene, computeLayout(720, 1280), level, readyTextures);
  staticBoard.mockRestore();
  const snapshot = (over: Partial<PlayViewSnapshot> = {}): PlayViewSnapshot => ({
    levelId: level.id,
    phase: 'playing',
    showTarget: false,
    snappedCount: 0,
    totalPieces: count,
    canRotate: false,
    selectedPieceId: null,
    dragPreviewMask: null,
    snapCandidateId: null,
    dragInfo: null,
    committedMask: level.targetMask,
    ...over,
    timer: over.timer ?? null,
  });
  return { ...fake, renderer, snapshot };
}

const snapped: PieceState = { kind: 'snapped', anchorId: 'A', turns: 0 };
const tray: PieceState = { kind: 'tray', turns: 0 };

describe('vùng giao mờ dần', () => {
  test('đường sáng vùng giao tăng dần từ 0 và chỉ hiện khi còn chồng', () => {
    const { renderer, snapshot, calls } = setup();
    const glowAlpha = () =>
      [...calls].reverse().find((c) => c.method === 'lineStyle' && c.args[0] === 1.5 && c.depth === DEPTH_TOKENS.draggingPiece + 1)
        ?.args[2] as number;
    renderer.tick(16, snapshot(), { P1: snapped, P2: tray });
    renderer.tick(0, snapshot(), { P1: snapped, P2: snapped });
    expect(glowAlpha()).toBe(0);
    renderer.tick(300, snapshot(), { P1: snapped, P2: snapped });
    expect(glowAlpha()).toBeCloseTo(0.45, 5);
    renderer.tick(400, snapshot(), { P1: snapped, P2: snapped });
    expect(glowAlpha()).toBeCloseTo(0.9, 5);
    const before = calls.length;
    renderer.tick(16, snapshot(), { P1: snapped, P2: tray });
    expect(calls.slice(before).some((c) => c.method === 'strokePoints')).toBe(false);
  });

  test('vùng giao chẵn là lỗ thật: cắt mảnh bằng mask đảo, không tô màu mặt bia', () => {
    const { renderer, snapshot, calls } = setup();
    renderer.tick(0, snapshot(), { P1: snapped, P2: snapped });
    renderer.tick(200, snapshot(), { P1: snapped, P2: snapped });
    expect(calls.some((c) => c.method === 'fillPoints' && c.color === COLOR_NUMBERS.boardSurfaceTop)).toBe(false);
    expect(calls.some((c) => c.method === 'setInvertAlpha' && c.args[0] === true)).toBe(true);
    expect(calls.some((c) => c.method === 'setMask')).toBe(true);
    renderer.tick(16, snapshot(), { P1: snapped, P2: tray });
    expect(calls.some((c) => c.method === 'clearMask')).toBe(true);
  });

  test('bốn mảnh chồng nhau: lỗ sâu cắt cả lớp vàng phẳng của vùng ba lớp', () => {
    const { renderer, snapshot, calls } = setup(4);
    const stack = { P1: snapped, P2: snapped, P3: snapped, P4: snapped };
    renderer.tick(0, snapshot(), stack);
    renderer.tick(16, snapshot(), stack);
    const masked = calls.filter((c) => c.method === 'setMask');
    // 4 jewels take the hole mask; the 4 parity graphics take the deep-hole mask on top.
    expect(masked.length).toBe(8);
    renderer.tick(16, snapshot(), { P1: snapped, P2: snapped, P3: snapped, P4: tray });
    // Three stacked: no 4-deep hole is left, so the deep mask comes off but the jewels stay cut.
    expect(calls.filter((c) => c.method === 'clearMask').length).toBe(4);
  });

  test('xem trước: có neo ứng viên chồng lên mảnh đã snap thì vẽ nét ở depth 32', () => {
    const { renderer, snapshot, calls } = setup();
    const drag = { pieceId: 'P2', x: 300, y: 600, snapCandidateId: 'A' };
    renderer.tick(16, snapshot({ dragInfo: drag }), { P1: snapped, P2: tray });
    expect(calls.some((c) => c.method === 'strokePoints' && c.depth === DEPTH_TOKENS.placedPieces + 2)).toBe(true);
  });

  test('mảnh tạm (temporary) khi buông ra vẫn hiển thị vùng giao chẵn/lẻ ở depth 51', () => {
    const { renderer, snapshot, calls } = setup();
    const temporaryState: PieceState = { kind: 'temporary', x: 16, y: 56, turns: 0 };
    renderer.tick(0, snapshot(), { P1: snapped, P2: temporaryState });
    renderer.tick(200, snapshot(), { P1: snapped, P2: temporaryState });

    const parityLine = calls.find(
      (c) => c.method === 'strokePoints' && c.depth === DEPTH_TOKENS.draggingPiece + 1
    );
    expect(parityLine).toBeDefined();

    const dragParityCalls = calls.filter(
      (c) => c.depth === DEPTH_TOKENS.draggingPiece + 1 && c.method === 'fillPoints'
    );
    expect(dragParityCalls.length).toBe(0);
  });
});
