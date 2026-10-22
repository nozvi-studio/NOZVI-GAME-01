import type { LevelSource } from '../authoring.ts';
import { piece } from '../kit.ts';

/** Bình hành nằm ngang xoay thành đứng, hai tam giác góc xoay 1 nấc lấp hai đầu thành lưỡi thẳng, đặt trên chuôi vuông. */
export const luoiKiemThienThe: LevelSource = {
  id: '3-2',
  title: 'Lưỡi Kiếm Thiên Thể',
  chapter: 3,
  order: 40,
  contentRevision: 'luoi-kiem-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    // Bình hành 0 (nằm nghiêng phải) xoay 1 nấc thành hướng 1 (đứng)
    piece('P1', 'parallelogram', 48, [64, 72], { orientation: 0, placement: 'free' }),
    // Hai tam giác góc giống nhau, cùng hướng 0 ở khay: mũi lưỡi xoay 1 nấc (thành hướng 1), gót lưỡi xoay 3 nấc (thành hướng 3)
    piece('T1', 'triangle', 16, [64, 56], { orientation: 0, placement: 'free' }),
    piece('T2', 'triangle', 16, [64, 88], { orientation: 0, placement: 'free' }),
    // Chuôi kiếm: khối vuông đỡ dưới lưỡi, không cần xoay
    piece('S1', 'square', 32, [64, 112], { placement: 'free' }),
  ],
  sampleSolutions: [
    [
      { pieceId: 'P1', anchorId: 'A', turns: 1 },
      { pieceId: 'T1', anchorId: 'A', turns: 1 },
      { pieceId: 'T2', anchorId: 'A', turns: 3 },
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Bình hành chỉ có hai tư thế: xoay một nấc là đổi từ nằm sang đứng',
  difficultyEstimate: 3,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Lưỡi kiếm dựng đứng giữa trời, cắt đôi một đêm sao.',
};
