export type Point = { x: number; y: number };

/** A long, asymmetric arc reads as an orbit instead of a zigzag chord. */
export function constellationPath(start: Point, end: Point, steps = 12): Point[] {
  const direction = Math.sign(end.x - start.x) || 1;
  const span = Math.abs(end.x - start.x);
  const control1 = { x: start.x + direction * span * 0.72, y: start.y + 24 };
  const control2 = { x: end.x + direction * span * 0.28, y: end.y - 24 };
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const u = 1 - t;
    return {
      x: u ** 3 * start.x + 3 * u ** 2 * t * control1.x + 3 * u * t ** 2 * control2.x + t ** 3 * end.x,
      y: u ** 3 * start.y + 3 * u ** 2 * t * control1.y + 3 * u * t ** 2 * control2.y + t ** 3 * end.y,
    };
  });
}

export function parallaxOffset(scrollY: number): number {
  // Cộng 0 để tránh trả về -0 khi scrollY = 0; -0 và 0 khác nhau với Object.is
  return -scrollY * 0.35 + 0;
}

/** Bright ignition, short hold, then a complete fade. */
export function victoryGlow(progress: number): number {
  if (progress <= 0 || progress >= 1) return 0;
  if (progress < 0.32) return Math.sin((progress / 0.32) * Math.PI / 2);
  return Math.max(0, 1 - (progress - 0.32) / 0.68);
}

/**
 * Walked links are tier 1 — structure, not focus. The one arriving at the
 * current node stays a little brighter so the eye can follow the path to
 * where the player is, without competing with the node itself.
 */
export function walkedLinkAlpha(isIntoCurrent: boolean): number {
  return isIntoCurrent ? 0.95 : 0.55;
}

