import Phaser from 'phaser';
import { COLOR_NUMBERS, FEEDBACK_TOKENS } from '../designTokens.ts';
import type { PieceTextureKeys } from './PieceTextureCache.ts';
import { SILHOUETTE_SCALE } from './PieceTextureCache.ts';
import {
  bounceScale,
  lerpPose,
  lightAlpha,
  shakeOffset,
  stepPose,
  stepScalar,
  tiltDeg,
} from './pieceMotion.ts';
import type { Pose, PoseTau } from './pieceMotion.ts';
import { EASES } from '../transitions/motion.ts';
import type { EaseName } from '../transitions/motion.ts';

type Timed = { elapsedMs: number; delayMs: number; durationMs: number };
type Glide = Timed & { from: Pose; to: Pose; ease: EaseName };
type LiftTween = Timed & { from: number; to: number; ease: EaseName };
type EffectKind = 'bounce' | 'shake' | 'spin' | 'light';
type Effect = Timed & { kind: EffectKind; amount: number };

function progress(t: Timed): number {
  const active = t.elapsedMs - t.delayMs;
  if (active <= 0) return 0;
  return t.durationMs <= 0 ? 1 : Math.min(1, active / t.durationMs);
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/**
 * Một mảnh trên màn chơi. `root` mang tư thế (đuổi theo trạng thái logic mỗi
 * khung); `offset` là lớp lệch riêng cho dàn dựng chuyển cảnh của F1, nên
 * tween chuyển cảnh không đánh nhau với tư thế. Bên trong: bóng, thân, chớp.
 */
export class PieceView {
  readonly root: Phaser.GameObjects.Container;
  readonly offset: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly body: Phaser.GameObjects.Image;
  private readonly light: Phaser.GameObjects.Image;
  private readonly linkMark: Phaser.GameObjects.Graphics;
  private linkMarkKey = '';
  private keys: PieceTextureKeys | null = null;
  private bakedTurns: number | null = null;
  private pose: Pose | null = null;
  private glide: Glide | null = null;
  private liftTween: LiftTween | null = null;
  private lift = 0;
  private tilt = 0;
  private effects: Effect[] = [];

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.image(0, 0, '__DEFAULT');
    this.body = scene.add.image(0, 0, '__DEFAULT');
    this.light = scene.add.image(0, 0, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.linkMark = scene.add.graphics().setVisible(false);
    this.offset = scene.add.container(0, 0, [this.shadow, this.body, this.light, this.linkMark]);
    this.root = scene.add.container(0, 0, [this.offset]).setVisible(false);
  }

  setTextures(keys: PieceTextureKeys, turns: number): void {
    this.keys = keys;
    this.bakedTurns = turns;
    this.body.setTexture(keys.body);
    this.shadow.setTexture(keys.shadow);
    this.light.setTexture(keys.light);
  }

  /**
   * Dấu xoay liên động ở tâm mảnh (tâm luôn nằm trong hình): mảnh dẫn có chấm đặc và vòng ngoài,
   * mảnh bị dẫn chỉ có vòng. `emphasised` làm dấu sáng hơn khi mảnh đang chọn có liên quan.
   */
  setLinkMark(role: 'driver' | 'driven' | 'both' | null, emphasised: boolean): void {
    const key = `${role ?? ''}:${emphasised}`;
    if (key === this.linkMarkKey) return;
    this.linkMarkKey = key;
    const g = this.linkMark;
    g.clear();
    g.setVisible(role !== null);
    if (role === null) return;
    const alpha = emphasised ? 1 : 0.65;
    const ring = role === 'driven' ? 8 : 10;
    g.lineStyle(emphasised ? 3 : 2, COLOR_NUMBERS.icePrimary, alpha);
    g.strokeCircle(0, 0, ring);
    if (role !== 'driven') {
      g.fillStyle(COLOR_NUMBERS.skyTop, alpha);
      g.fillCircle(0, 0, 5);
      g.fillStyle(COLOR_NUMBERS.iceHighlight, alpha);
      g.fillCircle(0, 0, 2.5);
    }
    if (role === 'both') g.strokeCircle(0, 0, ring - 5);
  }

  hasTextures(): boolean {
    return this.keys !== null;
  }

  turns(): number | null {
    return this.bakedTurns;
  }

  setDepth(depth: number): void {
    this.root.setDepth(depth);
  }

  currentPose(): Pose | null {
    return this.pose ? { ...this.pose } : null;
  }

  setLifted(on: boolean, durationMs: number, ease: EaseName): void {
    const to = on ? 1 : 0;
    if (durationMs <= 0) {
      this.lift = to;
      this.liftTween = null;
      return;
    }
    this.liftTween = { from: this.lift, to, elapsedMs: 0, delayMs: 0, durationMs, ease };
  }

  /** Khi khớp: tắt nhấc ngay, nhịp nảy tiếp nối từ 1.08 */
  dropLiftNow(): void {
    this.lift = 0;
    this.liftTween = null;
  }

  glideTo(to: Pose, durationMs: number, ease: EaseName, delayMs = 0): void {
    if (!this.pose || (durationMs <= 0 && delayMs <= 0)) {
      this.pose = { ...to };
      this.glide = null;
      return;
    }
    this.glide = { from: { ...this.pose }, to: { ...to }, elapsedMs: 0, delayMs, durationMs, ease };
  }

  /** Nhấc lại mảnh đang bay: đi tiếp từ tư thế hiện tại, không nhảy (F3 T2-14) */
  cancelGlide(): void {
    this.glide = null;
  }

  play(kind: EffectKind, durationMs: number, amount = 1): void {
    if (durationMs <= 0) return;
    this.effects = this.effects.filter((e) => e.kind !== kind);
    this.effects.push({ kind, amount, elapsedMs: 0, delayMs: 0, durationMs });
  }

  update(dtMs: number, target: Pose, tau: PoseTau, opts: { dragging: boolean; reduced: boolean }): void {
    if (!this.keys) return;
    const prevX = this.pose?.x ?? target.x;
    if (!this.pose) this.pose = { ...target };

    if (this.glide) {
      this.glide.elapsedMs += dtMs;
      const t = progress(this.glide);
      this.pose = lerpPose(this.glide.from, this.glide.to, EASES[this.glide.ease](t));
      if (t >= 1) this.glide = null;
    } else {
      this.pose = opts.reduced ? { ...target } : stepPose(this.pose, target, dtMs, tau);
    }

    const vx = dtMs > 0 ? ((this.pose.x - prevX) * 1000) / dtMs : 0;
    const tiltTarget = opts.dragging && !opts.reduced ? tiltDeg(vx) : 0;
    this.tilt = opts.reduced ? 0 : stepScalar(this.tilt, tiltTarget, dtMs, tau.angle);

    if (this.liftTween) {
      this.liftTween.elapsedMs += dtMs;
      const t = progress(this.liftTween);
      this.lift = lerp(this.liftTween.from, this.liftTween.to, EASES[this.liftTween.ease](t));
      if (t >= 1) this.liftTween = null;
    }

    let scaleMul = 1;
    let dx = 0;
    let spin = 0;
    let flash = 0;
    this.effects = this.effects.filter((e) => {
      e.elapsedMs += dtMs;
      const t = progress(e);
      if (e.kind === 'bounce') scaleMul *= bounceScale(t);
      else if (e.kind === 'shake') dx += shakeOffset(t) * e.amount;
      else if (e.kind === 'spin') spin += e.amount * (1 - EASES.backOut(t));
      else flash = Math.max(flash, e.amount * lightAlpha(t));
      return t < 1;
    });

    const { x, y, scale, angle, alpha } = this.pose;
    const liftScale = 1 + (FEEDBACK_TOKENS.liftScale - 1) * this.lift;
    this.root
      .setPosition(x + dx, y)
      .setScale(scale * liftScale * scaleMul)
      .setAngle(angle + this.tilt + spin)
      .setAlpha(alpha)
      .setVisible(true);

    const res = this.keys.resolution;
    const silScale = 1 / (res * SILHOUETTE_SCALE);
    const { shadowRest: rest, shadowLifted: lifted } = FEEDBACK_TOKENS;
    this.body.setScale(1 / res);
    this.shadow
      .setScale(silScale)
      .setPosition(lerp(rest.x, lifted.x, this.lift), lerp(rest.y, lifted.y, this.lift))
      .setAlpha(FEEDBACK_TOKENS.shadowAlpha * this.lift);
    this.light.setScale(silScale).setAlpha(flash);
  }

  destroy(): void {
    this.root.destroy();
  }
}
