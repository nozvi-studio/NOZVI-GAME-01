import type { LevelSource } from '../../../src/content/authoring.ts';

export const manMan27: LevelSource = {
  id: '2-14',
  title: 'Màn man-2-7',
  chapter: 2,
  order: 24,
  contentRevision: 'man-man-2-7-v1',
  rotationEnabled: false,
  pieces: [
    {
      id: 'D1',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 64,
      anchors: [
        { id: 'A', x: 32, y: 48 },
      ],
    },
    {
      id: 'D2',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 80 },
      ],
    },
    {
      id: 'D3',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 24, y: 48 },
      ],
    },
    {
      id: 'D4',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 56, y: 48 },
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
  difficultyEstimate: 1,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Một mảnh về đúng chỗ, bầu trời thêm một vì sao.',
};
