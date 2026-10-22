import type { LevelSource } from '../authoring.ts';

export const manMan220: LevelSource = {
  id: '2-27',
  title: 'Màn man-2-20',
  chapter: 2,
  order: 37,
  contentRevision: 'man-man-2-20-v2',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 80,
      anchors: [
        { id: 'A', x: 48, y: 32 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 48, y: 64 },
      ],
    },
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 48, y: 32 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'T3', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Đặt một mảnh đúng vào bóng mục tiêu',
  difficultyEstimate: 2,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Một mảnh về đúng chỗ, bầu trời thêm một vì sao.',
};
