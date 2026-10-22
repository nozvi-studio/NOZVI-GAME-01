import { describe, expect, it } from 'vitest';
import { computeLayout, computeTargetBadgeScale } from '../src/presentation/board/layout.ts';
import { computeDesignView, computeViewport } from '../src/presentation/viewport.ts';

describe('target badge uses spare height above the board', () => {
  it.each([
    [104, 1], [80, 1], [148, 1.275], [192, 1.55], [400, 1.55],
  ])('scales for a %s-unit header-to-board gap', (gap, scale) => {
    expect(computeTargetBadgeScale(96, 96 + gap)).toBeCloseTo(scale);
    expect(computeTargetBadgeScale(176, 176 + gap)).toBeCloseTo(scale);
  });

  it('preserves the original geometry on a short landscape iframe', () => {
    const viewport = computeViewport(907, 510, 1);
    const view = computeDesignView(viewport.bufferWidth, viewport.bufferHeight);
    const layout = computeLayout(view.width, view.height);
    expect(layout.targetBadgeScale).toBe(1);
    expect(layout.targetBadgeY).toBe(178);
  });

  it.each([1280, 1368, 1456, 1560, 1640, 2000])('keeps clearance at height %s, including safe areas', (height) => {
    for (const safeArea of [{ top: 0, bottom: 0 }, { top: 96, bottom: 48 }]) {
      const layout = computeLayout(720, height, safeArea);
      const extent = 80 * layout.targetBadgeScale;
      // The current glow spans y=98..258 on the 1280 artboard.
      expect(layout.targetBadgeY - extent).toBeGreaterThanOrEqual(safeArea.top + 98 - 1e-8);
      expect(layout.targetBadgeY + extent - layout.boardBounds.y).toBeCloseTo(58);
    }
  });

  it('reaches a roughly 118-unit face radius on the reference Android screen', () => {
    const layout = computeLayout(720, 1640);
    expect(layout.targetBadgeScale * 76).toBeCloseTo(117.8);
    expect(layout.targetBadgeY).toBeCloseTo(270);
  });
});
