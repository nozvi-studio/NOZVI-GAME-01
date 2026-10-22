import type { LevelSource } from '../authoring.ts';

/**
 * 2-5 Đồng Hồ Cát: Vòng tròn rỗng (tròn 64 trừ tròn 48) ôm chiếc đồng hồ cát hai mái hiện lại ba lớp. Thay bản Chìa Khóa Thời Gian.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const dongHoCat: LevelSource = {
  id: '2-5', title: 'Đồng Hồ Cát', chapter: 2, order: 11,
  contentRevision: 'dong-ho-cat-v2', rotationEnabled: false,
  placement: 'free',
  pieces: [
    { id: 'C1', shapeKind: 'circle', orientation: 0, frameSize: 64, anchors: [
      { id: 'A', x: 32, y: 40 },
    ] },
    { id: 'C2', shapeKind: 'circle', orientation: 0, frameSize: 48, anchors: [
      { id: 'A', x: 40, y: 48 },
    ] },
    { id: 'T1', shapeKind: 'triangle', orientation: 6, frameSize: 32, anchors: [
      { id: 'A', x: 48, y: 56 },
    ] },
    { id: 'T2', shapeKind: 'triangle', orientation: 4, frameSize: 32, anchors: [
      { id: 'A', x: 48, y: 56 },
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
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Cát rơi trong vòng tròn, thời gian thành hình.',
};
