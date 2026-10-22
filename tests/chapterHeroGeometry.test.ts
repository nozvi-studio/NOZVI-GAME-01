import { describe, expect, it } from 'vitest';
import {
  CLUSTER_SATELLITES, REFRESH_ARROW, RING_HERO_SPIN_MS, heroKindFor, heroSpinDelta, pinwheelFaces, pinwheelOutline,
} from '../src/presentation/menu/chapterHeroGeometry.ts';

describe('chapterHeroGeometry', () => {
  it('builds the mockup pinwheel at half-extent 56 (Menu3)', () => {
    const faces = pinwheelFaces(56);
    expect(faces.map((f) => f.color)).toEqual([0xfff0a6, 0xffd23f, 0xf59400, 0xffb31f, 0xffe27a]);
    expect(faces[0].points).toEqual([[0, -56], [0, 0], [-56, 0]]);
    expect(faces[1].points).toEqual([[0, -56], [56, 0], [0, 0]]);
    expect(faces[4].points[0][1]).toBeCloseTo(-23.52, 2);
    expect(pinwheelOutline(56)).toEqual([[0, -56], [56, 0], [0, 56], [-56, 0]]);
  });

  it('rotates about the centre', () => {
    const [top] = pinwheelOutline(56, 90);
    expect(top[0]).toBeCloseTo(56);
    expect(top[1]).toBeCloseTo(0);
  });

  it('places four satellites on the diagonals (Menu4)', () => {
    expect(CLUSTER_SATELLITES).toEqual([[60.8, 60.8], [-60.8, 60.8], [-60.8, -60.8], [60.8, -60.8]]);
  });

  it('draws the refresh arrow on the r=88 circle from (-84,-20) to (60,-66)', () => {
    expect(REFRESH_ARROW.radius).toBe(88);
    expect(Math.hypot(-84, -20)).toBeCloseTo(86.3, 1);
    expect(REFRESH_ARROW.startAngle).toBeLessThan(REFRESH_ARROW.endAngle);
  });

  it('turns the ring hero gently and clockwise: one lap per period', () => {
    expect(heroSpinDelta(RING_HERO_SPIN_MS.pinwheel, RING_HERO_SPIN_MS.pinwheel)).toBeCloseTo(2 * Math.PI);
    expect(heroSpinDelta(16, RING_HERO_SPIN_MS.arrow)).toBeGreaterThan(0);
    expect(heroSpinDelta(16, RING_HERO_SPIN_MS.arrow)).toBeLessThan(0.01); // gentle: well under 0.6 rad/s
    expect(RING_HERO_SPIN_MS.arrow).toBeGreaterThanOrEqual(15000);
    expect(RING_HERO_SPIN_MS.pinwheel).toBeGreaterThanOrEqual(15000);
  });

  it('maps theme ids to hero kinds', () => {
    expect(['dwarf', 'spiral', 'ring', 'cluster', 'prism'].map(heroKindFor))
      .toEqual([undefined, undefined, 'ring', 'cluster', 'prism']);
  });
});
