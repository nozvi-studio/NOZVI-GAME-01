import type { LevelSource } from '../authoring.ts';

/**
 * 1-5 Chiếc Thuyền Sao: thân vuông, mũi thuyền áp cạnh phải thân (x = 64) với
 * cạnh huyền vát về phía sau, buồm có đáy nằm trên mép trên của thân và mũi
 * (y = 80), cột buồm tại x = 40. Thân chỉ có một neo: thân bắt đầu ở x = 16
 * nên không còn chỗ đặt mũi bên trái.
 */
export const thuyenSao: LevelSource = {
  id: '1-5',
  title: 'Chiếc Thuyền Sao',
  chapter: 1,
  order: 5,
  contentRevision: 'thuyen-sao-v3',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 48, y: 96 },
      ],
    },
    {
      id: 'T1',
      shapeKind: 'triangle',
      orientation: 1,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 16, y: 96 },
      ],
    },
    {
      id: 'T2',
      shapeKind: 'triangle',
      orientation: 0,
      frameSize: 32,
      anchors: [
        { id: 'A', x: 80, y: 96 },
      ],
    },
    {
      id: 'T3',
      shapeKind: 'triangle',
      orientation: 5,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 64, y: 48 },
      ],
    },
    {
      id: 'T4',
      shapeKind: 'triangle',
      orientation: 7,
      frameSize: 64,
      anchors: [
        { id: 'A', x: 0, y: 32 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
      { pieceId: 'T3', anchorId: 'A', turns: 0 },
      { pieceId: 'T4', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Ghép thân, mũi và buồm tiếp giáp cạnh thành con thuyền',
  difficultyEstimate: 3,
  distractors: [],
  ftueSteps: [],
  victoryVerse: 'Thuyền sao giương buồm, dải ngân hà mở lối.',
};
