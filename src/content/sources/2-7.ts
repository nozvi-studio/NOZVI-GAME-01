import type { LevelSource } from '../authoring.ts';

/** 3-1 Nhật Nguyệt Song Huyền: hai vầng tròn và ngôi sao thoi theo spec C. */
export const nhatNguyet: LevelSource = {
  id: '2-7', title: 'Nhật Nguyệt Song Huyền', chapter: 2, order: 17,
  contentRevision: 'nhat-nguyet-v2', rotationEnabled: false,
  placement: 'free',
  pieces: [
    { id: 'C1', shapeKind: 'circle', orientation: 0, frameSize: 64, anchors: [{ id: 'A', x: 16, y: 48 }] },
    { id: 'C2', shapeKind: 'circle', orientation: 0, frameSize: 64, anchors: [{ id: 'A', x: 48, y: 48 }] },
    { id: 'K1', shapeKind: 'diamond', orientation: 0, frameSize: 16, anchors: [{ id: 'A', x: 56, y: 72 }] },
  ],
  sampleSolutions: [[{ pieceId: 'C1', anchorId: 'A', turns: 0 }, { pieceId: 'C2', anchorId: 'A', turns: 0 }, { pieceId: 'K1', anchorId: 'A', turns: 0 }]],
  learningObjective: 'Làm quen hình tròn và vùng giao cong', difficultyEstimate: 2,
  distractors: [],
  ftueSteps: [{ id: 'circle-parity', trigger: 'idle', end: 'drag-start', text: 'Hình tròn cũng tuân theo luật chẵn lẻ' }],
  victoryVerse: 'Mặt trời và mặt trăng gặp nhau, sinh ra một vì sao.',
};
