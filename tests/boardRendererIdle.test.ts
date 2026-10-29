import { describe, expect, test, vi } from 'vitest';
import type Phaser from 'phaser';
import { BoardRenderer } from '../src/presentation/board/BoardRenderer.ts';
import { computeLayout } from '../src/presentation/board/layout.ts';
import { loadLevel } from '../src/content/catalog.ts';
import type { PlayViewSnapshot } from '../src/application/playController.ts';
import { COLOR_NUMBERS, FEEDBACK_TOKENS } from '../src/presentation/designTokens.ts';
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

describe('BoardRenderer target tint and idle breathing', () => {
  function setup() {
    const { scene, calls } = createFakeScene();
    const staticBoard = vi.spyOn(BoardRenderer.prototype, 'drawStaticBoard').mockImplementation(() => {});
    const level = loadLevel('1-1', 'campaign');
    const renderer = new BoardRenderer(scene as Phaser.Scene, computeLayout(720, 1280), level, readyTextures);
    staticBoard.mockRestore();
    const snapshot: PlayViewSnapshot = {
      levelId: level.id,
      phase: 'playing',
      showTarget: true,
      matchedCount: 0,
      totalPieces: 2,
      canRotate: false,
      selectedPieceId: null,
      dragPreviewMask: null,
      snapCandidateId: null,
      dragInfo: null,
      committedMask: new Uint8Array(level.targetMask.length),
      timer: null,
    };
    /** Calls on the target graphics (depth 20) since its last clear */
    const sinceClear = () => {
      const target = calls.filter((c) => c.depth === 20);
      return target.slice(target.map((c) => c.method).lastIndexOf('clear') + 1);
    };
    return { renderer, level, snapshot, sinceClear };
  }

  test('tô nhạt các vùng sáng của hình đích bằng màu hổ phách, dưới nét viền', () => {
    const { renderer, level, snapshot, sinceClear } = setup();
    renderer.render(level, snapshot, {});
    const calls = sinceClear();
    const fillIndex = calls.findIndex((c) => c.method === 'fillPoints');
    const strokeIndex = calls.findIndex((c) => c.method === 'lineStyle');
    expect(fillIndex).toBeGreaterThanOrEqual(0);
    expect(calls[fillIndex].color).toBe(COLOR_NUMBERS.amberSolid);
    expect(fillIndex).toBeLessThan(strokeIndex);
    const fillStyle = calls.find((c) => c.method === 'fillStyle')!;
    expect(fillStyle.args[1] as number).toBeCloseTo(FEEDBACK_TOKENS.targetFillAlpha, 9);
    renderer.destroy();
  });

  test('nhịp nudge làm viền và lớp tô dao động rồi trở về như cũ khi nghỉ', () => {
    const { renderer, level, snapshot, sinceClear } = setup();
    const lineAlphas = () => sinceClear().filter((c) => c.method === 'lineStyle').map((c) => c.args[2] as number);
    renderer.render(level, snapshot, {});
    const rest = lineAlphas();

    renderer.setIdleNudge(0.25);
    renderer.tick(16, snapshot, {});
    const breathing = lineAlphas();
    expect(breathing).toHaveLength(rest.length);
    expect(breathing[0]).not.toBeCloseTo(rest[0], 4);

    renderer.setIdleNudge(null);
    renderer.tick(16, snapshot, {});
    expect(lineAlphas()).toEqual(rest);
    renderer.destroy();
  });
});
