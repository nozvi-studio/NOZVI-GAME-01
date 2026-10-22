import type { LevelSource } from '../authoring.ts';

export const baoNgocLucGiac: LevelSource = {
  id: '1-10',
  title: 'Bảo Ngọc Lục Giác',
  chapter: 1,
  order: 10,
  contentRevision: 'bao-ngoc-v2',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'D1',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 64 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 0,
      frameSize: 24,
      anchors: [
        { id: 'A', x: 40, y: 64 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 1,
      frameSize: 24,
      anchors: [
        { id: 'A', x: 64, y: 64 },
      ],
    },
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 24,
      anchors: [
        { id: 'A', x: 64, y: 88 },
      ],
    },
    {
      id: 'T4',
      shapeKind: 'triangle',
      orientation: 3,
      frameSize: 24,
      anchors: [
        { id: 'A', x: 40, y: 88 },
      ],
    },
    {
      id: 'C1',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 16 },
      ],
    },
    {
      id: 'C2',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 112 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'D1', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'T3', anchorId: 'A', turns: 0 },
      { pieceId: 'T4', anchorId: 'A', turns: 0 },
      { pieceId: 'C1', anchorId: 'A', turns: 0 },
      { pieceId: 'C2', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Viên thoi ẩn giữa lòng khối vuông, hai mũ nhọn chốt hình',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Viên ngọc lục giác lấp lánh, ánh sáng đầu tiên của thiên hà.',
};
