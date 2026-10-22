import type { LevelSource } from '../authoring.ts';

export const man316: LevelSource = {
  id: '3-16',
  title: 'Đồng Hồ Tinh Vân',
  chapter: 3,
  order: 54,
  contentRevision: 'dong-ho-tinh-van-v2',
  rotationEnabled: true,
  placement: 'free',
  pieces: [
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      drives: ['T1', 'T4', 'T5'],
      anchors: [
        { id: 'A', x: 24, y: 56 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      drives: ['T2'],
      anchors: [
        { id: 'A', x: 72, y: 56 },
      ],
    },
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 24, y: 56 },
      ],
    },
    {
      id: 'T4',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 32,
      drives: ['T5'],
      anchors: [
        { id: 'A', x: 56, y: 88 },
      ],
    },
    {
      id: 'T5',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 56, y: 40 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T3', anchorId: 'A', turns: 2 },
      { pieceId: 'T4', anchorId: 'A', turns: 0 },
      { pieceId: 'T5', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Hai tam giác xoay qua lại; chỉ tam giác lớn kéo bệ, nên cần bù riêng vòng xoay của bệ.',
  difficultyEstimate: 5,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Hai miền cát sao gặp nhau, chiếc bệ nghiêng giữ nhịp thời gian.',
};
