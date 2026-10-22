import type { LevelSource } from '../authoring.ts';

/**
 * 3-6 Mèo Thần: Đầu vuông, hai tai tam giác nhỏ, hai mắt thoi rỗng, thân mái lớn, đuôi bình hành.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const meoThan: LevelSource = {
  id: '2-9',
  title: 'Mèo Thần',
  chapter: 2,
  order: 19,
  contentRevision: 'meo-than-v2',
  rotationEnabled: false,
  placement: 'free',
  allowUnproven: { reason: 'Solver cannot enumerate free poses with overlaps for this many pieces; reviewer played and approved the level.' },
  pieces: [
    {
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 40, y: 24 },
      ],
    },
    {
      id: 'E1',
      shapeKind: 'triangle',
      orientation: 3,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 40, y: 8 },
      ],
    },
    {
      id: 'E2',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 56, y: 8 },
      ],
    },
    {
      id: 'B1',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 96,
      anchors: [
        { id: 'A', x: 8, y: 8 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'parallelogram',
      orientation: 1,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 88, y: 56 },
      ],
    },
    {
      id: 'Y1',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 40, y: 32 },
      ],
    },
    {
      id: 'Y2',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 56, y: 32 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'E1', anchorId: 'A', turns: 0 },
      { pieceId: 'E2', anchorId: 'A', turns: 0 },
      { pieceId: 'B1', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'Y1', anchorId: 'A', turns: 0 },
      { pieceId: 'Y2', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Ghép bảy mảnh, nhận ra bình hành và tam giác nhỏ',
  difficultyEstimate: 4,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Mèo thần ngồi canh cửa giữa hai thế giới.',
};
