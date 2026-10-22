import type { LevelSource } from '../authoring.ts';

/**
 * 3-10 Mandala Thiên Cầu: Năm mảnh chung tâm tạo năm tầng chẵn lẻ xen kẽ.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const mandala: LevelSource = {
  id: '2-13',
  title: 'Mandala Thiên Cầu',
  chapter: 2,
  order: 23,
  contentRevision: 'mandala-v2',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    { id: 'C1', shapeKind: 'circle', orientation: 0, frameSize: 96, anchors: [
      { id: 'A', x: 16, y: 32 },
    ] },
    { id: 'S1', shapeKind: 'square', orientation: 0, frameSize: 64, anchors: [
      { id: 'A', x: 32, y: 48 },
    ] },
    { id: 'D1', shapeKind: 'diamond', orientation: 0, frameSize: 64, anchors: [
      { id: 'A', x: 32, y: 48 },
    ] },
    { id: 'C2', shapeKind: 'circle', orientation: 0, frameSize: 32, anchors: [
      { id: 'A', x: 48, y: 64 },
    ] },
    { id: 'K1', shapeKind: 'diamond', orientation: 0, frameSize: 16, anchors: [
      { id: 'A', x: 56, y: 72 },
    ] },
  ],
  sampleSolutions: [[
    { pieceId: 'C1', anchorId: 'A', turns: 0 },
    { pieceId: 'S1', anchorId: 'A', turns: 0 },
    { pieceId: 'D1', anchorId: 'A', turns: 0 },
    { pieceId: 'C2', anchorId: 'A', turns: 0 },
    { pieceId: 'K1', anchorId: 'A', turns: 0 },
  ]],
  learningObjective: 'Tổng hợp: năm tầng chẵn lẻ xen kẽ',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Thiên cầu xoay quanh một viên ngọc, bức họa hoàn tất.',
};
