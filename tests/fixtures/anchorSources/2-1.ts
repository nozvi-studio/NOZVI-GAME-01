import type { LevelSource } from '../../../src/content/authoring.ts';

/**
 * 2-1 Mũi Tên Chỉ Thiên: Mái nhỏ lồng vào đáy mái lớn; phần giao biến mất để lại mũi tên chevron Λ.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const muiTen: LevelSource = {
  id: '2-1',
  title: 'Mũi Tên Chỉ Thiên',
  chapter: 2,
  order: 7,
  contentRevision: 'mui-ten-v1',
  rotationEnabled: false,
  pieces: [
    {
      id: 'R1', shapeKind: 'triangle', orientation: 4, frameSize: 96,
      anchors: [
        { id: 'A', x: 16, y: 16 }, { id: 'B', x: 24, y: 16 },
        { id: 'C', x: 8, y: 16 }, { id: 'D', x: 16, y: 24 },
      ],
    },
    {
      id: 'R2', shapeKind: 'triangle', orientation: 4, frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 64 }, { id: 'B', x: 48, y: 64 },
        { id: 'C', x: 32, y: 64 }, { id: 'D', x: 40, y: 72 },
      ],
    },
  ],
  sampleSolutions: [[
    { pieceId: 'R1', anchorId: 'A', turns: 0 },
    { pieceId: 'R2', anchorId: 'A', turns: 0 },
  ]],
  learningObjective: 'Hiểu hai lớp chồng nhau thì vùng giao biến mất',
  difficultyEstimate: 2,
  distractors: [
    { pieceId: 'R1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'R1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'R1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'R2', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'R2', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'R2', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
  ],
  ftueSteps: [
    { id: 'overlap-hides', trigger: 'two-layers', end: 'drag-start', text: 'Hai mảnh cùng màu: vùng giao biến mất' },
  ],
  victoryVerse: 'Mũi tên chỉ trời, khoảng trống dẫn lối.',
};
