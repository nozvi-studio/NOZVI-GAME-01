import type { LevelSource } from '../authoring.ts';

export const manMan28: LevelSource = {
  id: '2-15',
  title: 'Màn man-2-8',
  chapter: 2,
  order: 25,
  contentRevision: 'man-man-2-8-v2',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'P1',
      shapeKind: 'parallelogram',
      orientation: 0,
      frameSize: 72,
      anchors: [
        { id: 'A', x: 16, y: 56 },
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
    {
      id: 'P2',
      shapeKind: 'parallelogram',
      orientation: 2,
      frameSize: 72,
      anchors: [
        { id: 'A', x: 40, y: 56 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'P1', anchorId: 'A', turns: 0 },
      { pieceId: 'D1', anchorId: 'A', turns: 0 },
      { pieceId: 'P2', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Đặt một mảnh đúng vào bóng mục tiêu',
  difficultyEstimate: 1,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Một mảnh về đúng chỗ, bầu trời thêm một vì sao.',
};
