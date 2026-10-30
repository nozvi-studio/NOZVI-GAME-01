/**
 * The declarative description of one sound.
 *
 * Five concepts: a Source makes raw signal, an Envelope shapes its level,
 * a Filter colours it, a Layer binds those together, and normalize sets how
 * loud the finished sum is. Layers are summed; startMs offsets one so a
 * single patch can hold a chord or an arpeggio.
 */
import type { EnvelopeShape, FilterKind, OscKind } from './dsp.ts';

export type Envelope = EnvelopeShape;

export type Source =
  | { kind: OscKind; hz: number; glideToHz?: number }
  | { kind: 'noise'; color: 'white' | 'pink' }
  | { kind: 'fm'; carrierHz: number; ratio: number; index: number; indexEnv?: Envelope };

export type Filter = { kind: FilterKind; hz: number; q?: number; sweepToHz?: number };

export type Layer = {
  startMs?: number;
  source: Source;
  env: Envelope;
  filter?: Filter;
  gain?: number;
};

export type NormalizeTarget = { peak: number } | { rms: number };

export type Patch = {
  durationMs: number;
  seed: number;
  layers: Layer[];
  normalize: NormalizeTarget;
};

export type PatchIssue = { path: string; message: string };

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function checkEnvelope(env: Envelope, path: string, issues: PatchIssue[]): void {
  for (const key of ['attackMs', 'decayMs'] as const) {
    if (!finite(env[key]) || env[key] < 0) {
      issues.push({ path: `${path}.${key}`, message: `${key} must be a number >= 0` });
    }
  }
  if (env.releaseMs !== undefined && (!finite(env.releaseMs) || env.releaseMs < 0)) {
    issues.push({ path: `${path}.releaseMs`, message: 'releaseMs must be a number >= 0' });
  }
  if (env.sustain !== undefined && (!finite(env.sustain) || env.sustain < 0 || env.sustain > 1)) {
    issues.push({ path: `${path}.sustain`, message: 'sustain must be between 0 and 1' });
  }
}

/** Returns every problem it can find. An empty array means the patch renders. */
export function validatePatch(patch: Patch, sampleRate: number): PatchIssue[] {
  const issues: PatchIssue[] = [];
  const nyquist = sampleRate / 2;

  // A bad rate would render garbage silently, so reject it up front.
  if (!finite(sampleRate) || sampleRate <= 0) {
    issues.push({ path: 'sampleRate', message: 'sampleRate must be a finite number > 0' });
  }

  if (!finite(patch.durationMs) || patch.durationMs <= 0) {
    issues.push({ path: 'durationMs', message: 'durationMs must be a number > 0' });
  }
  if (!finite(patch.seed)) {
    issues.push({ path: 'seed', message: 'seed must be a finite number' });
  }
  if (!Array.isArray(patch.layers) || patch.layers.length === 0) {
    issues.push({ path: 'layers', message: 'a patch needs at least one layer' });
  }

  if ('peak' in patch.normalize) {
    const { peak } = patch.normalize;
    if (!finite(peak) || peak <= 0 || peak > 1) {
      issues.push({ path: 'normalize.peak', message: 'peak must be between 0 (exclusive) and 1' });
    }
  } else {
    const { rms } = patch.normalize;
    if (!finite(rms) || rms <= 0 || rms > 1) {
      issues.push({ path: 'normalize.rms', message: 'rms must be between 0 (exclusive) and 1' });
    }
  }

  (patch.layers ?? []).forEach((layer, i) => {
    const at = `layers[${i}]`;

    if (layer.startMs !== undefined) {
      if (!finite(layer.startMs) || layer.startMs < 0) {
        issues.push({ path: `${at}.startMs`, message: 'startMs must be a number >= 0' });
      } else if (layer.startMs >= patch.durationMs) {
        issues.push({ path: `${at}.startMs`, message: 'startMs must be before the patch ends' });
      }
    }
    if (layer.gain !== undefined && (!finite(layer.gain) || layer.gain < 0)) {
      issues.push({ path: `${at}.gain`, message: 'gain must be a number >= 0' });
    }

    const src = layer.source;
    if (src.kind === 'noise') {
      if (src.color !== 'white' && src.color !== 'pink') {
        issues.push({ path: `${at}.source.color`, message: 'color must be white or pink' });
      }
    } else if (src.kind === 'fm') {
      for (const key of ['carrierHz', 'ratio', 'index'] as const) {
        if (!finite(src[key]) || src[key] < 0) {
          issues.push({ path: `${at}.source.${key}`, message: `${key} must be a number >= 0` });
        }
      }
      if (finite(src.carrierHz) && src.carrierHz > nyquist) {
        issues.push({ path: `${at}.source.carrierHz`, message: 'carrierHz is above Nyquist' });
      }
      if (finite(src.carrierHz) && finite(src.ratio) && src.carrierHz * src.ratio > nyquist) {
        issues.push({
          path: `${at}.source.ratio`,
          message: 'the modulator (carrierHz * ratio) is above Nyquist',
        });
      }
      if (src.indexEnv) checkEnvelope(src.indexEnv, `${at}.source.indexEnv`, issues);
    } else {
      if (!finite(src.hz) || src.hz <= 0) {
        issues.push({ path: `${at}.source.hz`, message: 'hz must be a number > 0' });
      } else if (src.hz > nyquist) {
        issues.push({ path: `${at}.source.hz`, message: 'hz is above Nyquist' });
      }
      if (src.glideToHz !== undefined) {
        if (!finite(src.glideToHz) || src.glideToHz <= 0) {
          issues.push({ path: `${at}.source.glideToHz`, message: 'glideToHz must be a number > 0' });
        } else if (src.glideToHz > nyquist) {
          issues.push({ path: `${at}.source.glideToHz`, message: 'glideToHz is above Nyquist' });
        }
      }
    }

    checkEnvelope(layer.env, `${at}.env`, issues);

    if (layer.filter) {
      const f = layer.filter;
      if (!finite(f.hz) || f.hz <= 0 || f.hz >= nyquist) {
        issues.push({ path: `${at}.filter.hz`, message: 'filter hz must be between 0 and Nyquist' });
      }
      if (f.sweepToHz !== undefined && (!finite(f.sweepToHz) || f.sweepToHz <= 0 || f.sweepToHz >= nyquist)) {
        issues.push({
          path: `${at}.filter.sweepToHz`,
          message: 'filter sweepToHz must be between 0 and Nyquist',
        });
      }
      if (f.q !== undefined && (!finite(f.q) || f.q <= 0)) {
        issues.push({ path: `${at}.filter.q`, message: 'q must be a number > 0' });
      }
    }
  });

  return issues;
}
