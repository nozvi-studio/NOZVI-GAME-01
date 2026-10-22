import type { LevelSource } from '../authoring.ts';

import { piece } from '../kit.ts';
export const man320: LevelSource = {
  id: '3-20',
  title: 'Vương Miện Quỹ Đạo',
  chapter: 3,
  order: 58,
  contentRevision: 'vuong-mien-quy-dao-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    {
      id: 'A',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 32,
      drives: ['B', 'P1'],
      anchors: [
        { id: 'A', x: 16, y: 48 },
      ],
    },
    {
      id: 'B',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      drives: ['C', 'P2'],
      anchors: [
        { id: 'A', x: 48, y: 32 },
      ],
    },
    {
      id: 'C',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 16,
      drives: ['A', 'P3'],
      anchors: [
        { id: 'A', x: 96, y: 64 },
      ],
    },
    {
      id: 'P1',
      shapeKind: 'parallelogram',
      orientation: 0,
      frameSize: 24,
      anchors: [
        { id: 'A', x: 88, y: 72 },
      ],
    },
    {
      id: 'P2',
      shapeKind: 'parallelogram',
      orientation: 0,
      frameSize: 72,
      anchors: [
        { id: 'A', x: 24, y: 56 },
      ],
    },
    {
      id: 'P3',
      shapeKind: 'parallelogram',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 0, y: 64 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'A', anchorId: 'A', turns: 1 },
      { pieceId: 'B', anchorId: 'A', turns: 3 },
      { pieceId: 'C', anchorId: 'A', turns: 2 },
      { pieceId: 'P1', anchorId: 'A', turns: 0 },
      { pieceId: 'P2', anchorId: 'A', turns: 0 },
      { pieceId: 'P3', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Ba chóp kéo thành vòng kín: mỗi lần bấm chỉ quay chóp được chọn và chóp kế, bệ xoay độc lập.',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Ba chóp sao nối vòng trời, vương miện khép khi quỹ đạo hòa nhịp.',
};
