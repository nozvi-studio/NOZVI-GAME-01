import type { LevelSource } from '../../../src/content/authoring.ts';

export const manMan219: LevelSource = {
  id: '2-26',
  title: 'Màn man-2-19',
  chapter: 2,
  order: 36,
  contentRevision: 'man-man-2-19-v1',
  rotationEnabled: false,
  pieces: [
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
      id: 'D2',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 40, y: 64 },
      ],
    },
    {
      id: 'D3',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 56, y: 64 },
      ],
    },
    {
      id: 'D4',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 56 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'D1', anchorId: 'A', turns: 0 },
      { pieceId: 'D2', anchorId: 'A', turns: 0 },
      { pieceId: 'D3', anchorId: 'A', turns: 0 },
      { pieceId: 'D4', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Đặt một mảnh đúng vào bóng mục tiêu',
  difficultyEstimate: 3,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Một mảnh về đúng chỗ, bầu trời thêm một vì sao.',
};
