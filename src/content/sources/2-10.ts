import type { LevelSource } from '../authoring.ts';

/** 3-7 Hoa Sen: nụ thoi, hai cánh tam giác và hai bình hành mặt nước theo spec C. */
export const hoaSen: LevelSource = {
  id: '2-10', title: 'Hoa Sen', chapter: 2, order: 20,
  contentRevision: 'hoa-sen-v2', rotationEnabled: false,
  placement: 'free',
  pieces: [
    { id: 'P1', shapeKind: 'diamond', orientation: 0, frameSize: 48, anchors: [{ id: 'A', x: 40, y: 56 }] },
    { id: 'P2', shapeKind: 'triangle', orientation: 3, frameSize: 48, anchors: [{ id: 'A', x: 16, y: 48 }] },
    { id: 'P3', shapeKind: 'triangle', orientation: 2, frameSize: 48, anchors: [{ id: 'A', x: 64, y: 48 }] },
    { id: 'W1', shapeKind: 'parallelogram', orientation: 0, frameSize: 48, anchors: [{ id: 'A', x: 16, y: 104 }] },
    { id: 'W2', shapeKind: 'parallelogram', orientation: 2, frameSize: 48, anchors: [{ id: 'A', x: 64, y: 104 }] },
  ],
  sampleSolutions: [[{ pieceId: 'P1', anchorId: 'A', turns: 0 }, { pieceId: 'P2', anchorId: 'A', turns: 0 }, { pieceId: 'P3', anchorId: 'A', turns: 0 }, { pieceId: 'W1', anchorId: 'A', turns: 0 }, { pieceId: 'W2', anchorId: 'A', turns: 0 }]],
  learningObjective: 'Dùng vùng giao mảnh để tách cánh hoa', difficultyEstimate: 3,
  distractors: [],
  ftueSteps: [], victoryVerse: 'Sen nở trên mặt nước, không vướng bùn.',
};
