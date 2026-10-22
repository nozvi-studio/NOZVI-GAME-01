import type {
  Anchor,
  Command,
  Level,
  Outcome,
  Piece,
  PieceState,
  Placement,
  PuzzleState,
  Transition,
  Turns,
} from './model.ts';
import { TOTAL_CELLS } from './model.ts';
import { fitsBoard, turnedCells } from './geometry.ts';
import { evaluate, matchesTarget } from './mask.ts';
import { freeSnapOrigin } from './freePlacement.ts';
import { occupiedAnchorCoords } from './pieceEquivalence.ts';
import { rotationGroup } from './linkedRotation.ts';

/**
 * Khởi tạo trạng thái ban đầu của màn chơi với tất cả mảnh nằm trong khay (tray) ở góc 0°.
 */
export function createPuzzle(level: Level): PuzzleState {
  const pieces: Record<string, PieceState> = {};
  for (const piece of level.pieces) {
    pieces[piece.id] = { kind: 'tray', turns: 0 };
  }
  return {
    levelId: level.id,
    phase: 'playing',
    pieces,
  };
}

/**
 * Trích xuất danh sách các mảnh đã snap vào neo để tính toán mask.
 * Mảnh đang ở khay (tray) hoặc vị trí tạm (temporary) không tạo placement.
 */
export function placementsOf(level: Level, state: PuzzleState): Placement[] {
  const placements: Placement[] = [];
  for (const [pieceId, pState] of Object.entries(state.pieces)) {
    if (pState.kind === 'placed') {
      // Màn đặt tự do: gốc khung nằm ngay trong trạng thái (FP-04)
      placements.push({ pieceId, x: pState.x, y: pState.y, turns: pState.turns });
    } else if (pState.kind === 'snapped') {
      const piece = level.pieces.find((p) => p.id === pieceId);
      if (!piece) continue;
      const anchor = piece.anchors.find((a) => a.id === pState.anchorId);
      if (!anchor) continue;
      placements.push({
        pieceId,
        x: anchor.x,
        y: anchor.y,
        turns: pState.turns,
      });
    }
  }
  return placements;
}

/**
 * Trạng thái của một mảnh sau khi xoay một nấc tại chỗ (quanh tâm khung), hoặc null
 * nếu ô sau xoay vượt biên. Mảnh trong khay không cần kiểm tra biên.
 */
function rotatedPieceState(piece: Piece, current: PieceState): PieceState | null {
  const nextTurns = (((current.turns + 1) % 4) as Turns);
  const cells = turnedCells(piece, nextTurns);
  switch (current.kind) {
    case 'snapped': {
      const anchor = piece.anchors.find((a) => a.id === current.anchorId);
      if (!anchor || !fitsBoard(cells, anchor.x, anchor.y)) return null;
      return { kind: 'snapped', anchorId: current.anchorId, turns: nextTurns };
    }
    case 'placed':
      return fitsBoard(cells, current.x, current.y) ? { kind: 'placed', x: current.x, y: current.y, turns: nextTurns } : null;
    case 'temporary':
      return fitsBoard(cells, current.x, current.y) ? { kind: 'temporary', x: current.x, y: current.y, turns: nextTurns } : null;
    default:
      return { kind: 'tray', turns: nextTurns };
  }
}

/**
 * Áp dụng một lệnh tương tác lên bàn chơi theo cơ chế giao dịch bất biến (deterministic state machine).
 */
export function applyCommand(level: Level, state: PuzzleState, command: Command): Transition {
  const currentPlacements = placementsOf(level, state);
  const currentMask = evaluate(level, currentPlacements);

  // Khi đã thắng, chỉ chấp nhận lệnh reset
  if (state.phase === 'won' && command.type !== 'reset') {
    return {
      accepted: false,
      outcome: 'won',
      state,
      mask: currentMask,
      changed: [],
      becameWon: false,
    };
  }

  // 1. Lệnh Reset
  if (command.type === 'reset') {
    const nextPieces: Record<string, PieceState> = {};
    for (const piece of level.pieces) {
      nextPieces[piece.id] = { kind: 'tray', turns: 0 };
    }
    const nextState: PuzzleState = {
      levelId: level.id,
      phase: 'playing',
      pieces: nextPieces,
    };
    const nextMask = new Uint8Array(TOTAL_CELLS);
    const changed: number[] = [];
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (currentMask[i] !== 0) changed.push(i);
    }
    return {
      accepted: true,
      outcome: 'reset',
      state: nextState,
      mask: nextMask,
      changed,
      becameWon: false,
    };
  }

  // 2. Lệnh Return (trả mảnh về khay, giữ góc xoay hiện tại)
  if (command.type === 'return') {
    const piece = level.pieces.find((p) => p.id === command.pieceId);
    if (!piece || !state.pieces[command.pieceId]) {
      return {
        accepted: false,
        outcome: 'unknown-piece',
        state,
        mask: currentMask,
        changed: [],
        becameWon: false,
      };
    }

    const currentPieceState = state.pieces[command.pieceId];
    const nextPieces = {
      ...state.pieces,
      [command.pieceId]: { kind: 'tray' as const, turns: currentPieceState.turns },
    };
    const nextState: PuzzleState = {
      ...state,
      pieces: nextPieces,
    };
    const nextPlacements = placementsOf(level, nextState);
    const nextMask = evaluate(level, nextPlacements);
    const changed: number[] = [];
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (currentMask[i] !== nextMask[i]) changed.push(i);
    }
    return {
      accepted: true,
      outcome: 'tray',
      state: nextState,
      mask: nextMask,
      changed,
      becameWon: false,
    };
  }

  // 3. Lệnh Rotate (xoay 90° theo chiều kim đồng hồ quanh tâm khung)
  if (command.type === 'rotate') {
    if (!level.rotationEnabled) {
      return {
        accepted: false,
        outcome: 'rotation-disabled',
        state,
        mask: currentMask,
        changed: [],
        becameWon: false,
      };
    }

    const piece = level.pieces.find((p) => p.id === command.pieceId);
    if (!piece || !state.pieces[command.pieceId]) {
      return {
        accepted: false,
        outcome: 'unknown-piece',
        state,
        mask: currentMask,
        changed: [],
        becameWon: false,
      };
    }

    // Xoay liên động: mảnh được bấm và các mảnh nó dẫn cùng xoay một nấc; có mảnh vượt biên thì từ chối cả lệnh
    const nextPieces: Record<string, PieceState> = { ...state.pieces };
    for (const id of rotationGroup(level, command.pieceId)) {
      const member = level.pieces.find((p) => p.id === id)!;
      const turned = rotatedPieceState(member, state.pieces[id]);
      if (!turned) {
        return {
          accepted: false,
          outcome: 'out-of-bounds',
          state,
          mask: currentMask,
          changed: [],
          becameWon: false,
        };
      }
      nextPieces[id] = turned;
    }
    const nextState: PuzzleState = {
      ...state,
      pieces: nextPieces,
    };
    const nextPlacements = placementsOf(level, nextState);
    const nextMask = evaluate(level, nextPlacements);
    const changed: number[] = [];
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (currentMask[i] !== nextMask[i]) changed.push(i);
    }

    const isWon = matchesTarget(nextMask, level.targetMask);
    if (isWon) {
      return {
        accepted: true,
        outcome: 'won',
        state: { ...nextState, phase: 'won' },
        mask: nextMask,
        changed,
        becameWon: true,
      };
    }

    return {
      accepted: true,
      outcome: 'rotated',
      state: nextState,
      mask: nextMask,
      changed,
      becameWon: false,
    };
  }

  // 4. Lệnh Drop (thả mảnh vào bàn cờ)
  if (command.type === 'drop') {
    if (!Number.isInteger(command.x) || !Number.isInteger(command.y)) {
      return {
        accepted: false,
        outcome: 'invalid-coordinate',
        state,
        mask: currentMask,
        changed: [],
        becameWon: false,
      };
    }

    const piece = level.pieces.find((p) => p.id === command.pieceId);
    if (!piece || !state.pieces[command.pieceId]) {
      return {
        accepted: false,
        outcome: 'unknown-piece',
        state,
        mask: currentMask,
        changed: [],
        becameWon: false,
      };
    }

    const currentPieceState = state.pieces[command.pieceId];
    const turns = currentPieceState.turns;
    let nextPieceState: PieceState;
    let outcome: Outcome;

    if (level.placement === 'free') {
      // Free placement: target snap when the level opts in (TSN), else nearest grid intersection (FP-03).
      // Outcome vẫn là 'snapped' để FTUE, telemetry và hiệu ứng snap dùng chung.
      const origin = freeSnapOrigin(level, piece, turns, command.x, command.y);
      if (origin) {
        nextPieceState = { kind: 'placed', x: origin.x, y: origin.y, turns };
        outcome = 'snapped';
      } else {
        nextPieceState = { kind: 'temporary', x: command.x, y: command.y, turns };
        outcome = 'temporary';
      }
    } else {
      const rotatedCells = turnedCells(piece, turns);

      const occupiedCoords = occupiedAnchorCoords(level, state, piece);

      // Tìm neo gần nhất trong bán kính 6 ô (d^2 <= 36)
      // Phép so d < bestDistance giữ neo đứng trước khi khoảng cách bằng nhau (tie)
      let best: Anchor | undefined;
      let bestDistance = Infinity;
      for (const anchor of piece.anchors) {
        if (occupiedCoords.has(`${anchor.x},${anchor.y}`)) continue;
        const d = (anchor.x - command.x) ** 2 + (anchor.y - command.y) ** 2;
        if (d <= 36 && d < bestDistance && fitsBoard(rotatedCells, anchor.x, anchor.y)) {
          best = anchor;
          bestDistance = d;
        }
      }

      if (best) {
        nextPieceState = { kind: 'snapped', anchorId: best.id, turns };
        outcome = 'snapped';
      } else {
        nextPieceState = { kind: 'temporary', x: command.x, y: command.y, turns };
        outcome = 'temporary';
      }
    }

    const nextPieces = {
      ...state.pieces,
      [command.pieceId]: nextPieceState,
    };
    const nextState: PuzzleState = {
      ...state,
      pieces: nextPieces,
    };
    const nextPlacements = placementsOf(level, nextState);
    const nextMask = evaluate(level, nextPlacements);
    const changed: number[] = [];
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (currentMask[i] !== nextMask[i]) changed.push(i);
    }

    const isWon = matchesTarget(nextMask, level.targetMask);
    if (isWon) {
      return {
        accepted: true,
        outcome: 'won',
        state: { ...nextState, phase: 'won' },
        mask: nextMask,
        changed,
        becameWon: true,
      };
    }

    return {
      accepted: true,
      outcome,
      state: nextState,
      mask: nextMask,
      changed,
      becameWon: false,
    };
  }

  return {
    accepted: false,
    outcome: 'unknown-piece',
    state,
    mask: currentMask,
    changed: [],
    becameWon: false,
  };
}
