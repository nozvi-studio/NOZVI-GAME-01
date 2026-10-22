import type { LevelSource } from '../authoring.ts';

export const manMan213: LevelSource = {
  id: '2-20',
  title: 'Màn man-2-13',
  chapter: 2,
  order: 30,
  contentRevision: 'man-man-2-13-v2',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 3,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 72 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 72 },
      ],
    },
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 16, y: 72 },
      ],
    },
    {
      id: 'T4',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 64, y: 72 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'T3', anchorId: 'A', turns: 0 },
      { pieceId: 'T4', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Đặt một mảnh đúng vào bóng mục tiêu',
  difficultyEstimate: 4,
  distractors: [],
  ftueSteps: [],
};
