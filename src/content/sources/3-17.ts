import type { LevelSource } from '../authoring.ts';

import { piece } from '../kit.ts';
export const man317: LevelSource = {
  id: '3-17',
  title: 'Kính Vọng Thiên Hà',
  chapter: 3,
  order: 55,
  contentRevision: 'kinh-vong-thien-ha-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    {
      id: 'P1',
      shapeKind: 'parallelogram',
      orientation: 1,
      frameSize: 48,
      drives: ['P2'],
      anchors: [
        { id: 'A', x: 48, y: 72 },
      ],
    },
    {
      id: 'P2',
      shapeKind: 'parallelogram',
      orientation: 1,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 32, y: 56 },
      ],
    },
    {
      id: 'P3',
      shapeKind: 'parallelogram',
      orientation: 3,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 64, y: 72 },
      ],
    },
    {
      id: 'P4',
      shapeKind: 'parallelogram',
      orientation: 3,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 16, y: 56 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      drives: ['P3'],
      anchors: [
        { id: 'A', x: 48, y: 88 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      drives: ['P4'],
      anchors: [
        { id: 'A', x: 32, y: 40 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'P1', anchorId: 'A', turns: 0 },
      { pieceId: 'P2', anchorId: 'A', turns: 2 },
      { pieceId: 'P3', anchorId: 'A', turns: 0 },
      { pieceId: 'P4', anchorId: 'A', turns: 2 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 2 },
    ],
  ],
  learningObjective: 'Ống kính và miệng kính kéo nhau, ống còn kéo giá đỡ; chân kính xoay độc lập.',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Miệng kính hướng trời sâu, chân đế đứng yên đợi ánh sao.',
};
