import type { LevelSource } from '../authoring.ts';
import { piece } from '../kit.ts';

/** Bốn tam giác giống hệt nhau, mỗi mảnh cần một số nấc xoay riêng (0, 1, 2, 3) để thành bánh xe có lỗ thoi. */
export const banhXeSoPhan: LevelSource = {
  id: '3-4',
  title: 'Bánh Xe Số Phận',
  chapter: 3,
  order: 42,
  contentRevision: 'banh-xe-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    // Góc vuông của mỗi tam giác hướng ra góc ngoài của bánh xe: hướng 0 (TL), 1 (TR), 2 (BR), 3 (BL)
    piece('T1', 'triangle', 32, [48, 64], { orientation: 0, placement: 'free' }),
    piece('T2', 'triangle', 32, [80, 64], { orientation: 0, placement: 'free' }),
    piece('T3', 'triangle', 32, [80, 96], { orientation: 0, placement: 'free' }),
    piece('T4', 'triangle', 32, [48, 96], { orientation: 0, placement: 'free' }),
  ],
  sampleSolutions: [
    [
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 1 },
      { pieceId: 'T3', anchorId: 'A', turns: 2 },
      { pieceId: 'T4', anchorId: 'A', turns: 3 },
    ],
  ],
  learningObjective: 'Bốn mảnh giống nhau, bốn nấc xoay khác nhau quanh một tâm chung',
  difficultyEstimate: 3,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Bánh xe quay đủ bốn nấc, số phận trở về điểm khởi đầu.',
};
