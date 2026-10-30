/**
 * Sample-level DSP primitives.
 *
 * Everything here is pure and deterministic: given the same arguments
 * (and the same Rng) a function returns the same samples. Nothing in this
 * file imports anything, which is what lets the folder be copied into
 * another project unchanged.
 */

export type Rng = () => number;

/** Small, fast, well-distributed PRNG. Used instead of Math.random so renders repeat. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function noise(color: 'white' | 'pink', n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n);
  if (color === 'white') {
    for (let i = 0; i < n; i++) out[i] = rng() * 2 - 1;
    return out;
  }
  // Paul Kellet's economy pink-noise filter: three one-pole sections summed.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = rng() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 0.1050186;
    out[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + w * 0.1848) * 0.35));
  }
  return out;
}

export type EnvelopeShape = {
  attackMs: number;
  decayMs: number;
  sustain?: number;
  releaseMs?: number;
  curve?: 'lin' | 'exp';
};

/**
 * Attack 0 -> 1, decay 1 -> sustain, hold, release sustain -> 0.
 * With no sustain and no release this is the plain AD shape most effects use.
 * Decay and release include their endpoints; a one-sample segment is its target.
 * Segments exceeding the buffer are truncated, rather than compressed.
 */
export function envelope(env: EnvelopeShape, n: number, sampleRate: number): Float32Array {
  const out = new Float32Array(n);
  const perMs = sampleRate / 1000;
  const a = Math.max(0, Math.round(env.attackMs * perMs));
  const d = Math.max(0, Math.round(env.decayMs * perMs));
  const r = Math.max(0, Math.round((env.releaseMs ?? 0) * perMs));
  const sustain = env.sustain ?? 0;
  const exp = env.curve === 'exp';
  const releaseStart = Math.max(a + d, n - r);

  for (let i = 0; i < n; i++) {
    let v: number;
    if (i < a) {
      const t = a === 0 ? 1 : i / a;
      v = exp ? t * t : t;
    } else if (i < a + d) {
      const t = d <= 1 ? 1 : (i - a) / (d - 1);
      const fall = exp ? (1 - t) ** 3 : 1 - t;
      v = sustain + (1 - sustain) * fall;
    } else if (i < releaseStart) {
      v = sustain;
    } else {
      const t = r <= 1 ? 1 : Math.min(1, (i - releaseStart) / (r - 1));
      v = sustain * (exp ? (1 - t) ** 3 : 1 - t);
    }
    out[i] = v;
  }
  return out;
}

export type OscKind = 'sine' | 'triangle' | 'saw' | 'square';

function waveform(kind: OscKind, phase: number): number {
  switch (kind) {
    case 'sine':
      return Math.sin(2 * Math.PI * phase);
    case 'saw':
      return 2 * phase - 1;
    case 'square':
      return phase < 0.5 ? 1 : -1;
    case 'triangle':
      return 4 * Math.abs(phase - 0.5) - 1;
  }
}

/** Linear frequency glide from hzStart to hzEnd across the whole buffer. */
export function osc(
  kind: OscKind,
  hzStart: number,
  hzEnd: number,
  n: number,
  sampleRate: number,
): Float32Array {
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : i / (n - 1);
    const hz = hzStart + (hzEnd - hzStart) * t;
    out[i] = waveform(kind, phase);
    phase += hz / sampleRate;
    if (phase >= 1) phase -= Math.floor(phase);
  }
  return out;
}

/**
 * Two-operator FM. A modulator at carrierHz * ratio bends the carrier's phase.
 * A non-integer ratio gives inharmonic partials, which is what makes bells
 * and struck metal sound the way they do.
 */
export function fmOsc(
  carrierHz: number,
  ratio: number,
  index: number,
  indexEnv: Float32Array | null,
  n: number,
  sampleRate: number,
): Float32Array {
  const out = new Float32Array(n);
  const modHz = carrierHz * ratio;
  let carrierPhase = 0;
  let modPhase = 0;
  for (let i = 0; i < n; i++) {
    const depth = index * (indexEnv ? indexEnv[i] : 1);
    out[i] = Math.sin(2 * Math.PI * carrierPhase + Math.sin(2 * Math.PI * modPhase) * depth);
    carrierPhase += carrierHz / sampleRate;
    if (carrierPhase >= 1) carrierPhase -= Math.floor(carrierPhase);
    modPhase += modHz / sampleRate;
    if (modPhase >= 1) modPhase -= Math.floor(modPhase);
  }
  return out;
}

export type FilterKind = 'lowpass' | 'highpass' | 'bandpass';
export type Coeffs = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** Robert Bristow-Johnson's cookbook biquad, normalised by a0. */
export function biquadCoeffs(
  kind: FilterKind,
  hz: number,
  q: number,
  sampleRate: number,
): Coeffs {
  const clamped = Math.max(1, Math.min(hz, sampleRate * 0.49));
  const w0 = (2 * Math.PI * clamped) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * Math.max(0.0001, q));
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let b0: number;
  let b1: number;
  let b2: number;
  if (kind === 'lowpass') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = b0;
  } else if (kind === 'highpass') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = b0;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/** Direct form I. Recomputes coefficients per sample when the cutoff sweeps. */
export function applyBiquad(
  input: Float32Array,
  kind: FilterKind,
  hzStart: number,
  hzEnd: number,
  q: number,
  sampleRate: number,
): Float32Array {
  const n = input.length;
  const out = new Float32Array(n);
  const sweeps = hzEnd !== hzStart;
  let c = biquadCoeffs(kind, hzStart, q, sampleRate);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < n; i++) {
    if (sweeps) {
      const t = n <= 1 ? 0 : i / (n - 1);
      c = biquadCoeffs(kind, hzStart + (hzEnd - hzStart) * t, q, sampleRate);
    }
    const x = input[i];
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}
