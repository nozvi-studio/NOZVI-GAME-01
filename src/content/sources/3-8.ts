import type { LevelSource } from '../authoring.ts';
import { piece } from '../kit.ts';

export const cungTenLienHoan: LevelSource = {
  id: '3-8',
  title: 'Cung Tên Liên Hoàn',
  chapter: 3,
  order: 46,
  contentRevision: 'cung-ten-lien-hoan-v1',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    // Tam giác dẫn: xoay T1 thì P1 xoay theo (một chiều: xoay P1 không làm T1 xoay)
    { ...piece('T1', 'triangle', 16, [48, 80], { placement: 'free', orientation: 1 }), drives: ['P1'] },
    piece('P1', 'parallelogram', 48, [64, 80], { placement: 'free', orientation: 0 }),
    piece('S1', 'square', 16, [80, 64], { placement: 'free' }),
  ],
  sampleSolutions: [
    [
      { pieceId: 'T1', anchorId: 'A', turns: 3 },
      { pieceId: 'P1', anchorId: 'A', turns: 0 },
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Xoay tam giác kéo bình hành xoay theo: xoay tam giác trước rồi chỉnh lại bình hành',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [{ id: 'linked-rotation', trigger: 'idle', end: 'snap', text: 'Mảnh có chấm đặc kéo theo mảnh có vòng tròn khi xoay; xoay mảnh có vòng thì mảnh kia đứng yên' }],
  victoryVerse: 'Một mũi tên dẫn đường, cánh cung lặng lẽ xoay theo.',
};
