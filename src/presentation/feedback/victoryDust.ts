import Phaser from 'phaser';
import { STARDUST_MAX } from '../transitions/stardust.ts';
import type { Point } from '../transitions/routes.ts';

/**
 * One cloud of stardust that lives through the whole finale: it is born as the
 * solved pieces dissolve, gathers in the board centre, spreads out and circles
 * the completion card while it is up, then is drawn back in with the card when
 * "Next" is pressed. Positions are pure functions of a stage and a clock.
 */
export type DustSpec = {
  src: Point;
  /** Start angle on the orbit, radians. */
  phase: number;
  /** Orbit radii relative to the card's, so the cloud is a loose ring rather than a line. */
  rxScale: number;
  ryScale: number;
  /** Laps per ORBIT_PERIOD_MS, between 0.7 and 1.3. */
  speed: number;
  radius: number;
  color: number;
  alpha: number;
};

export type DustStage = { gather: number; emerge: number; collapse: number };
export type CardOrbit = { x: number; y: number; rx: number; ry: number };
export type DustGeometry = { center: Point; card: CardOrbit };

export const ORBIT_PERIOD_MS = 24000;
const DUST_COLORS = [0xffc857, 0xf9c74f, 0xa9e3ff, 0xffffff] as const;
const DEPTH_BETWEEN_DIM_AND_CARD = 99.5;

export function planVictoryDust(sources: readonly Point[], count: number, random: () => number = Math.random): DustSpec[] {
  if (sources.length === 0) return [];
  const n = Math.min(STARDUST_MAX, Math.max(0, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => {
    const source = sources[i % sources.length];
    const angle = random() * Math.PI * 2;
    const spread = random() * 50;
    return {
      src: { x: source.x + Math.cos(angle) * spread, y: source.y + Math.sin(angle) * spread },
      phase: random() * Math.PI * 2,
      rxScale: 1 + random() * 0.2,
      ryScale: 1 + random() * 0.35,
      speed: 0.7 + random() * 0.6,
      radius: 1.6 + random() * 2.2,
      color: DUST_COLORS[i % DUST_COLORS.length],
      alpha: 0.7 + random() * 0.3,
    };
  });
}

export function orbitPoint(spec: DustSpec, elapsedMs: number, card: CardOrbit): Point {
  const angle = spec.phase + (elapsedMs / ORBIT_PERIOD_MS) * Math.PI * 2 * spec.speed;
  return { x: card.x + Math.cos(angle) * card.rx * spec.rxScale, y: card.y + Math.sin(angle) * card.ry * spec.ryScale };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t;

export function dustPose(spec: DustSpec, stage: DustStage, elapsedMs: number, g: DustGeometry): { x: number; y: number; alpha: number; radius: number } {
  const twinkle = 0.7 + 0.3 * Math.sin(elapsedMs / 650 + spec.phase * 3);
  const base = spec.alpha * twinkle;
  if (stage.collapse > 0) {
    const t = easeIn(Math.min(1, stage.collapse));
    const from = orbitPoint(spec, elapsedMs, g.card);
    return { x: lerp(from.x, g.card.x, t), y: lerp(from.y, g.card.y, t), alpha: stage.collapse >= 1 ? 0 : base * (1 - t), radius: spec.radius * (1 - 0.5 * t) };
  }
  if (stage.emerge > 0) {
    const to = orbitPoint(spec, elapsedMs, g.card);
    const t = easeOut(Math.min(1, stage.emerge));
    return { x: lerp(g.center.x, to.x, t), y: lerp(g.center.y, to.y, t), alpha: base, radius: spec.radius };
  }
  const t = Math.min(1, stage.gather);
  // Fades up out of the dissolving piece instead of popping into view.
  const fadeUp = Math.sin((Math.min(1, t * 2) * Math.PI) / 2);
  return { x: lerp(spec.src.x, g.center.x, t), y: lerp(spec.src.y, g.center.y, t), alpha: spec.alpha * fadeUp, radius: spec.radius };
}

export class VictoryDust {
  /** Tweened by the victory timeline (gather, emerge) and by `collapse`. */
  readonly stage: DustStage = { gather: 0, emerge: 0, collapse: 0 };
  private readonly graphics: Phaser.GameObjects.Graphics;
  private elapsedMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly specs: readonly DustSpec[],
    private readonly geometry: DustGeometry
  ) {
    this.graphics = scene.add.graphics().setDepth(DEPTH_BETWEEN_DIM_AND_CARD);
  }

  /** Start at the finale's resting state: already circling the card. */
  settle(): void {
    this.stage.gather = 1;
    this.stage.emerge = 1;
    this.draw();
  }

  tick(dtMs: number): void {
    this.elapsedMs += Math.min(dtMs, 50);
    this.draw();
  }

  draw(): void {
    if (!this.graphics.active) return;
    this.graphics.clear();
    for (const spec of this.specs) {
      const d = dustPose(spec, this.stage, this.elapsedMs, this.geometry);
      if (d.alpha <= 0.01) continue;
      this.graphics.fillStyle(spec.color, d.alpha * 0.35);
      this.graphics.fillCircle(d.x, d.y, d.radius * 2.4);
      this.graphics.fillStyle(spec.color, d.alpha);
      this.graphics.fillCircle(d.x, d.y, d.radius);
    }
  }

  /** The cloud draws in to the card's centre in `ms`, matching the card's own collapse. */
  collapse(ms: number): void {
    this.scene.tweens.add({ targets: this.stage, collapse: 1, duration: ms, ease: 'Cubic.easeIn', onUpdate: () => this.draw() });
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
