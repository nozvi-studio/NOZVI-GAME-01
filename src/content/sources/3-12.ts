import type { LevelSource } from '../authoring.ts';

export const man312: LevelSource = {
  id: '3-12',
  title: 'Thuyền Buồm Ngân Hà',
  chapter: 3,
  order: 50,
  contentRevision: 'thuyen-buom-ngan-ha-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    {
      id: 'P1',
      shapeKind: 'parallelogram',
      orientation: 1,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 48, y: 64 },
      ],
    },
    {
      id: 'P2',
      shapeKind: 'parallelogram',
      orientation: 3,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 32, y: 64 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 32,
      drives: ['P2'],
      anchors: [
        { id: 'A', x: 48, y: 48 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 32,
      drives: ['P1'],
      anchors: [
        { id: 'A', x: 48, y: 48 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'P1', anchorId: 'A', turns: 0 },
      { pieceId: 'P2', anchorId: 'A', turns: 2 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 2 },
    ],
  ],
  learningObjective: 'Hai mảnh dẫn cùng kéo thân thuyền; tính phần xoay chung trước khi chỉnh sống thuyền.',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Cánh buồm đón gió sao, hai nhịp xoay đưa thuyền về bến.',
};
