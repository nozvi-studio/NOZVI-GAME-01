import { describe, expect, it } from 'vitest';
import { TARGET_BADGE_HIT_SIZE, targetBadgeHitCircle } from '../src/presentation/board/targetBadgeHit.ts';

describe('targetBadgeHitCircle', () => {
  it('is centred in the container size box, not at its top-left corner', () => {
    const c = targetBadgeHitCircle();
    expect(c.x).toBe(TARGET_BADGE_HIT_SIZE / 2);
    expect(c.y).toBe(TARGET_BADGE_HIT_SIZE / 2);
  });

  it('fits inside the size box so no part of the touch area hangs outside the badge', () => {
    const c = targetBadgeHitCircle();
    expect(c.x - c.radius).toBeGreaterThanOrEqual(0);
    expect(c.y - c.radius).toBeGreaterThanOrEqual(0);
    expect(c.x + c.radius).toBeLessThanOrEqual(TARGET_BADGE_HIT_SIZE);
    expect(c.y + c.radius).toBeLessThanOrEqual(TARGET_BADGE_HIT_SIZE);
  });
});
