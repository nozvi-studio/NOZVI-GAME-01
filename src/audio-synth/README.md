# audio-synth

A tiny, dependency-free sound-effect synthesizer. You describe a sound as data; it gives you samples.

It imports nothing: not a framework, not Node, not the game around it. Copy the folder into another project and it works.

## Hello, bell

```ts
import { renderPatch } from './audio-synth/render.ts';
import type { Patch } from './audio-synth/patch.ts';

const bell: Patch = {
  durationMs: 1200,
  seed: 1,
  layers: [
    {
      source: { kind: 'fm', carrierHz: 440, ratio: 3, index: 2.5,
                indexEnv: { attackMs: 0, decayMs: 110, curve: 'exp' } },
      env: { attackMs: 2, decayMs: 1198, curve: 'exp' },
    },
  ],
  normalize: { peak: 0.9 },
};

const samples = renderPatch(bell, 44100); // Float32Array, mono
```

To hear it in a browser:

```ts
const buffer = ctx.createBuffer(1, samples.length, 44100);
buffer.copyToChannel(samples, 0);
const node = ctx.createBufferSource();
node.buffer = buffer;
node.connect(ctx.destination);
node.start();
```

`renderPatch` throws if the patch is invalid. Call `validatePatch(patch, sampleRate)` to get the list of problems instead (an empty array means it renders).

## The five concepts

A **Patch** is a duration, a seed, a list of layers, and a loudness target. Layers are summed.

### Source: where the signal comes from

| Kind | Fields | Use for |
|---|---|---|
| `sine`, `triangle`, `saw`, `square` | `hz`, optional `glideToHz` | tones, thuds, pitched hits |
| `noise` | `color: 'white' \| 'pink'` | ticks, air, impacts |
| `fm` | `carrierHz`, `ratio`, `index`, optional `indexEnv` | bells, chimes, struck metal |

`glideToHz` slides the pitch linearly across the layer. Use it for a falling thud.

`fm` bends a carrier with a modulator running at `carrierHz * ratio`. `index` is how hard it bends, and `indexEnv` (an envelope) scales the index over time, so the strike can be bright and the tail pure.

- A whole-number `ratio` keeps the partials on the harmonic series: it reads as struck crystal or glass.
- A non-integer `ratio` makes inharmonic partials: it reads as metal.
- A high `index` adds many sidebands and gets harsh. Mirror's bell uses ratio 3 and index 2.5.

### Envelope: how the level moves

`{ attackMs, decayMs, sustain?, releaseMs?, curve? }`

It rises 0 to 1 over `attackMs`, falls to `sustain` (default 0) over `decayMs`, holds at `sustain`, then falls to 0 over the final `releaseMs` of the layer. With no sustain and no release this is the plain attack-decay shape almost every effect wants. Segments that run past the end of the buffer are truncated, not squeezed.

`curve: 'exp'` bends the segments: the attack is a squared rise and the decay a cubic fall, so it drops fast and then lingers. That is how struck and plucked things decay, and it almost always sounds better than `'lin'` for a hit. Keep `'lin'` for swells and whooshes.

### Filter: how it is coloured

`{ kind: 'lowpass' | 'highpass' | 'bandpass', hz, q?, sweepToHz? }`

`q` defaults to 0.707, which is flat. Raise it for a resonant, vocal quality. `sweepToHz` moves the cutoff across the layer: a bandpass swept downward is a whoosh, swept upward is a riser. Filter frequencies must be below Nyquist (half the sample rate).

### Layer: one voice

`{ source, env, filter?, gain?, startMs? }`

Processing order is **source, filter, envelope, gain**. Filtering before the envelope matters: any ringing from the filter is still shaped by the envelope, so the tail reaches zero and the sound cannot click.

`startMs` delays a layer. That is how one patch holds a chord or an arpeggio; see `src/content/audio/sources/stingerWin.ts` in Mirror for four bell voices entering in turn. A delayed layer's envelope starts at its own `startMs`, and the layer runs to the end of the patch.

### normalize: how loud the result is

`{ peak: 0.9 }` scales the loudest sample onto 0.9. `{ rms: 0.12 }` scales so the average energy is 0.12 instead, which suits sustained, noisy sounds whose peak is not representative.

An rms target is then hard-limited: each sample is clamped into [-0.99, 0.99] (`CEILING` in `normalize.ts`). Clamping is applied per sample; the buffer is not rescaled. So spiky material, whose peaks would exceed 0.99 at the requested rms, comes out with *less* rms than you asked for, and the clamped peaks sound slightly squashed. If the result is quieter than the number you wrote, switch to a `peak` target or soften the transients.

Silence is returned untouched. Set loudness here, never by hand-tuning every `gain`. Use `gain` only for the balance *between* layers.

## What `renderPatch` does, in order

1. Validate; throw on any issue.
2. For each layer: source, filter, envelope, gain, then add into the mix at `startMs`.
3. Fade the last 3 ms (`FADE_OUT_MS`) linearly to zero. The final sample is exactly 0, so playback never ends on a click.
4. Normalize the faded mix.

The fade runs *before* normalization, so the loudness target is measured on what actually plays.

## Why seeds

Noise is drawn from a seeded PRNG (`mulberry32`), never `Math.random`. The same patch therefore renders the same bytes every time, which means the version someone approved by ear is exactly the version that ships, and tests can assert on real output. Each layer draws from its own stream (`seed + layerIndex * 7919`), so adding a layer after the others leaves the earlier ones untouched. Only noise uses the seed, but the field is always required.

## Adding a sound

1. Copy the closest preset from `presets.ts` into a new file.
2. Change the numbers. Start with duration and the source, get that right, then shape with the envelope, then colour with the filter.
3. Register it wherever your project lists its sounds.
4. Listen, adjust, repeat. In Mirror that loop is the Audio Lab at `/tools/audiolab.html`.

**Gotcha when pasting from the Audio Lab.** *Copy as TypeScript* stringifies the *evaluated* patch. If your source wrote `carrierHz: MUSIC_ROOT_HZ * 2`, it comes back as the literal `587.32`. After pasting a tuned patch, re-link any such expression by hand, or the pitched effects stop following the music's key when it changes.

A rule of thumb for each sound family:

| Want | Start from | Then |
|---|---|---|
| click, tick | `clickPreset` | raise the highpass to thin it, shorten `decayMs` to sharpen it |
| bell, chime | `bellPreset` | `carrierHz` sets the pitch; a whole-number `ratio` is glassy, a non-integer one (try 1.4 or 2.7) is more metallic; `index` sets how bright the strike is, and a short `indexEnv` decay keeps that brightness to the attack |
| whoosh, swish | `whooshPreset` | sweep the bandpass further for more movement, raise `q` to narrow it |
| thud, impact | a `sine` with `glideToHz` below it | add a short lowpassed noise layer at `gain: 0.28` to `0.5` for the contact (Mirror's `thud.ts` does this) |
| drone, pad | several detuned `sine` layers, long `attackMs` | detune by a few hertz so they beat |

## Porting it to another project

1. Copy `src/audio-synth/` in. There are no dependencies to install and no build step. Imports use the `.ts` suffix, so your toolchain must allow that (Vite, Vitest and Node's type stripping all do).
2. Write your patches somewhere outside this folder, importing `Patch` from `patch.ts`. Keep the folder clean so the next copy is just as easy.
3. Call `renderPatch(patch, ctx.sampleRate)` and push the result into an `AudioBuffer`, as in *Hello, bell* above. Render once at start-up and cache the result rather than rendering on every play.

A test in this repo (`tests/audioSynthPortable.test.ts`) fails if any file here starts importing from outside the folder. Keep it.

## What is in each file

| File | What it holds |
|---|---|
| `dsp.ts` | the primitives: PRNG, noise, envelope, oscillators, FM, biquad filters |
| `patch.ts` | the `Patch` types and `validatePatch` |
| `render.ts` | `renderPatch` and `FADE_OUT_MS`; the only function most callers need |
| `normalize.ts` | `measure`, `applyNormalize` and `CEILING` |
| `wav.ts` | `encodeWav` / `decodeWavSamples` (16-bit mono PCM), for writing listening copies |
| `report.ts` | `renderWaveformSvg` and `renderAudioReport`, for review artifacts |
| `presets.ts` | three starting points: `clickPreset`, `bellPreset`, `whooshPreset` |
| `README.md` | this file |

## What it deliberately does not do

No stereo, no reverb, no delay, no sample playback, no music sequencing. Effects are mono and short; anything longer or wider belongs in an audio file. If you need reverb, render a tail into the patch with a long decay, or use the platform's own convolver on the output node.
