import Phaser from 'phaser';
import { COLOR_NUMBERS, DEPTH_TOKENS, LAYOUT_TOKENS } from '../designTokens.ts';
import { applySteps } from './choreography.ts';
import type { Parts } from './choreography.ts';
import { stagger } from './motion.ts';
import { PLAY_OUT_LEAVE, PLAY_OUT_NEXT, PLAY_SPECIAL, playIn } from './routes.ts';
import type { Point } from './routes.ts';
import type { TransitionContext } from './director.ts';
import type { TransitionTimeline } from '../../engine/core/transitions/TransitionTimeline.ts';

export type PlayTransitionView = {
  scene: Phaser.Scene;
  parts: Parts;
  grid: Phaser.GameObjects.RenderTexture | null;
  boardBounds: { x: number; y: number; width: number; height: number };
  targetCount: number;
  setTargetReveal(values: readonly number[] | null): void;
  setFrameGold(on: boolean): void;
};

const GLINT_KEY = 'transition_glint';

function centerOf(b: PlayTransitionView['boardBounds']): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

export function choreographPlayIn(tl: TransitionTimeline, ctx: TransitionContext, view: PlayTransitionView): void {
  const center = centerOf(view.boardBounds);
  const variant = ctx.route === 'next-level' ? 'next' : ctx.route === 'map-to-play' ? 'node' : 'menu';
  applySteps(tl, playIn(variant, center, ctx.origin), view.parts, 'enter');
  if (variant !== 'next') {
    revealGrid(tl, view, center);
    zoomCamera(tl, view.scene);
  }
  revealTargets(tl, view);
  sweepGlint(tl, view);
}

export function choreographPlayOut(tl: TransitionTimeline, ctx: TransitionContext, view: PlayTransitionView): void {
  if (ctx.route === 'next-level') {
    // The stardust already flew with the win card; nothing new appears here.
    applySteps(tl, PLAY_OUT_NEXT, view.parts, 'exit');
    flashFrame(tl, view);
  } else {
    applySteps(tl, PLAY_OUT_LEAVE, view.parts, 'exit');
  }
}

/** Lưới lộ dần theo vòng tròn loang từ tâm bia */
function revealGrid(tl: TransitionTimeline, view: PlayTransitionView, center: Point): void {
  const grid = view.grid;
  if (!grid) return;
  const shape = view.scene.make.graphics({ x: 0, y: 0 }, false);
  const state = { radius: 0 };
  const draw = () => {
    shape.clear();
    shape.fillStyle(0xffffff, 1);
    shape.fillCircle(center.x, center.y, Math.max(1, state.radius));
  };
  draw();
  grid.setMask(shape.createGeometryMask());
  tl.at(PLAY_SPECIAL.gridRevealAtMs, state, { radius: PLAY_SPECIAL.gridRevealRadius }, PLAY_SPECIAL.gridRevealMs, 'cubicOut', draw);
  tl.call(PLAY_SPECIAL.gridRevealAtMs + PLAY_SPECIAL.gridRevealMs, () => {
    grid.clearMask(true);
    shape.destroy();
  });
}

function zoomCamera(tl: TransitionTimeline, scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  const baseZoom = cam.zoom;
  const half = PLAY_SPECIAL.zoomMs / 2;
  tl.at(PLAY_SPECIAL.zoomAtMs, cam, { zoom: baseZoom * PLAY_SPECIAL.zoomPeak }, half, 'sineInOut');
  tl.at(PLAY_SPECIAL.zoomAtMs + half, cam, { zoom: baseZoom }, half, 'sineInOut');
}

function revealTargets(tl: TransitionTimeline, view: PlayTransitionView): void {
  const n = view.targetCount;
  if (n === 0) return;
  const state: Record<string, number> = {};
  for (let i = 0; i < n; i++) state[`p${i}`] = 0;
  const push = () => view.setTargetReveal(Array.from({ length: n }, (_, i) => state[`p${i}`]));
  push();
  for (let i = 0; i < n; i++) {
    tl.at(
      PLAY_SPECIAL.targetsAtMs + stagger(i, n, PLAY_SPECIAL.targetsSpanMs),
      state,
      { [`p${i}`]: 1 },
      PLAY_SPECIAL.targetsMs,
      'cubicOut',
      push
    );
  }
  tl.call(PLAY_SPECIAL.targetsAtMs + PLAY_SPECIAL.targetsSpanMs + PLAY_SPECIAL.targetsMs, () =>
    view.setTargetReveal(null)
  );
}

function ensureGlintTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GLINT_KEY)) return;
  const canvas = scene.textures.createCanvas(GLINT_KEY, 180, 1100);
  if (!canvas) return;
  const ctx = canvas.context;
  const gradient = ctx.createLinearGradient(0, 0, 180, 0);
  gradient.addColorStop(0, 'rgba(255, 244, 204, 0)');
  gradient.addColorStop(0.5, 'rgba(255, 244, 204, 0.35)');
  gradient.addColorStop(1, 'rgba(255, 244, 204, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 180, 1100);
  canvas.refresh();
}

/** Vệt sáng lướt chéo qua bia lúc bóng mục tiêu hiện ra */
function sweepGlint(tl: TransitionTimeline, view: PlayTransitionView): void {
  const { scene, boardBounds: b } = view;
  ensureGlintTexture(scene);
  const glint = scene.add
    .image(b.x - 160, b.y + b.height / 2, GLINT_KEY)
    .setAngle(20)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(DEPTH_TOKENS.targetSilhouette + 1);
  const clip = scene.make.graphics({ x: 0, y: 0 }, false);
  clip.fillStyle(0xffffff, 1);
  clip.fillRoundedRect(b.x, b.y, b.width, b.height, LAYOUT_TOKENS.board.cornerRadius);
  glint.setMask(clip.createGeometryMask());
  tl.at(PLAY_SPECIAL.glintAtMs, glint, { x: b.x + b.width + 160 }, PLAY_SPECIAL.glintMs, 'cubicInOut');
  tl.call(PLAY_SPECIAL.glintAtMs + PLAY_SPECIAL.glintMs, () => {
    glint.destroy();
    clip.destroy();
  });
}


/** Khung bia lật sáng một nhịp: viền vàng sáng nhất rồi về kính xanh */
function flashFrame(tl: TransitionTimeline, view: PlayTransitionView): void {
  const b = view.boardBounds;
  const g = view.scene.add.graphics().setDepth(DEPTH_TOKENS.draggingPiece + 1).setAlpha(0);
  g.lineStyle(6, COLOR_NUMBERS.amberGlow, 1);
  g.strokeRoundedRect(b.x - 2, b.y - 2, b.width + 4, b.height + 4, 38);
  // call phải đứng trước tween cùng mốc để tween bắt đầu từ alpha 0.9
  tl.call(PLAY_SPECIAL.flashAtMs, () => {
    view.setFrameGold(false);
    g.setAlpha(0.9);
  });
  tl.at(PLAY_SPECIAL.flashAtMs, g, { alpha: 0 }, PLAY_SPECIAL.flashMs, 'cubicOut');
}
