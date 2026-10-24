import type { Level, Piece, PuzzleState, Transition } from '../domain/model.ts';
import { applyCommand, createPuzzle, placementsOf } from '../domain/session.ts';
import { evaluate } from '../domain/mask.ts';
import type { ProgressRepository, ResultRecord } from './progressPort.ts';
import type { DragSession, DragUpdate } from './drag.ts';
import { beginDrag, cancelDrag, finishDrag, updateDrag } from './drag.ts';
import type { LayoutMetrics } from '../presentation/board/layout.ts';
import { pieceBoardOrigin, pieceHitbox, piecePolygonCanvas, pointNearPolygon } from '../presentation/board/layout.ts';
import { LevelClock } from './levelClock.ts';
import { parFromSolution, starsFor, timeBudget, type Stars } from '../domain/starRating.ts';

/** Bound resumed-frame spikes without changing normal frame timing. */
export const MAX_CLOCK_STEP_MS = 250;

/** Đệm quanh đa giác mảnh trên bàn khi chạm (px canvas) */
const BOARD_TOUCH_PAD = 12;
/** Mảnh tạm nằm trên mảnh đã khớp, mảnh đã khớp nằm trên khay */
const HIT_RANK = { temporary: 0, snapped: 1, placed: 1, tray: 2 } as const;

export type DragInfo = {
  pieceId: string;
  x: number;
  y: number;
  snapCandidateId: string | null;
};

export type PlayViewSnapshot = {
  levelId: string;
  phase: 'playing' | 'won';
  showTarget: boolean;
  snappedCount: number;
  totalPieces: number;
  canRotate: boolean;
  selectedPieceId: string | null;
  dragPreviewMask: Uint8Array | null;
  snapCandidateId: string | null;
  dragInfo: DragInfo | null;
  committedMask: Uint8Array;
  /** Time-star state; null outside the campaign. */
  timer: { active: boolean; elapsedMs: number; budgetMs: number; stars: Stars } | null;
};

export class PlayController {
  private level: Level;
  private progressRepo: ProgressRepository;
  private isCampaign: boolean;
  private puzzleState: PuzzleState;
  private committedMask: Uint8Array;
  private selectedPieceId: string | null = null;
  private dragSession: DragSession | null = null;
  private dragUpdate: DragUpdate | null = null;
  private dragInfo: DragInfo | null = null;
  private showTarget: boolean;
  private readonly clock = new LevelClock();
  private readonly budgetMs: number;
  private result: { elapsedMs: number; stars: Stars; record: ResultRecord } | null = null;

  constructor(
    level: Level,
    progressRepo: ProgressRepository,
    isCampaign: boolean = true,
    initialShowTarget: boolean = true
  ) {
    this.level = level;
    this.progressRepo = progressRepo;
    this.isCampaign = isCampaign;
    this.puzzleState = createPuzzle(level);
    this.committedMask = evaluate(level, placementsOf(level, this.puzzleState));
    this.showTarget = initialShowTarget;
    this.budgetMs = timeBudget(level.parMs ?? parFromSolution(level.targetPlacements ?? []));
  }

  /** Mọi thay đổi trạng thái đi qua đây để mask cache luôn khớp */
  private commitState(next: PuzzleState, mask: Uint8Array): void {
    this.puzzleState = next;
    this.committedMask = mask;
  }

  getSnapshot(): PlayViewSnapshot {
    const snappedCount = Object.values(this.puzzleState.pieces).filter(
      (p) => p.kind === 'snapped' || p.kind === 'placed'
    ).length;

    return {
      levelId: this.level.id,
      phase: this.puzzleState.phase,
      showTarget: this.showTarget,
      snappedCount,
      totalPieces: this.level.pieces.length,
      canRotate: this.level.rotationEnabled && this.selectedPieceId !== null,
      selectedPieceId: this.selectedPieceId,
      dragPreviewMask: this.dragUpdate ? this.dragUpdate.previewMask : null,
      snapCandidateId: this.dragUpdate ? this.dragUpdate.snapCandidateId : null,
      dragInfo: this.dragInfo,
      committedMask: this.committedMask,
      timer: this.isCampaign
        ? {
            active: this.clock.running,
            elapsedMs: this.clock.elapsedMs,
            budgetMs: this.budgetMs,
            stars: starsFor(this.clock.elapsedMs, this.budgetMs),
          }
        : null,
    };
  }

  /** Called by the scene every frame it is not paused or won. */
  tickClock(dtMs: number): void {
    if (this.isCampaign && this.puzzleState.phase !== 'won') this.clock.tick(Math.min(dtMs, MAX_CLOCK_STEP_MS));
  }

  getResult(): { elapsedMs: number; stars: Stars; record: ResultRecord } | null {
    return this.result;
  }

  /** Win in the campaign: stop the clock and keep the better result. Replaces the bare `complete` call. */
  private recordWin(): void {
    if (!this.isCampaign) return;
    this.clock.stop();
    const elapsedMs = Math.round(this.clock.elapsedMs);
    const stars = starsFor(elapsedMs, this.budgetMs);
    this.result = { elapsedMs, stars, record: this.progressRepo.recordResult(this.level.id, elapsedMs, stars) };
  }

  getPuzzleState(): PuzzleState {
    return this.puzzleState;
  }

  /** Topmost piece under the pointer (top layer first: temporary, then snapped, then tray; later pieces first). */
  private hitPiece(pointerX: number, pointerY: number, layout: LayoutMetrics): { piece: Piece; index: number } | null {
    // Lớp trên cùng trước (tạm > đã khớp > khay), cùng lớp thì mảnh sau trước.
    // Mảnh trên bàn trúng khi chạm gần đa giác của nó, không phải cả khung vuông.
    const pieceOrder = [...this.level.pieces]
      .map((piece, index) => ({ piece, index }))
      .sort((a, b) => {
        const ra = HIT_RANK[(this.puzzleState.pieces[a.piece.id] ?? { kind: 'tray' }).kind];
        const rb = HIT_RANK[(this.puzzleState.pieces[b.piece.id] ?? { kind: 'tray' }).kind];
        return ra - rb || b.index - a.index;
      });

    for (const { piece, index } of pieceOrder) {
      const pState = this.puzzleState.pieces[piece.id] ?? { kind: 'tray', turns: 0 };
      const origin = pieceBoardOrigin(piece, pState);
      const hitbox = pieceHitbox(piece, pState, layout, index, this.level.pieces.length);
      const hit = origin
        ? pointNearPolygon(
            { x: pointerX, y: pointerY },
            piecePolygonCanvas(piece, origin.x, origin.y, pState.turns, layout),
            BOARD_TOUCH_PAD
          )
        : pointerX >= hitbox.x &&
          pointerX <= hitbox.x + hitbox.width &&
          pointerY >= hitbox.y &&
          pointerY <= hitbox.y + hitbox.height;
      if (hit) return { piece, index };
    }
    return null;
  }

  /** The id of the piece under the pointer, or null. Looks only: no selection, no drag. */
  pieceAt(pointerX: number, pointerY: number, layout: LayoutMetrics): string | null {
    return this.hitPiece(pointerX, pointerY, layout)?.piece.id ?? null;
  }

  /** `fingerLift` > 0 carries the piece that far above the pointer (a touch); 0 keeps it under the pointer. */
  onPointerDown(pointerX: number, pointerY: number, layout: LayoutMetrics, fingerLift: number = 0): boolean {
    if (this.puzzleState.phase === 'won') {
      return false;
    }

    const found = this.hitPiece(pointerX, pointerY, layout);
    if (!found) return false;
    const { piece, index: originalIndex } = found;

    this.selectedPieceId = piece.id;
    if (this.isCampaign) this.clock.start();
    this.dragSession = beginDrag(
      this.puzzleState,
      piece,
      pointerX,
      pointerY,
      layout,
      originalIndex,
      this.level.pieces.length,
      fingerLift
    );
    this.dragUpdate = updateDrag(this.dragSession, this.level, pointerX, pointerY, layout, {
      computePreviewMask: false,
    });
    this.dragInfo = {
      pieceId: piece.id,
      x: pointerX - this.dragSession.pointerOffset.x,
      y: pointerY - this.dragSession.pointerOffset.y,
      snapCandidateId: this.dragUpdate.snapCandidateId,
    };
    return true;
  }

  onPointerMove(pointerX: number, pointerY: number, layout: LayoutMetrics): void {
    if (!this.dragSession) return;
    this.dragUpdate = updateDrag(this.dragSession, this.level, pointerX, pointerY, layout, {
      computePreviewMask: false,
      previous: this.dragUpdate,
    });
    this.dragInfo = {
      pieceId: this.dragSession.pieceId,
      x: pointerX - this.dragSession.pointerOffset.x,
      y: pointerY - this.dragSession.pointerOffset.y,
      snapCandidateId: this.dragUpdate.snapCandidateId,
    };
  }

  onPointerUp(pointerX: number, pointerY: number, layout: LayoutMetrics): Transition | null {
    if (!this.dragSession) return null;

    const transition = finishDrag(this.dragSession, this.level, pointerX, pointerY, layout);
    this.dragSession = null;
    this.dragUpdate = null;
    this.dragInfo = null;

    if (transition.accepted) {
      this.commitState(transition.state, transition.mask);
      if (transition.becameWon) this.recordWin();
    }

    return transition;
  }

  onPointerCancel(): Transition | null {
    if (!this.dragSession) return null;

    const transition = cancelDrag(this.dragSession, this.level);
    this.dragSession = null;
    this.dragUpdate = null;
    this.dragInfo = null;

    return transition;
  }

  /** Send a piece back to the tray, keeping its turns (the tutorial uses this for drops that miss their target). */
  onReturnToTray(pieceId: string): Transition | null {
    const transition = applyCommand(this.level, this.puzzleState, { type: 'return', pieceId });
    if (!transition.accepted) return null;
    this.commitState(transition.state, transition.mask);
    return transition;
  }

  onRotate(): Transition | null {
    if (!this.selectedPieceId || !this.level.rotationEnabled) {
      return null;
    }

    const transition = applyCommand(this.level, this.puzzleState, {
      type: 'rotate',
      pieceId: this.selectedPieceId,
    });

    if (transition.accepted) {
      this.commitState(transition.state, transition.mask);
      if (transition.becameWon) this.recordWin();
    }

    return transition;
  }

  /**
   * Turn the piece in hand one step without letting go. The piece is turned as if it were back
   * in the tray, so a tight spot at its old place cannot block a turn made somewhere else; the
   * drag then carries on from the turned state.
   */
  onRotateDuringDrag(layout: LayoutMetrics): Transition | null {
    const drag = this.dragSession;
    if (!drag || !this.level.rotationEnabled) return null;
    const held = drag.committedState.pieces[drag.pieceId];
    if (!held) return null;

    const lifted: PuzzleState = {
      ...drag.committedState,
      pieces: { ...drag.committedState.pieces, [drag.pieceId]: { kind: 'tray', turns: held.turns } },
    };
    const transition = applyCommand(this.level, lifted, { type: 'rotate', pieceId: drag.pieceId });
    if (!transition.accepted) return transition;

    this.commitState(transition.state, transition.mask);
    this.dragSession = {
      ...drag,
      committedState: transition.state,
      originState: transition.state.pieces[drag.pieceId],
    };
    const info = this.dragInfo;
    if (info) {
      this.dragUpdate = updateDrag(
        this.dragSession,
        this.level,
        info.x + drag.pointerOffset.x,
        info.y + drag.pointerOffset.y,
        layout,
        { computePreviewMask: false }
      );
      this.dragInfo = { ...info, snapCandidateId: this.dragUpdate.snapCandidateId };
    }
    return transition;
  }

  onReset(): Transition {
    const transition = applyCommand(this.level, this.puzzleState, { type: 'reset' });
    this.commitState(transition.state, transition.mask);
    this.selectedPieceId = null;
    this.dragSession = null;
    this.dragUpdate = null;
    this.clock.reset();
    this.result = null;
    return transition;
  }

  onToggleTarget(): boolean {
    this.showTarget = !this.showTarget;
    this.progressRepo.setShowTarget(this.showTarget);
    return this.showTarget;
  }
}
