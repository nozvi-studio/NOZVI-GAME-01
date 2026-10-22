/**
 * The listening panel — dev only, throwaway prototype.
 *
 * Everything here exists to answer questions a spec cannot: does the room
 * sound like the game, can you tell a triangle from a circle with your eyes
 * shut, and does the board breathing become annoying after a minute.
 */
import { renderAll } from '../../audio-synth/webaudio.ts';
import { SFX_PATCHES } from '../../content/audio/index.ts';
import type { SfxKey } from '../../content/audio/index.ts';
import type { ShapeKind } from '../../domain/model.ts';
import { createResonanceBus, PRIORITY } from './bus.ts';
import type { ResonanceBus } from './bus.ts';
import { ROOMS, roomById } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { breathVoice, snapChord, timbreFor, touchVoice } from './pieceVoice.ts';
import type { PieceLike } from './pieceVoice.ts';

/** The six frame sizes that actually ship, smallest first. */
const SIZES = [16, 32, 48, 64, 96, 128] as const;
const SHAPES: readonly ShapeKind[] = ['triangle', 'square', 'diamond', 'circle', 'parallelogram'];
const SHAPE_VI: Record<ShapeKind, string> = {
  triangle: 'tam giác',
  square: 'vuông',
  diamond: 'thoi',
  circle: 'tròn',
  parallelogram: 'bình hành',
};

/** A five-piece level, roughly the shape of 3-10. */
const DEMO_LEVEL: readonly PieceLike[] = [
  { frameSize: 96, shapeKind: 'diamond' },
  { frameSize: 64, shapeKind: 'triangle' },
  { frameSize: 48, shapeKind: 'square' },
  { frameSize: 32, shapeKind: 'circle' },
  { frameSize: 16, shapeKind: 'triangle' },
];

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

export function mountResonancePanel(host: HTMLElement, ctx: AudioContext): void {
  const buffers = renderAll(SFX_PATCHES, ctx) as Partial<Record<SfxKey, AudioBuffer>>;
  const bus: ResonanceBus = createResonanceBus(ctx, buffers);

  let room: RoomId = 'stone-temple';
  let send = 0.6;
  let selected: PieceLike = { frameSize: 64, shapeKind: 'diamond' };
  let breathTimer: number | null = null;
  let timeline: number[] = [];

  const status = el('div', { className: 'status' });

  function refreshStatus(): void {
    const spec = roomById(room);
    status.textContent =
      `phòng ${spec.label} · đuôi ${spec.seconds}s · wet ${spec.wet.toFixed(2)} · ` +
      `send ${send.toFixed(2)} · giọng đang kêu ${bus.activeCount()} · bị cướp chỗ ${bus.stolenCount()}`;
  }

  function clearTimeline(): void {
    for (const id of timeline) window.clearTimeout(id);
    timeline = [];
  }

  function later(ms: number, fn: () => void): void {
    timeline.push(window.setTimeout(fn, ms));
  }

  function selectRoom(id: RoomId): void {
    room = id;
    bus.setRoom(roomById(id));
    for (const b of host.querySelectorAll('[data-room]')) {
      b.classList.toggle('active', b.getAttribute('data-room') === id);
    }
    refreshStatus();
  }

  // ---- rooms -------------------------------------------------------------

  const roomRow = el('div', { className: 'cues' });
  for (const spec of ROOMS) {
    const button = el('button', { textContent: spec.label });
    button.setAttribute('data-room', spec.id);
    button.addEventListener('click', () => {
      selectRoom(spec.id);
      bus.play(touchVoice(selected, send), PRIORITY.action);
    });
    roomRow.append(button);
  }

  // ---- piece grid --------------------------------------------------------

  const grid = el('table', { className: 'grid' });
  const head = el('tr');
  head.append(el('th', { textContent: '' }));
  for (const size of SIZES) head.append(el('th', { textContent: String(size) }));
  grid.append(head);

  for (const shape of SHAPES) {
    const row = el('tr');
    row.append(el('th', { textContent: SHAPE_VI[shape], title: timbreFor(shape).label }));
    for (const size of SIZES) {
      const cell = el('td');
      const button = el('button', { textContent: '♪' });
      button.title = `${SHAPE_VI[shape]} ${size} — ${timbreFor(shape).label}`;
      button.addEventListener('click', () => {
        selected = { frameSize: size, shapeKind: shape };
        bus.play(touchVoice(selected, send), PRIORITY.action);
        refreshStatus();
      });
      cell.append(button);
      row.append(cell);
    }
    grid.append(row);
  }

  // ---- actions -----------------------------------------------------------

  const touchBtn = el('button', { textContent: '◇ Chạm mảnh đang chọn' });
  touchBtn.addEventListener('click', () => {
    bus.play(touchVoice(selected, send), PRIORITY.action);
    refreshStatus();
  });

  const snapBtn = el('button', { textContent: '✦ Ghép mảnh (hợp âm, bậc 3)' });
  snapBtn.addEventListener('click', () => {
    for (const v of snapChord(selected, 3, send)) bus.play(v, PRIORITY.action);
    refreshStatus();
  });

  const solveBtn = el('button', { textContent: '▶ Giải trọn một màn 5 mảnh' });
  solveBtn.addEventListener('click', () => {
    clearTimeline();
    bus.resetCounters();
    DEMO_LEVEL.forEach((piece, i) => {
      const at = i * 1500;
      later(at, () => bus.play(touchVoice(piece, send), PRIORITY.action));
      later(at + 420, () => {
        const step = i === DEMO_LEVEL.length - 1 ? 7 : Math.min(i, 6);
        for (const v of snapChord(piece, step, send)) bus.play(v, PRIORITY.action);
        refreshStatus();
      });
    });
    // The win: the stinger lands on top of the last chord's tail.
    later(DEMO_LEVEL.length * 1500 + 520, () => {
      bus.play(
        { strike: 'stinger-win', rate: 1, gain: 0.9, filter: { type: 'peaking', hz: 2400, q: 1 }, detuneCents: 0, send, delayMs: 0 },
        PRIORITY.victory
      );
      bus.play({ ...touchVoice(selected, send), strike: 'shimmer', gain: 0.5, delayMs: 180 }, PRIORITY.victory);
      refreshStatus();
    });
  });

  const stressBtn = el('button', { textContent: '⚡ Ép 20 giọng cùng lúc (thử cướp chỗ)' });
  stressBtn.addEventListener('click', () => {
    bus.resetCounters();
    for (let i = 0; i < 20; i++) {
      const piece = DEMO_LEVEL[i % DEMO_LEVEL.length];
      for (const v of snapChord(piece, i % 8, send)) bus.play(v, PRIORITY.action);
    }
    refreshStatus();
  });

  const breathBtn = el('button', { textContent: '◌ Bật nhịp thở' });
  breathBtn.addEventListener('click', () => {
    if (breathTimer !== null) {
      window.clearInterval(breathTimer);
      breathTimer = null;
      breathBtn.textContent = '◌ Bật nhịp thở';
      refreshStatus();
      return;
    }
    let i = 0;
    breathTimer = window.setInterval(() => {
      const piece = DEMO_LEVEL[i % DEMO_LEVEL.length];
      bus.play(breathVoice(piece, i % 8, send), PRIORITY.breath);
      i++;
      refreshStatus();
    }, 7000);
    breathBtn.textContent = '◌ Tắt nhịp thở (đang chạy, 7s/lượt)';
    const piece = DEMO_LEVEL[0];
    bus.play(breathVoice(piece, 0, send), PRIORITY.breath);
  });

  const stopBtn = el('button', { textContent: '■ Im lặng' });
  stopBtn.addEventListener('click', () => {
    clearTimeline();
    bus.stopAll();
    refreshStatus();
  });

  const actions = el('div', { className: 'cues' }, touchBtn, snapBtn, solveBtn, stressBtn, breathBtn, stopBtn);

  // ---- sliders -----------------------------------------------------------

  function slider(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onInput: (v: number) => void
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
      refreshStatus();
    });
    return el('div', { className: 'row' }, readout, input);
  }

  const sliders = el(
    'div',
    { className: 'params' },
    slider('wet (độ ướt của phòng)', 0, 1, 0.01, roomById(room).wet, (v) => bus.setWet(v)),
    slider('send (mỗi giọng gửi vào phòng bao nhiêu)', 0, 1, 0.01, send, (v) => {
      send = v;
    }),
    slider('maxVoices (trần giọng)', 1, 32, 1, 12, (v) => bus.setMaxVoices(v))
  );

  host.append(
    el('h2', { textContent: 'Phòng cộng hưởng — nguyên mẫu nghe thử' }),
    el('p', {
      className: 'hint',
      textContent:
        'Chọn một kiểu phòng, bấm ô trong bảng để nghe từng mảnh kính, rồi bấm "Giải trọn một màn" để nghe cả chuỗi. Code này là đồ bỏ đi, chỉ để chấm bằng tai.',
    }),
    roomRow,
    grid,
    actions,
    sliders,
    status
  );

  selectRoom(room);
}
