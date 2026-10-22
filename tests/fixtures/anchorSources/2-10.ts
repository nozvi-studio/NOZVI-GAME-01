import type { LevelSource } from '../../../src/content/authoring.ts';

/** 3-7 Hoa Sen: nụ thoi, hai cánh tam giác và hai bình hành mặt nước theo spec C. */
export const hoaSen: LevelSource = {
  id: '2-10', title: 'Hoa Sen', chapter: 2, order: 20,
  contentRevision: 'hoa-sen-v1', rotationEnabled: false,
  pieces: [
    { id: 'P1', shapeKind: 'diamond', orientation: 0, frameSize: 48, anchors: [{ id: 'A', x: 40, y: 56 }, { id: 'B', x: 48, y: 56 }, { id: 'C', x: 32, y: 56 }, { id: 'D', x: 40, y: 64 }] },
    { id: 'P2', shapeKind: 'triangle', orientation: 3, frameSize: 48, anchors: [{ id: 'A', x: 16, y: 48 }, { id: 'B', x: 24, y: 48 }, { id: 'C', x: 8, y: 48 }, { id: 'D', x: 16, y: 56 }] },
    { id: 'P3', shapeKind: 'triangle', orientation: 2, frameSize: 48, anchors: [{ id: 'A', x: 64, y: 48 }, { id: 'B', x: 72, y: 48 }, { id: 'C', x: 56, y: 48 }, { id: 'D', x: 64, y: 56 }] },
    { id: 'W1', shapeKind: 'parallelogram', orientation: 0, frameSize: 48, anchors: [{ id: 'A', x: 16, y: 104 }, { id: 'B', x: 24, y: 104 }, { id: 'C', x: 8, y: 104 }, { id: 'D', x: 16, y: 112 }] },
    { id: 'W2', shapeKind: 'parallelogram', orientation: 2, frameSize: 48, anchors: [{ id: 'A', x: 64, y: 104 }, { id: 'B', x: 72, y: 104 }, { id: 'C', x: 56, y: 104 }, { id: 'D', x: 64, y: 112 }] },
  ],
  sampleSolutions: [[{ pieceId: 'P1', anchorId: 'A', turns: 0 }, { pieceId: 'P2', anchorId: 'A', turns: 0 }, { pieceId: 'P3', anchorId: 'A', turns: 0 }, { pieceId: 'W1', anchorId: 'A', turns: 0 }, { pieceId: 'W2', anchorId: 'A', turns: 0 }]],
  learningObjective: 'Dùng vùng giao mảnh để tách cánh hoa', difficultyEstimate: 3,
  distractors: [
    { pieceId: 'P1', anchorId: 'B', reason: 'Lệch phải 8 ô' }, { pieceId: 'P1', anchorId: 'C', reason: 'Lệch trái 8 ô' }, { pieceId: 'P1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'P2', anchorId: 'B', reason: 'Lệch phải 8 ô' }, { pieceId: 'P2', anchorId: 'C', reason: 'Lệch trái 8 ô' }, { pieceId: 'P2', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'P3', anchorId: 'B', reason: 'Lệch phải 8 ô' }, { pieceId: 'P3', anchorId: 'C', reason: 'Lệch trái 8 ô' }, { pieceId: 'P3', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'W1', anchorId: 'B', reason: 'Lệch phải 8 ô' }, { pieceId: 'W1', anchorId: 'C', reason: 'Lệch trái 8 ô' }, { pieceId: 'W1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'W2', anchorId: 'B', reason: 'Lệch phải 8 ô' }, { pieceId: 'W2', anchorId: 'C', reason: 'Lệch trái 8 ô' }, { pieceId: 'W2', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
  ],
  ftueSteps: [], victoryVerse: 'Sen nở trên mặt nước, không vướng bùn.',
};
