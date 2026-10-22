import { describe, expect, it } from 'vitest';
import { createGalaxyStars, galaxyStarPose } from '../src/presentation/galaxy/galaxyStars.ts';

describe('moving white stars', () => {
  it('uses a deterministic budget of thirty stars', () => {
    expect(createGalaxyStars(1)).toHaveLength(30);
    expect(createGalaxyStars(1)).toEqual(createGalaxyStars(1));
    expect(createGalaxyStars(1)).not.toEqual(createGalaxyStars(2));
  });

  it('moves visibly over time and preserves the size-relative travel speed', () => {
    const star = createGalaxyStars(1)[0];
    const start = galaxyStarPose(star, 0, 900);
    const later = galaxyStarPose(star, 2000, 900);
    expect(Math.hypot(later.x - start.x, later.y - start.y)).toBeGreaterThan(12);
    expect(galaxyStarPose(star, 2000, 450).x).toBeCloseTo(later.x / 2);
  });

  it('remains inside the artwork and fades to transparent at a wrapping edge', () => {
    const stars = createGalaxyStars(1);
    for (const star of stars) for (const ms of [0, 1000, 90000, 3600000]) {
      const pose = galaxyStarPose(star, ms, 900);
      expect(Math.abs(pose.x)).toBeLessThanOrEqual(450);
      expect(Math.abs(pose.y)).toBeLessThanOrEqual(450);
      expect(pose.alpha).toBeGreaterThanOrEqual(0);
      expect(pose.alpha).toBeLessThanOrEqual(1);
    }
    const edge = { ...stars[0], x: 0, y: 0.5 };
    expect(galaxyStarPose(edge, 0, 900).alpha).toBe(0);
  });
});
