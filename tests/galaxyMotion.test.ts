import { describe, expect, it } from 'vitest';
import { METEOR_PERIOD_MS, METEOR_TRAVEL, ORBIT_PERIOD_MS, meteorPose, orbitDotPose } from '../src/presentation/galaxy/galaxyMotion.ts';

const spec = { rx: 115, ry: 75, fraction: 0.07, phaseMs: 0, dots: 7 };

describe('orbitDotPose', () => {
  it('starts at the right-hand vertex and runs clockwise', () => {
    const head = orbitDotPose(0, spec, 0);
    expect(head.x).toBeCloseTo(115);
    expect(head.y).toBeCloseTo(0);
    expect(head.alpha).toBe(1);
    const quarter = orbitDotPose(ORBIT_PERIOD_MS / 4, spec, 0);
    expect(quarter.x).toBeCloseTo(0, 5);
    expect(quarter.y).toBeCloseTo(75);
  });

  it('is periodic and its tail fades but stays visible', () => {
    const a = orbitDotPose(1234, spec, 3);
    const b = orbitDotPose(1234 + ORBIT_PERIOD_MS, spec, 3);
    expect(b.x).toBeCloseTo(a.x);
    expect(b.y).toBeCloseTo(a.y);
    const tail = orbitDotPose(0, spec, spec.dots - 1);
    expect(tail.alpha).toBeGreaterThan(0);
    expect(tail.alpha).toBeLessThan(0.3);
  });

  it('honours the phase offset', () => {
    const shifted = orbitDotPose(0, { ...spec, phaseMs: ORBIT_PERIOD_MS / 2 }, 0);
    expect(shifted.x).toBeCloseTo(-115);
  });
});

describe('meteorPose', () => {
  it('is hidden before its delay and between flights', () => {
    expect(meteorPose(500, 1500).alpha).toBe(0);
    expect(meteorPose(1500 + METEOR_PERIOD_MS * 0.5, 1500).alpha).toBe(0);
  });

  it('fades in, travels the full vector and fades out', () => {
    expect(meteorPose(1500 + METEOR_PERIOD_MS * 0.03, 1500).alpha).toBeCloseTo(1);
    const nearEnd = meteorPose(1500 + METEOR_PERIOD_MS * 0.1299, 1500);
    expect(nearEnd.alpha).toBeCloseTo(0, 1);
    expect(nearEnd.dx).toBeGreaterThan(METEOR_TRAVEL.x * 0.95);
    expect(nearEnd.dy).toBeGreaterThan(METEOR_TRAVEL.y * 0.95);
    expect(meteorPose(1500 + METEOR_PERIOD_MS, 1500).alpha).toBe(0);
  });
});
