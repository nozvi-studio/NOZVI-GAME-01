/**
 * Instrument voices — dev only, listening prototype.
 *
 * Each instrument is a function (pitch, length, tweaks) -> Patch. The note is
 * synthesised at the requested pitch rather than a fixed sound being sped up
 * or slowed down, because playbackRate also moves the attack and the decay
 * and the result stops sounding like the same instrument.
 *
 * Three techniques cover everything here, all built from the engine's
 * existing sources, envelopes and filters, so nothing in src/audio-synth/
 * changes:
 *
 *   additive  a stack of sine partials, each with its own level and decay.
 *             Struck and plucked instruments live or die on one fact: the
 *             higher partials die faster than the fundamental, so the tone
 *             gets duller as it fades.
 *   twins     a second partial a hair off pitch. Two near-equal frequencies
 *             beat against each other, which is what makes piano strings,
 *             glass and bowed instruments shimmer instead of sit still.
 *   noise     short filtered bursts for the non-pitched part of a sound:
 *             hammer thump, pick, breath, mallet.
 */
import type { Envelope, Filter, Layer, Patch } from '../../audio-synth/patch.ts';

export type InstrumentId =
  | 'piano'
  | 'guitar'
  | 'harp'
  | 'music-box'
  | 'marimba'
  | 'flute'
  | 'bamboo-flute'
  | 'strings'
  | 'glass-bowl'
  | 'glass-harmonica';

/** Macro knobs applied to every instrument so a reviewer can tune by ear. */
export type Tweaks = {
  /** Spectral tilt: partial k is scaled by k^tilt. Positive = brighter. */
  tilt: number;
  /** Multiplies every decay time. */
  decay: number;
  /** Multiplies every noise layer (hammer, pick, breath). */
  noise: number;
};

export const NEUTRAL: Tweaks = { tilt: 0, decay: 1, noise: 1 };

export type InstrumentSpec = {
  id: InstrumentId;
  label: string;
  hint: string;
  /** Sustained instruments hold for as long as the note length says. */
  sustained: boolean;
  /** Comfortable MIDI range, shown as a hint only. */
  low: number;
  high: number;
  build(hz: number, noteMs: number, tw: Tweaks): Patch;
};

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

const MAX_HZ = 16000;
const REF_HZ = 261.63;
const PEAK = 0.5;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const audible = (hz: number): boolean => hz > 0 && hz < MAX_HZ;

type Part = { ratio: number; gain: number; decayMs: number };

/**
 * Partials that ring and die. The envelope is exponential-cubic, so a layer is
 * effectively silent by about 80% of its decayMs; the figures below are written
 * with that in mind.
 */
function struck(hz: number, parts: readonly Part[], attackMs: number, tw: Tweaks): Layer[] {
  const layers: Layer[] = [];
  parts.forEach((p, i) => {
    if (!audible(hz * p.ratio)) return;
    layers.push({
      source: { kind: 'sine', hz: hz * p.ratio },
      env: { attackMs, decayMs: Math.max(20, p.decayMs * tw.decay), curve: 'exp' },
      gain: p.gain * (i + 1) ** tw.tilt,
    });
  });
  return layers;
}

/** Partials that hold at a level until the release. */
function held(
  hz: number,
  parts: ReadonlyArray<{ ratio: number; gain: number }>,
  env: Envelope,
  tw: Tweaks,
  detuneHz = 0,
  twinGain = 0
): Layer[] {
  const layers: Layer[] = [];
  parts.forEach((p, i) => {
    const f = hz * p.ratio;
    if (!audible(f)) return;
    const gain = p.gain * (i + 1) ** tw.tilt;
    layers.push({ source: { kind: 'sine', hz: f }, env, gain });
    if (twinGain > 0 && audible(f + detuneHz * p.ratio)) {
      layers.push({
        source: { kind: 'sine', hz: f + detuneHz * p.ratio },
        env,
        gain: gain * twinGain,
      });
    }
  });
  return layers;
}

function burst(
  color: 'pink' | 'white',
  filter: Filter,
  attackMs: number,
  decayMs: number,
  gain: number,
  tw: Tweaks
): Layer {
  return {
    source: { kind: 'noise', color },
    filter: { ...filter, hz: Math.min(filter.hz, MAX_HZ) },
    env: { attackMs, decayMs, curve: 'exp' },
    gain: gain * tw.noise,
  };
}

function finish(layers: Layer[], durationMs: number, seed: number): Patch {
  return { durationMs: Math.round(durationMs), seed, layers, normalize: { peak: PEAK } };
}

function piano(hz: number, _noteMs: number, tw: Tweaks): Patch {
  // Higher notes ring for less time, and each partial dies faster than the one below.
  const t0 = clamp(5200 * (REF_HZ / hz) ** 0.55, 1100, 7500);
  const parts: Part[] = [];
  for (let k = 1; k <= 10; k++) {
    parts.push({
      // Stiff strings are slightly sharp in their upper partials.
      ratio: k * Math.sqrt(1 + 0.00032 * k * k),
      // The hammer strikes about 13% along the string, which weakens partials
      // whose node sits at the strike point.
      gain: Math.abs(Math.sin(Math.PI * k * 0.13)) / k ** 1.15,
      decayMs: t0 / (1 + 0.75 * (k - 1)),
    });
  }
  const layers = struck(hz, parts, 2, tw);
  // A piano note is two or three strings a hair apart; the beat is the life of it.
  layers.push({
    source: { kind: 'sine', hz: hz * 1.0006 },
    env: { attackMs: 2, decayMs: t0 * 0.9 * tw.decay, curve: 'exp' },
    gain: parts[0].gain * 0.7,
  });
  layers.push(burst('pink', { kind: 'bandpass', hz: Math.min(hz * 2.2, 5000), q: 0.9 }, 1, 45, 0.12, tw));
  return finish(layers, t0 * tw.decay + 40, 201);
}

function guitar(hz: number, _noteMs: number, tw: Tweaks): Patch {
  const t0 = clamp(2800 * (196 / hz) ** 0.35, 700, 3600);
  const parts: Part[] = [];
  for (let k = 1; k <= 9; k++) {
    parts.push({
      ratio: k * Math.sqrt(1 + 0.0001 * k * k),
      // Plucked about 17% along the string.
      gain: Math.abs(Math.sin(Math.PI * k * 0.17)) / k ** 0.9,
      decayMs: t0 / k,
    });
  }
  const layers = struck(hz, parts, 1, tw);
  layers.push(burst('pink', { kind: 'bandpass', hz: Math.min(hz * 8, 6000), q: 1.2 }, 1, 18, 0.1, tw));
  // The body of the instrument answering the string.
  layers.push(burst('pink', { kind: 'lowpass', hz: 240, q: 2.5 }, 1, 90, 0.22, tw));
  return finish(layers, t0 * tw.decay + 40, 202);
}

function harp(hz: number, _noteMs: number, tw: Tweaks): Patch {
  const t0 = clamp(4200 * (REF_HZ / hz) ** 0.4, 1300, 6000);
  const parts: Part[] = [];
  for (let k = 1; k <= 7; k++) {
    parts.push({ ratio: k, gain: 1 / k ** 1.15, decayMs: t0 / (1 + 0.55 * (k - 1)) });
  }
  const layers = struck(hz, parts, 3, tw);
  layers.push(burst('pink', { kind: 'bandpass', hz: Math.min(hz * 6, 5500), q: 1 }, 1, 25, 0.06, tw));
  return finish(layers, t0 * tw.decay + 40, 203);
}

function musicBox(hz: number, _noteMs: number, tw: Tweaks): Patch {
  const s = clamp((REF_HZ / hz) ** 0.25, 0.5, 1.6);
  // Free-bar partial ratios: inharmonic, which is what reads as "tuned metal".
  const ratios = [1, 2.756, 5.404, 8.933];
  const gains = [1, 0.42, 0.18, 0.08];
  const decays = [2600, 800, 330, 160];
  const parts = ratios.map((ratio, i) => ({ ratio, gain: gains[i], decayMs: decays[i] * s }));
  const layers = struck(hz, parts, 1, tw);
  layers.push(burst('white', { kind: 'highpass', hz: 7000, q: 0.7 }, 0, 14, 0.1, tw));
  return finish(layers, 2600 * s * tw.decay + 40, 204);
}

function marimba(hz: number, _noteMs: number, tw: Tweaks): Patch {
  const s = clamp((REF_HZ / hz) ** 0.3, 0.5, 1.8);
  // A marimba bar is carved so its second partial sits exactly two octaves up.
  const ratios = [1, 4, 9.2];
  const gains = [1, 0.42, 0.1];
  const decays = [1000, 300, 90];
  const parts = ratios.map((ratio, i) => ({ ratio, gain: gains[i], decayMs: decays[i] * s }));
  const layers = struck(hz, parts, 1, tw);
  layers.push(burst('pink', { kind: 'lowpass', hz: Math.min(hz * 2.5, 1400), q: 0.8 }, 1, 22, 0.25, tw));
  return finish(layers, 1000 * s * tw.decay + 40, 205);
}

function flute(hz: number, noteMs: number, tw: Tweaks): Patch {
  const release = 260;
  const env: Envelope = { attackMs: 75, decayMs: 140, sustain: 0.9, releaseMs: release, curve: 'exp' };
  const harmonics = [1, 0.28, 0.09, 0.04].map((gain, i) => ({ ratio: i + 1, gain }));
  const layers = held(hz, harmonics, env, tw);
  // A partner about 5 Hz sharp, faded in late, beats against the note: vibrato.
  layers.push({
    source: { kind: 'sine', hz: hz + 5.2 },
    env: { attackMs: 450, decayMs: 0, sustain: 1, releaseMs: release, curve: 'exp' },
    gain: 0.22,
  });
  layers.push({
    source: { kind: 'noise', color: 'pink' },
    filter: { kind: 'bandpass', hz: Math.min(hz * 2.2, 8000), q: 1.8 },
    env: { attackMs: 60, decayMs: 100, sustain: 0.55, releaseMs: release, curve: 'exp' },
    gain: 0.16 * tw.noise,
  });
  return finish(layers, noteMs + release, 301);
}

function bambooFlute(hz: number, noteMs: number, tw: Tweaks): Patch {
  const release = 240;
  const env: Envelope = { attackMs: 48, decayMs: 120, sustain: 0.9, releaseMs: release, curve: 'exp' };
  const harmonics = [1, 0.16, 0.05].map((gain, i) => ({ ratio: i + 1, gain }));
  const layers = held(hz, harmonics, env, tw);
  layers.push({
    source: { kind: 'sine', hz: hz + 4.6 },
    env: { attackMs: 600, decayMs: 0, sustain: 1, releaseMs: release, curve: 'exp' },
    gain: 0.18,
  });
  // Bamboo is breathier than a metal flute, and chiffs as the note starts.
  layers.push({
    source: { kind: 'noise', color: 'pink' },
    filter: { kind: 'bandpass', hz: Math.min(hz * 2.5, 8000), q: 1.2 },
    env: { attackMs: 40, decayMs: 100, sustain: 0.6, releaseMs: release, curve: 'exp' },
    gain: 0.26 * tw.noise,
  });
  layers.push(burst('white', { kind: 'highpass', hz: 2500, q: 0.7 }, 0, 45, 0.12, tw));
  return finish(layers, noteMs + release, 302);
}

function strings(hz: number, noteMs: number, tw: Tweaks): Patch {
  const release = 420;
  const env: Envelope = { attackMs: 260, decayMs: 200, sustain: 0.88, releaseMs: release, curve: 'exp' };
  // A sawtooth spectrum (1/k), built additively so it cannot alias at high pitch.
  // Three copies make an ensemble rather than a solo. They are offset in HERTZ,
  // not cents: a fixed cent offset becomes a tiny Hz offset at low pitch, the
  // copies beat once every couple of seconds and the note swells and drops out
  // instead of shimmering. Measured: the fundamental swung 7x between 0.9 s and
  // 1.5 s on a low note. A fixed Hz offset keeps the beat at 1-3 Hz everywhere.
  const copies = [
    { offsetHz: -1.3, gain: 0.3 },
    { offsetHz: 0, gain: 1 },
    { offsetHz: 1.3, gain: 0.3 },
  ];
  const layers: Layer[] = [];
  for (const copy of copies) {
    const parts = Array.from({ length: 10 }, (_, i) => ({
      ratio: i + 1,
      gain: copy.gain / (i + 1) ** 1.1,
    }));
    layers.push(...held(hz + copy.offsetHz, parts, env, tw));
  }
  layers.push({
    source: { kind: 'noise', color: 'pink' },
    filter: { kind: 'bandpass', hz: Math.min(hz * 3, 6000), q: 1 },
    env: { attackMs: 200, decayMs: 150, sustain: 0.5, releaseMs: release, curve: 'exp' },
    gain: 0.04 * tw.noise,
  });
  return finish(layers, noteMs + release, 303);
}

function glassBowl(hz: number, _noteMs: number, tw: Tweaks): Patch {
  const s = clamp((REF_HZ / hz) ** 0.2, 0.6, 1.4);
  // Bowl partials are inharmonic, and the bowl is never perfectly round, so each
  // partial splits into two close frequencies that beat. Higher partials beat faster.
  const ratios = [1, 2.71, 5.12, 8.2];
  const gains = [1, 0.5, 0.22, 0.08];
  const decays = [5200, 3200, 2000, 1100];
  const parts = ratios.map((ratio, i) => ({ ratio, gain: gains[i], decayMs: decays[i] * s }));
  const layers = struck(hz, parts, 18, tw);
  const twins = parts.map((p) => ({ ratio: p.ratio * 1.0028, gain: p.gain * 0.7, decayMs: p.decayMs }));
  layers.push(...struck(hz, twins, 18, tw));
  return finish(layers, 5200 * s * tw.decay + 40, 304);
}

function glassHarmonica(hz: number, noteMs: number, tw: Tweaks): Patch {
  const release = 700;
  const env: Envelope = { attackMs: 150, decayMs: 200, sustain: 0.92, releaseMs: release, curve: 'exp' };
  const harmonics = [1, 0.18, 0.06].map((gain, i) => ({ ratio: i + 1, gain }));
  const layers = held(hz, harmonics, env, tw, 1.1, 0.55);
  return finish(layers, noteMs + release, 305);
}

export const INSTRUMENTS: readonly InstrumentSpec[] = [
  { id: 'piano', label: 'Piano', hint: 'dây kép lệch nhẹ, búa gõ, cao càng ngắn', sustained: false, low: 48, high: 84, build: piano },
  { id: 'guitar', label: 'Guitar nylon', hint: 'gảy dây, thân đàn đáp lại', sustained: false, low: 40, high: 76, build: guitar },
  { id: 'harp', label: 'Đàn hạc', hint: 'gảy dây, ngân dài, trong', sustained: false, low: 48, high: 84, build: harp },
  { id: 'music-box', label: 'Hộp nhạc', hint: 'thanh kim loại nhỏ, phần bội không hài hoà', sustained: false, low: 72, high: 96, build: musicBox },
  { id: 'marimba', label: 'Marimba', hint: 'gỗ, ấm, tắt nhanh', sustained: false, low: 48, high: 84, build: marimba },
  { id: 'flute', label: 'Sáo tây', hint: 'hơi thở, rung nhẹ về cuối nốt', sustained: true, low: 60, high: 96, build: flute },
  { id: 'bamboo-flute', label: 'Sáo trúc', hint: 'nhiều hơi, mộc, có tiếng bật đầu nốt', sustained: true, low: 72, high: 98, build: bambooFlute },
  { id: 'strings', label: 'Dàn dây', hint: 'ba cây lệch vài Hz cho lấp lánh, kéo cung chậm', sustained: true, low: 36, high: 72, build: strings },
  { id: 'glass-bowl', label: 'Chuông thuỷ tinh', hint: 'gõ rồi ngân, rung theo nhịp phách', sustained: false, low: 60, high: 84, build: glassBowl },
  { id: 'glass-harmonica', label: 'Đàn thuỷ tinh', hint: 'cọ vành, vào chậm, kéo dài', sustained: true, low: 60, high: 90, build: glassHarmonica },
];

export function instrumentSpec(id: InstrumentId): InstrumentSpec {
  const spec = INSTRUMENTS.find((i) => i.id === id);
  if (!spec) throw new Error(`unknown instrument: ${id}`);
  return spec;
}
