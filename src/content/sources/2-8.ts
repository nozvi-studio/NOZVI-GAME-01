import type { LevelSource } from '../authoring.ts';

/**
 * 3-5 Thuyền Buồm Hoàng Hôn: Thân thuyền chữ V, hai buồm tam giác, mặt trời tròn lặn sau buồm.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const thuyenBuom: LevelSource = {
  id: '2-8',
  title: 'Thuyền Buồm Hoàng Hôn',
  chapter: 2,
  order: 18,
  contentRevision: 'thuyen-buom-v2',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'H1',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 64,
      anchors: [
        { id: 'A', x: 24, y: 104 },
      ],
    },
    {
      id: 'L1',
      shapeKind: 'triangle',
      orientation: 3,
      frameSize: 64,
      anchors: [
        { id: 'A', x: 56, y: 32 },
      ],
    },
    {
      id: 'J1',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 24, y: 64 },
      ],
    },
    {
      id: 'C1',
      shapeKind: 'circle',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 80, y: 48 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'H1', anchorId: 'A', turns: 0 },
      { pieceId: 'L1', anchorId: 'A', turns: 0 },
      { pieceId: 'J1', anchorId: 'A', turns: 0 },
      { pieceId: 'C1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Ghép nhiều tam giác khác cỡ và một vùng giao cong',
  difficultyEstimate: 3,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Mặt trời lặn sau cánh buồm, thuyền vẫn đi.',
};
