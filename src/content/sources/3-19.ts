import type { LevelSource } from '../authoring.ts';

import { piece } from '../kit.ts';
export const man319: LevelSource = {
  id: '3-19',
  title: 'Mũi Giáo Sao',
  chapter: 3,
  order: 57,
  contentRevision: 'mui-giao-sao-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    {
      id: 'P1',
      shapeKind: 'parallelogram',
      orientation: 0,
      frameSize: 48,
      drives: ['P2', 'P3'],
      anchors: [
        { id: 'A', x: 48, y: 24 },
      ],
    },
    {
      id: 'P2',
      shapeKind: 'parallelogram',
      orientation: 0,
      frameSize: 48,
      drives: ['P3', 'P4'],
      anchors: [
        { id: 'A', x: 64, y: 56 },
      ],
    },
    {
      id: 'P3',
      shapeKind: 'parallelogram',
      orientation: 0,
      frameSize: 48,
      drives: ['P1', 'P4'],
      anchors: [
        { id: 'A', x: 32, y: 72 },
      ],
    },
    {
      id: 'P4',
      shapeKind: 'parallelogram',
      orientation: 0,
      frameSize: 48,
      drives: ['P1', 'P2'],
      anchors: [
        { id: 'A', x: 16, y: 40 },
      ],
    },
    {
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 32,
      drives: ['P1', 'P2', 'P3', 'P4'],
      anchors: [
        { id: 'A', x: 48, y: 56 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'P1', anchorId: 'A', turns: 0 },
      { pieceId: 'P2', anchorId: 'A', turns: 1 },
      { pieceId: 'P3', anchorId: 'A', turns: 0 },
      { pieceId: 'P4', anchorId: 'A', turns: 3 },
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Chuỗi chỉ kéo một bước: xoay đầu giáo làm thân xoay, nhưng chân không tự xoay theo thân.',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Một nhịp truyền một đoạn, mũi giáo vạch sáng trời đêm.',
};
