/**
 * The instrument panel — dev only, listening prototype.
 *
 * Pick an instrument, play single notes, a chord, a scale, a phrase in the
 * game's own scale, or the same note on every instrument back to back. Every
 * note is synthesised at its pitch (see instruments.ts) and sent through the
 * shared room, so the reverb is the same one the glass pieces would use.
 *
 * The tweak sliders exist because nobody, including whoever wrote the
 * patches, can pick these numbers without listening.
 */
import { measure } from '../../audio-synth/normalize.ts';
import { renderPatch } from '../../audio-synth/render.ts';
import { toAudioBuffer } from '../../audio-synth/webaudio.ts';
import { PRIORITY, createResonanceBus } from './bus.ts';
import { INSTRUMENTS, NEUTRAL, instrumentSpec, midiToHz } from './instruments.ts';
import type { InstrumentId, Tweaks } from './instruments.ts';
import type { VoiceSpec } from './pieceVoice.ts';
import { ROOMS, roomById } from './rooms.ts';
import type { RoomId } from './rooms.ts';

/** The scale the game is built on, D major, as semitones above the root. */
const DEGREES = [0, 2, 4, 5, 7, 9, 11, 12];
const DEGREE_LABELS = ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯', 'D'];
/** D F♯ A B A F♯ E D — pentatonic, the same steps audioCues.ts climbs. */
const PHRASE = [0, 4, 7, 9, 7, 4, 2, 0];
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const A4 = 69;

const rootMidi = (octave: number): number => 12 * (octave + 1) + 2;
const noteName = (midi: number): string => NOTE_NAMES[midi % 12] + String(Math.floor(midi / 12) - 1);

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function rawVoice(buffer: AudioBuffer, delayMs: number): VoiceSpec {
  return { strike: 'bell', buffer, rate: 1, gain: 1, detuneCents: 0, send: 1, delayMs };
}

type Scheduled = { id: InstrumentId; midi: number; ms: number; atMs: number };

export function mountInstrumentPanel(host: HTMLElement, ctx: AudioContext): void {
  const bus = createResonanceBus(ctx, {});
  bus.setMaxVoices(24);

  let instrument: InstrumentId = 'piano';
  let octave = 4;
  let room: RoomId = 'glass-hall';
  let wet = 0.5;
  let master = 0.8;
  let noteMs = 1600;
  let lastMidi = rootMidi(octave);
  let tweaks: Tweaks = { ...NEUTRAL };
  let lastRender = '';
  let problem = '';
  let timers: number[] = [];
  const cache = new Map<string, AudioBuffer>();

  const status = el('div', { className: 'status' });
  const hint = el('p', { className: 'hint' });

  function refreshStatus(extra = ''): void {
    const spec = instrumentSpec(instrument);
    const hz = midiToHz(lastMidi);
    const outOfRange = lastMidi < spec.low || lastMidi > spec.high;
    status.textContent =
      problem !== ''
        ? `Lỗi: ${problem}`
        : `${spec.label} · ${noteName(lastMidi)} (${hz.toFixed(1)} Hz) · ${lastRender} · ` +
          `phòng ${roomById(room).label.split(' — ')[0]} · giọng đang kêu ${bus.activeCount()}` +
          (outOfRange ? ' · ngoài tầm âm thoải mái của nhạc cụ này' : '') +
          (extra ? ` · ${extra}` : '');
    hint.textContent = spec.hint;
  }

  function bufferFor(id: InstrumentId, midi: number, ms: number): AudioBuffer {
    const spec = instrumentSpec(id);
    // Struck instruments ignore the note length, so they share one buffer per pitch.
    const key = [id, midi, spec.sustained ? ms : 0, tweaks.tilt, tweaks.decay, tweaks.noise, ctx.sampleRate].join('|');
    const hit = cache.get(key);
    if (hit) return hit;

    const started = performance.now();
    const patch = spec.build(midiToHz(midi), ms, tweaks);
    const samples = renderPatch(patch, ctx.sampleRate);
    const renderMs = performance.now() - started;
    const { peak, rms } = measure(samples);
    lastRender = `${patch.durationMs} ms · peak ${peak.toFixed(2)} · rms ${rms.toFixed(3)} · dựng ${renderMs.toFixed(0)} ms`;

    const buffer = toAudioBuffer(samples, ctx);
    cache.set(key, buffer);
    return buffer;
  }

  /** Renders everything first, then schedules on the audio clock so timing is not at the mercy of rendering. */
  function playAll(notes: readonly Scheduled[]): void {
    try {
      problem = '';
      const prepared = notes.map((n) => ({ n, buffer: bufferFor(n.id, n.midi, n.ms) }));
      for (const { n, buffer } of prepared) bus.play(rawVoice(buffer, n.atMs), PRIORITY.action);
    } catch (err) {
      problem = err instanceof Error ? err.message : String(err);
    }
    refreshStatus();
  }

  function clearTimers(): void {
    for (const id of timers) window.clearTimeout(id);
    timers = [];
  }

  function stopAll(): void {
    clearTimers();
    bus.stopAll();
    refreshStatus();
  }

  function playNote(midi: number): void {
    lastMidi = midi;
    playAll([{ id: instrument, midi, ms: noteMs, atMs: 0 }]);
  }

  function applyRoom(): void {
    bus.setRoom(roomById(room));
    bus.setWet(room === 'dry' ? 0 : wet);
    for (const b of host.querySelectorAll('[data-room]')) {
      b.classList.toggle('active', b.getAttribute('data-room') === room);
    }
  }

  // ---- instruments -------------------------------------------------------

  const instrumentRow = el('div', { className: 'cues' });
  for (const spec of INSTRUMENTS) {
    const button = el('button', { textContent: spec.label });
    button.setAttribute('data-instrument', spec.id);
    button.addEventListener('click', () => {
      instrument = spec.id;
      for (const b of host.querySelectorAll('[data-instrument]')) {
        b.classList.toggle('active', b.getAttribute('data-instrument') === spec.id);
      }
      // Jump into the instrument's own register so its first note is a fair one.
      if (lastMidi < spec.low || lastMidi > spec.high) {
        octave = Math.max(2, Math.min(6, Math.round((spec.low + spec.high) / 24) - 1));
        lastMidi = rootMidi(octave);
      }
      playNote(lastMidi);
    });
    instrumentRow.append(button);
  }

  // ---- octave + notes ----------------------------------------------------

  const octaveRow = el('div', { className: 'cues' }, el('span', { className: 'label', textContent: 'Quãng tám:' }));
  for (const o of [2, 3, 4, 5, 6]) {
    const button = el('button', { textContent: String(o) });
    button.setAttribute('data-octave', String(o));
    button.addEventListener('click', () => {
      octave = o;
      for (const b of host.querySelectorAll('[data-octave]')) {
        b.classList.toggle('active', b.getAttribute('data-octave') === String(o));
      }
      playNote(rootMidi(octave));
    });
    octaveRow.append(button);
  }

  const noteRow = el('div', { className: 'cues' }, el('span', { className: 'label', textContent: 'Nốt (Rê trưởng):' }));
  DEGREES.forEach((semi, i) => {
    const label = i === DEGREES.length - 1 ? `${DEGREE_LABELS[i]}′` : DEGREE_LABELS[i];
    const button = el('button', { textContent: label });
    button.addEventListener('click', () => playNote(rootMidi(octave) + semi));
    noteRow.append(button);
  });

  // ---- demos -------------------------------------------------------------

  const chordBtn = el('button', { textContent: '◇ Hợp âm Rê trưởng' });
  chordBtn.addEventListener('click', () => {
    const root = rootMidi(octave);
    lastMidi = root;
    playAll([0, 4, 7].map((semi, i) => ({ id: instrument, midi: root + semi, ms: 2200, atMs: i * 35 })));
  });

  const scaleBtn = el('button', { textContent: '↗ Thang âm 8 nốt' });
  scaleBtn.addEventListener('click', () => {
    const root = rootMidi(octave);
    lastMidi = root;
    playAll(DEGREES.map((semi, i) => ({ id: instrument, midi: root + semi, ms: 520, atMs: i * 380 })));
  });

  const phraseBtn = el('button', { textContent: '♪ Giai điệu mẫu' });
  phraseBtn.addEventListener('click', () => {
    const root = rootMidi(octave);
    lastMidi = root;
    playAll(
      PHRASE.map((semi, i) => ({
        id: instrument,
        midi: root + semi,
        ms: i === PHRASE.length - 1 ? 2200 : 700,
        atMs: i * 480,
      }))
    );
  });

  const compareBtn = el('button', { textContent: '⇄ So sánh: cùng nốt La, mọi nhạc cụ' });
  compareBtn.addEventListener('click', () => {
    clearTimers();
    lastMidi = A4;
    const gap = 2800;
    playAll(INSTRUMENTS.map((spec, i) => ({ id: spec.id, midi: A4, ms: 1800, atMs: i * gap })));
    INSTRUMENTS.forEach((spec, i) => {
      timers.push(window.setTimeout(() => refreshStatus(`đang phát: ${spec.label}`), i * gap));
    });
  });

  const stopBtn = el('button', { textContent: '■ Im lặng' });
  stopBtn.addEventListener('click', stopAll);

  const demoRow = el('div', { className: 'cues' }, chordBtn, scaleBtn, phraseBtn, compareBtn, stopBtn);

  // ---- rooms -------------------------------------------------------------

  const roomRow = el('div', { className: 'cues' }, el('span', { className: 'label', textContent: 'Phòng:' }));
  for (const spec of ROOMS) {
    const button = el('button', { textContent: spec.label });
    button.setAttribute('data-room', spec.id);
    button.addEventListener('click', () => {
      room = spec.id;
      applyRoom();
      playNote(lastMidi);
    });
    roomRow.append(button);
  }

  // ---- sliders -----------------------------------------------------------

  function slider(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onInput: (v: number) => void,
    onChange: () => void
  ): HTMLElement {
    const readout = el('span', { textContent: `${label} = ${value}` });
    const input = el('input', { type: 'range' });
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      readout.textContent = `${label} = ${v}`;
      onInput(v);
    });
    input.addEventListener('change', onChange);
    return el('div', { className: 'row' }, readout, input);
  }

  /** Changing a tweak invalidates every rendered note, so drop the cache and replay. */
  const retune = (): void => {
    cache.clear();
    playNote(lastMidi);
  };

  const sliders = el(
    'div',
    { className: 'params' },
    slider('âm lượng tổng', 0, 1.5, 0.01, master, (v) => {
      master = v;
      bus.setMaster(v);
    }, () => playNote(lastMidi)),
    slider('độ vang (wet)', 0, 1.5, 0.01, wet, (v) => {
      wet = v;
      if (room !== 'dry') bus.setWet(v);
    }, () => playNote(lastMidi)),
    slider('độ dài nốt giữ (ms, cho sáo / dàn dây / đàn thuỷ tinh)', 300, 4000, 50, noteMs, (v) => {
      noteMs = v;
    }, () => playNote(lastMidi)),
    slider('độ sáng (tilt)', -1, 1, 0.05, tweaks.tilt, (v) => {
      tweaks = { ...tweaks, tilt: v };
    }, retune),
    slider('độ ngân (decay ×)', 0.3, 2.5, 0.05, tweaks.decay, (v) => {
      tweaks = { ...tweaks, decay: v };
    }, retune),
    slider('tiếng búa / hơi thở / gảy (noise ×)', 0, 3, 0.05, tweaks.noise, (v) => {
      tweaks = { ...tweaks, noise: v };
    }, retune)
  );

  host.append(
    el('h2', { textContent: 'Nhạc cụ tổng hợp — nghe thử' }),
    el('p', {
      className: 'hint',
      textContent:
        'Mỗi nốt được tổng hợp đúng cao độ, không phải tiếng chuông kéo giãn. Chọn nhạc cụ, bấm nốt, rồi thử hợp âm, thang âm, giai điệu, và nút so sánh. Kéo các thanh trượt để chỉnh bằng tai.',
    }),
    instrumentRow,
    hint,
    octaveRow,
    noteRow,
    demoRow,
    roomRow,
    sliders,
    status
  );

  for (const b of host.querySelectorAll('[data-instrument]')) {
    b.classList.toggle('active', b.getAttribute('data-instrument') === instrument);
  }
  for (const b of host.querySelectorAll('[data-octave]')) {
    b.classList.toggle('active', b.getAttribute('data-octave') === String(octave));
  }
  applyRoom();
  bus.setMaster(master);
  refreshStatus();
}
