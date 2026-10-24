import { describe, expect, it } from 'vitest';
import { computeMenuLayout } from '../src/presentation/menu/menuLayout.ts';

const HEIGHTS = [1280, 1440, 1558, 1600, 1750];

describe('computeMenuLayout', () => {
  it('stacks logo, emblem, buttons and ad slot without overlap on every screen height', () => {
    for (const height of HEIGHTS) {
      for (const safeBottom of [0, 48]) {
        const l = computeMenuLayout(height, 0, safeBottom);
        const label = `H${height} safe${safeBottom}`;
        expect(l.logoBottomY + 20, label).toBeLessThanOrEqual(l.emblemY - l.emblemRadius);
        expect(l.emblemY + l.emblemRadius + 20, label).toBeLessThanOrEqual(l.primaryY - l.primaryHeight / 2);
        expect(l.primaryY + l.primaryHeight / 2 + 20, label).toBeLessThanOrEqual(l.secondaryY - l.secondaryHeight / 2);
        expect(l.secondaryY + l.secondaryHeight / 2 + 20, label).toBeLessThanOrEqual(l.adSlotY - l.adSlotHeight / 2);
        expect(l.adSlotY + l.adSlotHeight / 2 + safeBottom, label).toBeLessThanOrEqual(height);
      }
    }
  });

  it('reserves a banner-sized strip at the bottom, above the safe inset', () => {
    const l = computeMenuLayout(1558, 0, 48);
    expect(l.adSlotHeight).toBeGreaterThanOrEqual(100);
    expect(l.adSlotY + l.adSlotHeight / 2).toBe(1558 - 48);
  });

  it('keeps the emblem full size on tall screens and shrinks it only when space runs out', () => {
    expect(computeMenuLayout(1750, 0).emblemScale).toBe(1);
    const short = computeMenuLayout(1280, 0).emblemScale;
    expect(short).toBeLessThan(1);
    expect(short).toBeGreaterThanOrEqual(0.6);
  });

  it('centres the emblem in the room between logo and primary button', () => {
    const l = computeMenuLayout(1750, 0);
    const above = l.emblemY - l.emblemRadius - l.logoBottomY;
    const below = l.primaryY - l.primaryHeight / 2 - (l.emblemY + l.emblemRadius);
    expect(Math.abs(above - below)).toBeLessThan(1);
  });
});
