import type { LevelSource } from '../authoring.ts';
import { piece } from '../kit.ts';

export const daiAnLuanChuyen: LevelSource = {
  id: '3-10',
  title: 'Đại Ấn Luân Chuyển',
  chapter: 3,
  order: 48,
  contentRevision: 'dai-an-luan-chuyen-v1',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    // Khối vuông xoay mà hình không đổi, nhưng kéo bệ phóng P1 xoay theo
    { ...piece('S1', 'square', 32, [64, 80], { placement: 'free' }), drives: ['P1'] },
    // Mũi dẫn hai cánh F1, F2
    { ...piece('R1', 'triangle', 32, [64, 48], { placement: 'free', orientation: 7 }), drives: ['F1', 'F2'] },
    piece('F1', 'triangle', 16, [40, 88], { placement: 'free', orientation: 0 }),
    piece('F2', 'triangle', 16, [88, 88], { placement: 'free', orientation: 0 }),
    piece('P1', 'parallelogram', 48, [56, 104], { placement: 'free', orientation: 1 }),
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'R1', anchorId: 'A', turns: 1 },
      { pieceId: 'F1', anchorId: 'A', turns: 2 },
      { pieceId: 'F2', anchorId: 'A', turns: 3 },
      { pieceId: 'P1', anchorId: 'A', turns: 1 },
    ],
  ],
  learningObjective: 'Hai nhóm liên động cùng lúc: có mảnh dẫn mà nhìn không thấy xoay, phải đoán ra nó kéo mảnh nào',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Mỗi mảnh kéo một mảnh khác, đại ấn khép lại khi mọi vòng quay gặp nhau.',
};
