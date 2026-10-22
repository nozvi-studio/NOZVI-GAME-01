import type { LevelSource } from '../authoring.ts';
import { piece } from '../kit.ts';

export const mauTenGio: LevelSource = {
  id: '3-5',
  title: 'Mũi Tên Gió',
  chapter: 3,
  order: 43,
  contentRevision: 'mui-ten-gio-v1',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    piece('S1', 'square', 32, [56, 80], { placement: 'free' }),
    // Đầu mũi tên: mái hướng 4 ở khay, xoay 1 nấc thành hướng 5 (đỉnh chỉ phải)
    piece('R1', 'triangle', 32, [88, 80], { placement: 'free', orientation: 4 }),
    // Cánh đuôi: tam giác góc hướng 0, xoay 3 nấc thành hướng 3
    piece('T1', 'triangle', 16, [48, 56], { placement: 'free', orientation: 0 }),
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'R1', anchorId: 'A', turns: 1 },
      { pieceId: 'T1', anchorId: 'A', turns: 3 },
    ],
  ],
  learningObjective: 'Mái xoay một nấc làm đầu mũi tên, tam giác góc xoay ba nấc làm cánh đuôi; đặt tự do trên lưới',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Mũi tên chỉ về nơi gió thôi, cánh đuôi giữ cho nó thẳng đường.',
};
