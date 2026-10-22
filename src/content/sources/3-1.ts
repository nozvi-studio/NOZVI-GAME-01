import type { LevelSource } from '../authoring.ts';
import { piece } from '../kit.ts';

/** Màn dạy xoay: mái nhà lệch hướng, xoay 1 nấc để đỉnh mái chỉ lên. */
export const laBanGio: LevelSource = {
  id: '3-1',
  title: 'La Bàn Gió',
  chapter: 3,
  order: 39,
  contentRevision: 'la-ban-gio-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    // Mái nằm ở khay với đỉnh chỉ trái (hướng 7); xoay 1 nấc thành đỉnh chỉ lên (hướng 4)
    piece('T1', 'triangle', 32, [64, 56], { orientation: 7, placement: 'free' }),
    piece('S1', 'square', 32, [64, 88], { placement: 'free' }),
  ],
  sampleSolutions: [
    [
      { pieceId: 'T1', anchorId: 'A', turns: 1 },
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Chọn mảnh rồi bấm Xoay để mái nhà chỉ đúng hướng gió',
  difficultyEstimate: 2,
  distractors: [],
  ftueSteps: [
    { id: 'rotate-first', trigger: 'idle', end: 'snap', text: 'Chạm mảnh để chọn, bấm Xoay cho đúng hướng rồi kéo vào bóng' },
  ],
  victoryVerse: 'Mũi kim quay một vòng, gió Cổ Ngữ chỉ về phương nhà.',
};
