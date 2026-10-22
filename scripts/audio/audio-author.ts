/**
 * Render Mirror's sound effects to listening copies.
 *
 *   npm run audio:author -- bell tick
 *   npm run audio:author -- --all
 *
 * Writes docs/testing/audio/<key>.wav, <key>.svg and report.md. None of it
 * ships: the game synthesizes these patches at runtime. Exits non-zero if a
 * patch is invalid or longer than the sound brief allows.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure } from '../../src/audio-synth/normalize.ts';
import { renderPatch } from '../../src/audio-synth/render.ts';
import { renderAudioReport, renderWaveformSvg } from '../../src/audio-synth/report.ts';
import type { ReportRow } from '../../src/audio-synth/report.ts';
import { encodeWav } from '../../src/audio-synth/wav.ts';
import { MUSIC_ROOT_HZ, SFX_KEYS, SFX_PATCHES } from '../../src/content/audio/index.ts';
import type { SfxKey } from '../../src/content/audio/index.ts';

const SAMPLE_RATE = 44100;
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../../docs/testing/audio');

/** Spec G section 3.2. Kept here as well as in the test so the CLI can fail loudly. */
const LIMIT_MS: Record<SfxKey, number> = {
  bell: 1500,
  tick: 150,
  'tap-soft': 300,
  thud: 400,
  hollow: 1000,
  shimmer: 1000,
  swish: 600,
  'stinger-win': 5000,
};

/** The configured pitch, read from the patch. Nothing is estimated. */
function pitchOf(key: SfxKey): number | null {
  const first = SFX_PATCHES[key].layers[0]?.source;
  if (!first) return null;
  if (first.kind === 'fm') return first.carrierHz;
  if (first.kind === 'noise') return null;
  return first.hz;
}

function main(): void {
  const args = process.argv.slice(2);
  const keys: SfxKey[] =
    args.length === 0 || args.includes('--all')
      ? [...SFX_KEYS]
      : (args.filter((a) => (SFX_KEYS as readonly string[]).includes(a)) as SfxKey[]);

  const unknown = args.filter(
    (a) => a !== '--all' && !(SFX_KEYS as readonly string[]).includes(a),
  );
  if (unknown.length > 0) {
    console.error(`[audio-author] unknown key(s): ${unknown.join(', ')}`);
    console.error(`[audio-author] known keys: ${SFX_KEYS.join(', ')}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const rows: ReportRow[] = [];
  let failed = false;

  for (const key of keys) {
    let samples: Float32Array;
    try {
      samples = renderPatch(SFX_PATCHES[key], SAMPLE_RATE);
    } catch (err) {
      console.error(`[audio-author] FAIL ${key}: ${(err as Error).message}`);
      failed = true;
      continue;
    }

    writeFileSync(resolve(OUT_DIR, `${key}.wav`), encodeWav(samples, SAMPLE_RATE));
    writeFileSync(resolve(OUT_DIR, `${key}.svg`), renderWaveformSvg(samples), 'utf8');

    const { peak, rms } = measure(samples);
    const durationMs = SFX_PATCHES[key].durationMs;
    const withinLimit = durationMs <= LIMIT_MS[key];
    if (!withinLimit) failed = true;
    rows.push({ key, durationMs, peak, rms, pitchHz: pitchOf(key), limitMs: LIMIT_MS[key], withinLimit });

    const kb = (samples.length * 2 + 44) / 1024;
    console.log(
      `${key.padEnd(12)} ${String(durationMs).padStart(5)} ms  peak ${peak.toFixed(3)}  ${kb.toFixed(1)} KB${
        withinLimit ? '' : '  OVER LIMIT'
      }`,
    );
  }

  writeFileSync(resolve(OUT_DIR, 'report.md'), renderAudioReport(rows), 'utf8');
  console.log(`\n[audio-author] music root ${MUSIC_ROOT_HZ} Hz · wrote ${rows.length} sound(s) to docs/testing/audio/`);
  if (failed) process.exit(1);
}

main();
