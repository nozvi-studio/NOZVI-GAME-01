import type { LevelSource } from '../authoring.ts';
import { piece } from '../kit.ts';

export const saoTuPhuong: LevelSource = {
  id: '3-7',
  title: 'Sao Tứ Phương',
  chapter: 3,
  order: 45,
  contentRevision: 'sao-tu-phuong-v1',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    piece('S1', 'square', 32, [64, 80], { placement: 'free' }),
    // Bốn mái giống hệt nhau, cùng hướng 4 ở khay; xoay 0, 1, 2, 3 nấc để chỉ lên, phải, xuống, trái
    piece('R1', 'triangle', 32, [64, 48], { placement: 'free', orientation: 4 }),
    piece('R2', 'triangle', 32, [96, 80], { placement: 'free', orientation: 4 }),
    piece('R3', 'triangle', 32, [64, 112], { placement: 'free', orientation: 4 }),
    piece('R4', 'triangle', 32, [32, 80], { placement: 'free', orientation: 4 }),
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'R1', anchorId: 'A', turns: 0 },
      { pieceId: 'R2', anchorId: 'A', turns: 1 },
      { pieceId: 'R3', anchorId: 'A', turns: 2 },
      { pieceId: 'R4', anchorId: 'A', turns: 3 },
    ],
  ],
  learningObjective: 'Bốn mái giống nhau, mỗi mái một số nấc xoay, tạo ngôi sao bốn hướng quanh khối vuông',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Bốn phương cùng chỉ về một tâm, ngôi sao tìm thấy hướng của mình.',
};
