import type { LevelSource } from '../authoring.ts';

import { piece } from '../kit.ts';
export const man314: LevelSource = {
  id: '3-14',
  title: 'Tháp Quan Tinh',
  chapter: 3,
  order: 52,
  contentRevision: 'thap-quan-tinh-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    {
      id: 'A',
      shapeKind: 'parallelogram',
      orientation: 0,
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
      anchors: [
        { id: 'A', x: 48, y: 80 },
      ],
    },
    {
      id: 'P2',
      shapeKind: 'parallelogram',
      orientation: 2,
      frameSize: 48,
      drives: ['A', 'P1'],
      anchors: [
        { id: 'A', x: 32, y: 64 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 32,
      drives: ['A'],
      anchors: [
        { id: 'A', x: 80, y: 64 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 32, y: 80 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'A', anchorId: 'A', turns: 1 },
      { pieceId: 'P1', anchorId: 'A', turns: 0 },
      { pieceId: 'P2', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 2 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Thân tháp kéo hai nhánh, chân trái cùng kéo nhánh phải; giữ chân giữa độc lập.',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Từ chân tháp tới chóp trời, từng vòng quay nâng mắt nhìn sao.',
};
