import type { StoragePort } from './progressPort.ts';

export const TUTORIAL_STORAGE_KEY = 'nozvi.tutorial.v1';

const FIRST_TUTORIAL_LEVEL = '1-1';
const ROTATION_TUTORIAL_LEVEL = '3-1';
const ROTATING_PIECE = 'T1';
const LAST_PIECE = 'S1';
const DRAG_STEPS = 2;

/** 1-1 keeps its original key so players who already saw it are not asked again; others get a per-level key. */
export function tutorialStorageKey(levelId: string): string {
  return levelId === FIRST_TUTORIAL_LEVEL ? TUTORIAL_STORAGE_KEY : `${TUTORIAL_STORAGE_KEY}.${levelId}`;
}

export interface TutorialSeenStore {
  isSeen(): boolean;
  markSeen(): void;
}

/** The seen flag in its own key, so the progress schema needs no migration. Storage errors fall back to memory. */
export function createTutorialSeenStore(storage: StoragePort, levelId: string = FIRST_TUTORIAL_LEVEL): TutorialSeenStore {
  const key = tutorialStorageKey(levelId);
  let seen = false;
  return {
    isSeen() {
      if (seen) return true;
      try {
        seen = storage.getItem(key) === '1';
      } catch {
        // Unreadable storage: treat as unseen.
      }
      return seen;
    },
    markSeen() {
      seen = true;
      try {
        storage.setItem(key, '1');
      } catch {
        // Memory-only: the flag lasts for this session.
      }
    },
  };
}

/** Which copy, spotlights and guide the overlay shows. */
export type TutorialStepId =
  | 'drag-first'
  | 'drag-second'
  | 'select'
  | 'rotate-button'
  | 'double-tap'
  | 'hold'
  | 'fix-pose'
  | 'drag-turned'
  | 'place-last';

/** What the scene observes each frame. `correct` = on the grid at the target cell and pose. */
export type TutorialObserved = Readonly<{
  selectedPieceId: string | null;
  turns: Readonly<Record<string, number>>;
  correct: ReadonlySet<string>;
}>;

/** Things that really happened and that a step may be waiting for. */
export type TutorialEvent = 'rotate-button' | 'double-tap' | 'hold-turn';

/** Something the player is trying to do; the script says whether the current step allows it. */
export type TutorialAction =
  | Readonly<{ type: 'press-piece'; pieceId: string }>
  | Readonly<{ type: 'rotate-button' }>
  | Readonly<{ type: 'rotate-gesture' }>
  /** Reset, menu, back, target toggle, level select, presses on the empty board. */
  | Readonly<{ type: 'hud' }>;

/** What the overlay shows right now. `step` is 1-based. */
export type TutorialView = Readonly<{ step: number; total: number; id: TutorialStepId; pieceId: string }>;

type ScriptView = Omit<TutorialView, 'total'>;

type TutorialScript = {
  readonly total: number;
  /** The current step, or null when the tutorial is complete. */
  view(observed: TutorialObserved): ScriptView | null;
  event(event: TutorialEvent): void;
  allows(view: ScriptView, action: TutorialAction): boolean;
  /** Keep a piece the player just dropped? `correct` = it landed on its target cell and pose; anything else goes back to the tray. */
  acceptsDrop(view: ScriptView, pieceId: string, correct: boolean): boolean;
};

/** 1-1: drag the first piece that is not yet at its target, twice. Only that piece may be pressed. */
function dragScript(pieceIds: readonly string[]): TutorialScript {
  const total = Math.min(DRAG_STEPS, pieceIds.length);
  return {
    total,
    view(observed) {
      const doneCount = pieceIds.filter((id) => observed.correct.has(id)).length;
      if (doneCount >= total) return null;
      return {
        step: doneCount + 1,
        id: doneCount === 0 ? 'drag-first' : 'drag-second',
        pieceId: pieceIds.find((id) => !observed.correct.has(id))!,
      };
    },
    event() {},
    allows(view, action) {
      return action.type === 'press-piece' && action.pieceId === view.pieceId;
    },
    acceptsDrop(view, pieceId, correct) {
      return correct && pieceId === view.pieceId;
    },
  };
}

/**
 * 3-1: select the rotating piece, press Rotate, double tap, double tap and hold (each one an event
 * that must happen in its own step), then get the piece to its target place and pose and place the last
 * piece. Steps 1 to 4 only move forward; steps 5 and 6 follow the state.
 */
function rotationScript(rotating: string, last: string, targetTurns: number): TutorialScript {
  // 0 select, 1 rotate-button, 2 double-tap, 3 hold, 4 free (state-driven)
  let stage = 0;
  return {
    total: 6,
    view(observed) {
      if (stage === 0 && observed.selectedPieceId === rotating) stage = 1;
      if (stage === 0) return { step: 1, id: 'select', pieceId: rotating };
      if (stage === 1) return { step: 2, id: 'rotate-button', pieceId: rotating };
      if (stage === 2) return { step: 3, id: 'double-tap', pieceId: rotating };
      if (stage === 3) return { step: 4, id: 'hold', pieceId: rotating };
      if (!observed.correct.has(rotating)) {
        const turned = (observed.turns[rotating] ?? 0) === targetTurns;
        return { step: 5, id: turned ? 'drag-turned' : 'fix-pose', pieceId: rotating };
      }
      if (!observed.correct.has(last)) return { step: 6, id: 'place-last', pieceId: last };
      return null;
    },
    event(event) {
      if (stage === 1 && event === 'rotate-button') stage = 2;
      else if (stage === 2 && event === 'double-tap') stage = 3;
      else if (stage === 3 && event === 'hold-turn') stage = 4;
    },
    allows(view, action) {
      switch (action.type) {
        case 'hud':
          return false;
        case 'rotate-button':
          return view.id === 'rotate-button' || view.id === 'fix-pose';
        case 'rotate-gesture':
          return view.id === 'double-tap' || view.id === 'hold' || view.id === 'fix-pose';
        case 'press-piece':
          // Pressing a piece in the Rotate step would change the selection.
          return view.id !== 'rotate-button' && action.pieceId === view.pieceId;
      }
    },
    acceptsDrop(view, pieceId, correct) {
      // Before the last two steps a dropped piece always goes back to the tray, even on its target.
      const placing = view.id === 'fix-pose' || view.id === 'drag-turned' || view.id === 'place-last';
      return placing && correct && pieceId === view.pieceId;
    },
  };
}

export class TutorialController {
  private finished = false;
  private current: ScriptView | null = null;

  constructor(
    private readonly script: TutorialScript,
    private readonly store: TutorialSeenStore
  ) {}

  /** Recompute from the observed state; null once the tutorial is over. */
  sync(observed: TutorialObserved): TutorialView | null {
    if (this.finished) return null;
    const view = this.script.view(observed);
    this.current = view;
    if (!view) {
      this.finish();
      return null;
    }
    return { ...view, total: this.script.total };
  }

  /** Something taught really happened. Counts only if the current step is waiting for it. */
  onEvent(event: TutorialEvent): void {
    if (!this.finished) this.script.event(event);
  }

  /** May the player do this now? Open before the first step is shown and after the tutorial ends. */
  allows(action: TutorialAction): boolean {
    if (this.finished || !this.current) return true;
    return this.script.allows(this.current, action);
  }

  /** Keep a piece the player just dropped, or send it back to the tray? Open when no step is shown. */
  acceptsDrop(pieceId: string, correct: boolean): boolean {
    if (this.finished || !this.current) return true;
    return this.script.acceptsDrop(this.current, pieceId, correct);
  }

  skip(): void {
    this.finish();
  }

  private finish(): void {
    this.finished = true;
    this.store.markSeen();
  }
}

export function createTutorial(opts: {
  levelId: string;
  mode: string;
  pieceIds: readonly string[];
  targets?: readonly Readonly<{ pieceId: string; turns: number }>[];
  store: TutorialSeenStore;
  force?: boolean;
}): TutorialController | null {
  if (opts.mode !== 'campaign' && opts.mode !== 'harness') return null;

  let script: TutorialScript | null = null;
  if (opts.levelId === FIRST_TUTORIAL_LEVEL && opts.pieceIds.length >= 2) {
    script = dragScript(opts.pieceIds);
  } else if (opts.levelId === ROTATION_TUTORIAL_LEVEL) {
    const targetTurns = opts.targets?.find((target) => target.pieceId === ROTATING_PIECE)?.turns;
    if (targetTurns !== undefined && opts.pieceIds.includes(ROTATING_PIECE) && opts.pieceIds.includes(LAST_PIECE)) {
      script = rotationScript(ROTATING_PIECE, LAST_PIECE, targetTurns);
    }
  }
  if (!script) return null;
  if (!opts.force && opts.store.isSeen()) return null;
  return new TutorialController(script, opts.store);
}
