/**
 * Rooms — dev only, listening prototype.
 *
 * A room is an impulse response, and an impulse response is just a noise
 * burst that decays. We generate it rather than ship a .wav: same reasoning
 * as the patches in src/content/audio/ — no file, no licence, no budget, and
 * the character is a handful of numbers a reviewer can drag.
 *
 * Nothing here touches the Web Audio API, so it is a pure function of
 * (spec, sampleRate) and could graduate into src/audio-synth/ unchanged.
 */
import { mulberry32 } from '../../audio-synth/dsp.ts';

export type RoomSpec = {
  id: RoomId;
  label: string;
  /** Seconds for the tail to fall 60 dB. The headline number of a room. */
  seconds: number;
  /** Silence before the tail starts. Reads as distance from the walls. */
  predelayMs: number;
  /** Lowpass cutoff at the start of the tail. */
  dampingFromHz: number;
  /** Lowpass cutoff at the end of it. Falling = the room swallows highs as it decays. */
  dampingToHz: number;
  /** 0..1. How many early reflections sit in the first 80 ms. */
  diffusion: number;
  /** Default wet level for this room. */
  wet: number;
  /** Feedback echo in ms; 0 turns it off. This is the "vọng", distinct from the tail. */
  echoMs: number;
  /** 0..0.85. How much of the echo feeds back into itself. */
  echoFeedback: number;
};

export type RoomId = 'dry' | 'stone-temple' | 'glass-hall' | 'close';

export const ROOMS: readonly RoomSpec[] = [
  {
    id: 'dry',
    label: 'Khô (như hiện tại)',
    seconds: 0.001,
    predelayMs: 0,
    dampingFromHz: 20000,
    dampingToHz: 20000,
    diffusion: 0,
    wet: 0,
    echoMs: 0,
    echoFeedback: 0,
  },
  {
    id: 'stone-temple',
    label: 'Đền đá — dài, tối, thiêng',
    seconds: 3.5,
    predelayMs: 22,
    dampingFromHz: 5200,
    dampingToHz: 900,
    diffusion: 0.75,
    wet: 0.42,
    echoMs: 320,
    echoFeedback: 0.22,
  },
  {
    id: 'glass-hall',
    label: 'Sảnh kính — sáng, lấp lánh',
    seconds: 2.0,
    predelayMs: 12,
    dampingFromHz: 11000,
    dampingToHz: 3200,
    diffusion: 0.55,
    wet: 0.36,
    echoMs: 180,
    echoFeedback: 0.3,
  },
  {
    id: 'close',
    label: 'Gần — ấm, thân mật',
    seconds: 1.2,
    predelayMs: 6,
    dampingFromHz: 7000,
    dampingToHz: 2000,
    diffusion: 0.35,
    wet: 0.28,
    echoMs: 0,
    echoFeedback: 0,
  },
];

export function roomById(id: RoomId): RoomSpec {
  return ROOMS.find((r) => r.id === id) ?? ROOMS[0];
}

/** -60 dB expressed as a natural-log decay constant. */
const LN_MILLI = Math.log(1000);

/**
 * One channel of the tail.
 *
 * Noise shaped by an exponential decay, run through a one-pole lowpass whose
 * cutoff falls across the tail. The falling cutoff is what separates a room
 * from a noise burst: real rooms absorb treble faster than bass, so the tail
 * darkens as it dies.
 */
function tail(spec: RoomSpec, sampleRate: number, seed: number): Float32Array {
  const predelay = Math.round((spec.predelayMs / 1000) * sampleRate);
  const body = Math.max(1, Math.round(spec.seconds * sampleRate));
  const out = new Float32Array(predelay + body);
  const rng = mulberry32(seed);

  // Early reflections: a few discrete taps before the diffuse tail takes over.
  const taps = Math.round(spec.diffusion * 18);
  for (let t = 0; t < taps; t++) {
    const at = predelay + Math.floor(rng() * 0.08 * sampleRate);
    if (at >= out.length) continue;
    const gain = (1 - t / Math.max(1, taps)) * spec.diffusion * (rng() * 0.6 + 0.4);
    out[at] += (rng() * 2 - 1) * gain;
  }

  let lp = 0;
  for (let i = 0; i < body; i++) {
    const t = i / body;
    const decay = Math.exp(-LN_MILLI * t);
    const cutoff = spec.dampingFromHz + (spec.dampingToHz - spec.dampingFromHz) * t;
    // One-pole lowpass coefficient for this instant's cutoff.
    const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
    const white = rng() * 2 - 1;
    lp += a * (white - lp);
    out[predelay + i] += lp * decay;
  }

  return out;
}

/**
 * Scales a pair of channels so each has unit ENERGY (sum of squares = 1).
 *
 * Energy, not RMS, is what sets how loud a convolver is. A steady tone comes
 * out of a convolver scaled by roughly the square root of the impulse's
 * energy, so an impulse normalised to a fixed RMS gets louder the longer it
 * is. The first version of this file did exactly that: a 3.5 s tail at
 * RMS 0.12 has energy ~2200, so the reverb came out ~14x louder than the
 * sound that fed it. With unit energy the wet path has roughly the same
 * loudness as its input, and the wet knob means what it says.
 */
function normalizePair(left: Float32Array, right: Float32Array): void {
  let l = 0;
  let r = 0;
  for (let i = 0; i < left.length; i++) {
    l += left[i] * left[i];
    r += right[i] * right[i];
  }
  const kl = l === 0 ? 1 : 1 / Math.sqrt(l);
  const kr = r === 0 ? 1 : 1 / Math.sqrt(r);
  for (let i = 0; i < left.length; i++) {
    left[i] *= kl;
    right[i] *= kr;
  }
}

/**
 * A stereo impulse response for the room.
 *
 * The two channels use different seeds so they are uncorrelated — that
 * decorrelation is the whole reason the tail sounds wide rather than like a
 * mono blob pasted in the middle of the head.
 *
 * Every room has unit energy per channel, so switching rooms compares
 * character, not loudness. Without this the longest room always "wins".
 */
export function generateImpulse(
  spec: RoomSpec,
  sampleRate: number
): { left: Float32Array; right: Float32Array } {
  const left = tail(spec, sampleRate, 0x5eed);
  const right = tail(spec, sampleRate, 0xb33f);
  normalizePair(left, right);
  return { left, right };
}
