import type { LevelSource } from '../../../src/content/authoring.ts';

/**
 * 2-3 Trái Tim Tinh Thể: Nơ của 2-2 cộng viên ngọc thoi 16 đặt vào tâm rỗng: hạt nhân hiện lại giữa vòng rỗng.
 * Toạ độ và neo nhiễu lấy nguyên từ bảng mục 4 của spec C; không tự chỉnh.
 */
export const traiTim: LevelSource = {
  id: '2-3',
  title: 'Màn mau-2-3-remake',
  chapter: 2,
  order: 13,
  contentRevision: 'trai-tim-v2',
  rotationEnabled: false,
  pieces: [
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 3,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 16, y: 56 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 64, y: 56 },
      ],
    },
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 16, y: 56 },
      ],
    },
    {
      id: 'T4',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 64, y: 56 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'T3', anchorId: 'A', turns: 0 },
      { pieceId: 'T4', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Dự đoán được ba lớp thì vùng đó hiện lại',
  difficultyEstimate: 3,
  distractors: [],
  ftueSteps: [
    { id: 'third-layer', trigger: 'three-layers', end: 'drag-start', text: 'Thêm mảnh thứ ba: vùng đó hiện lại' },
  ],
  victoryVerse: 'Trong khoảng rỗng, một trái tim tinh thể bừng sáng.',
};
