/** Pure geometry for the Menu3/Menu4 hero emblems, in mockup units (390 px wide, origin at the emblem centre). */
export type Pt = readonly [number, number];
export type HeroFace = { color: number; points: readonly Pt[] };
export type HeroKind = 'ring' | 'cluster' | 'prism';

export const PINWHEEL = { nw: 0xfff0a6, ne: 0xffd23f, se: 0xf59400, sw: 0xffb31f, core: 0xffe27a, outline: 0xfff6d6 } as const;
export const RING_CENTER_HALF = 56;
export const RING_CENTER_ROTATION_DEG = 22;
export const CLUSTER_CENTER_HALF = 50;
export const CLUSTER_SATELLITE_HALF = 18;
export const CLUSTER_SATELLITES: readonly Pt[] = [[60.8, 60.8], [-60.8, 60.8], [-60.8, -60.8], [60.8, -60.8]];
export const PRISM_COLORS = [0xff5d7a, 0xff9f45, 0xffe15a, 0x4be0b0, 0x4da3ff, 0xb57cff, 0xff7ad9] as const;

/** Refresh arrow of the ring hero: an r=88 arc centred on the emblem plus a filled head (Menu3). */
export const REFRESH_ARROW = {
  radius: 88,
  startAngle: Math.atan2(-20, -84),
  endAngle: Math.atan2(-66, 60),
  head: [[52, -80], [74, -62], [48, -54]] as readonly Pt[],
} as const;

/** Chapter III is where pieces turn, so the ring hero's arrow and pinwheel rotate slowly and steadily (clockwise, one lap per period).
 * Periods in ms; the dotted outer ring keeps its own 240 s lap. */
export const RING_HERO_SPIN_MS = { arrow: 18000, pinwheel: 26000 } as const;

/** Radians turned in `deltaMs` by something that completes a lap every `periodMs`. */
export function heroSpinDelta(deltaMs: number, periodMs: number): number {
  return (2 * Math.PI * deltaMs) / periodMs;
}

const rotate = ([x, y]: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

/** Four coloured triangles and the lighter core diamond (0.42 × half), as in the mockups. */
export function pinwheelFaces(half: number, rotationDeg = 0): HeroFace[] {
  const c = 0.42 * half;
  const faces: Array<[number, Pt[]]> = [
    [PINWHEEL.nw, [[0, -half], [0, 0], [-half, 0]]],
    [PINWHEEL.ne, [[0, -half], [half, 0], [0, 0]]],
    [PINWHEEL.se, [[half, 0], [0, half], [0, 0]]],
    [PINWHEEL.sw, [[0, half], [-half, 0], [0, 0]]],
    [PINWHEEL.core, [[0, -c], [c, 0], [0, c], [-c, 0]]],
  ];
  return faces.map(([color, points]) => ({ color, points: rotationDeg ? points.map((p) => rotate(p, rotationDeg)) : points }));
}

export function pinwheelOutline(half: number, rotationDeg = 0): Pt[] {
  const outline: Pt[] = [[0, -half], [half, 0], [0, half], [-half, 0]];
  return rotationDeg ? outline.map((p) => rotate(p, rotationDeg)) : outline;
}

export function heroKindFor(themeId: string): HeroKind | undefined {
  return themeId === 'ring' || themeId === 'cluster' || themeId === 'prism' ? themeId : undefined;
}
