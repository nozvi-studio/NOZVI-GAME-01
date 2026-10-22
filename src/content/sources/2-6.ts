import type { LevelSource } from '../authoring.ts';

/** 2-6 Đại Ấn Hộ Mệnh: bốn tầng vuông/thoi đồng tâm theo spec C. */
export const daiAn: LevelSource = {
  id: '2-6', title: 'Đại Ấn Hộ Mệnh', chapter: 2, order: 12,
  contentRevision: 'dai-an-v2', rotationEnabled: false,
  placement: 'free',
  pieces: [
    { id: 'S1', shapeKind: 'square', orientation: 0, frameSize: 64, anchors: [{ id: 'A', x: 32, y: 48 }] },
    { id: 'D1', shapeKind: 'diamond', orientation: 0, frameSize: 64, anchors: [{ id: 'A', x: 32, y: 48 }] },
    { id: 'S2', shapeKind: 'square', orientation: 0, frameSize: 32, anchors: [{ id: 'A', x: 48, y: 64 }] },
    { id: 'D2', shapeKind: 'diamond', orientation: 0, frameSize: 32, anchors: [{ id: 'A', x: 48, y: 64 }] },
  ],
  sampleSolutions: [[{ pieceId: 'S1', anchorId: 'A', turns: 0 }, { pieceId: 'D1', anchorId: 'A', turns: 0 }, { pieceId: 'S2', anchorId: 'A', turns: 0 }, { pieceId: 'D2', anchorId: 'A', turns: 0 }]],
  learningObjective: 'Đọc được nhiều tầng chẵn lẻ xen kẽ', difficultyEstimate: 4,
  distractors: [],
  ftueSteps: [], victoryVerse: 'Bốn tầng ấn khép lại, lời hộ mệnh đã thành.',
};
