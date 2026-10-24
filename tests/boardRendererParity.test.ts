import { describe, expect, test, vi } from 'vitest';
import type Phaser from 'phaser';
import { BoardRenderer } from '../src/presentation/board/BoardRenderer.ts';
import { PieceView } from '../src/presentation/board/PieceView.ts';
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
  const glowLines = (calls: Array<{ method: string; depth?: number }>, from = 0) =>
    calls.slice(from).filter((c) => c.method === 'strokePoints' && c.depth === DEPTH_TOKENS.draggingPiece + 1);

  /** Holds P2 exactly over the anchor P1 sits on, so the two footprints coincide. */
  const holdOverAnchor = (renderer: BoardRenderer) => {
    const piece = (renderer as unknown as { level: { pieces: Array<{ id: string; frameSize: number }> } }).level.pieces[1];
    const centre = (renderer as unknown as { candidateCenter: (p: unknown, id: string, turns: number) => { x: number; y: number } })
      .candidateCenter(piece, 'A', 0);
    vi.spyOn(PieceView.prototype, 'currentPose').mockReturnValue({ x: centre.x, y: centre.y, scale: 1, angle: 0, alpha: 1 });
  };

  test('đường sáng vùng giao chỉ hiện khi đang giữ mảnh, tăng dần từ 0', () => {
    const { renderer, snapshot, calls } = setup();
    holdOverAnchor(renderer);
    const glowAlpha = () =>
      [...calls].reverse().find((c) => c.method === 'lineStyle' && c.args[0] === 1.5 && c.depth === DEPTH_TOKENS.draggingPiece + 1)
        ?.args[2] as number;
    const held = () => snapshot({ dragInfo: { pieceId: 'P2', x: 360, y: 400, snapCandidateId: null } });
    const stage = { P1: snapped, P2: tray };
    renderer.tick(0, held(), stage);
    expect(glowAlpha()).toBe(0);
    renderer.tick(300, held(), stage);
    expect(glowAlpha()).toBeCloseTo(0.45, 5);
    renderer.tick(400, held(), stage);
    expect(glowAlpha()).toBeCloseTo(0.9, 5);
  });

  test('thả mảnh là tắt đường sáng ngay khung đó, dù hai mảnh còn chồng nhau', () => {
    const { renderer, snapshot, calls } = setup();
    holdOverAnchor(renderer);
    const held = () => snapshot({ dragInfo: { pieceId: 'P2', x: 360, y: 400, snapCandidateId: null } });
    renderer.tick(16, held(), { P1: snapped, P2: tray });
    renderer.tick(700, held(), { P1: snapped, P2: tray });
    expect(glowLines(calls).length).toBeGreaterThan(0);
    const before = calls.length;
    renderer.tick(16, snapshot(), { P1: snapped, P2: snapped });
    expect(glowLines(calls, before).length).toBe(0);
    // The overlap is still a real hole after the drop.
    expect(calls.slice(before).some((c) => c.method === 'fillPoints') || calls.some((c) => c.method === 'setMask')).toBe(true);
  });

  test('hai mảnh đã đặt chồng nhau không vẽ đường sáng khi không giữ mảnh nào', () => {
    const { renderer, snapshot, calls } = setup();
    renderer.tick(0, snapshot(), { P1: snapped, P2: snapped });
    renderer.tick(700, snapshot(), { P1: snapped, P2: snapped });
    expect(glowLines(calls).length).toBe(0);
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

  test('mảnh tạm (temporary) khi buông ra vẫn là lỗ thật nhưng không còn đường sáng', () => {
    const { renderer, snapshot, calls } = setup();
    const temporaryState: PieceState = { kind: 'temporary', x: 16, y: 56, turns: 0 };
    renderer.tick(0, snapshot(), { P1: snapped, P2: temporaryState });
    renderer.tick(200, snapshot(), { P1: snapped, P2: temporaryState });

    expect(calls.some((c) => c.method === 'setMask')).toBe(true);
    expect(glowLines(calls).length).toBe(0);

    const dragParityCalls = calls.filter(
      (c) => c.depth === DEPTH_TOKENS.draggingPiece + 1 && c.method === 'fillPoints'
    );
    expect(dragParityCalls.length).toBe(0);
  });
});
