/**
 * Piece voices — dev only, listening prototype.
 *
 * Two independent axes, which is the whole design:
 *
 *   size  → register   (how high the piece sits)
 *   shape → timbre     (what material it is made of)
 *   progress → degree  (which note of the scale, unchanged from audioCues.ts)
 *
 * Keeping them independent is what makes the result musical. Size only ever
 * adds perfect intervals — octaves, fifths, a fourth — so no combination of
 * pieces on a board can produce a dissonance. The melody still comes from
 * progress, exactly as it does today.
 *
 * Both inputs already exist in every LevelDocument. Nothing here needs new
 * content, and no level file changes.
 */
import type { ShapeKind } from '../../domain/model.ts';
import type { SfxKey } from '../../content/audio/index.ts';

/** Semitone offset per frame size. Every value is a perfect interval. */
const REGISTER: Record<number, number> = {
  16: 12, // smallest: an octave up
  32: 7, //  a fifth up
  48: 2, //  a tone up
  64: 0, //  the reference size
  96: -5, // a fourth down
  128: -10, // a seventh down; the largest piece in the campaign (one of them)
};

const SIZES = Object.keys(REGISTER)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * Semitones for a frame size, with sizes we have never shipped snapped to the
 * nearest one we have. The six real sizes are 16/32/48/64/96/128.
 */
export function registerSemitones(frameSize: number): number {
  if (REGISTER[frameSize] !== undefined) return REGISTER[frameSize];
  let best = SIZES[0];
  for (const size of SIZES) {
    if (Math.abs(size - frameSize) < Math.abs(best - frameSize)) best = size;
  }
  return REGISTER[best];
}

export type Timbre = {
  /** Which rendered patch is struck. */
  strike: SfxKey;
  /** Colour applied to this voice alone, before the room send. */
  filter: { type: BiquadFilterType; hz: number; q: number };
  /** Cents of detune; gives a shape a touch of instability. */
  detuneCents: number;
  gain: number;
  label: string;
};

/**
 * Material per shape.
 *
 * The filter does the describing. A triangle is an edge, so it keeps its top
 * and loses its body; a circle has no edge at all, so it loses its top. The
 * diamond is the reference — it is the shape the bell was voiced on.
 */
const TIMBRES: Record<ShapeKind, Timbre> = {
  triangle: {
    strike: 'bell',
    filter: { type: 'highpass', hz: 700, q: 0.8 },
    detuneCents: 0,
    gain: 0.95,
    label: 'sắc, nhiều cạnh',
  },
  square: {
    strike: 'bell',
    filter: { type: 'lowpass', hz: 4200, q: 0.9 },
    detuneCents: 0,
    gain: 1,
    label: 'chắc, đầy thân',
  },
  diamond: {
    strike: 'bell',
    filter: { type: 'peaking', hz: 2400, q: 1.2 },
    detuneCents: 0,
    gain: 1,
    label: 'tròn đầy — giọng gốc',
  },
  circle: {
    strike: 'bell',
    filter: { type: 'lowpass', hz: 1900, q: 0.7 },
    detuneCents: 0,
    gain: 0.9,
    label: 'mềm, không cạnh',
  },
  parallelogram: {
    strike: 'bell',
    filter: { type: 'bandpass', hz: 1500, q: 1.6 },
    detuneCents: 9,
    gain: 0.92,
    label: 'nghiêng, hơi lệch',
  },
};

export function timbreFor(shape: ShapeKind): Timbre {
  return TIMBRES[shape];
}

/** Semitones → playback rate. */
export function rateFromSemitones(semitones: number): number {
  return 2 ** (semitones / 12);
}

/** Major pentatonic, copied from presentation/feedback/audioCues.ts. */
export const PENTATONIC_STEPS: readonly number[] = [-5, -3, 0, 2, 4, 7, 9, 12];

export function degreeSemitones(step: number): number {
  const i = Math.max(0, Math.min(PENTATONIC_STEPS.length - 1, Math.floor(step)));
  return PENTATONIC_STEPS[i];
}

export type VoiceSpec = {
  strike: SfxKey;
  /** When set, this exact buffer is played and `strike` is ignored. */
  buffer?: AudioBuffer;
  rate: number;
  gain: number;
  filter?: { type: BiquadFilterType; hz: number; q: number };
  detuneCents: number;
  /** How much of this voice is sent to the room. */
  send: number;
  delayMs: number;
};

export type PieceLike = { frameSize: number; shapeKind: ShapeKind };

/**
 * Touching a piece: its own register and material, no scale degree. Quiet,
 * short, but sent to the room so it rings rather than clicks.
 */
export function touchVoice(piece: PieceLike, send: number): VoiceSpec {
  const timbre = timbreFor(piece.shapeKind);
  return {
    strike: 'tick',
    rate: rateFromSemitones(registerSemitones(piece.frameSize) * 0.5),
    gain: 0.35 * timbre.gain,
    filter: timbre.filter,
    detuneCents: timbre.detuneCents,
    send: send * 0.8,
    delayMs: 0,
  };
}

/**
 * Snapping a piece: a chord, not a note.
 *
 * Root = the scale degree for how far the player has got (today's behaviour).
 * Above it, a fifth and an octave, quieter and slightly late, so the chord
 * blooms instead of arriving as a block. The piece's register transposes the
 * whole chord, which is why a big piece lands heavy and a small one chimes.
 */
export function snapChord(piece: PieceLike, step: number, send: number): VoiceSpec[] {
  const timbre = timbreFor(piece.shapeKind);
  const base = degreeSemitones(step) + registerSemitones(piece.frameSize);
  const voices: Array<{ semis: number; gain: number; delayMs: number }> = [
    { semis: base, gain: 0.8, delayMs: 0 },
    { semis: base + 7, gain: 0.34, delayMs: 55 },
    { semis: base + 12, gain: 0.22, delayMs: 110 },
  ];
  return voices.map((v) => ({
    strike: timbre.strike,
    rate: rateFromSemitones(v.semis),
    gain: v.gain * timbre.gain,
    filter: timbre.filter,
    detuneCents: timbre.detuneCents,
    send,
    delayMs: v.delayMs,
  }));
}

/**
 * The board breathing while nobody plays.
 *
 * One placed piece at a time, very quiet, drowned in the room. It is the same
 * voice the piece already has — the board is humming to itself in its own
 * voice, not playing a separate ambient instrument.
 */
export function breathVoice(piece: PieceLike, step: number, send: number): VoiceSpec {
  const timbre = timbreFor(piece.shapeKind);
  return {
    strike: timbre.strike,
    rate: rateFromSemitones(degreeSemitones(step) + registerSemitones(piece.frameSize)),
    gain: 0.08 * timbre.gain,
    filter: timbre.filter,
    detuneCents: timbre.detuneCents,
    send: Math.min(1, send * 1.6),
    delayMs: 0,
  };
}
