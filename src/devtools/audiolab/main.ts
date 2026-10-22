/**
 * Audio Lab — dev only.
 *
 * Plays the same patches, through the same renderer, that the game will use.
 * Not listed in vite.config.ts build input, so it never reaches production.
 */
import { measure } from '../../audio-synth/normalize.ts';
import type { Patch } from '../../audio-synth/patch.ts';
import { SFX_KEYS, SFX_PATCHES } from '../../content/audio/index.ts';
import type { SfxKey } from '../../content/audio/index.ts';
import { ViewMemory, formatIssues, sliderLabel, tryRender } from './guard.ts';
import type { RenderView } from './guard.ts';
import { ladderRates, patchToTypeScript } from './serialize.ts';
import { mountInstrumentPanel } from './instrumentPanel.ts';
import { mountResonancePanel } from './resonancePanel.ts';

const SR = 44100;
const ctx = new AudioContext();

const original = JSON.parse(JSON.stringify(SFX_PATCHES)) as Record<SfxKey, Patch>;
const working = JSON.parse(JSON.stringify(SFX_PATCHES)) as Record<SfxKey, Patch>;
let current: SfxKey = 'bell';

/** Every numeric leaf of the current patch, as a path the sliders can write back to. */
type Knob = { path: string; get(): number; set(v: number): void; min: number; max: number; step: number };

function rangeFor(path: string, value: number): { min: number; max: number; step: number } {
  if (path.endsWith('Ms')) return { min: 0, max: Math.max(2000, value * 2), step: 1 };
  if (path.endsWith('Hz')) return { min: 20, max: Math.max(12000, value * 2), step: 1 };
  if (path.endsWith('.q')) return { min: 0.1, max: 12, step: 0.1 };
  if (path.endsWith('.gain') || path.endsWith('.peak') || path.endsWith('.rms') || path.endsWith('.sustain')) {
    return { min: 0, max: 1, step: 0.01 };
  }
  if (path.endsWith('.ratio') || path.endsWith('.index')) return { min: 0, max: 16, step: 0.1 };
  return { min: 0, max: Math.max(1, value * 2), step: 0.01 };
}

function collectKnobs(node: Record<string, unknown>, prefix: string, out: Knob[]): void {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'number') {
      if (key === 'seed') continue;
      const { min, max, step } = rangeFor(path, value);
      out.push({
        path,
        min,
        max,
        step,
        get: () => node[key] as number,
        set: (v) => {
          node[key] = v;
        },
      });
    } else if (Array.isArray(value)) {
      value.forEach((item, i) =>
        collectKnobs(item as Record<string, unknown>, `${path}[${i}]`, out),
      );
    } else if (value && typeof value === 'object') {
      collectKnobs(value as Record<string, unknown>, path, out);
    }
  }
}

function play(patch: Patch, rate = 1): void {
  const attempt = tryRender(patch, SR);
  if (!attempt.ok) return; // the problem is already on screen via draw()
  void ctx.resume();
  const samples = attempt.samples;
  const buffer = ctx.createBuffer(1, samples.length, SR);
  buffer.copyToChannel(samples, 0);
  const node = ctx.createBufferSource();
  node.buffer = buffer;
  node.playbackRate.value = rate;
  node.connect(ctx.destination);
  node.start();
}

/** Shows or clears the validation message under the waveform. */
function showProblem(text: string): void {
  const el = document.getElementById('problem');
  if (!el) return;
  el.textContent = text;
  el.hidden = text === '';
}

const memory = new ViewMemory();

/** Paints a view, or blanks the canvas, stats and textarea when there is none. */
function paint(view: RenderView | null): void {
  const canvas = document.getElementById('wave') as HTMLCanvasElement;
  const g = canvas.getContext('2d');
  const { width, height } = canvas;
  const mid = height / 2;
  if (g) {
    g.fillStyle = '#0b1020';
    g.fillRect(0, 0, width, height);
    g.strokeStyle = '#1e293b';
    g.beginPath();
    g.moveTo(0, mid);
    g.lineTo(width, mid);
    g.stroke();
    if (view) {
      const samples = view.samples;
      g.strokeStyle = '#7fd8ff';
      g.beginPath();
      const perColumn = Math.max(1, Math.floor(samples.length / width));
      for (let x = 0; x < width; x++) {
        const from = x * perColumn;
        if (from >= samples.length) break;
        let lo = samples[from];
        let hi = samples[from];
        for (let i = from; i < Math.min(samples.length, from + perColumn); i++) {
          if (samples[i] < lo) lo = samples[i];
          if (samples[i] > hi) hi = samples[i];
        }
        g.moveTo(x, mid - hi * mid);
        g.lineTo(x, mid - lo * mid);
      }
      g.stroke();
    }
  }
  const stats = document.getElementById('stats');
  if (stats) stats.textContent = view ? view.stats : '';
  const out = document.getElementById('out') as HTMLTextAreaElement | null;
  if (out) out.value = view ? view.typescript : '';
}

function draw(patch: Patch): void {
  const started = performance.now();
  const attempt = tryRender(patch, SR);
  const renderMs = performance.now() - started;
  if (!attempt.ok) {
    // Show this cue's own last good render, or nothing; never another cue's.
    paint(memory.forCue(current));
    showProblem(`Patch không hợp lệ:
${formatIssues(attempt.issues)}`);
    return;
  }
  showProblem('');
  const { peak, rms } = measure(attempt.samples);
  const view: RenderView = {
    samples: attempt.samples,
    stats: `${patch.durationMs} ms · peak ${peak.toFixed(3)} · rms ${rms.toFixed(3)} · render ${renderMs.toFixed(1)} ms`,
    typescript: patchToTypeScript(current.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), patch),
  };
  memory.remember(current, view);
  paint(view);
}

function buildParams(): void {
  const host = document.getElementById('params');
  if (!host) return;
  host.innerHTML = '';
  const knobs: Knob[] = [];
  collectKnobs(working[current] as unknown as Record<string, unknown>, '', knobs);
  for (const knob of knobs) {
    const row = document.createElement('div');
    row.className = 'row';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(knob.min);
    input.max = String(knob.max);
    input.step = String(knob.step);
    input.value = String(knob.get());
    const readout = document.createElement('span');
    readout.textContent = sliderLabel(knob.path, knob.get());
    input.addEventListener('input', () => {
      knob.set(Number(input.value));
      readout.textContent = sliderLabel(knob.path, input.value);
      draw(working[current]);
    });
    input.addEventListener('change', () => play(working[current]));
    row.append(readout, input);
    host.append(row);
  }
}

function select(key: SfxKey): void {
  current = key;
  for (const el of document.querySelectorAll('#cues button')) {
    el.classList.toggle('active', el.getAttribute('data-key') === key);
  }
  buildParams();
  draw(working[key]);
  play(working[key]);
}

function boot(): void {
  const cues = document.getElementById('cues');
  if (cues) {
    for (const key of SFX_KEYS) {
      const button = document.createElement('button');
      button.textContent = key;
      button.setAttribute('data-key', key);
      button.addEventListener('click', () => select(key));
      cues.append(button);
    }
  }

  document.getElementById('ladder')?.addEventListener('click', () => {
    ladderRates().forEach((rate, i) => {
      window.setTimeout(() => play(working.bell, rate), i * 260);
    });
  });

  document.getElementById('copy')?.addEventListener('click', () => {
    const out = document.getElementById('out') as HTMLTextAreaElement | null;
    if (!out) return;
    // If the browser refuses clipboard access, select the text so Ctrl+C works.
    navigator.clipboard.writeText(out.value).catch(() => {
      out.focus();
      out.select();
    });
  });

  document.getElementById('reset')?.addEventListener('click', () => {
    working[current] = JSON.parse(JSON.stringify(original[current])) as Patch;
    select(current);
  });

  select('bell');

  const instruments = document.getElementById('instruments');
  if (instruments) mountInstrumentPanel(instruments, ctx);

  const resonance = document.getElementById('resonance');
  if (resonance) mountResonancePanel(resonance, ctx);
}

boot();
