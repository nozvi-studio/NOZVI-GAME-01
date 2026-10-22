import type { LevelSource } from '../authoring.ts';

/**
 * 2-4 Mắt Tiên Tri: Hai thoi lồng ngang thành mí mắt; vùng giao rỗng ôm con ngươi sáng.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const matTienTri: LevelSource = {
  id: '2-4', title: 'Mắt Tiên Tri', chapter: 2, order: 10,
  contentRevision: 'mat-tien-tri-v2', rotationEnabled: false,
  placement: 'free',
  pieces: [
    { id: 'D1', shapeKind: 'diamond', orientation: 0, frameSize: 64, anchors: [
      { id: 'A', x: 16, y: 48 },
    ] },
    { id: 'D2', shapeKind: 'diamond', orientation: 0, frameSize: 64, anchors: [
      { id: 'A', x: 48, y: 48 },
    ] },
    { id: 'P1', shapeKind: 'diamond', orientation: 0, frameSize: 16, anchors: [
      { id: 'A', x: 56, y: 72 },
    ] },
  ],
  sampleSolutions: [[
    { pieceId: 'D1', anchorId: 'A', turns: 0 },
    { pieceId: 'D2', anchorId: 'A', turns: 0 },
    { pieceId: 'P1', anchorId: 'A', turns: 0 },
  ]],
  learningObjective: 'Kết hợp vùng rỗng và vùng hiện lại trong cùng một hình',
  difficultyEstimate: 3,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Con mắt mở ra, thấy trước điều chưa tới.',
};
