import type { LevelSource } from '../../../src/content/authoring.ts';

/**
 * 3-6 Mèo Thần: Đầu vuông, hai tai tam giác nhỏ, hai mắt thoi rỗng, thân mái lớn, đuôi bình hành.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const meoThan: LevelSource = {
  id: '2-9',
  title: 'Mèo Thần',
  chapter: 2,
  order: 19,
  contentRevision: 'meo-than-v1',
  rotationEnabled: false,
  pieces: [
    {
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 40, y: 24 },
        { id: 'B', x: 48, y: 24 },
        { id: 'C', x: 32, y: 24 },
        { id: 'D', x: 40, y: 32 },
      ],
    },
    {
      id: 'E1',
      shapeKind: 'triangle',
      orientation: 3,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 40, y: 8 },
        { id: 'B', x: 48, y: 8 },
        { id: 'C', x: 32, y: 8 },
        { id: 'D', x: 40, y: 16 },
      ],
    },
    {
      id: 'E2',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 56, y: 8 },
        { id: 'B', x: 64, y: 8 },
        { id: 'C', x: 48, y: 8 },
        { id: 'D', x: 56, y: 16 },
      ],
    },
    {
      id: 'B1',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 96,
      anchors: [
        { id: 'A', x: 8, y: 8 },
        { id: 'B', x: 16, y: 8 },
        { id: 'C', x: 0, y: 8 },
        { id: 'D', x: 8, y: 16 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'parallelogram',
      orientation: 1,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 88, y: 56 },
        { id: 'B', x: 80, y: 56 },
      ],
    },
    {
      id: 'Y1',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 40, y: 32 },
        { id: 'B', x: 48, y: 32 },
        { id: 'C', x: 32, y: 32 },
        { id: 'D', x: 40, y: 40 },
      ],
    },
    {
      id: 'Y2',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 56, y: 32 },
        { id: 'B', x: 64, y: 32 },
        { id: 'C', x: 48, y: 32 },
        { id: 'D', x: 56, y: 40 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'E1', anchorId: 'A', turns: 0 },
      { pieceId: 'E2', anchorId: 'A', turns: 0 },
      { pieceId: 'B1', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'Y1', anchorId: 'A', turns: 0 },
      { pieceId: 'Y2', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Ghép bảy mảnh, nhận ra bình hành và tam giác nhỏ',
  difficultyEstimate: 4,
  distractors: [
    { pieceId: 'S1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'S1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'S1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'E1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'E1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'E1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'E2', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'E2', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'E2', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'B1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'B1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'B1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'T1', anchorId: 'B', reason: 'Lệch trái 8 ô' },
    { pieceId: 'Y1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'Y1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'Y1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'Y2', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'Y2', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'Y2', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
  ],
  ftueSteps: [],
  victoryVerse: 'Mèo thần ngồi canh cửa giữa hai thế giới.',
};
