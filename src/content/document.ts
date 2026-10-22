import type { Cell, Chapter, Level, Orientation, PlacementMode, ShapeKind, Turns } from '../domain/model.ts';

export type ManifestEntry = {
  id: string;
  title: string;
  chapter: Chapter;
  order: number;
  contentRevision: string;
  status: 'planned' | 'authored' | 'validated' | 'approved';
  dataPath?: string;
};

export type LevelDocument = {
  schemaVersion: 1;
  id: string;
  title: string;
  chapter: Chapter;
  order: number;
  contentRevision: string;
  board: { width: 128; height: 160 };
  rotationEnabled: boolean;
  /** Chế độ đặt mảnh (spec D, FP-01). Thiếu thì là 'anchors'; màn neo không ghi khoá này. */
  placement?: PlacementMode;
  /** Người review cho phát hành dù bộ giải chưa chứng minh nghiệm duy nhất (FP-09) */
  allowUnproven?: { reason: string };
  pieces: Array<{
    id: string;
    shapeKind: ShapeKind;
    /** Bắt buộc với tam giác (0–7) và bình hành (0–3); vuông, thoi, tròn bỏ trống hoặc 0 */
    orientation?: Orientation;
    frameSize: number;
    cells: Cell[];
    anchors: Array<{ id: string; x: number; y: number }>;
    /** Id các mảnh xoay theo khi mảnh này xoay (một chiều, một bước); chỉ ở màn xoay */
    drives?: string[];
    color: 'amber';
  }>;
  targetCells: Cell[];
  sampleSolutions: Array<Array<{ pieceId: string; anchorId: string; turns: Turns }>>;
  learningObjective: string;
  /** Câu thơ hiện ở màn hoàn thành; màn nào không có thì ẩn dòng này */
  victoryVerse?: string;
  /** Expert time in ms (par), computed by `content:author` from `sampleSolutions[0]`. */
  parMs?: number;
  difficultyEstimate: 1 | 2 | 3 | 4 | 5;
  distractors: Array<{ pieceId: string; anchorId?: string; reason: string }>;
  ftueSteps: Array<{
    id: string;
    trigger: 'idle' | 'first-snap' | 'two-layers' | 'three-layers';
    end: 'drag-start' | 'snap' | 'two-layers' | 'three-layers';
    text: string;
  }>;
};

export type ValidationIssue = {
  levelId: string;
  field: string;
  code: string;
};

export type ValidationResult =
  | { ok: true; level: Level }
  | { ok: false; issues: ValidationIssue[] };
