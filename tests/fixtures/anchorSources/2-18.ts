import type { LevelSource } from '../../../src/content/authoring.ts';

export const manMan211: LevelSource = {
  id: '2-18',
  title: 'Màn man-2-11',
  chapter: 2,
  order: 28,
  contentRevision: 'man-man-2-11-v1',
  rotationEnabled: false,
  pieces: [
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 0, y: 48 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 48, y: 48 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 48, y: 48 },
      ],
    },
    {
      id: 'D1',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 48, y: 48 },
      ],
    },
    {
      id: 'T4',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 72, y: 48 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'T3', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'D1', anchorId: 'A', turns: 0 },
      { pieceId: 'T4', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Đặt một mảnh đúng vào bóng mục tiêu',
  difficultyEstimate: 1,
  distractors: [],
  ftueSteps: [],
};
