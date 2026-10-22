import type { LevelSource } from '../authoring.ts';

/** 1-1 Song Tinh: hai thoi chạm đỉnh tại tâm bàn (64, 80). */
export const songTinh: LevelSource = {
  id: '1-1',
  title: 'Song Tinh',
  chapter: 1,
  order: 1,
  contentRevision: 'song-tinh-v3',
  rotationEnabled: false,
  placement: 'free',
  pieces: [
    {
      id: 'D1',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 16, y: 56 },
      ],
    },
    {
      id: 'D2',
      shapeKind: 'diamond',
      orientation: 0,
      frameSize: 48,
      anchors: [
        { id: 'A', x: 64, y: 56 },
      ],
    },
  ],
  sampleSolutions: [
    [
      { pieceId: 'D1', anchorId: 'A', turns: 0 },
      { pieceId: 'D2', anchorId: 'A', turns: 0 },
    ],
  ],
  learningObjective: 'Kéo hai mảnh tiếp giáp đỉnh, không xếp chồng',
  difficultyEstimate: 1,
  distractors: [],
  ftueSteps: [
    { id: 'drag-first', trigger: 'idle', end: 'drag-start', text: 'Kéo mảnh vào bóng mục tiêu' },
  ],
  victoryVerse: 'Hai vì sao chạm đỉnh, vũ trụ tìm thấy thế cân bằng.',
};
