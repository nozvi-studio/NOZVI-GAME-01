import type { LevelSource } from '../authoring.ts';

import { piece } from '../kit.ts';
export const man313: LevelSource = {
  id: '3-13',
  title: 'Vệ Tinh Đôi Cánh',
  chapter: 3,
  order: 51,
  contentRevision: 've-tinh-doi-canh-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    {
      id: 'A',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 32,
      drives: ['B', 'C'],
      anchors: [
        { id: 'A', x: 48, y: 64 },
      ],
    },
    {
      id: 'B',
      shapeKind: 'parallelogram',
      orientation: 2,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 16, y: 64 },
      ],
    },
    {
      id: 'C',
      shapeKind: 'parallelogram',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 64, y: 64 },
      ],
    },
    {
      id: 'D',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 32,
      drives: ['C'],
      anchors: [
        { id: 'A', x: 48, y: 32 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'A', anchorId: 'A', turns: 0 },
      { pieceId: 'B', anchorId: 'A', turns: 1 },
      { pieceId: 'C', anchorId: 'A', turns: 1 },
      { pieceId: 'D', anchorId: 'A', turns: 2 },
    ],
  ],
  learningObjective: 'Mảnh giữa dẫn hai cánh, chóp trên cùng dẫn cánh phải; chỉnh đuôi độc lập sau cùng.',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Hai cánh mở giữa trời xa, mọi tín hiệu cùng về một ngôi sao.',
};
