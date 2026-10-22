export const GRID_WIDTH = 128;
export const GRID_HEIGHT = 160;
export const TOTAL_CELLS = GRID_WIDTH * GRID_HEIGHT;

export type Cell = readonly [number, number];
export type Turns = 0 | 1 | 2 | 3;
export type ShapeKind = 'square' | 'triangle' | 'diamond' | 'circle' | 'parallelogram';
/**
 * Hướng mảnh. Tam giác vuông cân: 0–3 là góc vuông ở góc khung TL/TR/BR/BL,
 * 4–7 là mái có cạnh huyền nằm ở đáy/trái/đỉnh/phải khung. Bình hành: 0 nằm
 * nghiêng phải, 1 đứng, 2 nằm nghiêng trái, 3 đứng. Vuông, thoi, tròn luôn 0.
 */
export type Orientation = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Anchor = Readonly<{ id: string; x: number; y: number }>;

export type Piece = Readonly<{
  id: string;
  frameSize: number;
  cells: readonly Cell[];
  anchors: readonly Anchor[];
  color: 'amber';
  /** Validator luôn điền; literal viết tay trong test domain có thể bỏ trống (renderer coi là thoi) */
  shapeKind?: ShapeKind;
  orientation?: Orientation;
  /** Xoay liên động (chương 3): xoay mảnh này thì các mảnh ở đây cũng xoay một nấc; chiều ngược lại không có */
  drives?: readonly string[];
}>;

/** Năm chương campaign: 1 Khởi Nguyên, 2 Giao Thoa, 3 Luân Chuyển, 4 Hội Tụ (chương xoay), 5 Lăng Kính. */
export type Chapter = 1 | 2 | 3 | 4 | 5;

/** Chế độ đặt mảnh: 'anchors' hít vào neo tác giả đặt; 'free' hít vào mọi giao điểm lưới (spec D) */
export type PlacementMode = 'anchors' | 'free';

export type Level = Readonly<{
  id: string;
  title: string;
  chapter: Chapter;
  contentRevision: string;
  rotationEnabled: boolean;
  /** Validator luôn điền; thiếu trong tài liệu thì là 'anchors' */
  placement: PlacementMode;
  pieces: readonly Piece[];
  targetMask: Uint8Array;
  /** Câu thơ hiện ở màn hoàn thành; màn nào không khai báo thì bỏ qua */
  victoryVerse?: string;
  /** Placement của nghiệm mẫu thứ nhất, để vẽ bóng mục tiêu bằng đa giác thật */
  targetPlacements?: readonly Placement[];
  /**
   * Free placement only: a drop within this squared distance of the piece's
   * `targetPlacements` origin (same turns) snaps onto it. Absent = grid snap only.
   */
  targetSnapRadiusSq?: number;
  /** Expert time in ms for the time-star budget; the validator always sets it. */
  parMs?: number;
}>;

export type Placement = Readonly<{
  pieceId: string;
  x: number;
  y: number;
  turns: Turns;
}>;

export type PieceState =
  | Readonly<{ kind: 'tray'; turns: Turns }>
  | Readonly<{ kind: 'temporary'; x: number; y: number; turns: Turns }>
  | Readonly<{ kind: 'snapped'; anchorId: string; turns: Turns }>
  /** Chỉ ở màn placement 'free': đã hít vào giao điểm lưới (x, y) */
  | Readonly<{ kind: 'placed'; x: number; y: number; turns: Turns }>;

export type PuzzleState = Readonly<{
  levelId: string;
  phase: 'playing' | 'won';
  pieces: Readonly<Record<string, PieceState>>;
}>;

export type Command =
  | { type: 'drop'; pieceId: string; x: number; y: number }
  | { type: 'return'; pieceId: string }
  | { type: 'rotate'; pieceId: string }
  | { type: 'reset' };

export type Outcome =
  | 'snapped'
  | 'temporary'
  | 'tray'
  | 'rotated'
  | 'reset'
  | 'unknown-piece'
  | 'invalid-coordinate'
  | 'rotation-disabled'
  | 'out-of-bounds'
  | 'won';

export type Transition = Readonly<{
  accepted: boolean;
  outcome: Outcome;
  state: PuzzleState;
  mask: Uint8Array;
  changed: readonly number[];
  becameWon: boolean;
}>;
