import Phaser from 'phaser';
import { COLOR_NUMBERS, glowTier } from '../designTokens.ts';
import { jewelFaces, jewelOutline } from '../board/jewelGeometry.ts';
import { getMotionScale, isReducedMotion } from '../transitions/motion.ts';
import {
  emblemOffsetAt,
  emblemOverlap,
  emblemStarAlpha,
  nextElapsed,
} from './dualJewelGeometry.ts';

const JEWEL_RADIUS = 68;
const ORBIT_RADIUS = 150;

/**
 * Face colours resolved once. `jewelFaces` returns the token hex strings, and
 * converting them per face per frame would mean eight conversions every tick
 * on a screen the GDD asks to be frugal on battery.
 */
const FACE_COLORS: Record<'north' | 'east' | 'south' | 'west', number> = {
  north: COLOR_NUMBERS.jewelFaceNorth,
  east: COLOR_NUMBERS.jewelFaceEast,
  south: COLOR_NUMBERS.jewelFaceSouth,
  west: COLOR_NUMBERS.jewelFaceWest,
};

/**
 * Chapter I hero from the Menu1 mockup (docs/gdd/assets/Menu · Chương I
 * Khởi Nguyên-html): two touching amber jewels inside a tinted disc. It is
 * drawn in mockup units (390 px wide), so the caller scales it by 720/390.
 */
export const CHAPTER_ONE_HERO_SCALE = 720 / 390;
const HERO_FACES: ReadonlyArray<{ color: number; pts: ReadonlyArray<readonly [number, number]> }> = [
  { color: 0xfff0a6, pts: [[0, -42], [0, 0], [-42, 0]] },
  { color: 0xffd23f, pts: [[0, -42], [42, 0], [0, 0]] },
  { color: 0xf59400, pts: [[42, 0], [0, 42], [0, 0]] },
  { color: 0xffb31f, pts: [[0, 42], [-42, 0], [0, 0]] },
];

export class DualJewelEmblem {
  private readonly emblemGraphics: Phaser.GameObjects.Graphics;
  private readonly sparkleGraphics: Phaser.GameObjects.Graphics;
  private readonly ringGraphics?: Phaser.GameObjects.Graphics;
  private readonly heroAccent?: number;
  private elapsedMs = 0;
  private ringAngle1 = 0;
  private ringAngle2 = 0;
  private ringSpeed = 1;

  /** Pass `heroAccent` to render the static Chapter I hero instead of the XOR lesson. */
  constructor(scene: Phaser.Scene, x: number, y: number, heroAccent?: number) {
    this.emblemGraphics = scene.add.graphics().setPosition(x, y);
    this.sparkleGraphics = scene.add.graphics().setPosition(x, y);
    this.heroAccent = heroAccent;
    if (heroAccent !== undefined) {
      // Dotted outer ring (r132, dash 2/gap 8) turns slowly: one lap per 4 minutes.
      const ring = scene.add.graphics().setPosition(x, y);
      ring.lineStyle(1.2, heroAccent, 0.45);
      const dashes = Math.round((2 * Math.PI * 132) / 10);
      for (let i = 0; i < dashes; i++) {
        const a = (i / dashes) * Math.PI * 2;
        ring.beginPath();
        ring.arc(0, 0, 132, a, a + 2 / 132);
        ring.strokePath();
      }
      this.ringGraphics = ring;
    }
  }

  graphics(): Phaser.GameObjects.Graphics[] {
    return this.ringGraphics
      ? [this.emblemGraphics, this.sparkleGraphics, this.ringGraphics]
      : [this.emblemGraphics, this.sparkleGraphics];
  }

  setRingSpeed(speed: number): void {
    this.ringSpeed = speed;
  }

  update(deltaMs: number): void {
    // Reduced Motion holds the taught pose rather than switching the lesson
    // off: the overlap and its star stay on screen, nothing moves.
    const reduced = isReducedMotion();
    this.elapsedMs = nextElapsed(this.elapsedMs, deltaMs, reduced);
    if (!reduced) {
      const spin = this.ringSpeed * getMotionScale();
      this.ringAngle1 += deltaMs * 0.0003 * spin;
      this.ringAngle2 -= deltaMs * 0.0002 * spin;
      if (this.ringGraphics) this.ringGraphics.rotation += ((2 * Math.PI) / 240000) * deltaMs * spin;
    }
    this.draw();
  }

  private draw(): void {
    const g = this.emblemGraphics;
    const s = this.sparkleGraphics;
    g.clear();
    s.clear();

    if (this.heroAccent !== undefined) {
      this.drawChapterOneHero(g, this.heroAccent);
      return;
    }

    const offset = emblemOffsetAt(this.elapsedMs);

    // Tier 1: the orbit is structure, not an invitation.
    const ring = glowTier(1);
    g.lineStyle(1.2, COLOR_NUMBERS.icePrimary, ring.alpha);
    g.strokeCircle(0, 0, ORBIT_RADIUS);
    this.drawOrbitDust(g);

    // Both jewels, then the overlap punched out in sky navy.
    for (const cx of [-offset, offset]) {
      this.drawFacetedJewel(g, cx, JEWEL_RADIUS);
    }

    const overlap = emblemOverlap(offset, JEWEL_RADIUS);
    if (overlap.length >= 3) {
      g.fillStyle(COLOR_NUMBERS.skyBottom, 1);
      g.fillPoints(overlap.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);

      const alpha = emblemStarAlpha(this.elapsedMs);
      if (alpha > 0) this.drawStar(s, 0, 0, 14, alpha);
    }
  }

  /**
   * Four cut facets plus an outline, so the emblem reads as the same material
   * as the pieces on the board. `jewelFaces` is the shared helper the board
   * pieces use, which keeps the colours on the token system instead of the
   * hardcoded hexes the pre-VR1 emblem carried.
   */
  private drawFacetedJewel(g: Phaser.GameObjects.Graphics, cx: number, r: number): void {
    for (const face of jewelFaces(cx, 0, r)) {
      g.fillStyle(FACE_COLORS[face.name], 1);
      g.fillPoints(
        face.points.map((p) => new Phaser.Geom.Point(p.x, p.y)),
        true
      );
    }
    g.lineStyle(2, COLOR_NUMBERS.jewelOutline, 0.9);
    g.strokePoints(
      jewelOutline(cx, 0, r).map((p) => new Phaser.Geom.Point(p.x, p.y)),
      true
    );
  }

  private drawChapterOneHero(g: Phaser.GameObjects.Graphics, accent: number): void {
    g.fillStyle(accent, 0.1);
    g.fillCircle(0, 0, 118);
    g.lineStyle(1.5, accent, 0.55);
    g.strokeCircle(0, 0, 118);
    // Soft core glow behind the jewels (stands in for the mockup's blurred disc).
    for (let i = 0; i < 8; i++) {
      g.fillStyle(accent, 0.055);
      g.fillCircle(0, 0, 40 + i * 8);
    }
    for (const cx of [-42, 42]) {
      for (const face of HERO_FACES) {
        g.fillStyle(face.color, 1);
        g.fillPoints(face.pts.map(([x, y]) => new Phaser.Geom.Point(cx + x, y)), true);
      }
      g.fillStyle(0xffe27a, 1);
      g.fillPoints(
        [[0, -17.6], [17.6, 0], [0, 17.6], [-17.6, 0]].map(([x, y]) => new Phaser.Geom.Point(cx + x, y)),
        true
      );
      g.lineStyle(2.5, 0xfff6d6, 1);
      g.strokePoints(
        [[0, -42], [42, 0], [0, 42], [-42, 0]].map(([x, y]) => new Phaser.Geom.Point(cx + x, y)),
        true
      );
    }
  }

  private drawOrbitDust(g: Phaser.GameObjects.Graphics): void {
    for (let i = 0; i < 4; i++) {
      const a = this.ringAngle1 + (i * Math.PI) / 2;
      g.fillStyle(COLOR_NUMBERS.textSecondary, 0.6);
      g.fillCircle(Math.cos(a) * ORBIT_RADIUS, Math.sin(a) * ORBIT_RADIUS, 3);
    }
    for (let i = 0; i < 4; i++) {
      const a = this.ringAngle2 + (i * Math.PI) / 2 + Math.PI / 4;
      g.fillStyle(COLOR_NUMBERS.gridModule, 0.5);
      g.fillCircle(Math.cos(a) * 125, Math.sin(a) * 125, 2.5);
    }
  }

  private drawStar(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    r: number,
    alpha: number
  ): void {
    g.fillStyle(0xffffff, alpha);
    const pts = [
      new Phaser.Geom.Point(cx, cy - r),
      new Phaser.Geom.Point(cx + r * 0.28, cy - r * 0.28),
      new Phaser.Geom.Point(cx + r, cy),
      new Phaser.Geom.Point(cx + r * 0.28, cy + r * 0.28),
      new Phaser.Geom.Point(cx, cy + r),
      new Phaser.Geom.Point(cx - r * 0.28, cy + r * 0.28),
      new Phaser.Geom.Point(cx - r, cy),
      new Phaser.Geom.Point(cx - r * 0.28, cy - r * 0.28),
    ];
    g.fillPoints(pts, true);
  }
}
