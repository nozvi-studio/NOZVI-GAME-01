import type { LevelSource } from '../authoring.ts';
import { piece } from '../kit.ts';

export const thuyenBuomThienHa: LevelSource = {
  id: '3-6',
  title: 'Thuyền Buồm Thiên Hà',
  chapter: 3,
  order: 44,
  contentRevision: 'thuyen-buom-thien-ha-v1',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    // Cánh buồm: tam giác góc lớn, hướng 0 ở khay, xoay 3 nấc thành hướng 3
    piece('B1', 'triangle', 48, [64, 56], { placement: 'free', orientation: 0 }),
    // Thân thuyền: bình hành đứng (hướng 1) xoay 1 nấc thành nằm (hướng 0)
    piece('H1', 'parallelogram', 48, [48, 88], { placement: 'free', orientation: 1 }),
    // Cờ hiệu: mái nhỏ, hướng 5 ở khay, xoay 3 nấc thành hướng 4
    piece('F1', 'triangle', 16, [48, 24], { placement: 'free', orientation: 5 }),
  ],
  sampleSolutions: [
    [
      { pieceId: 'B1', anchorId: 'A', turns: 3 },
      { pieceId: 'H1', anchorId: 'A', turns: 1 },
      { pieceId: 'F1', anchorId: 'A', turns: 3 },
    ],
  ],
  learningObjective: 'Hai bộ tam giác (góc và mái) cùng xuất hiện: mỗi bộ có hướng riêng cần xoay cho đúng',
  difficultyEstimate: 4,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Buồm căng đón gió thiên hà, ngọn cờ nhỏ chỉ đường về bến.',
};
