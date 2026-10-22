import { clipConvex, polygonArea } from './polygonClip.ts';
import type { Pt } from './polygonClip.ts';
import { PIECE_TOKENS } from '../designTokens.ts';

// Pure maths for the merged victory block, so the look can be tested without Phaser:
// a gradient built from the jewel's own face colours, a sheen that sweeps across it and
// the sparkles that flare as the sheen passes. "Light" comes from the top-left, like the
// jewel faces and the sparkle on each piece.

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export function regionBounds(regions: readonly (readonly Pt[])[]): Bounds {
  const all = regions.flat();
  return {
    minX: Math.min(...all.map((p) => p.x)),
    minY: Math.min(...all.map((p) => p.y)),
    maxX: Math.max(...all.map((p) => p.x)),
    maxY: Math.max(...all.map((p) => p.y)),
  };
}

/** 0 at the top-left corner of the bounds, 1 at the bottom-right, measured along x + y. */
export function lightAxis(b: Bounds, x: number, y: number): number {
  const span = b.maxX - b.minX + (b.maxY - b.minY);
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (x - b.minX + (y - b.minY)) / span));
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const STOPS = [PIECE_TOKENS.faceNorth, PIECE_TOKENS.faceEast, PIECE_TOKENS.faceWest, PIECE_TOKENS.faceSouth].map(hexToRgb);

/** Light gold at 0 through the jewel's face colours to deep amber at 1. */
export function gradientColor(t: number): number {
  const x = clamp01(t) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const [r, g, b] = STOPS[i].map((c, k) => Math.round(c + (STOPS[i + 1][k] - c) * f));
  return (r << 16) | (g << 8) | b;
}

/**
 * Cuts every region into thin horizontal strips, each with its position along the light axis,
 * so a flat fill per strip reads as a smooth gradient. Strips tile the region exactly.
 */
export function shadeStrips(
  regions: readonly (readonly Pt[])[],
  stripPx = 6,
  /** The whole figure's bounds when `regions` is only a part of it, so the gradient stays continuous. */
  bounds?: Bounds
): Array<{ points: Pt[]; t: number }> {
  if (regions.length === 0) return [];
  const b = bounds ?? regionBounds(regions);
  const out: Array<{ points: Pt[]; t: number }> = [];
  for (const region of regions) {
    const ys = region.map((p) => p.y);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const count = Math.max(1, Math.ceil((bottom - top) / stripPx));
    const h = (bottom - top) / count;
    for (let i = 0; i < count; i++) {
      const y0 = top + i * h;
      const y1 = y0 + h;
      const band: Pt[] = [
        { x: b.minX - 1, y: y0 },
        { x: b.maxX + 1, y: y0 },
        { x: b.maxX + 1, y: y1 },
        { x: b.minX - 1, y: y1 },
      ];
      const strip = clipConvex(region, band);
      if (strip.length < 3 || polygonArea(strip) < 1e-6) continue;
      const cx = strip.reduce((s, p) => s + p.x, 0) / strip.length;
      out.push({ points: strip, t: lightAxis(b, cx, (y0 + y1) / 2) });
    }
  }
  return out;
}

/**
 * Diagonal band of light, `halfWidth` either side of position `p` on the light axis
 * (0 = top-left, 1 = bottom-right; outside 0..1 the band is off the figure).
 */
export function sheenBand(b: Bounds, p: number, halfWidth: number): Pt[] {
  const span = b.maxX - b.minX + (b.maxY - b.minY);
  const c0 = b.minX + b.minY + (p - halfWidth) * span;
  const c1 = b.minX + b.minY + (p + halfWidth) * span;
  const y0 = b.minY - 1;
  const y1 = b.maxY + 1;
  return [
    { x: c0 - y0, y: y0 },
    { x: c1 - y0, y: y0 },
    { x: c1 - y1, y: y1 },
    { x: c0 - y1, y: y1 },
  ];
}

export type Sparkle = { x: number; y: number; u: number };

/** One sparkle per region, taking the largest regions first, at their centre. */
export function sparkleSpots(regions: readonly (readonly Pt[])[], count: number): Sparkle[] {
  if (regions.length === 0 || count <= 0) return [];
  const b = regionBounds(regions);
  return [...regions]
    .sort((a, c) => polygonArea(c) - polygonArea(a))
    .slice(0, count)
    .map((r) => {
      const x = r.reduce((s, p) => s + p.x, 0) / r.length;
      const y = r.reduce((s, p) => s + p.y, 0) / r.length;
      return { x, y, u: lightAxis(b, x, y) };
    });
}

/** How much a sparkle at light-axis position `u` flares while the sheen is at `p`. */
export function twinkle(u: number, p: number, span = 0.22): number {
  return clamp01(1 - Math.abs(u - p) / span);
}
