import { describe, expect, test } from 'vitest';
import type { Level, PuzzleState } from '../src/domain/model.ts';
import type { AudioCue } from '../src/infrastructure/sfx.ts';
import type { AudioServices } from '../src/presentation/audio/audioServices.ts';
import { SILENT_AUDIO } from '../src/presentation/audio/audioServices.ts';
import { AUDIO_TOKENS } from '../src/presentation/designTokens.ts';
import {
  PENTATONIC_STEPS,
  STINGER_CUE,
  audioCues,
  pitchFor,
  playFeedbackAudio,
  placeStep,
  playVictoryAudio,
  snappedCount,
} from '../src/presentation/feedback/audioCues.ts';
import type { FeedbackEvent } from '../src/presentation/feedback/feedbackEvents.ts';

const C = AUDIO_TOKENS.cues;
const snap: FeedbackEvent = { type: 'snap', pieceId: 'a', anchorId: 'A', onTarget: true, x: 0, y: 0 };
const won: FeedbackEvent = { type: 'won' };
const rateAt = (k: number) => audioCues([snap], { matchedCount: k })[0].rate;
const one = (event: FeedbackEvent) => audioCues([event], { matchedCount: 1 });

describe('pitchFor', () => {
  test('major pentatonic around the root', () => {
    expect(PENTATONIC_STEPS).toEqual([-5, -3, 0, 2, 4, 7, 9, 12]);
    const rates = PENTATONIC_STEPS.map((_, i) => pitchFor(i));
    [0.7492, 0.8409, 1, 1.1225, 1.2599, 1.4983, 1.6818, 2].forEach((r, i) => expect(rates[i]).toBeCloseTo(r, 3));
  });

  test('clamps outside the table', () => {
    expect(pitchFor(-3)).toBe(pitchFor(0));
    expect(pitchFor(42)).toBe(2);
  });
});

describe('snap melody', () => {
  test('rises with each snapped piece, starting at step 0', () => {
    expect(rateAt(1)).toBe(pitchFor(0));
    const rates = [1, 2, 3, 4].map(rateAt);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThan(rates[i - 1]);
  });

  test('taking a piece off lowers the next snap', () => {
    expect(rateAt(2)).toBeLessThan(rateAt(3));
  });

  test('normal snaps stop at step 6; the octave is kept for the win', () => {
    expect(rateAt(8)).toBe(pitchFor(6));
    expect(rateAt(12)).toBe(pitchFor(6));
  });

  test('the winning snap resolves to the octave root', () => {
    expect(audioCues([snap, won], { matchedCount: 3 })).toEqual([{ key: 'bell', rate: 2, volume: C.snapWin, delayMs: 0 }]);
  });

  test('linked rotation (several rotate events in one press) ticks once', () => {
    const events: FeedbackEvent[] = [{ type: 'rotate', pieceId: 'a', turns: 1 }, { type: 'rotate', pieceId: 'b', turns: 2 }];
    expect(audioCues(events, { matchedCount: 0 })).toEqual([{ key: 'tick', rate: C.rotateRate, volume: C.rotate, delayMs: 0 }]);
  });

  test('snappedCount counts free-placement pieces (placed) as well as anchored ones', () => {
    const state = { levelId: 't', phase: 'playing', pieces: {
      a: { kind: 'snapped', anchorId: 'A', turns: 0 },
      b: { kind: 'placed', x: 8, y: 8, turns: 1 },
      c: { kind: 'temporary', x: 9, y: 9, turns: 0 },
      d: { kind: 'tray', turns: 0 },
    } } as const;
    expect(snappedCount(state)).toBe(2);
  });

  test('a drop that is not on target is a soft pluck: it never rises and never rings the bell', () => {
    const off: FeedbackEvent = { type: 'snap', pieceId: 'a', anchorId: null, onTarget: false, x: 16, y: 40 };
    const cues = [0, 1, 3].map((k) => audioCues([off], { matchedCount: k }));
    for (const c of cues) expect(c).toEqual([{ key: 'pluck', rate: pitchFor(placeStep(16, 40)), volume: C.place, delayMs: 0 }]);
  });

  test('the pluck note follows where the piece landed, stays in the pentatonic and leaves the octave to the bell', () => {
    expect(placeStep(16, 40)).toBe(placeStep(16, 40));
    const steps = new Set<number>();
    for (let x = 0; x < 128; x += 8) {
      for (let y = 0; y < 160; y += 8) {
        const step = placeStep(x, y);
        expect(step).toBeGreaterThanOrEqual(0);
        expect(step).toBeLessThan(PENTATONIC_STEPS.length - 1);
        steps.add(step);
      }
    }
    expect(steps.size).toBe(PENTATONIC_STEPS.length - 1);
    expect(placeStep(0, 0)).not.toBe(placeStep(8, 0));
  });

  test('a normal snap is a bell at the snap volume', () => {
    expect(audioCues([snap], { matchedCount: 3 })).toEqual([{ key: 'bell', rate: pitchFor(2), volume: C.snap, delayMs: 0 }]);
  });
});

describe('other events', () => {
  const cue = (key: AudioCue['key'], volume: number, rate = 1, delayMs = 0): AudioCue => ({ key, rate, volume, delayMs });

  test.each<[FeedbackEvent, AudioCue[]]>([
    [{ type: 'lift', pieceId: 'a' }, [cue('breath', C.lift)]],
    [{ type: 'settle-temporary', pieceId: 'a' }, [cue('tap-soft', C.settle)]],
    [{ type: 'return', pieceId: 'a' }, [cue('swish', C.return)]],
    [{ type: 'rotate', pieceId: 'a', turns: 1 }, [cue('tick', C.rotate, C.rotateRate)]],
    [{ type: 'rotate-blocked', pieceId: 'a' }, [cue('thud', C.rotateBlocked)]],
    [{ type: 'overlap-hollow', layers: [] }, [cue('hollow', C.overlap, 1, AUDIO_TOKENS.overlapDelayMs)]],
    [{ type: 'overlap-revive', layers: [] }, [cue('shimmer', C.overlap, 1, AUDIO_TOKENS.overlapDelayMs)]],
    [{ type: 'won' }, []],
  ])('%o', (event, expected) => {
    expect(one(event)).toEqual(expected);
  });

  test('reset plays one swish however many pieces return', () => {
    const events: FeedbackEvent[] = [
      { type: 'reset' },
      { type: 'return', pieceId: 'a' },
      { type: 'return', pieceId: 'b' },
    ];
    expect(audioCues(events, { matchedCount: 0 })).toEqual([{ key: 'swish', rate: 1, volume: C.reset, delayMs: 0 }]);
  });

  test('same input, same output', () => {
    const events: FeedbackEvent[] = [snap, { type: 'overlap-hollow', layers: [] }];
    expect(audioCues(events, { matchedCount: 2 })).toEqual(audioCues(events, { matchedCount: 2 }));
  });
});

describe('helpers', () => {
  const state: PuzzleState = {
    levelId: 'x',
    phase: 'playing',
    pieces: {
      a: { kind: 'snapped', anchorId: 'A', turns: 0 },
      b: { kind: 'tray', turns: 0 },
      c: { kind: 'temporary', x: 0, y: 0, turns: 0 },
      d: { kind: 'snapped', anchorId: 'D', turns: 0 },
    },
  };

  const piece = (id: string, anchorId: string, x: number) =>
    ({ id, shapeKind: 'diamond', frameSize: 8, cells: [[0, 0]], anchors: [{ id: anchorId, x, y: 0 }] }) as const;
  const level = {
    pieces: [piece('a', 'A', 0), piece('d', 'D', 8)],
    targetPlacements: [{ pieceId: 'a', x: 0, y: 0, turns: 0 }],
  } as unknown as Level;

  test('snappedCount counts only snapped pieces', () => {
    expect(snappedCount(state)).toBe(2);
  });

  test('playFeedbackAudio uses the state after the move', () => {
    const played: AudioCue[][] = [];
    playFeedbackAudio({ ...SILENT_AUDIO.sfx, play: (cues) => played.push([...cues]) }, [snap], level, state);
    // Two pieces rest on the board but only `a` stands on its target, so the melody is at its first step.
    expect(played).toEqual([[{ key: 'bell', rate: pitchFor(0), volume: C.snap, delayMs: 0 }]]);
  });

  test('playVictoryAudio ducks the music and plays the stinger', () => {
    const ducks: Array<[number, number]> = [];
    const played: AudioCue[][] = [];
    const audio: AudioServices = {
      music: { ...SILENT_AUDIO.music, duck: (level, holdMs) => ducks.push([level, holdMs]) },
      sfx: { ...SILENT_AUDIO.sfx, play: (cues) => played.push([...cues]) },
    };
    playVictoryAudio(audio);
    expect(ducks).toEqual([[AUDIO_TOKENS.duck.level, AUDIO_TOKENS.duck.holdMs]]);
    expect(played).toEqual([[STINGER_CUE]]);
    expect(STINGER_CUE).toEqual({ key: 'stinger-win', rate: 1, volume: C.stinger, delayMs: 0 });
  });
});
