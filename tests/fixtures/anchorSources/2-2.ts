import type { LevelSource } from '../../../src/content/authoring.ts';

/**
 * 2-2 Cánh Bướm Điệp Ảnh: Hai cánh mái đâm mũi qua nhau thành nơ bướm có tâm thoi rỗng.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const canhBuom: LevelSource = {
  id: '2-2',
  title: 'Màn mau-2-2-remake',
  chapter: 2,
  order: 12,
  contentRevision: 'canh-buom-v2',
  rotationEnabled: false,
  pieces: [
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 96,
      anchors: [
        { id: 'A', x: 32, y: 32 },
        { id: 'B', x: 24, y: 32 },
        { id: 'C', x: 32, y: 40 },
        { id: 'D', x: 32, y: 24 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 96,
      anchors: [
        { id: 'A', x: 0, y: 32 },
        { id: 'B', x: 8, y: 32 },
        { id: 'C', x: 0, y: 40 },
        { id: 'D', x: 0, y: 24 },
      ],
    },
    {
      id: 'D1',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 64 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'D1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Chủ động căn độ sâu giao để tạo khoảng rỗng cân bằng',
  difficultyEstimate: 3,
  distractors: [
    { pieceId: 'T1', anchorId: 'B', reason: 'Lệch trái 8 ô' },
    { pieceId: 'T1', anchorId: 'C', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'T1', anchorId: 'D', reason: 'Lệch lên 8 ô' },
    { pieceId: 'T2', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'T2', anchorId: 'C', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'T2', anchorId: 'D', reason: 'Lệch lên 8 ô' },
  ],
  ftueSteps: [
    { id: 'overlap-depth', trigger: 'idle', end: 'drag-start', text: 'Để hai cánh chồng nhau vừa đủ sâu' },
  ],
};
