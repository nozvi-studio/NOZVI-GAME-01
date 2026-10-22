import type { LevelSource } from '../../../src/content/authoring.ts';

/**
 * 2-5 Đồng Hồ Cát: Vòng tròn rỗng (tròn 64 trừ tròn 48) ôm chiếc đồng hồ cát hai mái hiện lại ba lớp. Thay bản Chìa Khóa Thời Gian.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const dongHoCat: LevelSource = {
  id: '2-5', title: 'Đồng Hồ Cát', chapter: 2, order: 11,
  contentRevision: 'dong-ho-cat-v1', rotationEnabled: false,
  pieces: [
    { id: 'C1', shapeKind: 'circle', orientation: 0, frameSize: 64, anchors: [
      { id: 'A', x: 32, y: 40 }, { id: 'B', x: 40, y: 40 },
      { id: 'C', x: 24, y: 40 }, { id: 'D', x: 32, y: 48 },
    ] },
    { id: 'C2', shapeKind: 'circle', orientation: 0, frameSize: 48, anchors: [
      { id: 'A', x: 40, y: 48 }, { id: 'B', x: 48, y: 48 },
      { id: 'C', x: 32, y: 48 }, { id: 'D', x: 40, y: 56 },
    ] },
    { id: 'T1', shapeKind: 'triangle', orientation: 6, frameSize: 32, anchors: [
      { id: 'A', x: 48, y: 56 }, { id: 'B', x: 56, y: 56 },
      { id: 'C', x: 40, y: 56 }, { id: 'D', x: 48, y: 64 },
    ] },
    { id: 'T2', shapeKind: 'triangle', orientation: 4, frameSize: 32, anchors: [
      { id: 'A', x: 48, y: 56 }, { id: 'B', x: 56, y: 56 },
      { id: 'C', x: 40, y: 56 }, { id: 'D', x: 48, y: 64 },
    ] },
  ],
  sampleSolutions: [[
    { pieceId: 'C1', anchorId: 'A', turns: 0 },
    { pieceId: 'C2', anchorId: 'A', turns: 0 },
    { pieceId: 'T1', anchorId: 'A', turns: 0 },
    { pieceId: 'T2', anchorId: 'A', turns: 0 },
  ]],
  learningObjective: 'Hai vùng rỗng lồng nhau quanh một hình hiện lại',
  difficultyEstimate: 4,
  distractors: [
    { pieceId: 'C1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'C1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'C1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'C2', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'C2', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'C2', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'T1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'T1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'T1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'T2', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'T2', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'T2', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
  ],
  ftueSteps: [],
  victoryVerse: 'Cát rơi trong vòng tròn, thời gian thành hình.',
};
