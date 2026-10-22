import type { LevelSource } from '../authoring.ts';

import { piece } from '../kit.ts';
export const man315: LevelSource = {
  id: '3-15',
  title: 'Đài Sao Giao Hướng',
  chapter: 3,
  order: 53,
  contentRevision: 'dai-sao-giao-huong-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 48,
      drives: ['T3', 'T4'],
      anchors: [
        { id: 'A', x: 40, y: 56 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 56 },
      ],
    },
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 48,
      drives: ['T2'],
      anchors: [
        { id: 'A', x: 40, y: 56 },
      ],
    },
    {
      id: 'T4',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 48,
      drives: ['T3'],
      anchors: [
        { id: 'A', x: 40, y: 56 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 2 },
      { pieceId: 'T3', anchorId: 'A', turns: 1 },
      { pieceId: 'T4', anchorId: 'A', turns: 3 },
    ],
  ],
  learningObjective: 'Hai mảnh kéo nhau nhưng chỉ chóp kéo chân: dùng nhánh phụ để phân biệt hai nút xoay.',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Chóp đài quay gọi bệ nghiêng, một nhánh sao giữ lời hẹn riêng.',
};
