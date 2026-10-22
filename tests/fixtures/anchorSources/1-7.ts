import type { LevelSource } from '../../../src/content/authoring.ts';

export const chongChongGio: LevelSource = {
  id: '1-7',
  title: 'Chong Chóng Gió',
  chapter: 1,
  order: 7,
  contentRevision: 'chong-chong-v1',
  rotationEnabled: false,
  pieces: [
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 4,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 64 },
        { id: 'B', x: 56, y: 64 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 64 },
        { id: 'B', x: 56, y: 64 },
      ],
    },
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 6,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 64 },
        { id: 'B', x: 56, y: 64 },
      ],
    },
    {
      id: 'T4',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 64 },
        { id: 'B', x: 56, y: 64 },
      ],
    },
    {
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 16,
      anchors: [
        { id: 'A', x: 56, y: 48 },
        { id: 'B', x: 64, y: 48 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'T3', anchorId: 'A', turns: 0 },
      { pieceId: 'T4', anchorId: 'A', turns: 0 },
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Bốn tam giác chụm đỉnh tại tâm ghép thành một hình vuông',
  difficultyEstimate: 4,
  distractors: [
    { pieceId: 'T1', anchorId: 'B', reason: 'Lệch sang phải một ô' },
    { pieceId: 'T2', anchorId: 'B', reason: 'Lệch sang phải một ô' },
    { pieceId: 'T3', anchorId: 'B', reason: 'Lệch sang phải một ô' },
    { pieceId: 'T4', anchorId: 'B', reason: 'Lệch sang phải một ô' },
    { pieceId: 'S1', anchorId: 'B', reason: 'Lệch sang phải một ô' },
  ],
  ftueSteps: [],
  victoryVerse: 'Cánh chong chóng quay đều, gió Cổ Ngữ thổi về phía mặt trời.',
};
