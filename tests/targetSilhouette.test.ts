import { describe, expect, test } from 'vitest';
import { loadLevel } from '../src/content/catalog.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import {
  BADGE_SILHOUETTE_FIT as BADGE_FIT,
  NODE_SILHOUETTE_FIT as NODE_FIT,
  silhouetteLayers,
} from '../src/presentation/board/targetSilhouette.ts';

const approved = campaignManifest.filter((e) => e.status === 'approved');

/** Half-width, half-height and furthest diamond reach of a drawn figure. */
function extent(layers: ReturnType<typeof silhouetteLayers>) {
  let x = 0;
  let y = 0;
  let reach = 0;
  for (const layer of layers) {
    for (const p of layer.points) {
      x = Math.max(x, Math.abs(p.x));
      y = Math.max(y, Math.abs(p.y));
      reach = Math.max(reach, Math.abs(p.x) + Math.abs(p.y));
    }
  }
  return { x, y, reach };
}

describe('silhouetteLayers, box fit (the play badge)', () => {
  test('fits every approved level inside the badge box', () => {
    for (const entry of approved) {
      const layers = silhouetteLayers(loadLevel(entry.id, 'campaign'), BADGE_FIT);
      expect(layers.length, entry.id).toBeGreaterThan(0);
      const e = extent(layers);
      // Polygon tips can reach up to one cell past the rasterised mask bounds
      // the box is measured from, e.g. the diamond points in 1-1.
      expect(e.x, `${entry.id} x`).toBeLessThanOrEqual(BADGE_FIT.width / 2 + 1.0);
      expect(e.y, `${entry.id} y`).toBeLessThanOrEqual(BADGE_FIT.height / 2 + 1.0);
    }
  });

  test('returns nothing for a level with an empty target mask', () => {
    const level = { ...loadLevel('1-1', 'campaign'), targetMask: new Uint8Array(0) };
    expect(silhouetteLayers(level, BADGE_FIT)).toEqual([]);
  });
});

describe('silhouetteLayers, diamond fit (a map node)', () => {
  test('every level touches the budget exactly and never crosses it', () => {
    for (const entry of approved) {
      const layers = silhouetteLayers(loadLevel(entry.id, 'campaign'), NODE_FIT);
      expect(layers.length, entry.id).toBeGreaterThan(0);
      // Measured on the drawn polygons, not on the mask, so no tolerance is
      // needed: the furthest point lands on the budget by construction.
      expect(extent(layers).reach, entry.id).toBeCloseTo(NODE_FIT.budget, 6);
    }
  });

  test('is a uniform scale of the badge figure, not a reshaping', () => {
    // Compared on extents rather than point by point: both fits scale the same
    // input polygons, but `parityLayers` clips them, so the vertex list it
    // returns need not come back in the same order at a different scale.
    for (const entry of approved) {
      const level = loadLevel(entry.id, 'campaign');
      const badge = silhouetteLayers(level, BADGE_FIT);
      const node = silhouetteLayers(level, NODE_FIT);
      expect(node.length, entry.id).toBe(badge.length);

      const b = extent(badge);
      const n = extent(node);
      const ratio = n.reach / b.reach;
      expect(n.x, `${entry.id} width`).toBeCloseTo(b.x * ratio, 4);
      expect(n.y, `${entry.id} height`).toBeCloseTo(b.y * ratio, 4);
    }
  });

  test('no level is smaller than under the 46x32 box, and the worst grow by half', () => {
    // The old box borrowed the badge's 92:64 aspect, which has nothing to do
    // with what fits a diamond, and could not adapt per shape. Tall figures
    // were the worst hit: 3-4 rendered 17px wide inside a 96px node. The
    // budget was picked so that this ratio never drops below 1 — a smaller
    // budget would have shrunk the levels that already sat near the limit.
    const legacy = { kind: 'box', width: 46, height: 32 } as const;
    const ratios = approved.map((entry) => {
      const level = loadLevel(entry.id, 'campaign');
      const before = extent(silhouetteLayers(level, legacy)).reach;
      const after = extent(silhouetteLayers(level, NODE_FIT)).reach;
      return { id: entry.id, ratio: after / before };
    });
    // Hai màn studio rộng (2-18, 2-23) có tỉ lệ khung nằm đúng khoảng mà hộp 46x32 cũ
    // cho hình lớn hơn chút (0.94); dưới 0.93 mới coi là thu nhỏ đáng kể.
    for (const r of ratios) expect(r.ratio, r.id).toBeGreaterThanOrEqual(0.93);
    expect(Math.max(...ratios.map((r) => r.ratio))).toBeGreaterThan(1.5);
  });

  test('every level now carries the same optical weight', () => {
    // The point of fitting the frame rather than a box: the old fit varied the
    // figure's reach by more than 1.7x across the campaign, so some nodes read
    // as emblems and others as specks.
    const legacy = { kind: 'box', width: 46, height: 32 } as const;
    const before = approved.map((e) => extent(silhouetteLayers(loadLevel(e.id, 'campaign'), legacy)).reach);
    expect(Math.max(...before) / Math.min(...before)).toBeGreaterThan(1.5);

    const after = approved.map((e) => extent(silhouetteLayers(loadLevel(e.id, 'campaign'), NODE_FIT)).reach);
    expect(Math.max(...after) - Math.min(...after)).toBeLessThan(1e-6);
  });
});
