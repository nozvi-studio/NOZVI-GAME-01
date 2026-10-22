import { describe, expect, it } from 'vitest';
import { STARDUST_MAX } from '../src/presentation/transitions/stardust.ts';
import { ORBIT_PERIOD_MS, dustPose, orbitPoint, planVictoryDust, type DustGeometry } from '../src/presentation/feedback/victoryDust.ts';

const seeded = () => {
  let s = 7;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};
const geometry: DustGeometry = { center: { x: 360, y: 500 }, card: { x: 360, y: 800, rx: 380, ry: 210 } };
const sources = [{ x: 200, y: 420 }, { x: 520, y: 560 }];
const [spec] = planVictoryDust(sources, 12, seeded());

describe('planVictoryDust', () => {
  it('makes at most the stardust cap, deterministically, from the given sources', () => {
    const a = planVictoryDust(sources, 99, seeded());
    expect(a).toHaveLength(STARDUST_MAX);
    expect(planVictoryDust(sources, 99, seeded())).toEqual(a);
    expect(planVictoryDust([], 10, seeded())).toEqual([]);
  });
});

describe('dustPose', () => {
  it('gather: starts invisible on its piece and ends bright in the board centre', () => {
    const start = dustPose(spec, { gather: 0, emerge: 0, collapse: 0 }, 0, geometry);
    expect(start).toMatchObject({ x: spec.src.x, y: spec.src.y, alpha: 0 });
    const end = dustPose(spec, { gather: 1, emerge: 0, collapse: 0 }, 0, geometry);
    expect(end.x).toBeCloseTo(360);
    expect(end.y).toBeCloseTo(500);
    expect(end.alpha).toBeGreaterThan(0.4);
  });

  it('emerge: leaves the centre and lands on its orbit around the card', () => {
    const stage = (emerge: number) => ({ gather: 1, emerge, collapse: 0 });
    const t = 1234;
    const landed = dustPose(spec, stage(1), t, geometry);
    const orbit = orbitPoint(spec, t, geometry.card);
    expect(landed.x).toBeCloseTo(orbit.x);
    expect(landed.y).toBeCloseTo(orbit.y);
    const mid = dustPose(spec, stage(0.5), t, geometry);
    const lo = Math.min(500, orbit.y);
    const hi = Math.max(500, orbit.y);
    expect(mid.y).toBeGreaterThan(lo);
    expect(mid.y).toBeLessThan(hi);
  });

  it('collapse: ends on the card centre, invisible', () => {
    const end = dustPose(spec, { gather: 1, emerge: 1, collapse: 1 }, 5000, geometry);
    expect(end.x).toBeCloseTo(360);
    expect(end.y).toBeCloseTo(800);
    expect(end.alpha).toBe(0);
  });
});

describe('orbitPoint', () => {
  it('circles the card and is periodic', () => {
    const period = ORBIT_PERIOD_MS / spec.speed;
    const a = orbitPoint(spec, 0, geometry.card);
    const b = orbitPoint(spec, period, geometry.card);
    expect(b.x).toBeCloseTo(a.x, 4);
    expect(b.y).toBeCloseTo(a.y, 4);
    const half = orbitPoint(spec, period / 2, geometry.card);
    expect(Math.abs(half.x - a.x) + Math.abs(half.y - a.y)).toBeGreaterThan(100);
  });

  it('keeps every dust mote clear of the card centre', () => {
    for (const s of planVictoryDust(sources, 30, seeded())) {
      for (let t = 0; t < ORBIT_PERIOD_MS; t += 1500) {
        const p = orbitPoint(s, t, geometry.card);
        const nx = (p.x - 360) / geometry.card.rx;
        const ny = (p.y - 800) / geometry.card.ry;
        expect(Math.hypot(nx, ny)).toBeGreaterThan(0.8);
      }
    }
  });
});
