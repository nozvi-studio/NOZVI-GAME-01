import { describe, expect, test, vi } from 'vitest';
import type Phaser from 'phaser';
import { TransitionTimeline } from '../src/presentation/transitions/TransitionTimeline.ts';
import { choreographPlayIn } from '../src/presentation/transitions/playChoreography.ts';
import type { PlayTransitionView } from '../src/presentation/transitions/playChoreography.ts';

vi.mock('phaser', () => ({
  default: {
    BlendModes: { ADD: 1 },
  },
}));

describe('playChoreography', () => {
  test('zoomCamera preserves responsive designScale on mobile (does not reset zoom to 1)', () => {
    const cam = { zoom: 1.5 };
    const mockScene = {
      cameras: { main: cam },
      textures: { exists: () => true },
      make: {
        graphics: () => ({
          clear: vi.fn(),
          fillStyle: vi.fn(),
          fillCircle: vi.fn(),
          fillRoundedRect: vi.fn(),
          createGeometryMask: () => ({}),
          destroy: vi.fn(),
        }),
      },
      add: {
        image: () => {
          const img = {
            setAngle: () => img,
            setBlendMode: () => img,
            setDepth: () => img,
            setMask: () => img,
            destroy: vi.fn(),
          };
          return img;
        },
      },
    } as unknown as Phaser.Scene;

    const mockGrid = {
      setMask: vi.fn(),
      clearMask: vi.fn(),
    } as unknown as Phaser.GameObjects.RenderTexture;

    const view: PlayTransitionView = {
      scene: mockScene,
      parts: {},
      grid: mockGrid,
      boardBounds: { x: 40, y: 200, width: 640, height: 800 },
      targetCount: 0,
      setTargetReveal: vi.fn(),
      setFrameGold: vi.fn(),
    };

    const tl = new TransitionTimeline(0);
    choreographPlayIn(tl, { route: 'menu-to-play', from: 'MenuScene' }, view);

    // Complete transition (or run to end)
    tl.complete();

    // The camera zoom must return to base responsive zoom (1.5), not hardcoded 1.0
    expect(cam.zoom).toBeCloseTo(1.5);
  });
});
