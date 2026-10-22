import type { LevelSource } from '../../../src/content/authoring.ts';

/**
 * 3-8 Kim Tự Tháp Nhật Thực: Kim tự tháp mái 128 có cửa tam giác rỗng; nhật thực từ hai hình tròn lệch nhau.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const kimTuThap: LevelSource = {
  id: '2-11',
  title: 'Kim Tự Tháp Nhật Thực',
  chapter: 2,
  order: 21,
  contentRevision: 'kim-tu-thap-v1',
  rotationEnabled: false,
  pieces: [
    {
      id: 'R1',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 128,
      anchors: [
        { id: 'A', x: 0, y: 16 },
        { id: 'B', x: 0, y: 24 },
        { id: 'C', x: 0, y: 8 },
      ],
    },
    {
      id: 'R2',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 112 },
        { id: 'B', x: 56, y: 112 },
        { id: 'C', x: 40, y: 112 },
        { id: 'D', x: 48, y: 120 },
      ],
    },
    {
      id: 'C1',
      shapeKind: 'circle',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 80, y: 16 },
        { id: 'B', x: 72, y: 16 },
        { id: 'C', x: 80, y: 24 },
        { id: 'D', x: 80, y: 8 },
      ],
    },
    {
      id: 'C2',
      shapeKind: 'circle',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 88, y: 16 },
        { id: 'B', x: 96, y: 16 },
        { id: 'C', x: 88, y: 24 },
        { id: 'D', x: 88, y: 8 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'R1', anchorId: 'A', turns: 0 },
      { pieceId: 'R2', anchorId: 'A', turns: 0 },
      { pieceId: 'C1', anchorId: 'A', turns: 0 },
      { pieceId: 'C2', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Hai cụm hình tách rời trên cùng một bàn',
  difficultyEstimate: 3,
  distractors: [
    { pieceId: 'R1', anchorId: 'B', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'R1', anchorId: 'C', reason: 'Lệch lên 8 ô' },
    { pieceId: 'R2', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'R2', anchorId: 'C', reason: 'Lệch trái 8 ô' },
    { pieceId: 'R2', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'C1', anchorId: 'B', reason: 'Lệch trái 8 ô' },
    { pieceId: 'C1', anchorId: 'C', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'C1', anchorId: 'D', reason: 'Lệch lên 8 ô' },
    { pieceId: 'C2', anchorId: 'B', reason: 'Lệch phải 8 ô' },
    { pieceId: 'C2', anchorId: 'C', reason: 'Lệch xuống 8 ô' },
    { pieceId: 'C2', anchorId: 'D', reason: 'Lệch lên 8 ô' },
  ],
  ftueSteps: [],
  victoryVerse: 'Khi mặt trời bị che, kim tự tháp thức giấc.',
};
