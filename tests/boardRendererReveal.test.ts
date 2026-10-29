import { describe, expect, test, vi } from 'vitest';
import type Phaser from 'phaser';
import { BoardRenderer } from '../src/presentation/board/BoardRenderer.ts';
import { computeLayout } from '../src/presentation/board/layout.ts';
import { loadLevel } from '../src/content/catalog.ts';
import type { PlayViewSnapshot } from '../src/application/playController.ts';
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

describe('BoardRenderer.setTargetReveal', () => {
  test('nhân alpha viền hình đích theo từng placement và vẽ lại ngay', () => {
    const { scene, calls } = createFakeScene();
    const staticBoard = vi.spyOn(BoardRenderer.prototype, 'drawStaticBoard').mockImplementation(() => {});
    const level = loadLevel('1-1', 'campaign');
    const renderer = new BoardRenderer(scene as Phaser.Scene, computeLayout(720, 1280), level, readyTextures);
    staticBoard.mockRestore();

    /** lineStyle alpha của nét viền hình đích (depth 20) kể từ lần clear gần nhất; hình đích không còn lớp tô */
    const targetAlphas = () => {
      const target = calls.filter((c) => c.depth === 20);
      const lastClear = target.map((c) => c.method).lastIndexOf('clear');
      return target.slice(lastClear + 1).filter((c) => c.method === 'lineStyle').map((c) => c.args[2] as number);
    };

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
    renderer.render(level, snapshot, {});
    const full = targetAlphas();
    expect(full.length).toBeGreaterThan(0);

    renderer.setTargetReveal([0, 0]);
    expect(targetAlphas()).toEqual([]);

    renderer.setTargetReveal([0.5, 0.5]);
    const half = targetAlphas();
    expect(half).toHaveLength(full.length);
    half.forEach((alpha, i) => expect(alpha).toBeCloseTo(full[i] * 0.5, 9));

    renderer.setTargetReveal(null);
    expect(targetAlphas()).toEqual(full);
    renderer.destroy();
  });
});
