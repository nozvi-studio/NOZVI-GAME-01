import type { LevelSource } from '../../../src/content/authoring.ts';

export const manMan217: LevelSource = {
  id: '2-24',
  title: 'Màn man-2-17',
  chapter: 2,
  order: 34,
  contentRevision: 'man-man-2-17-v1',
  rotationEnabled: false,
  pieces: [
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 64,
      anchors: [
        { id: 'A', x: 32, y: 80 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 32 },
        { id: 'B', x: 48, y: 32 },
        { id: 'C', x: 48, y: 32 },
      ],
    },
    {
      id: 'D1',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 56 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'D1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Đặt một mảnh đúng vào bóng mục tiêu',
  difficultyEstimate: 2,
  distractors: [
    { pieceId: 'T2', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'T2', anchorId: 'C', reason: 'Lệch phải 8 ô' },
  ],
  ftueSteps: [],
  victoryVerse: 'Một mảnh về đúng chỗ, bầu trời thêm một vì sao.',
};
