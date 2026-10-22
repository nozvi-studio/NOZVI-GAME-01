import type { Chapter, Orientation, PlacementMode, ShapeKind, Turns } from '../domain/model.ts';
import { GRID_HEIGHT, GRID_WIDTH } from '../domain/model.ts';
import { effectiveOrientation, isValidFrame, mirrorOrientation } from '../domain/shapes.ts';
import type { LevelSource, PieceSource } from '../content/authoring.ts';
import { slugFromTitle } from '../content/newLevel.ts';
import { DECOY_IDS } from '../content/kit.ts';
import { chapterAllowsRotation, chapterOfLevelId } from '../content/chapters.ts';

export type StudioState = {
  source: LevelSource;
  savedSource: LevelSource;
  selectedPieceId: string | null;
  selectedAnchorId: string | null;
};

export type StudioAction =
  | { type: 'select-piece'; id: string | null }
  | { type: 'select-anchor'; pieceId: string; anchorId: string | null }
  | { type: 'add-piece'; shapeKind: ShapeKind; frameSize: number; orientation: Orientation }
  | { type: 'move-piece'; id: string; x: number; y: number }
  | { type: 'rotate-piece'; id: string }
  | { type: 'set-orientation'; id: string; orientation: Orientation }
  | { type: 'mirror-piece'; id: string }
  | { type: 'duplicate-piece'; id: string }
  | { type: 'delete-piece'; id: string }
  | { type: 'nudge-piece'; id: string; dx: number; dy: number }
  | { type: 'add-decoy'; pieceId: string }
  | { type: 'move-decoy'; pieceId: string; anchorId: string; x: number; y: number }
  | { type: 'delete-decoy'; pieceId: string; anchorId: string }
  | { type: 'set-field'; field: 'difficultyEstimate' | 'chapter' | 'order' | 'contentRevision'; value: any }
  | { type: 'set-placement'; placement: PlacementMode }
  | { type: 'set-rotation'; enabled: boolean }
  | { type: 'set-solution-turns'; pieceId: string; turns: Turns }
  | { type: 'set-drives'; pieceId: string; targets: string[] }
  | { type: 'mark-saved' }
  | { type: 'load-source'; source: LevelSource };

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isDirty(state: StudioState): boolean {
  return !deepEqual(state.source, state.savedSource);
}

export function createInitialState(source: LevelSource): StudioState {
  const cloned = deepClone(source);
  return {
    source: cloned,
    savedSource: deepClone(cloned),
    selectedPieceId: null,
    selectedAnchorId: null,
  };
}

export function cloneLevelSource(source: LevelSource, newId: string): LevelSource {
  const cloned = deepClone(source);
  cloned.id = newId;
  cloned.title = `Màn ${newId}`;
  const chapter = chapterOfLevelId(newId);
  if (chapter !== undefined) cloned.chapter = chapter;
  cloned.contentRevision = `${slugFromTitle(cloned.title)}-v1`;
  delete cloned.victoryVerse;
  return cloned;
}

export function computeDecoyReason(
  anchorA: { x: number; y: number },
  decoy: { x: number; y: number }
): string {
  const dx = decoy.x - anchorA.x;
  const dy = decoy.y - anchorA.y;
  if (dx === 0 && dy === 0) return 'Trùng neo A';

  const parts: string[] = [];
  if (dx > 0) parts.push(`Lệch phải ${dx} ô`);
  else if (dx < 0) parts.push(`Lệch trái ${Math.abs(dx)} ô`);
  if (dy > 0) parts.push(`Lệch xuống ${dy} ô`);
  else if (dy < 0) parts.push(`Lệch lên ${Math.abs(dy)} ô`);

  return parts.join(', ');
}

function nextPieceId(shapeKind: ShapeKind, existingPieces: PieceSource[]): string {
  const prefixMap: Record<ShapeKind, string> = {
    square: 'S',
    triangle: 'T',
    diamond: 'D',
    circle: 'C',
    parallelogram: 'P',
  };
  const prefix = prefixMap[shapeKind] ?? 'P';
  const existingIds = new Set(existingPieces.map((p) => p.id));
  let counter = 1;
  while (existingIds.has(`${prefix}${counter}`)) {
    counter++;
  }
  return `${prefix}${counter}`;
}

/** Rotation off: every sample-solution step back to 0 turns and no linked rotation. */
function clearRotationState(source: LevelSource): void {
  for (const step of source.sampleSolutions?.[0] ?? []) step.turns = 0;
  for (const piece of source.pieces) delete piece.drives;
}

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'select-piece': {
      return {
        ...state,
        selectedPieceId: action.id,
        selectedAnchorId: action.id ? 'A' : null,
      };
    }

    case 'select-anchor': {
      return {
        ...state,
        selectedPieceId: action.pieceId,
        selectedAnchorId: action.anchorId,
      };
    }

    case 'add-piece': {
      const source = deepClone(state.source);
      const id = nextPieceId(action.shapeKind, source.pieces);
      const size = action.frameSize;
      const x = Math.max(0, Math.min(GRID_WIDTH - size, Math.round((64 - size / 2) / 8) * 8));
      const y = Math.max(0, Math.min(GRID_HEIGHT - size, Math.round((80 - size / 2) / 8) * 8));

      const newPiece: PieceSource = {
        id,
        shapeKind: action.shapeKind,
        orientation: action.orientation,
        frameSize: size,
        anchors: [{ id: 'A', x, y }],
      };

      source.pieces.push(newPiece);

      if (!source.sampleSolutions || source.sampleSolutions.length === 0) {
        source.sampleSolutions = [[]];
      }
      source.sampleSolutions[0].push({
        pieceId: id,
        anchorId: 'A',
        turns: 0,
      });

      return {
        ...state,
        source,
        selectedPieceId: id,
        selectedAnchorId: 'A',
      };
    }

    case 'move-piece': {
      const source = deepClone(state.source);
      const piece = source.pieces.find((p) => p.id === action.id);
      if (!piece) return state;

      const anchorA = piece.anchors.find((a) => a.id === 'A');
      if (!anchorA) return state;

      const deltaX = action.x - anchorA.x;
      const deltaY = action.y - anchorA.y;

      for (const a of piece.anchors) {
        a.x += deltaX;
        a.y += deltaY;
      }

      return {
        ...state,
        source,
      };
    }

    case 'nudge-piece': {
      const source = deepClone(state.source);
      const piece = source.pieces.find((p) => p.id === action.id);
      if (!piece) return state;

      const anchorA = piece.anchors.find((a) => a.id === 'A');
      if (!anchorA) return state;

      const newX = Math.max(0, Math.min(GRID_WIDTH - piece.frameSize, anchorA.x + action.dx));
      const newY = Math.max(0, Math.min(GRID_HEIGHT - piece.frameSize, anchorA.y + action.dy));

      const deltaX = newX - anchorA.x;
      const deltaY = newY - anchorA.y;

      for (const a of piece.anchors) {
        a.x += deltaX;
        a.y += deltaY;
      }

      return {
        ...state,
        source,
      };
    }

    case 'rotate-piece': {
      const source = deepClone(state.source);
      const piece = source.pieces.find((p) => p.id === action.id);
      if (!piece) return state;

      piece.orientation = effectiveOrientation(piece.shapeKind, piece.orientation ?? 0, 1);

      return {
        ...state,
        source,
      };
    }

    case 'set-orientation': {
      const current = state.source.pieces.find((p) => p.id === action.id);
      if (!current) return state;
      // Khung phải hợp lệ cho hướng mới: họ Mái cần bội 16, họ Góc chỉ cần bội 8.
      if (!isValidFrame(current.shapeKind, action.orientation, current.frameSize)) {
        return state;
      }
      const source = deepClone(state.source);
      const piece = source.pieces.find((p) => p.id === action.id);
      if (!piece) return state;
      piece.orientation = action.orientation;
      return { ...state, source };
    }

    case 'mirror-piece': {
      const source = deepClone(state.source);
      const piece = source.pieces.find((p) => p.id === action.id);
      if (!piece) return state;

      piece.orientation = mirrorOrientation(piece.shapeKind, piece.orientation ?? 0, 'x');

      const anchorA = piece.anchors.find((a) => a.id === 'A');
      if (anchorA) {
        for (const a of piece.anchors) {
          if (a.id !== 'A') {
            const dx = a.x - anchorA.x;
            a.x = anchorA.x - dx;
            const distractor = source.distractors?.find(
              (d) => d.pieceId === piece.id && d.anchorId === a.id
            );
            if (distractor) {
              distractor.reason = computeDecoyReason(anchorA, a);
            }
          }
        }
      }

      return {
        ...state,
        source,
      };
    }

    case 'duplicate-piece': {
      const source = deepClone(state.source);
      const piece = source.pieces.find((p) => p.id === action.id);
      if (!piece) return state;

      const anchorA = piece.anchors.find((a) => a.id === 'A');
      if (!anchorA) return state;

      const id = nextPieceId(piece.shapeKind, source.pieces);
      const size = piece.frameSize;

      let newX = anchorA.x + 8;
      let newY = anchorA.y + 8;
      if (newX + size > GRID_WIDTH || newY + size > GRID_HEIGHT) {
        newX = anchorA.x - 8;
        newY = anchorA.y - 8;
        if (newX < 0 || newY < 0) {
          newX = anchorA.x;
          newY = anchorA.y;
        }
      }

      const dupPiece: PieceSource = {
        id,
        shapeKind: piece.shapeKind,
        orientation: piece.orientation,
        frameSize: piece.frameSize,
        anchors: [{ id: 'A', x: newX, y: newY }],
      };

      source.pieces.push(dupPiece);

      if (!source.sampleSolutions || source.sampleSolutions.length === 0) {
        source.sampleSolutions = [[]];
      }
      source.sampleSolutions[0].push({
        pieceId: id,
        anchorId: 'A',
        turns: 0,
      });

      return {
        ...state,
        source,
        selectedPieceId: id,
        selectedAnchorId: 'A',
      };
    }

    case 'delete-piece': {
      const source = deepClone(state.source);
      source.pieces = source.pieces.filter((p) => p.id !== action.id);
      if (source.sampleSolutions && source.sampleSolutions[0]) {
        source.sampleSolutions[0] = source.sampleSolutions[0].filter(
          (s) => s.pieceId !== action.id
        );
      }
      if (source.distractors) {
        source.distractors = source.distractors.filter((d) => d.pieceId !== action.id);
      }
      for (const other of source.pieces) {
        if (!other.drives) continue;
        const rest = other.drives.filter((id) => id !== action.id);
        if (rest.length > 0) other.drives = rest;
        else delete other.drives;
      }

      return {
        ...state,
        source,
        selectedPieceId: state.selectedPieceId === action.id ? null : state.selectedPieceId,
        selectedAnchorId: state.selectedPieceId === action.id ? null : state.selectedAnchorId,
      };
    }

    case 'add-decoy': {
      const source = deepClone(state.source);
      const piece = source.pieces.find((p) => p.id === action.pieceId);
      if (!piece) return state;

      const existingIds = new Set(piece.anchors.map((a) => a.id));
      const nextId = DECOY_IDS.find((id) => !existingIds.has(id));
      if (!nextId) return state;

      const anchorA = piece.anchors.find((a) => a.id === 'A');
      if (!anchorA) return state;

      const decoyX = anchorA.x + 8;
      const decoyY = anchorA.y;
      const newAnchor = { id: nextId, x: decoyX, y: decoyY };
      piece.anchors.push(newAnchor);

      if (!source.distractors) source.distractors = [];
      source.distractors.push({
        pieceId: piece.id,
        anchorId: nextId,
        reason: computeDecoyReason(anchorA, newAnchor),
      });

      return {
        ...state,
        source,
        selectedAnchorId: nextId,
      };
    }

    case 'move-decoy': {
      const source = deepClone(state.source);
      const piece = source.pieces.find((p) => p.id === action.pieceId);
      if (!piece) return state;

      const anchor = piece.anchors.find((a) => a.id === action.anchorId);
      if (!anchor) return state;

      anchor.x = action.x;
      anchor.y = action.y;

      const anchorA = piece.anchors.find((a) => a.id === 'A');
      if (anchorA && source.distractors) {
        const distractor = source.distractors.find(
          (d) => d.pieceId === piece.id && d.anchorId === action.anchorId
        );
        if (distractor) {
          distractor.reason = computeDecoyReason(anchorA, anchor);
        }
      }

      return {
        ...state,
        source,
      };
    }

    case 'delete-decoy': {
      const source = deepClone(state.source);
      const piece = source.pieces.find((p) => p.id === action.pieceId);
      if (!piece) return state;

      piece.anchors = piece.anchors.filter((a) => a.id !== action.anchorId);
      if (source.distractors) {
        source.distractors = source.distractors.filter(
          (d) => !(d.pieceId === action.pieceId && d.anchorId === action.anchorId)
        );
      }

      return {
        ...state,
        source,
        selectedAnchorId:
          state.selectedAnchorId === action.anchorId ? 'A' : state.selectedAnchorId,
      };
    }

    case 'set-field': {
      const source = deepClone(state.source);
      (source as any)[action.field] = action.value;
      if (action.field === 'chapter') {
        source.chapter = Number(action.value) as Chapter;
        source.rotationEnabled = chapterAllowsRotation(source.chapter);
        if (!source.rotationEnabled) clearRotationState(source);
      }
      return {
        ...state,
        source,
      };
    }

    case 'set-placement': {
      const source = deepClone(state.source);
      source.placement = action.placement;
      if (action.placement === 'free') {
        for (const p of source.pieces) {
          p.anchors = p.anchors.filter((a) => a.id === 'A');
        }
        source.distractors = [];
      }
      return {
        ...state,
        source,
      };
    }

    case 'set-rotation': {
      const source = deepClone(state.source);
      source.rotationEnabled = action.enabled;
      if (!action.enabled) clearRotationState(source);
      return {
        ...state,
        source,
      };
    }

    case 'set-solution-turns': {
      const source = deepClone(state.source);
      if (source.sampleSolutions && source.sampleSolutions[0]) {
        const step = source.sampleSolutions[0].find((s) => s.pieceId === action.pieceId);
        if (step) {
          step.turns = action.turns;
        }
      }
      return {
        ...state,
        source,
      };
    }

    case 'set-drives': {
      if (!state.source.rotationEnabled) return state;
      const source = deepClone(state.source);
      const piece = source.pieces.find((p) => p.id === action.pieceId);
      if (!piece) return state;
      const wanted = new Set(action.targets);
      const targets = source.pieces.map((p) => p.id).filter((id) => id !== piece.id && wanted.has(id));
      if (targets.length > 0) piece.drives = targets;
      else delete piece.drives;
      return { ...state, source };
    }

    case 'mark-saved': {
      return {
        ...state,
        savedSource: deepClone(state.source),
      };
    }

    case 'load-source': {
      const cloned = deepClone(action.source);
      return {
        source: cloned,
        savedSource: deepClone(cloned),
        selectedPieceId: null,
        selectedAnchorId: null,
      };
    }

    default:
      return state;
  }
}
