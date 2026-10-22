import type { LevelSource } from '../../../src/content/authoring.ts';
import { piece } from '../../../src/content/kit.ts';

/** Hai tam giác giống hệt nhau phải xoay số nấc khác nhau để ốp hai bên thân thuyền. */
export const thuyenCoNgu: LevelSource = {
  id: '3-3',
  title: 'Thuyền Cổ Ngữ',
  chapter: 3,
  order: 41,
  contentRevision: 'thuyen-co-ngu-v1',
  rotationEnabled: true,
  pieces: [
    piece('S1', 'square', 32, [64, 80], { decoys: [[8, 0]] }),
    // Cả hai khay đều hướng 0: mạn trái cần hướng 2 (xoay 2 nấc), mạn phải cần hướng 3 (xoay 3 nấc)
    piece('T1', 'triangle', 32, [32, 80], { orientation: 0, decoys: [[8, 0]] }),
    piece('T2', 'triangle', 32, [96, 80], { orientation: 0, decoys: [[-8, 0]] }),
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 2 },
      { pieceId: 'T2', anchorId: 'A', turns: 3 },
    ],
  ],
  learningObjective: 'Hai mảnh giống nhau vẫn có thể cần số nấc xoay khác nhau',
  difficultyEstimate: 3,
  distractors: [
    { pieceId: 'S1', anchorId: 'B', reason: 'Lệch sang phải một ô' },
    { pieceId: 'T1', anchorId: 'B', reason: 'Lệch sang phải một ô' },
    { pieceId: 'T2', anchorId: 'B', reason: 'Lệch sang trái một ô' },
  ],
  ftueSteps: [],
  victoryVerse: 'Hai mạn thuyền chung một mũi, con sóng nào cũng quay về bến.',
};
