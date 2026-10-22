import type { LevelSource } from '../authoring.ts';

export const suonNuiTinhTu: LevelSource = {
  id: '1-9',
  title: 'Sườn Núi Tinh Tú',
  chapter: 1,
  order: 9,
  contentRevision: 'suon-nui-v4',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 40, y: 80 },
      ],
    },
    {
      id: 'S2',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 72, y: 96 },
      ],
    },
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 3,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 72, y: 80 },
      ],
    },
    {
      id: 'P1',
      shapeKind: 'parallelogram',
      orientation: 1,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 56, y: 48 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 72, y: 48 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 1,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 8, y: 80 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'S2', anchorId: 'A', turns: 0 },
      { pieceId: 'T3', anchorId: 'A', turns: 0 },
      { pieceId: 'P1', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Suy ngược từ khay về bóng: cùng loại nhưng khác cỡ',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Từng bậc đá xếp lên, đỉnh núi chạm vào những vì sao.',
};
