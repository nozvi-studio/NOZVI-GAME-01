import type { LevelSource } from '../authoring.ts';

/**
 * 1-4 Ngọn Hải Đăng: ba tầng theo trục đứng x = 64 — mái, đèn thoi, đế vuông.
 * Đỉnh thoi chạm đáy mái tại (64, 48); đáy thoi chạm cạnh trên đế tại (64, 96).
 */
export const haiDang: LevelSource = {
  id: '1-4',
  title: 'Ngọn Hải Đăng',
  chapter: 1,
  order: 4,
  contentRevision: 'hai-dang-v3',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 40, y: 96 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 8, y: 112 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 3,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 88, y: 112 },
      ],
    },
    {
      id: 'S2',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 64 },
      ],
    },
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 0,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 56, y: 48 },
      ],
    },
    {
      id: 'T4',
      shapeKind: 'triangle',
      orientation: 2,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 56, y: 48 },
      ],
    },
    {
      id: 'T5',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 48, y: 24 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'S2', anchorId: 'A', turns: 0 },
      { pieceId: 'T3', anchorId: 'A', turns: 0 },
      { pieceId: 'T4', anchorId: 'A', turns: 0 },
      { pieceId: 'T5', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Ghép ba khối tiếp giáp theo trục đứng',
  difficultyEstimate: 2,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Nơi Hải đăng thắp sáng, thuyền lạc tìm thấy lối về.',
};
