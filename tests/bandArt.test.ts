import { describe, expect, it } from 'vitest';
import { bandArtPlacements, layoutCampaignMap, snapToRowGap, type ChapterBand } from '../src/presentation/galaxy/constellationLayout.ts';

const band = (top: number, bottom: number): ChapterBand => ({ chapter: 2, bannerY: top + 85, top, bottom, nodeCount: 28 });

describe('bandArtPlacements', () => {
  it('keeps a single centred galaxy for a short band', () => {
    const placements = bandArtPlacements(band(0, 1300));
    expect(placements).toHaveLength(1);
    expect(placements[0]).toMatchObject({ x: 360, y: 650, size: 1050 });
  });

  it('repeats the galaxy along a tall band so no stretch is left bare', () => {
    const tall = band(1300, 5780);
    const placements = bandArtPlacements(tall);
    expect(placements.length).toBeGreaterThanOrEqual(4);
    const ys = placements.map((p) => p.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(ys[0]).toBeGreaterThan(tall.top);
    expect(ys[ys.length - 1]).toBeLessThan(tall.bottom);
    // Neighbouring galaxies are never further apart than one artwork frame.
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeLessThanOrEqual(1100);
  });

  it('alternates sides and varies size so repeats do not look stamped', () => {
    const placements = bandArtPlacements(band(0, 4800));
    expect(placements[0].x).not.toBe(placements[1].x);
    expect(placements[0].x).toBe(placements[2].x);
    expect(new Set(placements.map((p) => p.size)).size).toBeGreaterThan(1);
  });

  it('is deterministic', () => {
    expect(bandArtPlacements(band(0, 4800))).toEqual(bandArtPlacements(band(0, 4800)));
  });
});

describe('chapter 2 coil layout', () => {
  const entries = Array.from({ length: 28 }, (_, i) => ({ id: `2-${i + 1}`, title: `L${i + 1}`, chapter: 2 as const }));
  const layout = layoutCampaignMap(entries);
  const band = layout.chapters[0];

  it('winds the levels around one galaxy per ~6 nodes', () => {
    expect(band.art).toHaveLength(5);
    expect(layout.nodes).toHaveLength(28);
  });

  it('keeps every node on the coil of its own galaxy', () => {
    const art = band.art!;
    const galaxyOf = (y: number) => art.reduce((best, a) => (Math.abs(a.y - y) < Math.abs(best.y - y) ? a : best));
    for (const node of layout.nodes) {
      const g = galaxyOf(node.y);
      expect(Math.hypot(node.x - g.x, node.y - g.y)).toBeCloseTo(390, -1);
    }
  });

  it('descends steadily so the current-level badge never covers the next node', () => {
    for (let i = 1; i < layout.nodes.length; i++) {
      expect(layout.nodes[i].y - layout.nodes[i - 1].y).toBeGreaterThanOrEqual(130);
    }
  });

  it('feeds the same centres to bandArtPlacements', () => {
    expect(bandArtPlacements(band)).toBe(band.art);
  });
});

describe('snapToRowGap', () => {
  it('moves a point to the middle of the gap between the two node rows around it', () => {
    expect(snapToRowGap(130, [0, 200, 200, 400])).toBe(100);
    expect(snapToRowGap(250, [0, 200, 400])).toBe(300);
  });

  it('leaves a point outside the rows where it is', () => {
    expect(snapToRowGap(-20, [0, 200])).toBe(-20);
    expect(snapToRowGap(500, [0, 200])).toBe(500);
    expect(snapToRowGap(90, [])).toBe(90);
  });
});
