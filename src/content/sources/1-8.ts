import type { LevelSource } from '../authoring.ts';

export const loiChiaSai: LevelSource = {
  id: '1-8',
  title: 'Lối Chia Sai',
  chapter: 1,
  order: 8,
  contentRevision: 'loi-chia-sai-v4',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 32, y: 80 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 64, y: 80 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 64, y: 80 },
      ],
    },
    {
      id: 'S2',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 48, y: 64 },
      ],
    },
    {
      id: 'S3',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 64, y: 64 },
      ],
    },
    {
      id: 'S4',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 56, y: 48 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'S2', anchorId: 'A', turns: 0 },
      { pieceId: 'S3', anchorId: 'A', turns: 0 },
      { pieceId: 'S4', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Đối xứng của bóng không phải đối xứng của mảnh',
  difficultyEstimate: 4,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Hai nửa không giống nhau vẫn ghép nên một khối trọn vẹn.',
};
