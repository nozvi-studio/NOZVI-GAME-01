import type { LevelSource } from '../authoring.ts';

/**
 * 1-6 Vương Miện Bình Minh: đôi cánh của 1-3 cộng một viên thoi lấp vừa khe
 * giữa. Ba đỉnh cao bằng nhau tại x = 16, 64, 112 (y = 56), đáy phẳng y = 104.
 * Hai cạnh dưới của thoi nằm trên hai cạnh huyền của đôi cánh: tiếp giáp cạnh,
 * không chung ô nhờ quy tắc ô biên chung (spec D7, D8).
 */
export const vuongMien: LevelSource = {
  id: '1-6',
  title: 'Vương Miện Bình Minh',
  chapter: 1,
  order: 6,
  contentRevision: 'vuong-mien-v2',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'W1',
      shapeKind: 'triangle',
      orientation: 3,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 16, y: 56 },
      ],
    },
    {
      id: 'W2',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 64, y: 56 },
      ],
    },
    {
      id: 'D1',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 56 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'W1', anchorId: 'A', turns: 0 },
      { pieceId: 'W2', anchorId: 'A', turns: 0 },
      { pieceId: 'D1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Nhận ra khe giữa hai cánh vừa khít một viên thoi',
  difficultyEstimate: 3,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Ba đỉnh vương miện bừng sáng, bình minh Cổ Ngữ đã đến.',
};
