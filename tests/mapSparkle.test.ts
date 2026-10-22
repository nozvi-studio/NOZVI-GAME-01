import { describe, expect, it } from 'vitest';
import { createSparkles, meteorPose, sparkleAlpha } from '../src/presentation/galaxy/mapSparkle.ts';

describe('createSparkles', () => {
  it('scatters the requested count inside the band and is deterministic', () => {
    const a = createSparkles(7, 40, 0, 1200, 3);
    expect(a).toHaveLength(40);
    for (const s of a) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(720);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1200);
    }
    expect(createSparkles(7, 40, 0, 1200, 3)).toEqual(a);
  });
});

describe('sparkleAlpha', () => {
  it('twinkles between a dim floor and full brightness', () => {
    const [s] = createSparkles(1, 1, 0, 100, 3);
    const samples = Array.from({ length: 200 }, (_, i) => sparkleAlpha(s, i * 100));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.15);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.4);
  });
});

describe('meteorPose', () => {
  it('is hidden most of the time and visible only inside its short window', () => {
    const poses = Array.from({ length: 600 }, (_, i) => meteorPose(i * 50));
    const active = poses.filter(Boolean).length;
    expect(active).toBeGreaterThan(0);
    expect(active).toBeLessThan(poses.length * 0.25);
  });

  it('fades in and out and travels forward while active', () => {
    const first = Array.from({ length: 900 }, (_, i) => meteorPose(i * 10)).filter((p) => p !== null);
    const start = first[0]!;
    const mid = first[Math.floor(first.length / 2)]!;
    expect(mid.alpha).toBeGreaterThan(start.alpha);
    expect(mid.progress).toBeGreaterThan(start.progress);
    for (const p of first) {
      expect(p!.alpha).toBeGreaterThanOrEqual(0);
      expect(p!.alpha).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic per timestamp', () => {
    expect(meteorPose(12345)).toEqual(meteorPose(12345));
  });
});
