import type { Level } from '../../domain/model.ts';
import {
  largestFrameSize,
  pieceCenterCanvas,
  pieceHitbox,
  pieceRadiusPx,
  trayPieceRadiusPx,
  trayRelativeSize,
  trayWellRects,
  type CanvasPoint,
  type LayoutMetrics,
} from '../board/layout.ts';
import { FEEDBACK_TOKENS } from '../designTokens.ts';

export type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;

export type TutorialSpot = Readonly<{
  pieceId: string;
  /** The recessed tray slot to spotlight. */
  trayWell: Rect;
  trayCentre: CanvasPoint;
  trayRadius: number;
  /** Centre of the piece's place in the sample solution. */
  target: CanvasPoint;
  targetRadius: number;
  /** Quarter turns the piece has in the sample solution (the ghost is drawn in that pose). */
  targetTurns: number;
}>;

/** Where a piece starts (its tray slot) and where it belongs, in design-space pixels. */
export function tutorialSpot(level: Level, pieceId: string, layout: LayoutMetrics): TutorialSpot | null {
  const index = level.pieces.findIndex((p) => p.id === pieceId);
  const piece = level.pieces[index];
  const placement = level.targetPlacements?.find((p) => p.pieceId === pieceId);
  const well = trayWellRects(layout, level.pieces.length)[index];
  if (!piece || !placement || !well) return null;

  const hit = pieceHitbox(piece, { kind: 'tray', turns: 0 }, layout, index, level.pieces.length);
  return {
    pieceId,
    trayWell: well,
    trayCentre: { x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 },
    // Same shared tray scale as the piece itself, so the coach ring hugs a smaller piece.
    trayRadius: trayPieceRadiusPx(layout, level.pieces.length) * trayRelativeSize(piece.frameSize, largestFrameSize(level.pieces)),
    target: pieceCenterCanvas(piece.frameSize, placement.x, placement.y, layout),
    targetRadius: pieceRadiusPx(piece.frameSize, layout),
    targetTurns: placement.turns,
  };
}

const easeInOut = (k: number): number => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/**
 * One loop of the ghost piece (mockup keyframes `drag`, 3.4 s): appears at the tray, presses,
 * travels to the target, lands, fades. `p` is the loop progress; it wraps.
 */
export function ghostPose(p: number): { travel: number; alpha: number; scale: number } {
  const x = p - Math.floor(p);
  if (x < 0.12) return { travel: 0, alpha: 0, scale: 1 };
  if (x < 0.16) {
    const k = (x - 0.12) / 0.04;
    return { travel: 0, alpha: k, scale: 1 - 0.08 * k };
  }
  if (x < 0.24) return { travel: 0, alpha: 1, scale: 0.92 + 0.08 * ((x - 0.16) / 0.08) };
  if (x < 0.7) return { travel: easeInOut((x - 0.24) / 0.46), alpha: 1, scale: 1 };
  if (x < 0.8) return { travel: 1, alpha: 1, scale: 1 - 0.05 * ((x - 0.7) / 0.1) };
  if (x < 0.92) return { travel: 1, alpha: 1 - (x - 0.8) / 0.12, scale: 0.95 };
  return { travel: 1, alpha: 0, scale: 0.95 };
}

/** Flash ring at the target when the ghost lands (mockup keyframes `snapFlash`). */
export function snapFlash(p: number): number {
  const x = p - Math.floor(p);
  if (x < 0.74 || x >= 0.92) return 0;
  if (x < 0.8) return (x - 0.74) / 0.06;
  return 1 - (x - 0.8) / 0.12;
}

/** Spotlight circle for the HUD Rotate button, from its design-space bounds. */
export function rotateButtonSpot(bounds: Rect): { centre: CanvasPoint; radius: number } {
  return {
    centre: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    radius: Math.max(bounds.width, bounds.height) / 2,
  };
}

export type GestureKind = 'double-tap' | 'double-tap-hold';

export const GESTURE_LOOP_MS: Readonly<Record<GestureKind, number>> = { 'double-tap': 2400, 'double-tap-hold': 3800 };

const TAP_MS = 100;
const TAP1_AT = 200;
const TAP2_AT = 420;
/** Gap between the two demo taps; must stay under `FEEDBACK_TOKENS.doubleTap.windowMs` so the demo is a real double tap. */
export const GESTURE_TAP_GAP_MS = TAP2_AT - TAP1_AT;
const HOLD_END = 2800;
const PRESS_RAMP_MS = 60;
const RIPPLE_MS = 400;
const TURN_PULSE_MS = 200;

export type GesturePose = Readonly<{
  /** Finger pressure 0..1 (the fingertip dips by it). */
  press: number;
  /** Strength 0..1 of the ripple of the first and second tap. */
  ripples: readonly [number, number];
  /** The second press is still down (hold gesture only). */
  held: boolean;
  /** Quarter turns the demo piece has made so far in this loop. */
  turns: number;
  /** 1 right after a turn, fading to 0: used to ease the piece into its new angle. */
  turnPulse: number;
}>;

/**
 * Pure timeline of the two tip animations. `ms` is the time in the loop (it wraps). The hold timings
 * come from the game's own `holdRotate` tokens, so the demo shows what the game really does.
 */
export function gesturePose(kind: GestureKind, ms: number): GesturePose {
  const loop = GESTURE_LOOP_MS[kind];
  const t = ((ms % loop) + loop) % loop;
  const ripple = (at: number): number => (t >= at && t < at + RIPPLE_MS ? 1 - (t - at) / RIPPLE_MS : 0);
  const ripples = [ripple(TAP1_AT), ripple(TAP2_AT)] as const;
  const tapPress = (at: number): number =>
    t >= at && t < at + TAP_MS ? 1 - Math.abs((2 * (t - at)) / TAP_MS - 1) : 0;

  if (kind === 'double-tap') {
    const turnedAt = TAP2_AT + TAP_MS;
    const turned = t >= turnedAt;
    return {
      press: Math.max(tapPress(TAP1_AT), tapPress(TAP2_AT)),
      ripples,
      held: false,
      turns: turned ? 1 : 0,
      turnPulse: turned ? Math.max(0, 1 - (t - turnedAt) / TURN_PULSE_MS) : 0,
    };
  }

  const held = t >= TAP2_AT && t < HOLD_END;
  const press = t < TAP2_AT ? tapPress(TAP1_AT) : held ? Math.min(1, (t - TAP2_AT) / PRESS_RAMP_MS) : Math.max(0, 1 - (t - HOLD_END) / PRESS_RAMP_MS);
  const { delayMs, stepMs } = FEEDBACK_TOKENS.holdRotate;
  let turns = 0;
  let lastTurnAt = -1;
  if (held) {
    for (let at = TAP2_AT + delayMs; at <= t; at += stepMs) {
      turns += 1;
      lastTurnAt = at;
    }
  }
  return {
    press,
    ripples,
    held,
    turns,
    turnPulse: lastTurnAt >= 0 ? Math.max(0, 1 - (t - lastTurnAt) / TURN_PULSE_MS) : 0,
  };
}