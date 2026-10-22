import type { LevelSource } from '../../../src/content/authoring.ts';

/**
 * 3-10 Mandala Thiên Cầu: Năm mảnh chung tâm tạo năm tầng chẵn lẻ xen kẽ.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const mandala: LevelSource = {
  id: '2-13',
  title: 'Mandala Thiên Cầu',
  chapter: 2,
  order: 23,
  contentRevision: 'mandala-v1',
  rotationEnabled: false,
  pieces: [
    { id: 'C1', shapeKind: 'circle', orientation: 0, frameSize: 96, anchors: [
      { id: 'A', x: 16, y: 32 }, { id: 'B', x: 24, y: 32 },
      { id: 'C', x: 8, y: 32 }, { id: 'D', x: 16, y: 40 },
    ] },
    { id: 'S1', shapeKind: 'square', orientation: 0, frameSize: 64, anchors: [
      { id: 'A', x: 32, y: 48 }, { id: 'B', x: 40, y: 48 },
      { id: 'C', x: 24, y: 48 }, { id: 'D', x: 32, y: 56 },
    ] },
    { id: 'D1', shapeKind: 'diamond', orientation: 0, frameSize: 64, anchors: [
      { id: 'A', x: 32, y: 48 }, { id: 'B', x: 40, y: 48 },
      { id: 'C', x: 24, y: 48 }, { id: 'D', x: 32, y: 56 },
    ] },
    { id: 'C2', shapeKind: 'circle', orientation: 0, frameSize: 32, anchors: [
      { id: 'A', x: 48, y: 64 }, { id: 'B', x: 56, y: 64 },
      { id: 'C', x: 40, y: 64 }, { id: 'D', x: 48, y: 72 },
    ] },
    { id: 'K1', shapeKind: 'diamond', orientation: 0, frameSize: 16, anchors: [
      { id: 'A', x: 56, y: 72 }, { id: 'B', x: 64, y: 72 },
      { id: 'C', x: 48, y: 72 }, { id: 'D', x: 56, y: 80 },
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
  distractors: [
    { pieceId: 'C1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'C1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'C1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'S1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'S1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'S1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'D1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'D1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'D1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'C2', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'C2', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'C2', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'K1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'K1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'K1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
  ],
  ftueSteps: [],
  victoryVerse: 'Thiên cầu xoay quanh một viên ngọc, bức họa hoàn tất.',
};
