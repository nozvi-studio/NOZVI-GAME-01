import type { LevelSource } from '../../../src/content/authoring.ts';

export const manMan218: LevelSource = {
  id: '2-25',
  title: 'Màn man-2-18',
  chapter: 2,
  order: 35,
  contentRevision: 'man-man-2-18-v1',
  rotationEnabled: false,
  pieces: [
    {
      id: 'D2',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 56 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 40, y: 48 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 40, y: 80 },
      ],
    },
    {
      id: 'T4',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 40, y: 64 },
      ],
    },
    {
      id: 'T6',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 72, y: 64 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'D2', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'T4', anchorId: 'A', turns: 0 },
      { pieceId: 'T6', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Đặt một mảnh đúng vào bóng mục tiêu',
  difficultyEstimate: 4,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Một mảnh về đúng chỗ, bầu trời thêm một vì sao.',
};
