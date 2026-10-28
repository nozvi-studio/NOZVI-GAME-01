import Phaser from 'phaser';
import { arePiecesEquivalent } from '../../domain/pieceEquivalence.ts';
import type { Level, Piece, PieceState } from '../../domain/model.ts';
import type { CanvasPoint, LayoutMetrics } from './layout.ts';
import {
  pieceBoardOrigin,
  pieceCenterCanvas,
  largestFrameSize,
  pieceHitbox,
  piecePolygonAround,
  piecePolygonCanvas,
  pieceRadiusPx,
  trayPieceRadiusPx,
  trayRelativeSize,
  trayWellRects,
} from './layout.ts';
import { GridPainter } from './GridPainter.ts';
import { drawJewelPolygon, drawSparkle, strokeTargetSegment } from './JewelShape.ts';
import {
  gradientColor,
  lightAxis,
  regionBounds,
  shadeStrips,
  sheenBand,
  sparkleSpots,
  twinkle,
  type Bounds,
} from './mergedShading.ts';
import { clipConvex, oddRegions, outlineChains, parityOutline, pointInLoop, type OutlineChain, type ParityLayer } from './polygonClip.ts';
import { nudgeAlpha, nudgeOffset } from './idleNudge.ts';
import type { PlayViewSnapshot } from '../../application/playController.ts';
import { COLOR_NUMBERS, DEPTH_TOKENS, FEEDBACK_TOKENS, PIECE_TOKENS } from '../designTokens.ts';
import { TEXTURE_KEYS } from '../TextureFactory.ts';
import { getMotionScale, isReducedMotion } from '../transitions/motion.ts';
import type { Poseable } from '../transitions/choreography.ts';
import { PieceView } from './PieceView.ts';
import type { PieceTextureSource } from './PieceTextureCache.ts';
import { ALL_ASSIST, type SnapAssist } from './snapAssist.ts';
import { POSE_TAU, anchorCenter, magnetRing, pieceTargetPose, stepScalar } from './pieceMotion.ts';
import type { Pose } from './pieceMotion.ts';
import { diffLayers, overlapLayers } from '../feedback/parityDiff.ts';
import { computeDragParityLayers } from './dragParity.ts';
import { linkRelated, linkRole } from '../../domain/linkedRotation.ts';

/** First overlap depth whose hole cuts a flat fill (4 pieces stacked), and the first fill that sits above such a hole. */
const DEEP_HOLE_DEPTH = 4;
const DEEP_FILL_DEPTH = 5;
/** Width of the bright edge of the paint wipe, in light-axis units (0 to 1 across the figure). */
const PAINT_SOFT = 0.12;

export type BoardTransitionParts = {
  board: Poseable[];
  runes: Poseable[];
  rings: Poseable[];
  tray: Poseable[];
  trayPieces: Poseable[];
  pieces: Poseable[];
  targets: Poseable[];
  grid: Phaser.GameObjects.RenderTexture | null;
};

const DEPTH_FOR: Record<'tray' | 'snapped' | 'temporary' | 'dragging', number> = {
  tray: DEPTH_TOKENS.placedPieces,
  snapped: DEPTH_TOKENS.placedPieces,
  temporary: DEPTH_TOKENS.temporaryPieces,
  dragging: DEPTH_TOKENS.draggingPiece,
};

export class BoardRenderer {
  private readonly scene: Phaser.Scene;
  private readonly layout: LayoutMetrics;
  private readonly level: Level;
  private readonly textures: PieceTextureSource;
  private readonly trayCount: number;
  /** Largest frameSize in the level: the tray draws every piece at one shared scale against it. */
  private readonly trayRefFrame: number;

  private readonly ringGraphics: Phaser.GameObjects.Graphics;
  private readonly targetGraphics: Phaser.GameObjects.Graphics;
  private readonly placeholderGraphics: Phaser.GameObjects.Graphics;
  private readonly parityGraphics: Phaser.GameObjects.Graphics;
  private readonly parityIncomingGraphics: Phaser.GameObjects.Graphics;
  private readonly parityFadeGraphics: Phaser.GameObjects.Graphics;
  private readonly previewGraphics: Phaser.GameObjects.Graphics;
  private readonly magnetRingGraphics: Phaser.GameObjects.Graphics;
  private readonly temporaryGraphics: Phaser.GameObjects.Graphics;
  private readonly dragParityGraphics: Phaser.GameObjects.Graphics;
  private readonly fxGraphics: Phaser.GameObjects.Graphics;
  /** Unseen shape of every hollow (even-parity) region; inverted mask that cuts the jewels. */
  private readonly holeShape: Phaser.GameObjects.Graphics;
  private readonly holeMask: Phaser.Display.Masks.GeometryMask;
  private readonly glowGraphics: Phaser.GameObjects.Graphics;
  /**
   * Holes of depth 4 and deeper. The amber fill of a 3-deep region is a flat layer painted over the
   * jewels, so the 4-deep hole inside it has to be cut out of that fill too (a hole at depth 2 is
   * already cut out of the jewels, and no fill lies under it).
   */
  private readonly deepHoleShape: Phaser.GameObjects.Graphics;
  private readonly deepHoleMask: Phaser.Display.Masks.GeometryMask;
  /** Fills of depth 5 and deeper sit above the deep holes, so they are drawn here unmasked. */
  private readonly deepFillGraphics: Phaser.GameObjects.Graphics;
  private holesMasked = false;
  private deepMasked = false;
  private glow = 0;
  private dragHollow: ParityLayer[] = [];
  private dragDeepFill: ParityLayer[] = [];
  private dragParityHasContent = false;

  private gridTexture: Phaser.GameObjects.RenderTexture | null = null;
  private boardSurface: Phaser.GameObjects.Image | null = null;
  private boardFrame: Phaser.GameObjects.Image | null = null;
  private goldFrame: Phaser.GameObjects.Image | null = null;
  private boardBase: Phaser.GameObjects.Container | null = null;
  private boardTop: Phaser.GameObjects.Container | null = null;
  private runes: Phaser.GameObjects.Arc[] = [];
  private trayWells: Phaser.GameObjects.Image[] = [];
  private trayFrame: Phaser.GameObjects.Image | null = null;

  private readonly views = new Map<string, PieceView>();
  private ring1Angle = 0;
  private ring2Angle = 0;
  private victoryPulse = 0;

  private targetReveal: readonly number[] | null = null;
  private readonly assist: SnapAssist;
  private hoverAlpha: number[];
  private targetKey = '';
  /** Beat progress of the idle nudge in [0, 1), or null while it is not running. */
  private idlePhase: number | null = null;
  /** Which beat of the idle nudge this is; beat n goes to the n-th piece (wrapping). */
  private idleBeat = 0;
  /** Outline and lit regions of the visible target, reused while the visible set is unchanged. */
  private targetShape: { key: string; segments: ReturnType<typeof parityOutline>; lit: CanvasPoint[][] } | null = null;
  private staticKey = '';
  private previewKey = '';
  private parityKey = '';
  private currentParity: ParityLayer[] = [];
  private incoming: { alpha: number } | null = null;
  private parityFade: { alpha: number; ms: number } | null = null;
  private lastSnapshot: PlayViewSnapshot | null = null;
  private lastPieces: Readonly<Record<string, PieceState>> = {};
  /** The solved figure as one block, built for the victory finale (see `createMergedBlock`). */
  private mergeGraphics: Phaser.GameObjects.Graphics | null = null;
  private mergeLook: {
    origin: CanvasPoint;
    fragments: Array<{ index: number; strips: ReturnType<typeof shadeStrips>; from: number; to: number }>;
    regions: CanvasPoint[][];
    outline: OutlineChain[];
    bounds: Bounds;
    spots: ReturnType<typeof sparkleSpots>;
    spark: number;
  } | null = null;
  /** While the victory clean-up is on, the pieces are clipped to the lit area instead of hole-masked. */
  private victoryClip: { shape: Phaser.GameObjects.Graphics; mask: Phaser.Display.Masks.GeometryMask } | null = null;

  constructor(scene: Phaser.Scene, layout: LayoutMetrics, level: Level, textures: PieceTextureSource, assist: SnapAssist = ALL_ASSIST) {
    this.assist = assist;
    this.scene = scene;
    this.layout = layout;
    this.level = level;
    this.textures = textures;
    this.trayCount = level.pieces.length;
    this.trayRefFrame = largestFrameSize(level.pieces);
    this.hoverAlpha = (level.targetPlacements ?? []).map(() => FEEDBACK_TOKENS.targetIdleAlpha);

    this.ringGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.celestialRings);
    this.targetGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.targetSilhouette);
    this.placeholderGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.placedPieces);
    // Giao chẵn/lẻ phủ lên mảnh đã snap và cả mảnh tạm (temporary); mảnh đang kéo luôn nằm trên.
    this.parityGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.temporaryPieces + 1);
    this.parityIncomingGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.temporaryPieces + 1);
    this.parityFadeGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.temporaryPieces + 1);
    this.previewGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.placedPieces + 2);
    // Below the dragged piece: the ring is tier 2, the piece stays tier 3.
    this.magnetRingGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.placedPieces + 2);
    this.temporaryGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.temporaryPieces);
    this.dragParityGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.draggingPiece + 1);
    this.fxGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.draggingPiece + 2);
    this.deepFillGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.draggingPiece + 1);
    this.glowGraphics = scene.add.graphics().setDepth(DEPTH_TOKENS.draggingPiece + 1);
    this.deepHoleShape = scene.make.graphics({ x: 0, y: 0 }, false);
    this.deepHoleMask = this.deepHoleShape.createGeometryMask();
    this.deepHoleMask.setInvertAlpha(true);
    this.holeShape = scene.make.graphics({ x: 0, y: 0 }, false);
    this.holeMask = this.holeShape.createGeometryMask();
    this.holeMask.setInvertAlpha(true);

    this.drawStaticBoard();
    for (const piece of level.pieces) this.views.set(piece.id, new PieceView(scene));
  }

  public drawStaticBoard(): void {
    const { boardBounds, trayBounds } = this.layout;
    const cx = boardBounds.x + boardBounds.width / 2;
    const cy = boardBounds.y + boardBounds.height / 2;
    const left = -boardBounds.width / 2;
    const top = -boardBounds.height / 2;

    // Bia chia ba lớp quanh tâm (360, 600) để co giãn quanh tâm khi chuyển cảnh:
    // đế (mặt bàn) < lưới (RenderTexture) < nắp (rune + khung kính).
    if (!this.boardBase) {
      this.boardSurface = this.scene.add.image(left, top, TEXTURE_KEYS.boardSurface).setOrigin(0, 0);
      this.boardBase = this.scene.add
        .container(cx, cy, [this.boardSurface])
        .setDepth(DEPTH_TOKENS.steleBoard);
    }

    if (!this.gridTexture) {
      this.gridTexture = GridPainter.paint(this.scene, boardBounds)
        .setOrigin(0.5, 0.5)
        .setPosition(cx, cy);
    }

    if (!this.boardTop) {
      // 4 rune phương vị theo thứ tự Bắc, Đông, Nam, Tây (thứ tự sáng lên)
      const inset = 24;
      this.runes = [
        [0, top + inset],
        [-left - inset, 0],
        [0, -top - inset],
        [left + inset, 0],
      ].map(([x, y]) => this.scene.add.circle(x, y, 3, COLOR_NUMBERS.gridModule, 0.45));
      this.boardFrame = this.scene.add.image(left, top, TEXTURE_KEYS.glassFrameBoard).setOrigin(0, 0);
      this.goldFrame = this.scene.add.image(left, top, TEXTURE_KEYS.goldFrameBoard).setOrigin(0, 0).setAlpha(0);
      this.boardTop = this.scene.add
        .container(cx, cy, [...this.runes, this.boardFrame, this.goldFrame])
        .setDepth(DEPTH_TOKENS.boardGrid + 1);
      this.trayFrame = this.scene.add
        .image(trayBounds.x, trayBounds.y, TEXTURE_KEYS.glassFrameTray)
        .setOrigin(0, 0)
        .setDepth(DEPTH_TOKENS.trayArea);
    }

    if (this.trayWells.length === 0) {
      for (const rect of trayWellRects(this.layout, this.trayCount)) {
        this.trayWells.push(
          this.scene.add
            .image(rect.x, rect.y, TEXTURE_KEYS.trayWell)
            .setOrigin(0, 0)
            .setDisplaySize(rect.width, rect.height)
            .setDepth(DEPTH_TOKENS.steleBoard)
        );
      }
    }
  }

  /** Gọi mỗi khung hình từ PlayScene.update */
  public tick(dtMs: number, snapshot: PlayViewSnapshot, pieces: Readonly<Record<string, PieceState>>): void {
    this.lastSnapshot = snapshot;
    this.lastPieces = pieces;
    const reduced = isReducedMotion();
    const dragId = snapshot.dragInfo?.pieceId ?? null;
    this.updateCelestialRings(dtMs, snapshot.phase === 'won');
    this.syncTargets(dtMs, snapshot, reduced);
    this.syncPieceViews(dtMs, snapshot, pieces, reduced);
    this.syncStaticOverlays(dragId, pieces);
    this.syncParity(dtMs, dragId, pieces);
    this.syncPreview(snapshot, pieces);
    this.syncMagnetRing(snapshot, pieces);
    this.syncDragParity(snapshot, pieces);
    this.syncOverlapHoles(dtMs, snapshot, reduced);
    this.fxGraphics.clear();
    if (snapshot.phase === 'won') {
      this.victoryPulse += dtMs * 0.004 * getMotionScale();
      this.drawVictoryPulse();
    }
  }

  /** Giữ chữ ký cũ cho test: vẽ ngay một khung không trôi thời gian */
  public render(_level: Level, snapshot: PlayViewSnapshot, pieces: Readonly<Record<string, PieceState>>): void {
    this.tick(0, snapshot, pieces);
  }

  public getPieceView(id: string): PieceView | undefined {
    return this.views.get(id);
  }

  public targetPoseFor(piece: Piece, state: PieceState, trayIndex: number): Pose {
    return pieceTargetPose(piece, state, {
      layout: this.layout,
      trayIndex,
      trayCount: this.trayCount,
      trayRefFrame: this.trayRefFrame,
      selected: false,
      showTarget: false,
      drag: null,
    });
  }

  public canvasPolygonAt(piece: Piece, turns: number, pose: Pose): CanvasPoint[] {
    return piecePolygonAround(piece, turns, pose.x, pose.y, piece.frameSize * this.layout.cellPixel * pose.scale);
  }

  public getGoldFrame(): Phaser.GameObjects.Image | null {
    return this.goldFrame;
  }

  public getTrayParts(): Poseable[] {
    return [this.trayFrame, ...this.trayWells].filter((x): x is Phaser.GameObjects.Image => x !== null);
  }

  public setTrayVisible(visible: boolean, alpha: number): void {
    for (const part of this.getTrayParts() as Phaser.GameObjects.Image[]) part.setVisible(visible).setAlpha(alpha);
  }

  public setFrameGold(on: boolean): void {
    this.goldFrame?.setAlpha(on ? 1 : 0);
  }

  public setVictoryMode(on: boolean): void {
    this.setFrameGold(on);
    this.setTrayVisible(!on, 1);
  }

  /** Đặt lại: bản sao vùng giao hiện tại mờ dần trong `ms` */
  public fadeOutParity(ms: number): void {
    this.parityFadeGraphics.clear();
    this.drawLayers(this.parityFadeGraphics, this.currentParity);
    this.parityFadeGraphics.setAlpha(1);
    this.parityFade = { alpha: 1, ms: Math.max(1, ms) };
  }

  /** Idle nudge beat from PlayScene: unplaced pieces sway and the outline breathes. `null` = rest. */
  public setIdleNudge(phase: number | null, beat = 0): void {
    this.idlePhase = phase;
    this.idleBeat = beat;
  }

  public setTargetReveal(values: readonly number[] | null): void {
    this.targetReveal = values;
    if (this.lastSnapshot) this.drawTargetSilhouette(this.lastSnapshot);
  }

  public getTransitionParts(): BoardTransitionParts {
    const present = <T>(items: Array<T | null | undefined>): T[] =>
      items.filter((item): item is T => item !== null && item !== undefined);
    const offsets = this.level.pieces.map((p) => this.views.get(p.id)!.offset);
    return {
      board: present<Poseable>([this.boardBase, this.gridTexture, this.boardTop]),
      runes: [...this.runes],
      rings: [this.ringGraphics],
      tray: this.getTrayParts(),
      trayPieces: offsets,
      pieces: [
        ...offsets,
        this.parityGraphics,
        this.parityIncomingGraphics,
        this.previewGraphics,
        this.magnetRingGraphics,
        this.temporaryGraphics,
        this.dragParityGraphics,
        this.deepFillGraphics,
        this.glowGraphics,
        this.fxGraphics,
      ],
      targets: [this.targetGraphics, this.placeholderGraphics],
      grid: this.gridTexture,
    };
  }

  public updateCelestialRings(delta: number, isWon: boolean): void {
    const speedMult = (isWon ? 3.0 : 1.0) * getMotionScale();
    this.ring1Angle += delta * 0.0003 * speedMult;
    this.ring2Angle -= delta * 0.0002 * speedMult;

    const { boardBounds } = this.layout;
    const cx = boardBounds.x + boardBounds.width / 2;
    const cy = boardBounds.y + boardBounds.height / 2;

    this.ringGraphics.clear();

    // Vòng 1: Viền xanh cyan dạ quang nét mảnh
    this.ringGraphics.lineStyle(1.5, COLOR_NUMBERS.icePrimary, 0.28);
    this.ringGraphics.strokeCircle(cx, cy, 380);

    // Đốm sáng trên vòng 1
    const p1X = cx + Math.cos(this.ring1Angle) * 380;
    const p1Y = cy + Math.sin(this.ring1Angle) * 380;
    this.ringGraphics.fillStyle(COLOR_NUMBERS.iceHighlight, 0.6);
    this.ringGraphics.fillCircle(p1X, p1Y, 4);

    // Vòng 2: Viền vàng hổ phách đứt nét
    this.ringGraphics.lineStyle(1.2, COLOR_NUMBERS.gridModule, 0.22);
    this.ringGraphics.strokeCircle(cx, cy, 410);

    // Đốm sáng trên vòng 2
    const p2X = cx + Math.cos(this.ring2Angle) * 410;
    const p2Y = cy + Math.sin(this.ring2Angle) * 410;
    this.ringGraphics.fillStyle(COLOR_NUMBERS.amberSolid, 0.55);
    this.ringGraphics.fillCircle(p2X, p2Y, 3.5);
  }

  private syncPieceViews(
    dtMs: number,
    snapshot: PlayViewSnapshot,
    pieces: Readonly<Record<string, PieceState>>,
    reduced: boolean
  ): void {
    const drag = snapshot.dragInfo;
    // Every piece (tray, temporary or on the board) takes a turn: beat n nudges the n-th of them.
    const waiting = this.level.pieces.filter((p) => drag?.pieceId !== p.id);
    const nudged = waiting.length > 0 ? waiting[this.idleBeat % waiting.length].id : null;
    this.level.pieces.forEach((piece, index) => {
      const view = this.views.get(piece.id)!;
      const state = pieces[piece.id] ?? { kind: 'tray', turns: 0 };
      if (view.turns() !== state.turns) {
        const keys = this.textures.keys(piece.id, state.turns);
        if (!keys) return; // chưa vẽ xong: ẩn tới khung sau
        view.setTextures(keys, state.turns);
      }
      view.setLinkMark(linkRole(this.level, piece.id), linkRelated(this.level, snapshot.selectedPieceId, piece.id));
      const dragging = drag !== null && drag.pieceId === piece.id;
      const target = pieceTargetPose(piece, state, {
        layout: this.layout,
        trayIndex: index,
        trayCount: this.trayCount,
        trayRefFrame: this.trayRefFrame,
        selected: snapshot.selectedPieceId === piece.id,
        showTarget: snapshot.showTarget,
        drag: dragging
          ? {
              x: drag.x,
              y: drag.y,
              candidate: drag.snapCandidateId ? anchorCenter(piece, drag.snapCandidateId, this.layout) : null,
            }
          : null,
      });
      // Only the piece whose turn it is sways; the smoothing in view.update softens it.
      if (!reduced && piece.id === nudged) {
        const sway = nudgeOffset(this.idlePhase);
        target.x += sway.x;
        target.y += sway.y;
        target.angle += sway.angleDeg;
      }
      view.setDepth(DEPTH_FOR[dragging ? 'dragging' : state.kind === 'temporary' ? 'temporary' : 'snapped']);
      const tau = POSE_TAU[dragging ? 'dragging' : state.kind === 'temporary' ? 'settling' : 'idle'];
      view.update(dtMs, target, tau, { dragging, reduced });
    });
  }

  /** Ô chờ trong khay khi kéo từ khay, và chấm chú thích trên mảnh tạm */
  private syncStaticOverlays(dragId: string | null, pieces: Readonly<Record<string, PieceState>>): void {
    const key = `${dragId}|${JSON.stringify(pieces)}`;
    if (key === this.staticKey) return;
    this.staticKey = key;
    this.placeholderGraphics.clear();
    this.temporaryGraphics.clear();
    this.level.pieces.forEach((piece, index) => {
      const state = pieces[piece.id] ?? { kind: 'tray', turns: 0 };
      if (piece.id === dragId && state.kind === 'tray') {
        const hit = pieceHitbox(piece, state, this.layout, index, this.trayCount);
        // Same shared scale as the piece in the tray, so the placeholder is as big as the piece was.
        const radius = trayPieceRadiusPx(this.layout, this.trayCount) * trayRelativeSize(piece.frameSize, this.trayRefFrame);
        drawJewelPolygon(
          this.placeholderGraphics,
          piecePolygonAround(piece, state.turns, hit.x + hit.width / 2, hit.y + hit.height / 2, radius * 2),
          { variant: 'placeholder', sizePx: radius }
        );
      }
      if (state.kind === 'temporary' && piece.id !== dragId) {
        const radiusPx = pieceRadiusPx(piece.frameSize, this.layout);
        const center = pieceCenterCanvas(piece.frameSize, state.x, state.y, this.layout);
        this.temporaryGraphics.lineStyle(1, COLOR_NUMBERS.textSecondary, 0.4);
        this.temporaryGraphics.strokeCircle(center.x, center.y - radiusPx - 14, 4);
      }
    });
  }

  private boardEntries(
    dragId: string | null,
    pieces: Readonly<Record<string, PieceState>>
  ): Array<{ piece: Piece; state: Extract<PieceState, { kind: 'snapped' | 'placed' | 'temporary' }> }> {
    return this.level.pieces.flatMap((piece) => {
      const state = pieces[piece.id];
      return state && (state.kind === 'snapped' || state.kind === 'placed' || state.kind === 'temporary') && piece.id !== dragId
        ? [{ piece, state }]
        : [];
    });
  }

  private canvasPolygons(entries: readonly { piece: Piece; state: PieceState }[]): CanvasPoint[][] {
    return entries.flatMap(({ piece, state }) => {
      const origin = pieceBoardOrigin(piece, state);
      return origin ? [piecePolygonCanvas(piece, origin.x, origin.y, state.turns, this.layout)] : [];
    });
  }

  /**
   * Vùng giao: lớp cũ vẽ ngay, lớp mới mờ dần trong overlapFadeMs (giữ cả khi
   * Giảm chuyển động vì ≤ 150 ms là đổi màu, không phải chuyển động).
   */
  private syncParity(dtMs: number, dragId: string | null, pieces: Readonly<Record<string, PieceState>>): void {
    const entries = this.boardEntries(dragId, pieces);
    const key = entries.map(({ piece, state }) => {
      const anchorOrPos = state.kind === 'snapped' ? state.anchorId : `${state.x},${state.y}`;
      return `${piece.id}:${anchorOrPos}:${state.turns}`;
    }).join('|');
    const parityAlpha = this.lastSnapshot?.showTarget ? FEEDBACK_TOKENS.eyeResultAlpha : 1;
    if (key !== this.parityKey) {
      this.parityKey = key;
      const next = overlapLayers(this.canvasPolygons(entries));
      const { kept, added } = diffLayers(this.currentParity, next);
      this.currentParity = next;
      this.parityGraphics.clear();
      this.drawLayers(this.parityGraphics, kept, parityAlpha);
      this.parityIncomingGraphics.clear();
      if (added.length > 0) {
        this.drawLayers(this.parityIncomingGraphics, added, parityAlpha);
        this.incoming = { alpha: 0 };
        this.parityIncomingGraphics.setAlpha(0);
      } else {
        this.incoming = null;
      }
    }
    if (this.incoming) {
      this.incoming.alpha = Math.min(1, this.incoming.alpha + dtMs / FEEDBACK_TOKENS.overlapFadeMs);
      this.parityIncomingGraphics.setAlpha(this.incoming.alpha);
      if (this.incoming.alpha >= 1) {
        this.parityGraphics.clear();
        this.drawLayers(this.parityGraphics, this.currentParity, parityAlpha);
        this.parityIncomingGraphics.clear();
        this.incoming = null;
      }
    }
    if (this.parityFade) {
      this.parityFade.alpha = Math.max(0, this.parityFade.alpha - dtMs / this.parityFade.ms);
      this.parityFadeGraphics.setAlpha(this.parityFade.alpha);
      if (this.parityFade.alpha <= 0) {
        this.parityFadeGraphics.clear();
        this.parityFade = null;
      }
    }
  }

  /** Nét xem trước vùng sẽ ẩn khi mảnh đang kéo có neo ứng viên */
  private syncPreview(snapshot: PlayViewSnapshot, pieces: Readonly<Record<string, PieceState>>): void {
    const drag = snapshot.dragInfo;
    const key = drag ? `${drag.pieceId}|${drag.snapCandidateId}` : '';
    if (key === this.previewKey) return;
    this.previewKey = key;
    this.previewGraphics.clear();
    if (!drag || !drag.snapCandidateId) return;
    const piece = this.level.pieces.find((p) => p.id === drag.pieceId);
    if (!piece) return;
    const turns = (pieces[piece.id] ?? { turns: 0 }).turns;

    let candidatePoly: CanvasPoint[] | null = null;
    if (this.level.placement === 'free') {
      const match = drag.snapCandidateId.match(/^grid:(-?\d+),(-?\d+)$/);
      if (match) {
        const gx = Number.parseInt(match[1], 10);
        const gy = Number.parseInt(match[2], 10);
        candidatePoly = piecePolygonCanvas(piece, gx, gy, turns, this.layout);
      }
    } else {
      const anchor = piece.anchors.find((a) => a.id === drag.snapCandidateId);
      if (anchor) {
        candidatePoly = piecePolygonCanvas(piece, anchor.x, anchor.y, turns, this.layout);
      }
    }

    if (!candidatePoly) return;

    const polygons = [
      ...this.canvasPolygons(this.boardEntries(drag.pieceId, pieces)),
      candidatePoly,
    ];
    this.previewGraphics.lineStyle(1.5, COLOR_NUMBERS.icePrimary, FEEDBACK_TOKENS.previewAlpha);
    for (const layer of overlapLayers(polygons)) {
      this.previewGraphics.strokePoints(layer.points.map((p) => new Phaser.Geom.Point(p.x, p.y)), true, true);
    }
  }

  /**
   * Canvas centre of the current snap candidate, for both placement modes:
   * anchored levels carry an anchor id, free-placement levels carry
   * `grid:gx,gy`. `anchorCenter` alone only answers the first.
   */
  private candidateCenter(
    piece: Piece,
    candidateId: string,
    _turns?: number
  ): { x: number; y: number } | null {
    if (this.level.placement === 'free') {
      const match = candidateId.match(/^grid:(-?\d+),(-?\d+)$/);
      if (!match) return null;
      return pieceCenterCanvas(
        piece.frameSize,
        Number.parseInt(match[1], 10),
        Number.parseInt(match[2], 10),
        this.layout
      );
    }
    return anchorCenter(piece, candidateId, this.layout);
  }

  /**
   * Ring at the candidate anchor, tightening as the piece closes. Redrawn
   * every frame because it tracks distance; this is the hot path, so it is one
   * clear and at most one strokeCircle.
   */
  private syncMagnetRing(snapshot: PlayViewSnapshot, pieces: Readonly<Record<string, PieceState>>): void {
    this.magnetRingGraphics.clear();
    const drag = snapshot.dragInfo;
    if (!this.assist.ring || !drag || !drag.snapCandidateId || !drag.onTarget) return;
    const piece = this.level.pieces.find((p) => p.id === drag.pieceId);
    if (!piece) return;
    const turns = (pieces[piece.id] ?? { turns: 0 }).turns;
    const center = this.candidateCenter(piece, drag.snapCandidateId, turns);
    if (!center) return;

    const dist = Math.hypot(drag.x - center.x, drag.y - center.y);
    const ring = magnetRing(dist, pieceRadiusPx(piece.frameSize, this.layout));
    this.magnetRingGraphics.lineStyle(1.5, COLOR_NUMBERS.icePrimary, ring.alpha);
    this.magnetRingGraphics.strokeCircle(center.x, center.y, ring.radius);
  }

  /**
   * Vùng giao chẵn/lẻ trực tiếp thời gian thực của mảnh đang kéo với các mảnh trên bàn.
   * Tính toán dựa trên tư thế trực quan thực tế (dragView.pose) để không bị lệch pha hay giật hình.
   */
  private syncDragParity(snapshot: PlayViewSnapshot, pieces: Readonly<Record<string, PieceState>>): void {
    const drag = snapshot.dragInfo;
    this.dragHollow = [];
    this.dragDeepFill = [];
    if (!drag) {
      if (this.dragParityHasContent) {
        this.dragParityGraphics.clear();
        this.dragParityHasContent = false;
      }
      return;
    }

    const dragPiece = this.level.pieces.find((p) => p.id === drag.pieceId);
    if (!dragPiece) {
      if (this.dragParityHasContent) {
        this.dragParityGraphics.clear();
        this.dragParityHasContent = false;
      }
      return;
    }

    const dragView = this.views.get(dragPiece.id);
    if (!dragView) {
      if (this.dragParityHasContent) {
        this.dragParityGraphics.clear();
        this.dragParityHasContent = false;
      }
      return;
    }

    const dragPose = dragView.currentPose();
    if (!dragPose) {
      if (this.dragParityHasContent) {
        this.dragParityGraphics.clear();
        this.dragParityHasContent = false;
      }
      return;
    }

    const boardEntries = this.boardEntries(drag.pieceId, pieces);
    if (boardEntries.length === 0) {
      if (this.dragParityHasContent) {
        this.dragParityGraphics.clear();
        this.dragParityHasContent = false;
      }
      return;
    }

    const turns = (pieces[dragPiece.id] ?? { turns: 0 }).turns;
    const dragPoly = this.canvasPolygonAt(dragPiece, turns, dragPose);
    const boardPolygons = this.canvasPolygons(boardEntries);
    const layers = computeDragParityLayers(boardPolygons, dragPoly);
    this.dragHollow = layers.filter((l) => !l.filled);
    this.dragDeepFill = layers.filter((l) => l.filled && l.depth >= DEEP_FILL_DEPTH);

    if (layers.length > 0) {
      this.dragParityGraphics.clear();
      const parityAlpha = snapshot.showTarget ? FEEDBACK_TOKENS.eyeResultAlpha : 1;
      this.drawLayers(this.dragParityGraphics, layers, parityAlpha);
      this.dragParityHasContent = true;
    } else if (this.dragParityHasContent) {
      this.dragParityGraphics.clear();
      this.dragParityHasContent = false;
    }
  }

  private drawLayers(
    g: Phaser.GameObjects.Graphics,
    layers: readonly ParityLayer[],
    alpha: number = 1
  ): void {
    for (const layer of layers) {
      const pts = layer.points.map((p) => new Phaser.Geom.Point(p.x, p.y));
      // Fills of depth 5+ are painted by syncOverlapHoles above the deep holes.
      if (layer.filled && layer.depth < DEEP_FILL_DEPTH) {
        g.fillStyle(COLOR_NUMBERS.amberSolid, 1.0 * alpha);
        g.fillPoints(pts, true);
      }
      // Hollow regions draw nothing: syncOverlapHoles cuts them out of the jewels.
    }
  }

  /**
   * Even-parity regions are real holes: the jewels are masked away so the board
   * shows through. A fresh light line traces each hole and brightens while the
   * overlap lasts; leaving the overlap removes the holes (and the line) at once.
   */
  private syncOverlapHoles(dtMs: number, snapshot: PlayViewSnapshot, reduced: boolean): void {
    const hollow = [...this.currentParity.filter((l) => !l.filled), ...this.dragHollow];
    this.holeShape.clear();
    this.deepHoleShape.clear();
    this.deepFillGraphics.clear();
    this.glowGraphics.clear();
    if (hollow.length === 0) {
      this.glow = 0;
      this.setHolesMasked(false);
      this.setDeepMasked(false);
      return;
    }
    // The light line belongs to the piece in the hand: it shows only while one is held and cuts out the
    // frame it is dropped (no fade), even if the pieces still overlap. The holes themselves stay.
    const lit = snapshot.dragInfo ? new Set<ParityLayer>(this.dragHollow) : null;
    this.glow = !lit || lit.size === 0 ? 0 : reduced ? 1 : Math.min(1, this.glow + dtMs / FEEDBACK_TOKENS.overlapGlowMs);
    const eased = this.glow * this.glow * (3 - 2 * this.glow);
    const dim = snapshot.showTarget ? FEEDBACK_TOKENS.eyeResultAlpha : 1;
    this.holeShape.fillStyle(0xffffff, 1);
    this.deepHoleShape.fillStyle(0xffffff, 1);
    let deepHoles = false;
    for (const layer of hollow) {
      const pts = layer.points.map((p) => new Phaser.Geom.Point(p.x, p.y));
      this.holeShape.fillPoints(pts, true);
      if (layer.depth >= DEEP_HOLE_DEPTH) {
        this.deepHoleShape.fillPoints(pts, true);
        deepHoles = true;
      }
      if (snapshot.phase === 'won') continue; // solved: the removed areas keep no edge
      if (!lit?.has(layer)) continue;
      this.glowGraphics.lineStyle(5, COLOR_NUMBERS.iceHighlight, 0.18 * eased * dim);
      this.glowGraphics.strokePoints(pts, true, true);
      this.glowGraphics.lineStyle(1.5, COLOR_NUMBERS.iceHighlight, 0.9 * eased * dim);
      this.glowGraphics.strokePoints(pts, true, true);
    }
    this.setHolesMasked(true);
    this.setDeepMasked(deepHoles);

    this.deepFillGraphics.fillStyle(COLOR_NUMBERS.amberSolid, dim);
    for (const layer of [...this.currentParity, ...this.dragDeepFill]) {
      if (!layer.filled || layer.depth < DEEP_FILL_DEPTH) continue;
      this.deepFillGraphics.fillPoints(layer.points.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
    }
  }

  /** Cuts the deep holes out of the flat amber fills painted under them. */
  private setDeepMasked(on: boolean): void {
    if (on === this.deepMasked) return;
    this.deepMasked = on;
    for (const g of [this.parityGraphics, this.parityIncomingGraphics, this.parityFadeGraphics, this.dragParityGraphics]) {
      if (on) g.setMask(this.deepHoleMask);
      else g.clearMask(false);
    }
  }

  private setHolesMasked(on: boolean): void {
    if (this.victoryClip || on === this.holesMasked) return;
    this.holesMasked = on;
    for (const view of this.views.values()) {
      if (on) view.root.setMask(this.holeMask);
      else view.root.clearMask(false);
    }
  }

  /** Target shadow: brightens 0.7 -> 1 in ~120 ms when its anchor is the candidate, on levels that teach it. */
  private syncTargets(dtMs: number, snapshot: PlayViewSnapshot, reduced: boolean): void {
    const drag = this.assist.targetGlow ? snapshot.dragInfo : null;
    let moving = false;
    (this.level.targetPlacements ?? []).forEach((placement, i) => {
      const targetPiece = this.level.pieces.find((p) => p.id === placement.pieceId);
      const dragPiece = drag ? this.level.pieces.find((p) => p.id === drag.pieceId) : undefined;
      const isEquivalent =
        dragPiece !== undefined &&
        targetPiece !== undefined &&
        (dragPiece.id === targetPiece.id || arePiecesEquivalent(dragPiece, targetPiece));

      const candidateId =
        this.level.placement === 'free'
          ? `grid:${placement.x},${placement.y}`
          : dragPiece?.anchors.find((a) => a.x === placement.x && a.y === placement.y)?.id ??
            targetPiece?.anchors.find((a) => a.x === placement.x && a.y === placement.y)?.id;

      const hovered =
        drag !== null &&
        isEquivalent &&
        candidateId !== undefined &&
        drag.snapCandidateId === candidateId;
      const goal = hovered ? 1 : FEEDBACK_TOKENS.targetIdleAlpha;
      const next = reduced ? goal : stepScalar(this.hoverAlpha[i], goal, dtMs, FEEDBACK_TOKENS.tau.targetHover);
      if (Math.abs(next - this.hoverAlpha[i]) > 1e-4) moving = true;
      this.hoverAlpha[i] = Math.abs(next - goal) < 1e-3 ? goal : next;
    });
    const key = `${snapshot.showTarget && snapshot.phase !== 'won'}|${this.hoverAlpha.join(',')}|${this.idlePhase ?? '-'}`;
    if (key !== this.targetKey || moving) {
      this.targetKey = key;
      this.drawTargetSilhouette(snapshot);
    }
  }

  private drawTargetSilhouette(snapshot: PlayViewSnapshot): void {
    this.targetGraphics.clear();
    // Once solved the figure is the pieces' own parity; a leftover target would only outline what vanished.
    if (!snapshot.showTarget || snapshot.phase === 'won') return;
    const visible: CanvasPoint[][] = [];
    const shown: number[] = [];
    // Largest hover x reveal among visible placements: scales both the outline and the tint.
    let strength = 0;
    (this.level.targetPlacements ?? []).forEach((placement, index) => {
      const reveal = this.targetReveal?.[index] ?? 1;
      if (reveal <= 0) return;
      const piece = this.level.pieces.find((p) => p.id === placement.pieceId);
      if (!piece) return;
      visible.push(piecePolygonCanvas(piece, placement.x, placement.y, placement.turns, this.layout));
      shown.push(index);
      strength = Math.max(strength, (this.hoverAlpha[index] / FEEDBACK_TOKENS.targetIdleAlpha) * reveal);
    });

    // Polygons never change for a given visible set, so the clip work is done once, not per frame.
    const shapeKey = `${this.level.id}|${shown.join(',')}`;
    if (this.targetShape?.key !== shapeKey) {
      this.targetShape = {
        key: shapeKey,
        segments: parityOutline(visible),
        lit: oddRegions(visible),
      };
    }

    const breath = nudgeAlpha(this.idlePhase);
    // Pale amber tint over the lit (odd-parity) regions, like the badge, under the dashed outline.
    this.targetGraphics.fillStyle(COLOR_NUMBERS.amberSolid, FEEDBACK_TOKENS.targetFillAlpha * strength * breath);
    for (const region of this.targetShape.lit) {
      this.targetGraphics.fillPoints(region, true);
    }

    // One dashed boundary for the whole figure, only around the lit (odd-parity) regions:
    // pieces laid exactly on top of each other leave shadow, and their edges stay undrawn.
    const outlineAlpha = strength * FEEDBACK_TOKENS.eyeTargetAlpha * breath;
    for (const segment of this.targetShape.segments) {
      strokeTargetSegment(this.targetGraphics, segment, outlineAlpha);
    }
  }

  private drawVictoryPulse(): void {
    const { boardBounds } = this.layout;
    const pulse = 0.6 + Math.sin(this.victoryPulse) * 0.3;
    this.fxGraphics.lineStyle(2.5, COLOR_NUMBERS.amberGlow, pulse);
    this.fxGraphics.strokeRoundedRect(
      boardBounds.x - 2,
      boardBounds.y - 2,
      boardBounds.width + 4,
      boardBounds.height + 4,
      38
    );

    // Tô sáng bừng hình hoàn chỉnh: chỉ vẽ biên thật của hình (phần chẵn đã mất thì không có viền)
    this.fxGraphics.lineStyle(3, COLOR_NUMBERS.amberSolid, 0.85 * pulse);
    for (const chain of this.finalOutline()) {
      this.fxGraphics.strokePoints(chain.points.map((p) => new Phaser.Geom.Point(p.x, p.y)), chain.closed, chain.closed);
    }
  }

  /** `pieces` defaults to what the last frame drew; the finale passes the live state because it starts before the next frame. */
  private placedPolygons(pieces: Readonly<Record<string, PieceState>> = this.lastPieces): CanvasPoint[][] {
    return this.canvasPolygons(this.boardEntries(null, pieces));
  }

  private outlineCache: { key: string; chains: OutlineChain[] } | null = null;

  /**
   * Outside edge of the solved figure: only where lit area meets the empty board. Edges around a
   * removed area are left out, so some chains stay open; strokes must not close those.
   */
  public finalOutline(pieces: Readonly<Record<string, PieceState>> = this.lastPieces): OutlineChain[] {
    const polygons = this.placedPolygons(pieces);
    const key = polygons.map((poly) => poly.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(';')).join('|');
    if (this.outlineCache?.key !== key) {
      this.outlineCache = { key, chains: outlineChains(parityOutline(polygons, true)) };
    }
    return this.outlineCache.chains;
  }

  /**
   * Victory clean-up: from now on the pieces show only inside the lit (odd-parity) area. Whatever
   * a piece draws outside it, such as the golden halo around an edge that borders a removed area,
   * is cut away at once, before the merge starts.
   */
  public setVictoryClip(pieces: Readonly<Record<string, PieceState>> = this.lastPieces): void {
    this.clearVictoryClip();
    const regions = oddRegions(this.placedPolygons(pieces));
    if (regions.length === 0) return;
    const shape = this.scene.make.graphics({ x: 0, y: 0 }, false);
    shape.fillStyle(0xffffff, 1);
    for (const region of regions) shape.fillPoints(region.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
    const mask = shape.createGeometryMask();
    for (const view of this.views.values()) view.root.setMask(mask);
    this.victoryClip = { shape, mask };
    this.holesMasked = true;
  }

  public clearVictoryClip(): void {
    if (!this.victoryClip) return;
    for (const view of this.views.values()) view.root.clearMask(false);
    this.victoryClip.shape.destroy();
    this.victoryClip = null;
    this.holesMasked = false;
  }

  /**
   * The solved figure as one jewel block, built piece by piece for the finale: each odd-parity
   * area belongs to the first piece (in `level.pieces` order) that covers it, and shows when that
   * piece is revealed, so the material is painted over the pieces as the light passes and no
   * boundary between them survives. Only the outside edge gets a rim.
   */
  public createMergedBlock(pieces: Readonly<Record<string, PieceState>> = this.lastPieces): Phaser.GameObjects.Graphics | null {
    this.clearMergedBlock();
    const owned = this.boardEntries(null, pieces).flatMap((entry) => {
      const [poly] = this.canvasPolygons([entry]);
      return poly ? [{ index: this.level.pieces.indexOf(entry.piece), poly }] : [];
    });
    const polygons = owned.map((o) => o.poly);
    const regions = oddRegions(polygons);
    if (regions.length === 0) return null;
    const all = polygons.flat();
    const cx = (Math.min(...all.map((p) => p.x)) + Math.max(...all.map((p) => p.x))) / 2;
    const cy = (Math.min(...all.map((p) => p.y)) + Math.max(...all.map((p) => p.y))) / 2;
    const bounds = regionBounds(regions);

    const byOwner = new Map<number, CanvasPoint[][]>();
    const inOrder = [...owned].sort((a, b) => a.index - b.index);
    for (const region of regions) {
      const at = {
        x: region.reduce((s, p) => s + p.x, 0) / region.length,
        y: region.reduce((s, p) => s + p.y, 0) / region.length,
      };
      const owner = inOrder.find((o) => pointInLoop(at, o.poly))?.index ?? 0;
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), region]);
    }

    const g = this.scene.add.graphics({ x: cx, y: cy }).setDepth(DEPTH_TOKENS.draggingPiece + 1);
    this.mergeGraphics = g;
    this.mergeLook = {
      origin: { x: cx, y: cy },
      fragments: [...byOwner].map(([index, regs]) => {
        const us = regs.flat().map((p) => lightAxis(bounds, p.x, p.y));
        return { index, strips: shadeStrips(regs, 6, bounds), from: Math.min(...us), to: Math.max(...us) };
      }),
      regions,
      outline: this.finalOutline(pieces),
      bounds,
      spots: sparkleSpots(regions, 5),
      spark: Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.07,
    };
    this.setMergedProgress([], -1);
    return g;
  }

  /**
   * Redraws the block. `reveal[i]` in [0, 1] is how far piece i's part is painted in (it flashes
   * bright while it arrives and settles into the gradient); `sheen` is the band of light that
   * sweeps the finished block (0 top-left to 1 bottom-right, outside that = off). One Graphics,
   * cleared and redrawn per call.
   */
  public setMergedProgress(reveal: readonly number[], sheen: number): void {
    const g = this.mergeGraphics;
    const look = this.mergeLook;
    if (!g || !look) return;
    const { x: cx, y: cy } = look.origin;
    const local = (pts: readonly CanvasPoint[]) => pts.map((p) => new Phaser.Geom.Point(p.x - cx, p.y - cy));
    const hex = (value: string) => Phaser.Display.Color.HexStringToColor(value).color;
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const share = look.fragments.length === 0
      ? 0
      : look.fragments.reduce((sum, f) => sum + clamp01(reveal[f.index] ?? 0), 0) / look.fragments.length;

    g.clear();
    if (share <= 0) return;
    const trace = (width: number, color: number, alpha: number) => {
      g.lineStyle(width, color, alpha);
      for (const chain of look.outline) g.strokePoints(local(chain.points), chain.closed, chain.closed);
    };
    // Soft halo outside the figure: wide faint strokes stacked on the edge.
    for (const [width, alpha] of [[14, 0.08], [8, 0.12], [4, 0.2]] as const) {
      trace(width, hex(PIECE_TOKENS.glow.color), alpha * share);
    }
    for (const fragment of look.fragments) {
      const r = clamp01(reveal[fragment.index] ?? 0);
      if (r <= 0) continue;
      // The material is wiped over the piece along the light axis: opaque behind the front, with a
      // bright edge on the front itself, so the piece seems to be repainted as the light moves on.
      const front = fragment.from - PAINT_SOFT + (fragment.to - fragment.from + PAINT_SOFT) * r;
      const painted = r >= 1 ? null : sheenBand(look.bounds, (front - 1) / 2, (front + 1) / 2);
      const edge = r >= 1 ? null : sheenBand(look.bounds, front - PAINT_SOFT / 2, PAINT_SOFT / 2);
      for (const strip of fragment.strips) {
        const part = painted ? clipConvex(strip.points, painted) : strip.points;
        if (part.length >= 3) {
          g.fillStyle(gradientColor(strip.t), 1);
          g.fillPoints(local(part), true);
        }
        const rim = edge ? clipConvex(strip.points, edge) : [];
        if (rim.length >= 3) {
          g.fillStyle(0xffffff, 0.65);
          g.fillPoints(local(rim), true);
        }
      }
    }
    if (sheen > -0.3 && sheen < 1.3 && share >= 1) {
      const band = sheenBand(look.bounds, sheen, 0.1);
      g.fillStyle(0xffffff, 0.42);
      for (const region of look.regions) {
        const lit = clipConvex(region, band);
        if (lit.length >= 3) g.fillPoints(local(lit), true);
      }
    }
    trace(PIECE_TOKENS.outlineWidth, hex(PIECE_TOKENS.outline), 0.9 * share);
    for (const spot of look.spots) {
      const flare = share >= 1 ? twinkle(spot.u, sheen) : 0;
      drawSparkle(g, spot.x - cx, spot.y - cy, look.spark * (0.45 + 0.95 * flare), (0.55 + 0.45 * flare) * share);
    }
  }

  public clearMergedBlock(): void {
    this.mergeGraphics?.destroy();
    this.mergeGraphics = null;
    this.mergeLook = null;
  }

  public destroy(): void {
    for (const g of [
      this.ringGraphics,
      this.targetGraphics,
      this.placeholderGraphics,
      this.parityGraphics,
      this.parityIncomingGraphics,
      this.parityFadeGraphics,
      this.previewGraphics,
      this.magnetRingGraphics,
      this.temporaryGraphics,
      this.dragParityGraphics,
      this.deepFillGraphics,
      this.glowGraphics,
      this.fxGraphics,
      this.holeShape,
      this.deepHoleShape,
    ]) {
      g.destroy();
    }
    for (const view of this.views.values()) view.destroy();
    this.clearMergedBlock();
    this.clearVictoryClip();
    this.boardBase?.destroy();
    this.boardTop?.destroy();
    this.gridTexture?.destroy();
    this.trayFrame?.destroy();
    this.trayWells.forEach((w) => w.destroy());
  }
}
