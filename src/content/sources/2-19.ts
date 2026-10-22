import type { LevelSource } from '../authoring.ts';

export const manMan212: LevelSource = {
  id: '2-19',
  title: 'Màn man-2-12',
  chapter: 2,
  order: 29,
  contentRevision: 'man-man-2-12-v2',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 64,
      anchors: [
        { id: 'A', x: 32, y: 32 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 40 },
      ],
    },
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 88 },
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
  difficultyEstimate: 3,
  distractors: [],
  ftueSteps: [],
};
