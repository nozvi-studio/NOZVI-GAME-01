import { describe, expect, test } from 'vitest';
import { CLOUD_BLOB_COUNT, milkyWayBlobs } from '../src/presentation/galaxy/milkyWay.ts';
import { COLOR_TOKENS } from '../src/presentation/designTokens.ts';

const W = 720;
const H = 1280;

describe('milkyWayBlobs', () => {
  test('same seed gives the same blobs, a different seed gives different ones', () => {
    expect(milkyWayBlobs(7, W, H)).toEqual(milkyWayBlobs(7, W, H));
    expect(milkyWayBlobs(7, W, H)[0]).not.toEqual(milkyWayBlobs(8, W, H)[0]);
  });

  test('blob count, colours and sizes are valid', () => {
    const blobs = milkyWayBlobs(7, W, H);
    const allowed = Object.values(COLOR_TOKENS.sky.cloud);
    expect(blobs).toHaveLength(CLOUD_BLOB_COUNT);
    for (const b of blobs) {
      expect(allowed).toContain(b.hex);
      expect(b.alpha).toBeGreaterThan(0);
      expect(b.alpha).toBeLessThanOrEqual(1);
      expect(b.r).toBeGreaterThan(0);
    }
  });

  test('the band is centred on the canvas', () => {
    const blobs = milkyWayBlobs(7, W, H);
    const meanX = blobs.reduce((s, b) => s + b.x, 0) / blobs.length;
    const meanY = blobs.reduce((s, b) => s + b.y, 0) / blobs.length;
    expect(Math.abs(meanX - W / 2)).toBeLessThan(W * 0.15);
    expect(Math.abs(meanY - H / 2)).toBeLessThan(H * 0.15);
  });
});
