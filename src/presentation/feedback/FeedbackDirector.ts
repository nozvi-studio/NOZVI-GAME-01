import Phaser from 'phaser';
import type { Level, Piece, PuzzleState } from '../../domain/model.ts';
import { GRID_WIDTH, GRID_HEIGHT } from '../../domain/model.ts';
import { maskCentroid } from '../../domain/mask.ts';
import type { BackgroundScene } from '../scenes/BackgroundScene.ts';
import type { BoardRenderer } from '../board/BoardRenderer.ts';
import { COLOR_NUMBERS, DEPTH_TOKENS, FEEDBACK_TOKENS, VICTORY_TOKENS } from '../designTokens.ts';
import type { Hud } from '../hud/Hud.ts';
import type { LayoutMetrics } from '../board/layout.ts';
import { gridToCanvas, pieceCenterCanvas, pieceRadiusPx } from '../board/layout.ts';
import type { PieceTextureCache } from '../board/PieceTextureCache.ts';
import { lightAlpha } from '../board/pieceMotion.ts';
import type { Pt } from '../board/polygonClip.ts';
import { isReducedMotion, scaleTiming } from '../transitions/motion.ts';
import { TransitionTimeline } from '../transitions/TransitionTimeline.ts';
import { burstAt, planBurst, STARDUST_MAX } from '../transitions/stardust.ts';
import { planVictoryDust, VictoryDust } from './victoryDust.ts';
import type { Poseable } from '../transitions/choreography.ts';
import type { HapticsPort } from '../../infrastructure/haptics.ts';
import { type FeedbackEvent } from './feedbackEvents.ts';
import { matchedPieceCount } from '../../domain/targetMatch.ts';
import { HAPTIC_CUES, playCue } from './hapticCues.ts';
import { perimeterSegment } from './parityDiff.ts';
import { victoryPlan, type VictoryPlan } from './victorySequence.ts';
import type { AudioServices } from '../audio/audioServices.ts';
import { playFeedbackAudio, playVictoryAudio } from './audioCues.ts';
import { getVictoryVerse } from '../i18n.ts';

export type FeedbackDeps = {
  scene: Phaser.Scene;
  level: Level;
  layout: LayoutMetrics;
  board: BoardRenderer;
  hud: Hud;
  textures: PieceTextureCache;
  haptics: HapticsPort;
  audio: AudioServices;
  getState(): PuzzleState;
  background(): BackgroundScene | null;
  getVictoryVerse?: () => string;
};

export type FeedbackDirectorDependencies = FeedbackDeps;

const F = FEEDBACK_TOKENS;
const toGeom = (pts: readonly Pt[]) => pts.map((p) => new Phaser.Geom.Point(p.x, p.y));

/**
 * Chạy phản hồi hình và rung cho từng sự kiện. Mọi hiệu ứng ngắn là một
 * TransitionTimeline riêng, được tick từ PlayScene.update — cùng cơ chế với
 * chuyển cảnh F1, nên Giảm chuyển động và bỏ qua hoạt động giống nhau.
 */
export class FeedbackDirector {
  private readonly deps: FeedbackDeps;
  private effects: TransitionTimeline[] = [];
  private victory: TransitionTimeline | null = null;
  private victoryCleanup: Array<() => void> = [];
  /** Parts the finale faded out, with their alpha before, so a reset can bring them back. */
  private retracted: Array<{ part: Poseable; alpha: number }> = [];
  /** Born as the pieces dissolve, circles the win card, drawn back in with it on Next. */
  private dust: VictoryDust | null = null;

  constructor(deps: FeedbackDeps) {
    this.deps = deps;
  }

  /** `silent` skips the sound only (haptics and visuals still run): the caller has a better sound for this moment. */
  handle(events: readonly FeedbackEvent[], opts: { silent?: boolean } = {}): void {
    if (!opts.silent) playFeedbackAudio(this.deps.audio.sfx, events, this.deps.level);
    for (const event of events) {
      playCue(this.deps.haptics, HAPTIC_CUES[event.type]);
      this.visual(event);
    }
  }

  tick(dtMs: number): void {
    this.dust?.tick(dtMs);
    if (this.victory) {
      this.victory.advance(dtMs);
      if (this.victory.isFinished()) this.victoryCleanup = [];
    }
    for (const tl of this.effects) tl.advance(dtMs);
    this.effects = this.effects.filter((tl) => !tl.isFinished());
  }

  isVictoryRunning(): boolean {
    return this.victory !== null && !this.victory.isFinished();
  }

  /** Chạm khi đang chạy: khung vàng, thẻ hiện, không còn hạt */
  skipVictory(): void {
    if (!this.victory) return;
    this.victory.complete(); // chạy mọi call còn lại: setVictoryMode(true), hiện thẻ
    for (const clean of this.victoryCleanup) clean();
    this.victoryCleanup = [];
  }

  protected fx(): TransitionTimeline {
    const tl = new TransitionTimeline();
    this.effects.push(tl);
    return tl;
  }

  protected piece(id: string): Piece | undefined {
    return this.deps.level.pieces.find((p) => p.id === id);
  }

  private visual(event: FeedbackEvent): void {
    const { board, textures, level } = this.deps;
    const reduced = isReducedMotion();
    switch (event.type) {
      case 'lift': {
        const view = board.getPieceView(event.pieceId);
        view?.cancelGlide();
        view?.setLifted(true, scaleTiming(F.pickupMs), 'anticipateOut');
        if (level.rotationEnabled) {
          const turns = this.deps.getState().pieces[event.pieceId]?.turns ?? 0;
          textures.enqueue(event.pieceId, turns + 1);
        }
        return;
      }
      case 'snap': {
        const piece = this.piece(event.pieceId);
        const view = board.getPieceView(event.pieceId);
        const state = this.deps.getState().pieces[event.pieceId];
        if (!piece || !view || !state) return;
        view.dropLiftNow();
        view.glideTo(board.targetPoseFor(piece, state, level.pieces.indexOf(piece)), scaleTiming(F.snapMs), 'cubicOut');
        if (reduced) return;
        // Landing on the grid is quiet. Only a piece on its target gets the bounce, the light, the ring and the counter pop.
        if (!event.onTarget) return;
        view.play('bounce', F.bounceMs);
        view.play('light', 320, 0.85);
        const target = board.targetPoseFor(piece, state, 0);
        this.snapRing(target, pieceRadiusPx(piece.frameSize, this.deps.layout));
        this.deps.hud.popCounterIcon(matchedPieceCount(level, this.deps.getState()) - 1);
        return;
      }
      case 'settle-temporary':
        board.getPieceView(event.pieceId)?.setLifted(false, scaleTiming(F.dropLiftMs), 'cubicOut');
        return;
      case 'return': {
        const piece = this.piece(event.pieceId);
        const view = board.getPieceView(event.pieceId);
        if (!piece || !view) return;
        view.setLifted(false, scaleTiming(F.returnMs), 'cubicOut');
        view.glideTo(
          board.targetPoseFor(piece, { kind: 'tray', turns: this.deps.getState().pieces[piece.id]?.turns ?? 0 }, level.pieces.indexOf(piece)),
          scaleTiming(F.returnMs),
          'cubicOut'
        );
        return;
      }
      case 'rotate': {
        const view = board.getPieceView(event.pieceId);
        if (!view) return;
        view.setTextures(textures.ensure(event.pieceId, event.turns), event.turns);
        if (!reduced) view.play('spin', F.rotateMs, F.rotateFromDeg);
        textures.enqueue(event.pieceId, event.turns + 1);
        return;
      }
      case 'rotate-blocked': {
        const view = board.getPieceView(event.pieceId);
        if (!reduced) view?.play('shake', F.shakeMs);
        this.flashOutline(event.pieceId);
        return;
      }
      case 'overlap-hollow':
        if (!reduced) for (const layer of event.layers) this.traceEdge(layer);
        return;
      case 'overlap-revive':
        if (!reduced) for (const layer of event.layers) this.reviveFlash(layer);
        return;
      case 'reset':
        this.resetPieces();
        return;
      case 'won':
        this.playVictory();
        return;
    }
  }

  private snapRing(center: { x: number; y: number }, radius: number): void {
    const g = this.deps.scene.add.graphics().setDepth(DEPTH_TOKENS.draggingPiece + 1);
    const s = { r: 0, a: F.snapRingAlpha };
    const draw = () => {
      g.clear();
      g.lineStyle(2, COLOR_NUMBERS.icePrimary, s.a);
      g.strokeCircle(center.x, center.y, s.r);
    };
    const tl = this.fx();
    tl.at(0, s, { r: radius * F.snapRingRadiusRatio, a: 0 }, F.snapRingMs, 'cubicOut', draw);
    tl.call(F.snapRingMs, () => g.destroy());
    tl.advance(0);
  }

  private traceEdge(gridLayer: Pt[]): void {
    const points = gridLayer.map((p) => gridToCanvas(p.x, p.y, this.deps.layout));
    const g = this.deps.scene.add.graphics().setDepth(DEPTH_TOKENS.placedPieces + 2);
    const s = { p: 0 };
    const draw = () => {
      g.clear();
      const seg = perimeterSegment(points, s.p, F.overlapTraceFraction);
      if (seg.length < 2) return;
      g.lineStyle(3 - 2 * s.p, COLOR_NUMBERS.iceHighlight, 1 - s.p);
      g.strokePoints(toGeom(seg), false, false);
    };
    const tl = this.fx();
    tl.at(0, s, { p: 1 }, F.overlapTraceMs, 'linear', draw);
    tl.call(F.overlapTraceMs, () => g.destroy());
    tl.advance(0);
  }

  private reviveFlash(gridLayer: Pt[]): void {
    const pts = gridLayer.map((p) => gridToCanvas(p.x, p.y, this.deps.layout));
    const c = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
    const g = this.deps.scene.add.graphics().setDepth(DEPTH_TOKENS.placedPieces + 2);
    const s = { k: 0 };
    const draw = () => {
      g.clear();
      const len = 18 * lightAlpha(s.k);
      g.lineStyle(2, COLOR_NUMBERS.amberGlow, lightAlpha(s.k));
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        g.lineBetween(c.x, c.y, c.x + Math.cos(a) * len, c.y + Math.sin(a) * len);
      }
    };
    const tl = this.fx();
    tl.at(0, s, { k: 1 }, F.reviveFlashMs, 'linear', draw);
    tl.call(F.reviveFlashMs, () => g.destroy());
    tl.advance(0);
  }

  /** Nháy viền ice-white khi xoay bị chặn; giữ cả khi Giảm chuyển động */
  private flashOutline(pieceId: string): void {
    const piece = this.piece(pieceId);
    const view = this.deps.board.getPieceView(pieceId);
    const pose = view?.currentPose();
    if (!piece || !pose) return;
    const turns = this.deps.getState().pieces[pieceId]?.turns ?? 0;
    const pts = this.deps.board.canvasPolygonAt(piece, turns, pose);
    const g = this.deps.scene.add.graphics().setDepth(DEPTH_TOKENS.draggingPiece + 1);
    const s = { a: 0 };
    const draw = () => {
      g.clear();
      g.lineStyle(3, COLOR_NUMBERS.iceHighlight, s.a);
      g.strokePoints(toGeom(pts), true, true);
    };
    const half = Math.min(F.shakeMs / 2, F.reducedFadeMaxMs / 2);
    const tl = this.fx();
    tl.at(0, s, { a: F.blockedFlashAlpha }, half, 'linear', draw);
    tl.at(half, s, { a: 0 }, half, 'linear', draw);
    tl.call(half * 2, () => g.destroy());
    tl.advance(0);
  }

  /** Đặt lại: mảnh trên bia bay về khay so le 40 ms; vùng giao mờ trong 120 ms */
  private resetPieces(): void {
    const { board, level } = this.deps;
    board.fadeOutParity(F.resetOverlapFadeMs);
    let k = 0;
    level.pieces.forEach((piece, index) => {
      const view = board.getPieceView(piece.id);
      const pose = view?.currentPose();
      if (!view || !pose) return;
      const tray = board.targetPoseFor(piece, { kind: 'tray', turns: 0 }, index);
      if (Math.hypot(pose.x - tray.x, pose.y - tray.y) < 1) return;
      view.setLifted(false, 0, 'linear');
      view.glideTo(tray, scaleTiming(F.resetMs), 'cubicOut', scaleTiming(F.resetStaggerMs * k));
      k++;
    });
  }

  playVictory(): void {
    const { scene, board, hud, level } = this.deps;
    const plan = victoryPlan(level.pieces.length, isReducedMotion());
    const tl = new TransitionTimeline();
    this.victory = tl;
    // Clean-up first: nothing a piece draws outside the lit area survives into the merge.
    board.setVictoryClip(this.deps.getState().pieces);

    if (plan.skyDim) {
      const dim = plan.skyDim;
      tl.call(dim.atMs, () => this.deps.background()?.deepen(dim.extra, dim.ms));
    }
    // Khi nổ burst chào mừng chiến thắng: bầu trời thắp sáng bừng lên và sao trôi tương tác
    tl.call(plan.burstAtMs, () => this.deps.background()?.celebrateVictory(1000));

    level.pieces.forEach((piece, i) => {
      const start = plan.lightStartsMs[i];
      if (start === undefined) return;
      tl.call(start, () => board.getPieceView(piece.id)?.play('light', plan.lightMs, plan.lightPeak));
    });

    if (plan.traceMs > 0) {
      // The light runs along the figure's real edge, so it never crosses an area that vanished.
      for (const chain of board.finalOutline(this.deps.getState().pieces)) {
        // An open chain goes out and back, so wrapping round never draws a chord across the gap.
        const pts = chain.closed ? chain.points : [...chain.points, ...chain.points.slice(1, -1).reverse()];
        const g = scene.add.graphics().setDepth(DEPTH_TOKENS.draggingPiece + 1);
        this.victoryCleanup.push(() => g.destroy());
        const s = { p: 0 };
        const draw = () => {
          g.clear();
          const seg = perimeterSegment(pts, s.p, 0.3);
          if (seg.length < 2) return;
          g.lineStyle(3, COLOR_NUMBERS.amberGlow, 1 - s.p);
          g.strokePoints(toGeom(seg), false, false);
        };
        tl.at(plan.traceAtMs, s, { p: 1 }, plan.traceMs, 'cubicInOut', draw);
        tl.call(plan.traceAtMs + plan.traceMs, () => g.destroy());
      }
    }

    tl.call(plan.burstAtMs, () => {
      this.deps.haptics.notify('success');
      playVictoryAudio(this.deps.audio, level);
      if (plan.cameraFlash) scene.cameras.main.flash(VICTORY_TOKENS.flashMs, 249, 199, 79, false);
    });
    if (plan.rings || plan.particles > 0) this.burst(tl, plan);

    this.retractPieces(tl, plan);
    hud.playWinDim(tl, plan);

    const gold = board.getGoldFrame();
    if (gold) tl.at(plan.frameAtMs, gold, { alpha: 1 }, plan.frameMs, 'sineInOut');
    for (const part of board.getTrayParts()) tl.at(plan.frameAtMs, part, { alpha: 0 }, plan.trayFadeMs, 'linear');
    tl.call(plan.frameAtMs + Math.max(plan.frameMs, plan.trayFadeMs), () => board.setVictoryMode(true));

    const verse = this.deps.getVictoryVerse
      ? this.deps.getVictoryVerse()
      : getVictoryVerse(level.id, level.victoryVerse);
    hud.playWinCard(tl, plan, verse);
    tl.advance(0);
  }

  /** The solved pieces and the target silhouette draw in to the middle of the board once they have flashed. */
  private retractPieces(tl: TransitionTimeline, plan: VictoryPlan): void {
    const parts = this.retractableParts();
    this.retracted = parts.map((part) => ({ part, alpha: part.alpha }));
    const { board, level } = this.deps;
    const block = plan.mergeMs > 0 ? board.createMergedBlock(this.deps.getState().pieces) : null;
    if (block) {
      // Each piece's part of the block is painted in as that piece's light passes, so the material
      // covers the seams one by one. When the last has lit, the pieces underneath fade away and the
      // block unifies: a swell and a sweep of light with sparkles. Then it draws in with the retract.
      const reveal = level.pieces.map(() => ({ v: 0 }));
      const sheen = { p: -0.25 };
      const redraw = () => board.setMergedProgress(reveal.map((r) => r.v), sheen.p);
      level.pieces.forEach((piece, i) => {
        const start = plan.lightStartsMs[i];
        if (start === undefined) return;
        tl.at(start, reveal[i], { v: 1 }, plan.paintMs, 'sineInOut', redraw);
        // The piece itself dissolves behind the wipe instead of vanishing: it follows the paint with
        // a short lag, so the material seems to take its place.
        const view = board.getPieceView(piece.id);
        if (view) tl.at(start + plan.paintMs * 0.3, view.offset, { alpha: 0 }, plan.paintMs * 0.7, 'sineInOut');
      });
      for (const part of parts) tl.at(plan.mergeAtMs, part, { alpha: 0 }, plan.mergeMs, 'cubicInOut');
      tl.at(plan.mergeAtMs, sheen, { p: 1.2 }, plan.unifyMs, 'sineInOut', redraw);
      tl.at(plan.mergeAtMs, block, { scaleX: 1.05, scaleY: 1.05 }, plan.unifyMs * 0.4, 'cubicOut');
      tl.at(plan.mergeAtMs + plan.unifyMs * 0.4, block, { scaleX: 1, scaleY: 1 }, plan.unifyMs * 0.6, 'sineInOut');
      tl.at(plan.retractAtMs, block, { alpha: 0, scaleX: 0.55, scaleY: 0.55 }, plan.retractMs, 'cubicInOut');
    } else {
      for (const part of parts) tl.at(plan.retractAtMs, part, { alpha: 0 }, plan.retractMs, 'cubicInOut');
    }
    if (!plan.retractDust) return;

    const dust = this.createDust();
    if (!dust) return;
    // The same cloud gathers where the pieces were, then spreads around the card as it rises.
    tl.at(plan.retractAtMs, dust.stage, { gather: 1 }, plan.retractMs, 'cubicInOut', () => dust.draw());
    tl.at(plan.cardAtMs, dust.stage, { emerge: 1 }, plan.cardMs, 'cubicOut', () => dust.draw());
  }

  private createDust(): VictoryDust | null {
    const { scene, level, layout, hud } = this.deps;
    this.dust?.destroy();
    const state = this.deps.getState();
    const sources = level.pieces.flatMap((piece) => {
      const s = state.pieces[piece.id];
      if (!s || s.kind !== 'snapped') return [];
      const anchor = piece.anchors.find((a) => a.id === s.anchorId);
      return anchor ? [pieceCenterCanvas(piece.frameSize, anchor.x, anchor.y, layout)] : [];
    });
    const specs = planVictoryDust(sources.length > 0 ? sources : [{ x: 360, y: layout.designHeight / 2 }], STARDUST_MAX);
    const b = layout.boardBounds;
    this.dust = new VictoryDust(scene, specs, { center: { x: b.x + b.width / 2, y: b.y + b.height / 2 }, card: hud.winCardOrbit() });
    return this.dust;
  }

  /** The win card is drawing in: pull the circling dust to its centre over `ms`. */
  collapseDust(ms: number): void {
    this.dust?.collapse(ms);
  }

  private retractableParts(): Poseable[] {
    const parts = this.deps.board.getTransitionParts();
    return [...parts.pieces, ...parts.targets];
  }

  /** Restoring a level that is already won: skip the show and land on the finale's last frame. */
  restoreVictoryEnd(): void {
    this.retracted = this.retractableParts().map((part) => ({ part, alpha: part.alpha }));
    for (const part of this.retractableParts()) part.alpha = 0;
    if (!isReducedMotion()) this.createDust()?.settle();
  }

  private burst(tl: TransitionTimeline, plan: VictoryPlan): void {
    const { scene, level, layout } = this.deps;
    const centroid = maskCentroid(level.targetMask) ?? { x: GRID_WIDTH / 2, y: GRID_HEIGHT / 2 };
    const c = gridToCanvas(centroid.x, centroid.y, layout);
    const g = scene.add.graphics().setDepth(90);
    this.victoryCleanup.push(() => g.destroy());
    const particles = planBurst(c, plan.particles);
    const s = { r1: 10, a1: 0, r2: 10, a2: 0, t: 0 };
    const draw = () => {
      g.clear();
      if (s.a1 > 0) { g.lineStyle(2.5, COLOR_NUMBERS.amberSolid, s.a1); g.strokeCircle(c.x, c.y, s.r1); }
      if (s.a2 > 0) { g.lineStyle(1.8, COLOR_NUMBERS.icePrimary, s.a2); g.strokeCircle(c.x, c.y, s.r2); }
      for (const p of particles) {
        const d = burstAt(p, s.t);
        if (d.alpha <= 0) continue;
        g.fillStyle(p.color, d.alpha);
        g.fillCircle(d.x, d.y, d.radius);
      }
    };
    const T = VICTORY_TOKENS;
    if (plan.rings) {
      tl.call(plan.burstAtMs, () => { s.a1 = 0.9; });
      tl.at(plan.burstAtMs, s, { r1: 160, a1: 0 }, T.ringMs, 'cubicOut', draw);
      tl.call(plan.burstAtMs + T.ringGapMs, () => { s.a2 = 0.8; });
      tl.at(plan.burstAtMs + T.ringGapMs, s, { r2: 180, a2: 0 }, T.ringMs, 'cubicOut', draw);
    }
    if (particles.length > 0) tl.at(plan.burstAtMs, s, { t: 1 }, plan.particleMs, 'cubicOut', draw);
    tl.call(plan.burstAtMs + Math.max(plan.particleMs, T.ringGapMs + T.ringMs), () => g.destroy());
  }

  /** Đặt lại từ thẻ thắng: thẻ và khung chạy ngược 300 ms (≤ 150 khi Giảm chuyển động) rồi mới đặt lại */
  unwindVictory(onDone: () => void): void {
    if (this.victory && !this.victory.isFinished()) this.skipVictory();
    this.victory = null;
    const { board, hud } = this.deps;
    for (const { part, alpha } of this.retracted) part.alpha = alpha;
    this.retracted = [];
    this.dust?.destroy();
    this.dust = null;
    this.deps.board.clearMergedBlock();
    this.deps.board.clearVictoryClip();
    const ms = isReducedMotion() ? VICTORY_TOKENS.reducedMs : VICTORY_TOKENS.unwindMs;
    const tl = this.fx();
    board.setTrayVisible(true, 0);
    hud.unwindWinCard(tl, ms);
    const gold = board.getGoldFrame();
    if (gold) tl.at(0, gold, { alpha: 0 }, ms, 'sineInOut');
    for (const part of board.getTrayParts()) tl.at(0, part, { alpha: 1 }, ms, 'linear');
    tl.call(ms, () => {
      board.setVictoryMode(false);
      onDone();
    });
    tl.advance(0);
  }
}
