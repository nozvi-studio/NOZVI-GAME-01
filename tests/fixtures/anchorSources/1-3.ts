import type { LevelSource } from '../../../src/content/authoring.ts';

/**
 * 1-3 Cánh Chim Báo Điềm: đôi cánh giương, mũi cánh ở góc trên ngoài (16, 56)
 * và (112, 56), hai cạnh huyền dốc vào giữa và chạm nhau tại (64, 104).
 * Hai cánh chạm tại một đỉnh chứ không chung cạnh dọc (spec D6). Mỗi cánh có
 * neo phụ ở bên kia: đổi chỗ hai cánh cho ra hình kim tự tháp, sai bóng.
 */
export const canhChim: LevelSource = {
  id: '1-3',
  title: 'Tinh điệp ',
  chapter: 1,
  order: 3,
  contentRevision: 'canh-chim-v2',
  rotationEnabled: false,
  pieces: [
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 64,
      anchors: [
        { id: 'A', x: 24, y: 48 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 64,
      anchors: [
        { id: 'A', x: 40, y: 48 },
      ],
    },
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 72 },
      ],
    },
    {
      id: 'T4',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 56, y: 56 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'T3', anchorId: 'A', turns: 0 },
      { pieceId: 'T4', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Tự so bóng mục tiêu và đặt hai cánh đối xứng đúng bên',
  difficultyEstimate: 2,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Đôi cánh mở ra, điềm lành bay về phương bắc.',
};
