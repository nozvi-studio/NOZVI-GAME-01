import type { LevelSource } from '../../../src/content/authoring.ts';

export const manMan214: LevelSource = {
  id: '2-21',
  title: 'Màn man-2-14',
  chapter: 2,
  order: 31,
  contentRevision: 'man-man-2-14-v1',
  rotationEnabled: false,
  pieces: [
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 16, y: 56 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 80, y: 56 },
      ],
    },
    {
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 56 },
      ],
    },
    {
      id: 'D1',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 32, y: 56 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'D1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Đặt một mảnh đúng vào bóng mục tiêu',
  difficultyEstimate: 2,
  distractors: [],
  ftueSteps: [],
};
