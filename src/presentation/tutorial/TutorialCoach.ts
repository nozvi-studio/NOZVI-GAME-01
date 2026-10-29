import Phaser from 'phaser';
import type { Level } from '../../domain/model.ts';
import type { TutorialStepId, TutorialView } from '../../application/tutorial.ts';
import type { CommonTranslationKey } from '../../localization/types.ts';
import { cjkWordWrapCallback } from '../cjkWrap.ts';
import { COLOR_TOKENS, DEPTH_TOKENS, TYPO_TOKENS } from '../designTokens.ts';
import { designViewBounds } from '../designViewport.ts';
import { t } from '../i18n.ts';
import { piecePolygonAround } from '../board/layout.ts';
import type { LayoutMetrics } from '../board/layout.ts';
import { GESTURE_ICON_HEIGHT, GESTURE_ICON_WIDTH, TutorialGestureIcon } from './tutorialGestureIcon.ts';
import { ghostPose, rotateButtonSpot, snapFlash } from './tutorialGeometry.ts';
import type { GestureKind, Rect, TutorialSpot } from './tutorialGeometry.ts';
import { isReducedMotion, scaleTiming } from '../transitions/motion.ts';

const DIM_DEPTH = DEPTH_TOKENS.temporaryPieces + 2;
const FX_DEPTH = DIM_DEPTH + 1;
const UI_DEPTH = DEPTH_TOKENS.hudControls + 10;
const DIM_TEXTURE_KEY = 'tutorial-dim';
const GHOST_LOOP_MS = 3400;

type StepCopy = Readonly<{
  title: CommonTranslationKey;
  body: CommonTranslationKey;
  chip: CommonTranslationKey;
  /** The chip shows a drag arrow (drag steps only). */
  chipArrow: boolean;
  /** A demo of a faster gesture, shown under the body (never required). */
  tip?: Readonly<{ text: CommonTranslationKey; gesture: GestureKind }>;
}>;

const COPY: Record<TutorialStepId, StepCopy> = {
  time: { title: 'tutorial_time_title', body: 'tutorial_time_body', chip: 'tutorial_time_chip', chipArrow: false },
  'drag-first': { title: 'tutorial_drag_title', body: 'tutorial_drag_body', chip: 'tutorial_chip_drag', chipArrow: true },
  'drag-second': { title: 'tutorial_second_title', body: 'tutorial_second_body', chip: 'tutorial_chip_drag', chipArrow: true },
  select: {
    title: 'tutorial_select_title',
    body: 'tutorial_select_body',
    chip: 'tutorial_select_chip',
    chipArrow: false,
  },
  'rotate-button': {
    title: 'tutorial_button_title',
    body: 'tutorial_button_body',
    chip: 'tutorial_rotate_chip',
    chipArrow: false,
  },
  'double-tap': {
    title: 'tutorial_double_title',
    body: 'tutorial_double_body',
    chip: 'tutorial_double_chip',
    chipArrow: false,
    tip: { text: 'tutorial_tip_double_tap', gesture: 'double-tap' },
  },
  hold: {
    title: 'tutorial_hold_title',
    body: 'tutorial_hold_body',
    chip: 'tutorial_hold_chip',
    chipArrow: false,
    tip: { text: 'tutorial_tip_hold', gesture: 'double-tap-hold' },
  },
  'fix-pose': {
    title: 'tutorial_rotate_title',
    body: 'tutorial_rotate_body',
    chip: 'tutorial_rotate_chip',
    chipArrow: false,
  },
  'drag-turned': { title: 'tutorial_turned_drag_title', body: 'tutorial_turned_drag_body', chip: 'tutorial_chip_drag', chipArrow: true },
  'place-last': { title: 'tutorial_final_title', body: 'tutorial_final_body', chip: 'tutorial_chip_drag', chipArrow: true },
};

/** Steps that drag a piece from the tray to its place (the others only point at something). */
const isDragStep = (id: TutorialStepId): boolean =>
  id === 'drag-first' || id === 'drag-second' || id === 'drag-turned' || id === 'place-last';

/** Steps where the Rotate button is the thing to press. */
const usesRotateButton = (id: TutorialStepId): boolean => id === 'rotate-button' || id === 'fix-pose';

/** Steps that point at the piece in its tray slot with a pulsing ring (select, double tap, hold). */
const pointsAtTrayPiece = (id: TutorialStepId): boolean => id === 'select' || id === 'double-tap' || id === 'hold';

export class TutorialCoach {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private loop: Phaser.Tweens.Tween | null = null;
  private icon: TutorialGestureIcon | null = null;
  private shownOnce = false;
  /** Where the player should look or press in this step: the nudge ring goes here. */
  private focus: { x: number; y: number; radius: number } | null = null;
  /** The bubble's pieces, shaken together by `nudge`. */
  private bubbleObjects: Phaser.GameObjects.GameObject[] = [];
  private lastNudgeAt = -1000;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: Level,
    private readonly layout: LayoutMetrics,
    private readonly onSkip: () => void,
    private readonly onAck: () => void = () => {}
  ) {}

  /** (Re)draw the overlay for a step. `extras.rotateButton` is the Rotate button's design-space bounds, when shown. */
  show(
    view: TutorialView,
    spot: TutorialSpot,
    extras: { rotateButton: Rect | null; timeBar?: Rect | null } = { rotateButton: null }
  ): void {
    if (this.destroyed) return;
    this.clearObjects();
    const k = designViewBounds(this.scene).width / 390;
    const button = usesRotateButton(view.id) && extras.rotateButton ? rotateButtonSpot(extras.rotateButton) : null;
    const bar = view.id === 'time' ? (extras.timeBar ?? null) : null;
    this.focus = bar
      ? { x: bar.x + bar.width / 2, y: bar.y + bar.height / 2, radius: bar.height / 2 + 12 }
      : button
      ? { x: button.centre.x, y: button.centre.y, radius: button.radius + 4 }
      : { x: spot.trayCentre.x, y: spot.trayCentre.y, radius: spot.trayRadius };
    this.drawDim(view, spot, button);
    if (bar) this.drawBarHighlight(bar);
    else this.drawGuide(view, spot, button);
    this.drawBubble(view, k);
    this.drawSkip(k);
    this.fadeIn();
    this.shownOnce = true;
  }

  /** A blocked input: shake the bubble and ring the thing to use. Throttled, so a flurry of taps is one nudge. */
  nudge(): void {
    if (this.destroyed || !this.focus) return;
    const now = this.scene.time.now;
    if (now - this.lastNudgeAt < 450) return;
    this.lastNudgeAt = now;

    const gold = Phaser.Display.Color.HexStringToColor(COLOR_TOKENS.amberGold.solidPrimary).color;
    const ring = this.scene.add.graphics().setDepth(UI_DEPTH - 1).setPosition(this.focus.x, this.focus.y);
    ring.lineStyle(8, gold, 1);
    ring.strokeCircle(0, 0, this.focus.radius);
    const reduced = isReducedMotion();
    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: reduced ? 1 : 1.5,
      duration: 500,
      onComplete: () => ring.destroy(),
    });
    if (reduced) return;

    const amplitude = 8 * (designViewBounds(this.scene).width / 390);
    for (const object of this.bubbleObjects) {
      const target = object as unknown as Phaser.GameObjects.Components.Transform;
      this.scene.tweens.add({ targets: object, x: target.x + amplitude, duration: 45, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
    }
  }

  hide(): void {
    if (this.destroyed) return;
    const targets = this.objects.filter((o) => 'alpha' in o);
    if (targets.length === 0 || isReducedMotion()) {
      this.destroy();
      return;
    }
    this.loop?.stop();
    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: scaleTiming(200),
      onComplete: () => this.destroy(),
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearObjects();
    if (this.scene.textures.exists(DIM_TEXTURE_KEY)) this.scene.textures.remove(DIM_TEXTURE_KEY);
  }

  private clearObjects(): void {
    this.loop?.stop();
    this.loop = null;
    this.icon?.destroy();
    this.icon = null;
    this.bubbleObjects = [];
    for (const object of this.objects) {
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    }
    this.objects = [];
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.objects.push(object);
    return object;
  }

  private fadeIn(): void {
    // First show: dim then bubble. Later steps swap quickly.
    const first = !this.shownOnce;
    this.objects.forEach((object, index) => {
      // The ghost, flash and rings drive their own alpha every frame; a fade tween would fight them.
      // Zones have no alpha component in Phaser.
      if (object.getData('noFade') || !('alpha' in object)) return;
      const target = object as unknown as { alpha: number; setAlpha(a: number): unknown };
      const final = target.alpha;
      if (isReducedMotion()) return;
      target.setAlpha(0);
      this.scene.tweens.add({
        targets: object,
        alpha: final,
        duration: scaleTiming(first ? 500 : 200),
        delay: scaleTiming(first ? (index === 0 ? 0 : 400) : 0),
      });
    });
  }

  private drawDim(view: TutorialView, spot: TutorialSpot, button: { centre: { x: number; y: number }; radius: number } | null): void {
    const size = designViewBounds(this.scene);
    const w = Math.ceil(size.width);
    const h = Math.ceil(size.height);
    if (this.scene.textures.exists(DIM_TEXTURE_KEY)) this.scene.textures.remove(DIM_TEXTURE_KEY);
    const texture = this.scene.textures.createCanvas(DIM_TEXTURE_KEY, w, h)!;
    const ctx = texture.context;

    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = COLOR_TOKENS.modal.backdrop;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 18;
    const well = spot.trayWell;
    // The time step looks at the bar, not the tray: the tray stays dimmed.
    if (view.id !== 'time') {
      this.roundRectPath(ctx, well.x, well.y, well.width, well.height, 22);
      ctx.fill();
    }
    if (button) {
      ctx.beginPath();
      ctx.arc(button.centre.x, button.centre.y, button.radius + 12, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isDragStep(view.id)) {
      ctx.beginPath();
      ctx.arc(spot.target.x, spot.target.y, spot.targetRadius + 28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    texture.refresh();

    this.track(this.scene.add.image(0, 0, DIM_TEXTURE_KEY).setOrigin(0).setDepth(DIM_DEPTH));
  }

  private roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** A ring that grows and fades where the player should press (a still ring under reduced motion). */
  private pulseRing(x: number, y: number, radius: number, depth: number): void {
    const ring = this.scene.add.graphics().setDepth(depth).setPosition(x, y);
    ring.lineStyle(5, 0xffffff, 1);
    ring.strokeCircle(0, 0, radius);
    ring.setData('noFade', true);
    this.track(ring);
    if (isReducedMotion()) {
      ring.setAlpha(0.8);
      return;
    }
    this.loop = this.scene.tweens.add({
      targets: ring,
      scale: { from: 0.8, to: 1.35 },
      alpha: { from: 1, to: 0 },
      duration: 1200,
      repeat: -1,
      ease: 'Sine.easeOut',
    });
  }

  /** A gold frame that pulses around the time bar and its stars (above the HUD, which sits over the dim). */
  private drawBarHighlight(bar: Rect): void {
    const pad = 14;
    const gold = Phaser.Display.Color.HexStringToColor(COLOR_TOKENS.amberGold.solidPrimary).color;
    const frame = this.scene.add.graphics().setDepth(UI_DEPTH - 1).setData('noFade', true);
    frame.lineStyle(5, gold, 1);
    frame.strokeRoundedRect(bar.x - pad, bar.y - pad, bar.width + pad * 2, bar.height + pad * 2, (bar.height + pad * 2) / 2);
    this.track(frame);
    if (!isReducedMotion()) {
      this.scene.tweens.add({ targets: frame, alpha: 0.35, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private drawGuide(view: TutorialView, spot: TutorialSpot, button: { centre: { x: number; y: number }; radius: number } | null): void {
    if (pointsAtTrayPiece(view.id)) {
      this.pulseRing(spot.trayCentre.x, spot.trayCentre.y, spot.trayRadius, FX_DEPTH);
      return;
    }
    if (usesRotateButton(view.id)) {
      // Above the HUD (which sits over the dim) so the ring around the button is visible.
      if (button) this.pulseRing(button.centre.x, button.centre.y, button.radius + 4, UI_DEPTH - 1);
      return;
    }

    const piece = this.level.pieces.find((p) => p.id === spot.pieceId);
    if (!piece) return;
    const gold = Phaser.Display.Color.HexStringToColor(COLOR_TOKENS.amberGold.solidPrimary).color;
    const framePx = piece.frameSize * this.layout.cellPixel;

    if (isReducedMotion()) {
      // Static cue instead of the loop: an arrow from the tray piece to its place.
      const arrow = this.scene.add.graphics().setDepth(FX_DEPTH);
      const { trayCentre: a, target: b } = spot;
      const tipY = b.y + spot.targetRadius * 0.4;
      arrow.lineStyle(6, gold, 0.85);
      arrow.lineBetween(a.x, a.y - spot.trayRadius, b.x, tipY + 22);
      arrow.fillStyle(gold, 0.85);
      arrow.fillTriangle(b.x, tipY, b.x - 16, tipY + 22, b.x + 16, tipY + 22);
      this.track(arrow);
      return;
    }

    const ghost = this.scene.add.graphics().setDepth(FX_DEPTH);
    // The ghost is drawn in the target pose, so the turned roof piece is shown the way it must land.
    const points = piecePolygonAround(piece, spot.targetTurns, 0, 0, framePx);
    ghost.fillStyle(gold, 0.9);
    ghost.fillPoints(points, true);
    ghost.lineStyle(3, 0xffffff, 0.9);
    ghost.strokePoints(points, true);
    this.track(ghost);

    const flash = this.scene.add.graphics().setDepth(FX_DEPTH);
    this.track(flash);
    ghost.setData('noFade', true);
    flash.setData('noFade', true);

    const trayScale = spot.trayRadius / spot.targetRadius;
    const clock = { p: 0 };
    this.loop = this.scene.tweens.add({
      targets: clock,
      p: 1,
      duration: GHOST_LOOP_MS,
      repeat: -1,
      onUpdate: () => {
        const pose = ghostPose(clock.p);
        ghost.setPosition(
          Phaser.Math.Linear(spot.trayCentre.x, spot.target.x, pose.travel),
          Phaser.Math.Linear(spot.trayCentre.y, spot.target.y, pose.travel)
        );
        ghost.setScale(Phaser.Math.Linear(trayScale, 1, pose.travel) * pose.scale);
        ghost.setAlpha(pose.alpha);

        const strength = snapFlash(clock.p);
        flash.clear();
        if (strength > 0) {
          flash.lineStyle(6, 0xffffff, strength);
          flash.strokeCircle(spot.target.x, spot.target.y, spot.targetRadius * (0.9 + 0.25 * strength));
        }
      },
    });
  }

  private drawBubble(view: TutorialView, k: number): void {
    const copy = COPY[view.id];
    const title = t(copy.title);
    const body = t(copy.body);
    const label = t('tutorial_step_label', { n: view.step, total: view.total });

    const x = 24 * k;
    const y = 96 * k;
    const w = 342 * k;
    const padX = 16 * k;
    const innerW = w - padX * 2;
    const dark = '#1A1446';

    // Measure first (text heights set the card height), then draw the card behind the text.
    const stepRowH = 18 * k;
    const titleText = this.scene.add
      .text(x + padX, y + 14 * k + stepRowH + 6 * k, title, {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: `${19 * k}px`,
        fontStyle: 'bold',
        color: dark,
        wordWrap: { width: innerW, callback: cjkWordWrapCallback(innerW) },
        lineSpacing: 5 * k,
      })
      .setDepth(UI_DEPTH + 1);
    const bodyText = this.scene.add
      .text(x + padX, titleText.y + titleText.height + 4 * k, body, {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: `${13 * k}px`,
        color: '#4A3F6B',
        wordWrap: { width: innerW, callback: cjkWordWrapCallback(innerW) },
        lineSpacing: 5 * k,
      })
      .setDepth(UI_DEPTH + 1);

    // Optional tip row: a gesture icon on the left, the tip text on the right
    let tipText: Phaser.GameObjects.Text | null = null;
    let afterBody = bodyText.y + bodyText.height;
    if (copy.tip) {
      const tipY = afterBody + 10 * k;
      const textX = x + padX + (GESTURE_ICON_WIDTH + 8) * k;
      const textW = innerW - (GESTURE_ICON_WIDTH + 8) * k;
      tipText = this.scene.add
        .text(textX, tipY, t(copy.tip.text), {
          fontFamily: TYPO_TOKENS.fontFamily.sans,
          fontSize: `${12 * k}px`,
          fontStyle: 'bold',
          color: '#7A5A12',
          wordWrap: { width: textW, callback: cjkWordWrapCallback(textW) },
          lineSpacing: 4 * k,
        })
        .setDepth(UI_DEPTH + 1);
      const rowH = Math.max(GESTURE_ICON_HEIGHT * k, tipText.height);
      tipText.setY(tipY + (rowH - tipText.height) / 2);
      this.icon = new TutorialGestureIcon(this.scene, copy.tip.gesture, x + padX, tipY + (rowH - GESTURE_ICON_HEIGHT * k) / 2, k, UI_DEPTH + 1);
      this.track(this.icon.graphics);
      afterBody = tipY + rowH;
    }

    const chipY = afterBody + 10 * k;
    const chipH = 26 * k;
    const h = chipY + chipH + 12 * k - y;

    const card = this.scene.add.graphics().setDepth(UI_DEPTH);
    card.fillStyle(0x000014, 0.3);
    card.fillRoundedRect(x, y + 12 * k, w, h, 20 * k);
    card.fillStyle(0xfff8e6, 1);
    card.fillRoundedRect(x, y, w, h, 20 * k);
    card.lineStyle(3 * k, Phaser.Display.Color.HexStringToColor(COLOR_TOKENS.iceGlass.primaryBorder).color, 1);
    card.strokeRoundedRect(x, y, w, h, 20 * k);

    // Step dots (left) and step label (right)
    const dotsY = y + 14 * k + stepRowH / 2;
    const gold = Phaser.Display.Color.HexStringToColor(COLOR_TOKENS.amberGold.solidPrimary).color;
    let dotX = x + padX;
    for (let i = 1; i <= view.total; i += 1) {
      const active = i === view.step;
      const dw = (active ? 18 : 7) * k;
      card.fillStyle(active ? gold : 0x7a5a12, active ? 1 : 0.25);
      card.fillRoundedRect(dotX, dotsY - 3.5 * k, dw, 7 * k, 3.5 * k);
      dotX += dw + 5 * k;
    }
    const labelText = this.scene.add
      .text(x + w - padX, dotsY, label, {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: `${12 * k}px`,
        fontStyle: 'bold',
        color: '#7A5A12',
      })
      .setOrigin(1, 0.5)
      .setDepth(UI_DEPTH + 1);

    // Chip: the action word, with a drag arrow on drag steps
    const chipLabel = this.scene.add
      .text(0, 0, t(copy.chip), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: `${12 * k}px`,
        fontStyle: 'bold',
        color: dark,
      })
      .setOrigin(0, 0.5)
      .setDepth(UI_DEPTH + 1);
    const chipPad = 10 * k;
    const iconW = copy.chipArrow ? 16 * k : 0;
    const gap = copy.chipArrow ? 6 * k : 0;
    const chipW = chipPad + iconW + gap + chipLabel.width + chipPad;
    card.fillStyle(gold, 1);
    card.fillRoundedRect(x + padX, chipY, chipW, chipH, chipH / 2);
    const iconX = x + padX + chipPad;
    const midY = chipY + chipH / 2;
    if (copy.chipArrow) {
      card.lineStyle(2 * k, 0x1a1446, 1);
      card.beginPath();
      card.moveTo(iconX + 1 * k, midY);
      card.lineTo(iconX + 13 * k, midY);
      card.moveTo(iconX + 9 * k, midY - 4 * k);
      card.lineTo(iconX + 13 * k, midY);
      card.lineTo(iconX + 9 * k, midY + 4 * k);
      card.strokePath();
    }
    chipLabel.setPosition(iconX + iconW + gap, midY);

    [card, titleText, bodyText, labelText, chipLabel].forEach((o) => this.track(o));
    if (view.id === 'time') {
      // Nothing else is allowed in this step: tapping the card moves on.
      const ack = this.scene.add.zone(x, y, w, h).setOrigin(0).setDepth(UI_DEPTH + 2).setInteractive({ useHandCursor: true });
      ack.once('pointerdown', () => this.onAck());
      this.track(ack);
    }
    if (tipText) this.track(tipText);
    this.bubbleObjects = [card, titleText, bodyText, labelText, chipLabel, ...(tipText ? [tipText] : []), ...(this.icon ? [this.icon.graphics] : [])];
  }

  private drawSkip(k: number): void {
    const view = designViewBounds(this.scene);
    const label = this.scene.add
      .text(0, 0, t('tutorial_skip'), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: `${13 * k}px`,
        fontStyle: 'bold',
        color: '#FFFFFF',
      })
      .setOrigin(0, 0.5)
      .setDepth(UI_DEPTH + 1);
    const padX = 14 * k;
    const chevronW = 12 * k + 4 * k;
    const w = padX + label.width + chevronW + padX;
    const h = 32 * k;
    const x = view.width - 16 * k - w;
    const y = 30 * k;

    const button = this.scene.add.graphics().setDepth(UI_DEPTH);
    button.fillStyle(0x0a0a28, 0.6);
    button.fillRoundedRect(x, y, w, h, h / 2);
    button.lineStyle(1.5 * k, 0x5ad1e0, 1);
    button.strokeRoundedRect(x, y, w, h, h / 2);
    label.setPosition(x + padX, y + h / 2);
    const cx = x + padX + label.width + 4 * k;
    button.lineStyle(2 * k, 0xffffff, 1);
    button.beginPath();
    button.moveTo(cx + 4 * k, y + h / 2 - 4 * k);
    button.lineTo(cx + 8 * k, y + h / 2);
    button.lineTo(cx + 4 * k, y + h / 2 + 4 * k);
    button.strokePath();

    // A 48 dp touch target around the visible pill
    const pad = 8 * k;
    const hit = this.scene.add
      .zone(x - pad, y - pad, w + pad * 2, h + pad * 2)
      .setOrigin(0)
      .setDepth(UI_DEPTH + 2)
      .setInteractive({ useHandCursor: true });
    hit.once('pointerdown', () => this.onSkip());

    [button, label, hit].forEach((o) => this.track(o));
  }
}
