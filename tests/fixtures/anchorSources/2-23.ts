import type { LevelSource } from '../../../src/content/authoring.ts';

export const manMan216: LevelSource = {
  id: '2-23',
  title: 'Màn man-2-16',
  chapter: 2,
  order: 33,
  contentRevision: 'man-man-2-16-v1',
  rotationEnabled: false,
  pieces: [
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 3,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 56, y: 56 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 56, y: 56 },
      ],
    },
    {
      id: 'T4',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 32, y: 56 },
      ],
    },
    {
      id: 'T5',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 56, y: 56 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'T4', anchorId: 'A', turns: 0 },
      { pieceId: 'T5', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Đặt một mảnh đúng vào bóng mục tiêu',
  difficultyEstimate: 3,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Một mảnh về đúng chỗ, bầu trời thêm một vì sao.',
};
