import type { LevelSource } from '../../../src/content/authoring.ts';

/**
 * 3-5 Thuyền Buồm Hoàng Hôn: Thân thuyền chữ V, hai buồm tam giác, mặt trời tròn lặn sau buồm.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const thuyenBuom: LevelSource = {
  id: '2-8',
  title: 'Thuyền Buồm Hoàng Hôn',
  chapter: 2,
  order: 18,
  contentRevision: 'thuyen-buom-v1',
  rotationEnabled: false,
  pieces: [
    {
      id: 'H1',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 64,
      anchors: [
        { id: 'A', x: 24, y: 104 },
        { id: 'B', x: 24, y: 96 },
      ],
    },
    {
      id: 'L1',
      shapeKind: 'triangle',
      orientation: 3,
      frameSize: 64,
      anchors: [
        { id: 'A', x: 56, y: 32 },
        { id: 'B', x: 64, y: 32 },
        { id: 'C', x: 48, y: 32 },
        { id: 'D', x: 56, y: 40 },
      ],
    },
    {
      id: 'J1',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 24, y: 64 },
        { id: 'B', x: 32, y: 64 },
        { id: 'C', x: 16, y: 64 },
        { id: 'D', x: 24, y: 72 },
      ],
    },
    {
      id: 'C1',
      shapeKind: 'circle',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 80, y: 48 },
        { id: 'B', x: 88, y: 48 },
        { id: 'C', x: 72, y: 48 },
        { id: 'D', x: 80, y: 56 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'H1', anchorId: 'A', turns: 0 },
      { pieceId: 'L1', anchorId: 'A', turns: 0 },
      { pieceId: 'J1', anchorId: 'A', turns: 0 },
      { pieceId: 'C1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Ghép nhiều tam giác khác cỡ và một vùng giao cong',
  difficultyEstimate: 3,
  distractors: [
    { pieceId: 'H1', anchorId: 'B', reason: 'Lệch lên 8 ô' },
    { pieceId: 'L1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'L1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'L1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'J1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'J1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'J1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'C1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'C1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'C1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
  ],
  ftueSteps: [],
  victoryVerse: 'Mặt trời lặn sau cánh buồm, thuyền vẫn đi.',
};
