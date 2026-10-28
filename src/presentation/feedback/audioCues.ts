import { GRID_STEP } from '../../domain/freePlacement.ts';
import type { Level, PuzzleState } from '../../domain/model.ts';
import { matchedPieceCount } from '../../domain/targetMatch.ts';
import type { SfxKey } from '../../content/audio/index.ts';
import type { AudioCue, SfxPort } from '../../infrastructure/sfx.ts';
import type { AudioServices } from '../audio/audioServices.ts';
import { AUDIO_TOKENS } from '../designTokens.ts';
import type { FeedbackEvent } from './feedbackEvents.ts';

/** Major pentatonic, semitones from the music root (spec G §3.1). */
export const PENTATONIC_STEPS: readonly number[] = [-5, -3, 0, 2, 4, 7, 9, 12];

const WIN_STEP = PENTATONIC_STEPS.length - 1;
const LAST_NORMAL_STEP = WIN_STEP - 1;

export function pitchFor(step: number): number {
  const i = Math.max(0, Math.min(WIN_STEP, Math.floor(step)));
  return 2 ** (PENTATONIC_STEPS[i] / 12);
}

/** Pieces resting on the board (anchor or grid point), right or not. Not what the match bar counts. */
export function snappedCount(state: PuzzleState): number {
  return Object.values(state.pieces).filter((p) => p.kind === 'snapped' || p.kind === 'placed').length;
}

/**
 * A drop that is not on target plays one of the pentatonic notes below the octave, picked from the grid point it landed
 * on: the same spot always gives the same note, neighbouring spots differ, and the octave stays the win's alone.
 */
export function placeStep(x: number, y: number): number {
  const cell = Math.floor(x / GRID_STEP) + Math.floor(y / GRID_STEP) * 3;
  return ((cell % WIN_STEP) + WIN_STEP) % WIN_STEP;
}

const cue = (key: SfxKey, volume: number, rate = 1, delayMs = 0): AudioCue => ({ key, rate, volume, delayMs });

export const STINGER_CUE: AudioCue = cue('stinger-win', AUDIO_TOKENS.cues.stinger);

/**
 * One transition's events → sound cues (spec G §3.3). The whole batch is
 * needed: a `won` in the batch turns the snap into the resolving octave, and
 * `reset` swallows the per-piece `return`s, and linked rotation (several `rotate`
 * events in one press) ticks once.
 */
export function audioCues(events: readonly FeedbackEvent[], ctx: { matchedCount: number }): AudioCue[] {
  const c = AUDIO_TOKENS.cues;
  const won = events.some((e) => e.type === 'won');
  const reset = events.some((e) => e.type === 'reset');
  const out: AudioCue[] = [];
  let rotateTicked = false;
  for (const event of events) {
    switch (event.type) {
      case 'lift':
        out.push(cue('breath', c.lift));
        break;
      case 'snap':
        if (won) out.push(cue('bell', c.snapWin, pitchFor(WIN_STEP)));
        else if (event.onTarget) out.push(cue('bell', c.snap, pitchFor(Math.min(ctx.matchedCount - 1, LAST_NORMAL_STEP))));
        else out.push(cue('pluck', c.place, pitchFor(placeStep(event.x, event.y))));
        break;
      case 'settle-temporary':
        out.push(cue('tap-soft', c.settle));
        break;
      case 'return':
        if (!reset) out.push(cue('swish', c.return));
        break;
      case 'rotate':
        if (!rotateTicked) out.push(cue('tick', c.rotate, c.rotateRate));
        rotateTicked = true;
        break;
      case 'rotate-blocked':
        out.push(cue('thud', c.rotateBlocked));
        break;
      case 'overlap-hollow':
        out.push(cue('hollow', c.overlap, 1, AUDIO_TOKENS.overlapDelayMs));
        break;
      case 'overlap-revive':
        out.push(cue('shimmer', c.overlap, 1, AUDIO_TOKENS.overlapDelayMs));
        break;
      case 'reset':
        out.push(cue('swish', c.reset));
        break;
      case 'won':
        // The stinger belongs to the victory timeline (playVictoryAudio)
        break;
    }
  }
  return out;
}

export function playFeedbackAudio(sfx: SfxPort, events: readonly FeedbackEvent[], level: Level, state: PuzzleState): void {
  sfx.play(audioCues(events, { matchedCount: matchedPieceCount(level, state) }));
}

export function playVictoryAudio(audio: AudioServices): void {
  audio.music.duck(AUDIO_TOKENS.duck.level, AUDIO_TOKENS.duck.holdMs);
  audio.sfx.play([STINGER_CUE]);
}
