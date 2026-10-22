import type { LevelSource } from '../../../src/content/authoring.ts';

/**
 * 1-2 Bảo Tháp Tiên Tri: khối vuông làm chân tháp, mái tam giác đặt ngay ngắn
 * trên đỉnh. Đáy mái (y = 64) nằm trọn trên cạnh trên khối vuông.
 */
export const baoThap: LevelSource = {
  id: '1-2',
  title: 'Bảo Tháp Tiên Tri',
  chapter: 1,
  order: 2,
  contentRevision: 'bao-thap-v2',
  rotationEnabled: false,
  pieces: [
    {
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 72 },
        { id: 'B', x: 48, y: 72 },
      ],
    },
    {
      id: 'R1',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 24 },
        { id: 'B', x: 48, y: 24 },
      ],
    },
    {
      id: 'P1',
      shapeKind: 'parallelogram',
      orientation: 1,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 8, y: 72 },
      ],
    },
    {
      id: 'P2',
      shapeKind: 'parallelogram',
      orientation: 3,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 72, y: 72 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'R1', anchorId: 'A', turns: 0 },
      { pieceId: 'P1', anchorId: 'A', turns: 0 },
      { pieceId: 'P2', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Phối hợp hai hình khối khác nhau thành một biểu tượng',
  difficultyEstimate: 1,
  distractors: [
    { pieceId: 'S1', anchorId: 'B', reason: 'Chân tháp lệch ngang' },
    { pieceId: 'R1', anchorId: 'B', reason: 'Mái lệch khỏi trục tháp' },
  ],
  ftueSteps: [
    { id: 'combine-shapes', trigger: 'idle', end: 'drag-start', text: 'Mỗi mảnh một hình, ghép chúng thành bóng mục tiêu' },
  ],
  victoryVerse: 'Tháp vươn lên trời, lời tiên tri có chỗ đứng.',
};
