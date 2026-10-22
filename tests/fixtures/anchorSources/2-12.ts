import type { LevelSource } from '../../../src/content/authoring.ts';

/**
 * 3-9 Sao Bát Phương: Vuông 48 và thoi 64 chung tâm thành sao tám cánh, bát giác rỗng, mặt trời tròn hiện lại ở tâm.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const saoBatPhuong: LevelSource = {
  id: '2-12',
  title: 'Sao Bát Phương',
  chapter: 2,
  order: 22,
  contentRevision: 'sao-bat-phuong-v1',
  rotationEnabled: false,
  pieces: [
    {
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 56 },
        { id: 'B', x: 48, y: 56 },
        { id: 'C', x: 32, y: 56 },
        { id: 'D', x: 40, y: 64 },
      ],
    },
    {
      id: 'D1',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 64,
      anchors: [
        { id: 'A', x: 32, y: 48 },
        { id: 'B', x: 40, y: 48 },
        { id: 'C', x: 24, y: 48 },
        { id: 'D', x: 32, y: 56 },
      ],
    },
    {
      id: 'C1',
      shapeKind: 'circle',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 64 },
        { id: 'B', x: 56, y: 64 },
        { id: 'C', x: 40, y: 64 },
        { id: 'D', x: 48, y: 72 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'D1', anchorId: 'A', turns: 0 },
      { pieceId: 'C1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Nhận ra vùng ba lớp ở tâm một hình đối xứng',
  difficultyEstimate: 3,
  distractors: [
    { pieceId: 'S1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'S1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'S1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'D1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'D1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'D1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'C1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'C1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'C1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
  ],
  ftueSteps: [],
  victoryVerse: 'Tám hướng hội tụ về một mặt trời.',
};
