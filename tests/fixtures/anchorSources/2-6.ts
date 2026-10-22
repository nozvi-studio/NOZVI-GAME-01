import type { LevelSource } from '../../../src/content/authoring.ts';

/** 2-6 Đại Ấn Hộ Mệnh: bốn tầng vuông/thoi đồng tâm theo spec C. */
export const daiAn: LevelSource = {
  id: '2-6', title: 'Đại Ấn Hộ Mệnh', chapter: 2, order: 12,
  contentRevision: 'dai-an-v1', rotationEnabled: false,
  pieces: [
    { id: 'S1', shapeKind: 'square', orientation: 0, frameSize: 64, anchors: [{ id: 'A', x: 32, y: 48 }, { id: 'B', x: 40, y: 48 }, { id: 'C', x: 24, y: 48 }, { id: 'D', x: 32, y: 56 }] },
    { id: 'D1', shapeKind: 'diamond', orientation: 0, frameSize: 64, anchors: [{ id: 'A', x: 32, y: 48 }, { id: 'B', x: 40, y: 48 }, { id: 'C', x: 24, y: 48 }, { id: 'D', x: 32, y: 56 }] },
    { id: 'S2', shapeKind: 'square', orientation: 0, frameSize: 32, anchors: [{ id: 'A', x: 48, y: 64 }, { id: 'B', x: 56, y: 64 }, { id: 'C', x: 40, y: 64 }, { id: 'D', x: 48, y: 72 }] },
    { id: 'D2', shapeKind: 'diamond', orientation: 0, frameSize: 32, anchors: [{ id: 'A', x: 48, y: 64 }, { id: 'B', x: 56, y: 64 }, { id: 'C', x: 40, y: 64 }, { id: 'D', x: 48, y: 72 }] },
  ],
  sampleSolutions: [[{ pieceId: 'S1', anchorId: 'A', turns: 0 }, { pieceId: 'D1', anchorId: 'A', turns: 0 }, { pieceId: 'S2', anchorId: 'A', turns: 0 }, { pieceId: 'D2', anchorId: 'A', turns: 0 }]],
  learningObjective: 'Đọc được nhiều tầng chẵn lẻ xen kẽ', difficultyEstimate: 4,
  distractors: [
    { pieceId: 'S1', anchorId: 'B', reason: 'Lệch phải 8 ô' }, { pieceId: 'S1', anchorId: 'C', reason: 'Lệch trái 8 ô' }, { pieceId: 'S1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'D1', anchorId: 'B', reason: 'Lệch phải 8 ô' }, { pieceId: 'D1', anchorId: 'C', reason: 'Lệch trái 8 ô' }, { pieceId: 'D1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'S2', anchorId: 'B', reason: 'Lệch phải 8 ô' }, { pieceId: 'S2', anchorId: 'C', reason: 'Lệch trái 8 ô' }, { pieceId: 'S2', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'D2', anchorId: 'B', reason: 'Lệch phải 8 ô' }, { pieceId: 'D2', anchorId: 'C', reason: 'Lệch trái 8 ô' }, { pieceId: 'D2', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
  ],
  ftueSteps: [], victoryVerse: 'Bốn tầng ấn khép lại, lời hộ mệnh đã thành.',
};
