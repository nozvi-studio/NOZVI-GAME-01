import type { LevelSource } from '../authoring.ts';

import { piece } from '../kit.ts';
export const man311: LevelSource = {
  id: '3-11',
  title: 'Sao Chổi Hội Tụ',
  chapter: 3,
  order: 49,
  contentRevision: 'sao-choi-hoi-tu-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    {
      id: 'A',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 48,
      drives: ['C', 'P1'],
      anchors: [
        { id: 'A', x: 40, y: 32 },
      ],
    },
    {
      id: 'C',
      shapeKind: 'parallelogram',
      orientation: 1,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 64, y: 64 },
      ],
    },
    {
      id: 'P1',
      shapeKind: 'parallelogram',
      orientation: 2,
      frameSize: 48,
      drives: ['C'],
      anchors: [
        { id: 'A', x: 16, y: 64 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 80 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'A', anchorId: 'A', turns: 1 },
      { pieceId: 'C', anchorId: 'A', turns: 1 },
      { pieceId: 'P1', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Hai mảnh cùng dẫn một đuôi sao: cộng các lần xoay rồi chỉnh mảnh nhận.',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Hai dòng sao gặp nhau, chiếc đuôi sáng tìm đúng hướng.',
};
