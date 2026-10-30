import { describe, expect, test } from 'vitest';
import { loadLevel } from '../src/content/catalog.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import type { StoragePort } from '../src/application/progressPort.ts';
import { PlayController } from '../src/application/playController.ts';
import type { Level, PuzzleState } from '../src/domain/model.ts';
import { createProgressRepository } from '../src/infrastructure/progressRepository.ts';
import type { AudioCue } from '../src/engine/core/audio/sfx.ts';
import type { AudioServices } from '../src/presentation/audio/audioServices.ts';
import { SILENT_AUDIO } from '../src/presentation/audio/audioServices.ts';
import { computeLayout, gridToCanvas, pieceHitbox } from '../src/presentation/board/layout.ts';
import { AUDIO_TOKENS } from '../src/presentation/designTokens.ts';
import {
  PIECE_NOTES,
  audioCues,
  pieceSemitones,
  playFeedbackAudio,
  playVictoryAudio,
  snappedCount,
  victoryCues,
} from '../src/presentation/feedback/audioCues.ts';
import type { FeedbackEvent } from '../src/presentation/feedback/feedbackEvents.ts';
import { feedbackEvents } from '../src/presentation/feedback/feedbackEvents.ts';

const C = AUDIO_TOKENS.cues;
const rate = (semitones: number) => 2 ** (semitones / 12);

const piece = (id: string, x: number) =>
  ({ id, shapeKind: 'diamond', frameSize: 8, cells: [[0, 0]], anchors: [{ id: `A${id}`, x, y: 0 }] }) as const;
const level = { pieces: [piece('a', 0), piece('b', 8), piece('c', 16)] } as unknown as Level;
const cues = (event: FeedbackEvent) => audioCues([event], { level });
const snapOn: FeedbackEvent = { type: 'snap', pieceId: 'b', anchorId: null, onTarget: true, x: 8, y: 0 };
const snapOff: FeedbackEvent = { type: 'snap', pieceId: 'b', anchorId: null, onTarget: false, x: 8, y: 0 };

describe('piece notes', () => {
  test('a piece plays its own note everywhere, from the chord the victory run lands on', () => {
    expect(PIECE_NOTES).toEqual([0, 4, 7, 12, 16, 19]);
    expect(['a', 'b', 'c'].map((id) => pieceSemitones(level, id))).toEqual([0, 4, 7]);
  });

  test('more pieces than notes wrap round; an unknown piece falls back to the root', () => {
    const many = { pieces: Array.from({ length: 8 }, (_, i) => piece(`p${i}`, i)) } as unknown as Level;
    expect(pieceSemitones(many, 'p6')).toBe(PIECE_NOTES[0]);
    expect(pieceSemitones(level, 'ghost')).toBe(0);
  });
});

describe('what a piece sounds like', () => {
  test('lift: a light touch of the piece note', () => {
    expect(cues({ type: 'lift', pieceId: 'b' })).toEqual([{ key: 'kalimba', rate: rate(4), volume: C.lift, delayMs: 0 }]);
  });

  test('set down short of the target: the same note, short, and never the ring', () => {
    expect(cues(snapOff)).toEqual([{ key: 'kalimba', rate: rate(4), volume: C.place, delayMs: 0 }]);
  });

  test('locked onto the target: two notes only, the note ringing and a soft echo of it', () => {
    expect(cues(snapOn)).toEqual([
      { key: 'kalimba-ring', rate: rate(4), volume: C.snap, delayMs: 0 },
      { key: 'kalimba-ring', rate: rate(4), volume: C.snap * C.echo, delayMs: AUDIO_TOKENS.echoDelayMs },
    ]);
  });

  test('the echo is quieter than the note', () => {
    expect(C.echo).toBeLessThan(0.5);
  });

  test('handed back to the tray: the note an octave down', () => {
    expect(cues({ type: 'return', pieceId: 'b' })).toEqual([{ key: 'kalimba', rate: rate(4) / 2, volume: C.return, delayMs: 0 }]);
  });

  test('dropped without snapping: the short note too', () => {
    expect(cues({ type: 'settle-temporary', pieceId: 'c' })).toEqual([{ key: 'kalimba', rate: rate(7), volume: C.settle, delayMs: 0 }]);
  });

  test('one pitch per piece: lift, set down, lock in and return all share the note (octaves aside)', () => {
    const pitches = (event: FeedbackEvent) => cues(event)[0].rate;
    expect(pitches(snapOff)).toBe(pitches({ type: 'lift', pieceId: 'b' }));
    expect(pitches(snapOn)).toBe(pitches({ type: 'lift', pieceId: 'b' }));
    expect(pitches({ type: 'return', pieceId: 'b' })).toBe(pitches({ type: 'lift', pieceId: 'b' }) / 2);
  });

  test('the notes of the cues sit apart enough that none is dropped by the repeat gap', () => {
    expect(AUDIO_TOKENS.victoryChordGapMs).toBeGreaterThan(AUDIO_TOKENS.repeatGapMs);
    expect(AUDIO_TOKENS.victoryStepMs).toBeGreaterThan(AUDIO_TOKENS.repeatGapMs);
    expect(AUDIO_TOKENS.echoDelayMs).toBeGreaterThan(AUDIO_TOKENS.repeatGapMs);
  });
});

describe('other events', () => {
  const cue = (key: AudioCue['key'], volume: number, rate = 1, delayMs = 0): AudioCue => ({ key, rate, volume, delayMs });

  test.each<[FeedbackEvent, AudioCue[]]>([
    [{ type: 'rotate', pieceId: 'a', turns: 1 }, [cue('tick', C.rotate, C.rotateRate)]],
    [{ type: 'rotate-blocked', pieceId: 'a' }, [cue('thud', C.rotateBlocked)]],
    [{ type: 'overlap-hollow', layers: [] }, [cue('hollow', C.overlap, 1, AUDIO_TOKENS.overlapDelayMs)]],
    [{ type: 'overlap-revive', layers: [] }, [cue('shimmer', C.overlap, 1, AUDIO_TOKENS.overlapDelayMs)]],
    [{ type: 'won' }, []],
  ])('%o', (event, expected) => {
    expect(cues(event)).toEqual(expected);
  });

  test('linked rotation (several rotate events in one press) ticks once', () => {
    const events: FeedbackEvent[] = [{ type: 'rotate', pieceId: 'a', turns: 1 }, { type: 'rotate', pieceId: 'b', turns: 2 }];
    expect(audioCues(events, { level })).toEqual([{ key: 'tick', rate: C.rotateRate, volume: C.rotate, delayMs: 0 }]);
  });

  test('reset plays one swish however many pieces return', () => {
    const events: FeedbackEvent[] = [
      { type: 'reset' },
      { type: 'return', pieceId: 'a' },
      { type: 'return', pieceId: 'b' },
    ];
    expect(audioCues(events, { level })).toEqual([{ key: 'swish', rate: 1, volume: C.reset, delayMs: 0 }]);
  });

  test('same input, same output', () => {
    const events: FeedbackEvent[] = [snapOn, { type: 'overlap-hollow', layers: [] }];
    expect(audioCues(events, { level })).toEqual(audioCues(events, { level }));
  });
});

describe('victory', () => {
  test('the piece notes run up in order, then the root chord rolls out', () => {
    const out = victoryCues(level);
    const run = out.slice(0, 3);
    expect(run.map((c) => c.rate)).toEqual([rate(0), rate(4), rate(7)]);
    expect(run.map((c) => c.delayMs)).toEqual([0, 1, 2].map((i) => i * AUDIO_TOKENS.victoryStepMs));
    const chord = out.slice(3, 6);
    expect(chord.map((c) => c.rate)).toEqual([rate(0), rate(7), rate(12)]);
    const echoes = out.slice(6);
    expect(echoes.map((e) => e.rate)).toEqual([rate(12), rate(12)]);
    expect(echoes.map((e) => e.delayMs)).toEqual(AUDIO_TOKENS.victoryEchoDelaysMs.map((d) => chord[2].delayMs + d));
    expect(echoes[1].volume).toBeLessThan(echoes[0].volume);
    expect(echoes[0].volume).toBeCloseTo(C.victoryEnd * C.echo, 10);
    expect(chord[0].delayMs).toBeGreaterThan(run[2].delayMs);
    for (let i = 1; i < chord.length; i++) expect(chord[i].delayMs - chord[i - 1].delayMs).toBe(AUDIO_TOKENS.victoryChordGapMs);
    expect(out.every((c) => c.key === 'kalimba-ring')).toBe(true);
  });

  test('pieces sharing a note play it once', () => {
    const many = { pieces: Array.from({ length: 7 }, (_, i) => piece(`p${i}`, i)) } as unknown as Level;
    expect(victoryCues(many)).toHaveLength(PIECE_NOTES.length + 3 + 2);
  });

  test('the whole run fits the voices the sfx bus has', () => {
    const many = { pieces: Array.from({ length: 12 }, (_, i) => piece(`p${i}`, i)) } as unknown as Level;
    expect(victoryCues(many).length).toBeLessThanOrEqual(AUDIO_TOKENS.maxVoices);
  });

  test('with effects off the music is not ducked: there is no victory sound to make room for', () => {
    const ducks: number[] = [];
    const played: AudioCue[][] = [];
    const audio: AudioServices = {
      music: { ...SILENT_AUDIO.music, duck: (lvl) => ducks.push(lvl) },
      sfx: { ...SILENT_AUDIO.sfx, isEnabled: () => false, play: (cs) => played.push([...cs]) },
    };
    playVictoryAudio(audio, level);
    expect(ducks).toEqual([]);
    expect(played).toEqual([]);
  });

  test('playVictoryAudio ducks the music and plays the run', () => {
    const ducks: Array<[number, number]> = [];
    const played: AudioCue[][] = [];
    const audio: AudioServices = {
      music: { ...SILENT_AUDIO.music, duck: (lvl, holdMs) => ducks.push([lvl, holdMs]) },
      sfx: { ...SILENT_AUDIO.sfx, isEnabled: () => true, play: (cs) => played.push([...cs]) },
    };
    playVictoryAudio(audio, level);
    expect(ducks).toEqual([[AUDIO_TOKENS.duck.level, AUDIO_TOKENS.duck.holdMs]]);
    expect(played).toEqual([victoryCues(level)]);
  });
});

describe('helpers', () => {
  test('snappedCount counts snapped and placed pieces, not temporary or tray ones', () => {
    const state: PuzzleState = {
      levelId: 'x',
      phase: 'playing',
      pieces: {
        a: { kind: 'snapped', anchorId: 'A', turns: 0 },
        b: { kind: 'placed', x: 8, y: 8, turns: 1 },
        c: { kind: 'temporary', x: 9, y: 9, turns: 0 },
        d: { kind: 'tray', turns: 0 },
      },
    };
    expect(snappedCount(state)).toBe(2);
  });

  test('playFeedbackAudio plays the cues of the batch', () => {
    const played: AudioCue[][] = [];
    playFeedbackAudio({ ...SILENT_AUDIO.sfx, play: (cs) => played.push([...cs]) }, [snapOff], level);
    expect(played).toEqual([[{ key: 'kalimba', rate: rate(4), volume: C.place, delayMs: 0 }]]);
  });
});

/**
 * The promise to the player: whatever they do with a piece makes a sound, in the real game flow
 * (controller, feedback events, cues), not just for hand-made events.
 */
describe('every piece action makes a sound', () => {
  const storage: StoragePort = { getItem: () => null, setItem: () => {} };
  const layout = computeLayout(720, 1280);
  const real = loadLevel('1-1', 'harness');
  const goal = real.targetPlacements![0];
  const piece0 = real.pieces.find((p) => p.id === goal.pieceId)!;
  const index = real.pieces.indexOf(piece0);
  const centerOf = (x: number, y: number) => gridToCanvas(x + piece0.frameSize / 2, y + piece0.frameSize / 2, layout);

  function play(steps: (drop: (x: number, y: number) => FeedbackEvent[], lift: () => FeedbackEvent[]) => void): void {
    const controller = new PlayController(real, createProgressRepository(storage, campaignManifest, 'oracle-v1'), true);
    const lift = (): FeedbackEvent[] => {
      const box = pieceHitbox(piece0, controller.getPuzzleState().pieces[piece0.id], layout, index);
      controller.onPointerDown(box.x + box.width / 2, box.y + box.height / 2, layout);
      return [{ type: 'lift', pieceId: piece0.id }];
    };
    const drop = (x: number, y: number): FeedbackEvent[] => {
      const prev = controller.getPuzzleState();
      const at = centerOf(x, y);
      controller.onPointerMove(at.x, at.y, layout);
      const transition = controller.onPointerUp(at.x, at.y, layout)!;
      return feedbackEvents(prev, transition, real, { command: 'move', pieceId: piece0.id });
    };
    steps(drop, lift);
  }

  const kalimbas = (events: FeedbackEvent[]) => audioCues(events, { level: real }).filter((c) => c.key.startsWith('kalimba'));

  test('lifting, setting down short of the target, locking on and handing back each sound', () => {
    play((drop, lift) => {
      const lifted = kalimbas(lift());
      expect(lifted.length).toBeGreaterThan(0);

      const wrong = kalimbas(drop(goal.x + 24, goal.y + 24));
      expect(wrong.length).toBeGreaterThan(0);
      expect(wrong.every((c) => c.key === 'kalimba')).toBe(true); // short, no ring

      lift();
      const right = kalimbas(drop(goal.x, goal.y));
      expect(right.some((c) => c.key === 'kalimba-ring')).toBe(true);

      lift();
      const away = kalimbas(drop(-200, -200)); // off the board: back to the tray
      expect(away.length).toBeGreaterThan(0);
    });
  });
});
