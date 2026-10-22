import type { LevelSource } from '../authoring.ts';

/**
 * 3-9 Sao Bát Phương: Vuông 48 và thoi 64 chung tâm thành sao tám cánh, bát giác rỗng, mặt trời tròn hiện lại ở tâm.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const saoBatPhuong: LevelSource = {
  id: '2-12',
  title: 'Sao Bát Phương',
  chapter: 2,
  order: 22,
  contentRevision: 'sao-bat-phuong-v2',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 56 },
      ],
    },
    {
      id: 'D1',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 64,
      anchors: [
        { id: 'A', x: 32, y: 48 },
      ],
    },
    {
      id: 'C1',
      shapeKind: 'circle',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 64 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'D1', anchorId: 'A', turns: 0 },
      { pieceId: 'C1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Nhận ra vùng ba lớp ở tâm một hình đối xứng',
  difficultyEstimate: 3,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Tám hướng hội tụ về một mặt trời.',
};
