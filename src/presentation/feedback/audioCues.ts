import type { Level, PuzzleState } from '../../domain/model.ts';
import type { SfxKey } from '../../content/audio/index.ts';
import type { AudioCue, SfxPort } from '../../engine/core/audio/sfx.ts';
import type { AudioServices } from '../audio/audioServices.ts';
import { AUDIO_TOKENS } from '../designTokens.ts';
import type { FeedbackEvent } from './feedbackEvents.ts';

/**
 * Semitones above the music root handed to the pieces in turn: a D major triad, then up
 * (root, third, fifth, octave, third, fifth). Whatever order the pieces are handled in,
 * their notes agree, and together they are the chord the victory run lands on.
 */
export const PIECE_NOTES: readonly number[] = [0, 4, 7, 12, 16, 19];

const rateOf = (semitones: number) => 2 ** (semitones / 12);

/** Semitones of the note a piece plays everywhere: lift, set down, lock in, hand back, victory. */
export function pieceSemitones(level: Level, pieceId: string): number {
  const index = Math.max(0, level.pieces.findIndex((p) => p.id === pieceId));
  return PIECE_NOTES[index % PIECE_NOTES.length];
}

/** Pieces resting on the board (anchor or grid point), right or not. Not what the match bar counts. */
export function snappedCount(state: PuzzleState): number {
  return Object.values(state.pieces).filter((p) => p.kind === 'snapped' || p.kind === 'placed').length;
}

const cue = (key: SfxKey, volume: number, rate = 1, delayMs = 0): AudioCue => ({ key, rate, volume, delayMs });

/**
 * One transition's events → sound cues (spec G §3.3). Every piece sound is the kalimba at that piece's own note:
 * a light touch when it is lifted, a short note when set down short of its target, a ringing note
 * and a soft echo of it when it locks onto the target, the note an octave below when it is handed back. A `reset` swallows the
 * per-piece `return`s, and linked rotation (several `rotate` events in one press) ticks once.
 */
export function audioCues(events: readonly FeedbackEvent[], ctx: { level: Level }): AudioCue[] {
  const c = AUDIO_TOKENS.cues;
  const reset = events.some((e) => e.type === 'reset');
  const note = (pieceId: string) => rateOf(pieceSemitones(ctx.level, pieceId));
  const out: AudioCue[] = [];
  let rotateTicked = false;
  for (const event of events) {
    switch (event.type) {
      case 'lift':
        out.push(cue('kalimba', c.lift, note(event.pieceId)));
        break;
      case 'snap':
        if (event.onTarget) {
          out.push(cue('kalimba-ring', c.snap, note(event.pieceId)));
          out.push(cue('kalimba-ring', c.snap * c.echo, note(event.pieceId), AUDIO_TOKENS.echoDelayMs));
        } else {
          out.push(cue('kalimba', c.place, note(event.pieceId)));
        }
        break;
      case 'settle-temporary':
        out.push(cue('kalimba', c.settle, note(event.pieceId)));
        break;
      case 'return':
        if (!reset) out.push(cue('kalimba', c.return, note(event.pieceId) / 2));
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
        // The run belongs to the victory timeline (playVictoryAudio)
        break;
    }
  }
  return out;
}

/**
 * Victory: the notes of this level's pieces run up one after another, then the root chord (root, fifth, octave)
 * rolls out, slowly, and rings on with two fading echoes of its top note. The player hears the notes they have been playing
 * all level resolve into a chord.
 */
export function victoryCues(level: Level): AudioCue[] {
  const c = AUDIO_TOKENS.cues;
  const notes = [...new Set(level.pieces.map((p) => pieceSemitones(level, p.id)))].sort((a, b) => a - b);
  const out = notes.map((s, i) => cue('kalimba-ring', c.victoryNote, rateOf(s), i * AUDIO_TOKENS.victoryStepMs));
  const chordAt = notes.length * AUDIO_TOKENS.victoryStepMs + AUDIO_TOKENS.victoryStepMs;
  [0, 7, 12].forEach((s, i) =>
    out.push(cue('kalimba-ring', c.victoryEnd, rateOf(s), chordAt + i * AUDIO_TOKENS.victoryChordGapMs))
  );
  const lastAt = chordAt + 2 * AUDIO_TOKENS.victoryChordGapMs;
  AUDIO_TOKENS.victoryEchoDelaysMs.forEach((delay, i) =>
    out.push(cue('kalimba-ring', c.victoryEnd * c.echo * 0.5 ** i, rateOf(12), lastAt + delay))
  );
  return out;
}

export function playFeedbackAudio(sfx: SfxPort, events: readonly FeedbackEvent[], level: Level): void {
  sfx.play(audioCues(events, { level }));
}

/** The music only steps aside for a victory sound that plays: with effects off it carries on at full level. */
export function playVictoryAudio(audio: AudioServices, level: Level): void {
  if (!audio.sfx.isEnabled()) return;
  audio.music.duck(AUDIO_TOKENS.duck.level, AUDIO_TOKENS.duck.holdMs);
  audio.sfx.play(victoryCues(level));
}
