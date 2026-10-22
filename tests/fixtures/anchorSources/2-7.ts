import type { LevelSource } from '../../../src/content/authoring.ts';

/** 3-1 Nhật Nguyệt Song Huyền: hai vầng tròn và ngôi sao thoi theo spec C. */
export const nhatNguyet: LevelSource = {
  id: '2-7', title: 'Nhật Nguyệt Song Huyền', chapter: 2, order: 17,
  contentRevision: 'nhat-nguyet-v1', rotationEnabled: false,
  pieces: [
    { id: 'C1', shapeKind: 'circle', orientation: 0, frameSize: 64, anchors: [{ id: 'A', x: 16, y: 48 }, { id: 'B', x: 24, y: 48 }, { id: 'C', x: 8, y: 48 }, { id: 'D', x: 16, y: 56 }] },
    { id: 'C2', shapeKind: 'circle', orientation: 0, frameSize: 64, anchors: [{ id: 'A', x: 48, y: 48 }, { id: 'B', x: 56, y: 48 }, { id: 'C', x: 40, y: 48 }, { id: 'D', x: 48, y: 56 }] },
    { id: 'K1', shapeKind: 'diamond', orientation: 0, frameSize: 16, anchors: [{ id: 'A', x: 56, y: 72 }, { id: 'B', x: 64, y: 72 }, { id: 'C', x: 48, y: 72 }, { id: 'D', x: 56, y: 80 }] },
  ],
  sampleSolutions: [[{ pieceId: 'C1', anchorId: 'A', turns: 0 }, { pieceId: 'C2', anchorId: 'A', turns: 0 }, { pieceId: 'K1', anchorId: 'A', turns: 0 }]],
  learningObjective: 'Làm quen hình tròn và vùng giao cong', difficultyEstimate: 2,
  distractors: [
    { pieceId: 'C1', anchorId: 'B', reason: 'Lệch phải 8 ô' }, { pieceId: 'C1', anchorId: 'C', reason: 'Lệch trái 8 ô' }, { pieceId: 'C1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'C2', anchorId: 'B', reason: 'Lệch phải 8 ô' }, { pieceId: 'C2', anchorId: 'C', reason: 'Lệch trái 8 ô' }, { pieceId: 'C2', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'K1', anchorId: 'B', reason: 'Lệch phải 8 ô' }, { pieceId: 'K1', anchorId: 'C', reason: 'Lệch trái 8 ô' }, { pieceId: 'K1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
  ],
  ftueSteps: [{ id: 'circle-parity', trigger: 'idle', end: 'drag-start', text: 'Hình tròn cũng tuân theo luật chẵn lẻ' }],
  victoryVerse: 'Mặt trời và mặt trăng gặp nhau, sinh ra một vì sao.',
};
