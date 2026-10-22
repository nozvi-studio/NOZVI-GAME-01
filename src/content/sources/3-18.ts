import type { LevelSource } from '../authoring.ts';

import { piece } from '../kit.ts';
export const man318: LevelSource = {
  id: '3-18',
  title: 'Trạm Đáp Mặt Trăng',
  chapter: 3,
  order: 56,
  contentRevision: 'tram-dap-mat-trang-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    {
      id: 'B',
      shapeKind: 'triangle',
      orientation: 1,
      frameSize: 32,
      drives: ['C', 'T1'],
      anchors: [
        { id: 'A', x: 40, y: 56 },
      ],
    },
    {
      id: 'C',
      shapeKind: 'parallelogram',
      orientation: 1,
      frameSize: 48,
      drives: ['B'],
      anchors: [
        { id: 'A', x: 24, y: 72 },
      ],
    },
    {
      id: 'P1',
      shapeKind: 'parallelogram',
      orientation: 3,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 56, y: 40 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 64,
      drives: ['P1'],
      anchors: [
        { id: 'A', x: 24, y: 72 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'B', anchorId: 'A', turns: 1 },
      { pieceId: 'C', anchorId: 'A', turns: 1 },
      { pieceId: 'P1', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Khoang và thân trạm kéo nhau, khoang còn dẫn chân trái; cân chân phải bằng vòng xoay riêng.',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Khoang trạm khép đúng hướng, đôi chân nhẹ chạm miền trăng.',
};
