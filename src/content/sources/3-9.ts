import type { LevelSource } from '../authoring.ts';
import { piece } from '../kit.ts';

export const tenLuaTienTri: LevelSource = {
  id: '3-9',
  title: 'Tên Lửa Tiên Tri',
  chapter: 3,
  order: 47,
  contentRevision: 'ten-lua-tien-tri-v1',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    piece('S1', 'square', 32, [64, 80], { placement: 'free' }),
    // Mũi tên lửa dẫn hai cánh: xoay R1 thì F1 và F2 cùng xoay theo
    { ...piece('R1', 'triangle', 32, [64, 48], { placement: 'free', orientation: 6 }), drives: ['F1', 'F2'] },
    piece('F1', 'triangle', 16, [40, 88], { placement: 'free', orientation: 0 }),
    piece('F2', 'triangle', 16, [88, 88], { placement: 'free', orientation: 0 }),
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'R1', anchorId: 'A', turns: 2 },
      { pieceId: 'F1', anchorId: 'A', turns: 2 },
      { pieceId: 'F2', anchorId: 'A', turns: 3 },
    ],
  ],
  learningObjective: 'Một mảnh dẫn hai mảnh: xoay mũi trước, rồi chỉnh từng cánh',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Mũi dẫn đường, hai cánh theo sau, cả con tàu quay về phía vì sao.',
};
