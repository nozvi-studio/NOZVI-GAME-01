/** The part of HTMLAudioElement the port uses; tests pass a fake. */
export type MediaLike = {
  src: string;
  loop: boolean;
  preload: string;
  volume: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: 'error', listener: () => void): void;
};

export type MusicEnv = {
  createElement(): MediaLike;
  canPlayOgg(): boolean;
  setInterval(cb: () => void, ms: number): number;
  clearInterval(id: number): void;
  now(): number;
  /** Calls `cb` once on the next pointerdown/keydown */
  onFirstGesture(cb: () => void): void;
  onVisibilityChange(cb: (hidden: boolean) => void): void;
  warn(msg: string): void;
};

export type MusicOptions = {
  volume: number;
  toggleOutMs: number;
  toggleInMs: number;
  duckDownMs: number;
  duckUpMs: number;
  files(id: string): readonly string[];
  /** Gain of one track relative to the others (default 1), so a quiet bed can sit under the effects. */
  trackLevel?(id: string): number;
};

export interface MusicPort {
  /**
   * Fades the current track out over `fadeMs`; with `gapMs` > 0 it then stays
   * quiet for `gapMs` before the new one fades in over `fadeMs`. Without a gap
   * the two overlap in a crossfade.
   */
  setTrack(id: string | null, fadeMs: number, gapMs?: number): void;
  duck(level: number, holdMs: number): void;
  pause(): void;
  resume(): void;
  setEnabled(on: boolean): void;
}

type Ramp = { from: number; to: number; start: number; ms: number };
type EndAction = 'none' | 'pause' | 'unload';
type Slot = { el: MediaLike; track: string | null; gain: number; ramp: Ramp | null; end: EndAction };

const TICK_MS = 50;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function rampAt(r: Ramp, now: number): number {
  if (r.ms <= 0) return r.to;
  return r.from + (r.to - r.from) * clamp01((now - r.start) / r.ms);
}

/**
 * Streams background music on two alternating elements (spec G §2.3).
 * Streaming keeps RAM low; WebAudio would decode whole tracks to PCM.
 */
export function createMusic(env: MusicEnv, opts: MusicOptions): MusicPort {
  const warned = new Set<string>();
  const warnOnce = (track: string | null, why: string) => {
    if (!track || warned.has(track)) return;
    warned.add(track);
    env.warn(`[music] ${track}: ${why}`);
  };

  const makeSlot = (): Slot => {
    const slot: Slot = { el: env.createElement(), track: null, gain: 0, ramp: null, end: 'none' };
    slot.el.loop = true;
    slot.el.preload = 'auto';
    slot.el.addEventListener('error', () => warnOnce(slot.track, 'failed to load'));
    return slot;
  };
  const slots: [Slot, Slot] = [makeSlot(), makeSlot()];
  let active = 0;
  let wanted: string | null = null;
  let enabled = true;
  let paused = false;
  let waitingForGesture = false;
  let duckLevel = 1;
  let duckRamp: Ramp | null = null;
  let duckReleaseAt: number | null = null;
  let timer: number | null = null;
  let pending: { id: string; at: number; fadeMs: number } | null = null;

  const pickFile = (id: string): string => {
    const files = opts.files(id);
    const ext = env.canPlayOgg() ? '.ogg' : '.m4a';
    return files.find((f) => f.endsWith(ext)) ?? files[0] ?? '';
  };

  const apply = () => {
    for (const s of slots) s.el.volume = clamp01(s.gain * duckLevel * opts.volume * (s.track ? (opts.trackLevel?.(s.track) ?? 1) : 1));
  };

  function tick(): void {
    const now = env.now();
    let busy = false;
    for (const s of slots) {
      if (!s.ramp) continue;
      s.gain = rampAt(s.ramp, now);
      if (now - s.ramp.start < s.ramp.ms) {
        busy = true;
        continue;
      }
      s.ramp = null;
      if (s.end !== 'none') {
        s.el.pause();
        if (s.end === 'unload') {
          s.el.src = '';
          s.track = null;
        }
        s.end = 'none';
      }
    }
    if (pending) {
      if (now >= pending.at) {
        const { id, fadeMs } = pending;
        pending = null;
        startOn(slots[active], id, fadeMs);
      }
      busy = true;
    }
    if (duckReleaseAt !== null && now >= duckReleaseAt) {
      duckRamp = { from: duckLevel, to: 1, start: now, ms: opts.duckUpMs };
      duckReleaseAt = null;
    }
    if (duckRamp) {
      duckLevel = rampAt(duckRamp, now);
      if (now - duckRamp.start >= duckRamp.ms) duckRamp = null;
      else busy = true;
    }
    if (duckReleaseAt !== null) busy = true;
    apply();
    if (!busy && timer !== null) {
      env.clearInterval(timer);
      timer = null;
    }
  }

  function kick(): void {
    if (timer === null) timer = env.setInterval(tick, TICK_MS);
    tick();
  }

  function onPlayError(track: string, err: unknown): void {
    if ((err as { name?: string } | null)?.name === 'NotAllowedError') {
      if (waitingForGesture) return;
      waitingForGesture = true;
      env.onFirstGesture(() => {
        waitingForGesture = false;
        const s = slots[active];
        if (!s.track) return;
        s.gain = 0;
        s.end = 'none';
        s.ramp = { from: 0, to: 1, start: env.now(), ms: opts.toggleInMs };
        tryPlay(s);
        kick();
      });
      return;
    }
    warnOnce(track, 'play() failed');
  }

  function tryPlay(slot: Slot): void {
    const track = slot.track;
    if (paused || !enabled || !track) return;
    try {
      slot.el.play().catch((err: unknown) => onPlayError(track, err));
    } catch (err) {
      onPlayError(track, err);
    }
  }

  function startOn(slot: Slot, id: string, fadeMs: number): void {
    if (slot.track !== id) {
      slot.track = id;
      slot.el.src = pickFile(id);
      slot.gain = 0;
    }
    slot.end = 'none';
    slot.ramp = { from: slot.gain, to: 1, start: env.now(), ms: fadeMs };
    tryPlay(slot);
  }

  function fadeOut(slot: Slot, ms: number, end: EndAction): void {
    slot.ramp = { from: slot.gain, to: 0, start: env.now(), ms };
    slot.end = end;
  }

  function crossTo(id: string | null, fadeMs: number, gapMs = 0): void {
    const cur = slots[active];
    if (id !== null && gapMs > 0 && cur.track && cur.track !== id) {
      // Old track out, silence, then the new one on the same (by then empty) slot.
      fadeOut(cur, fadeMs, 'unload');
      pending = { id, at: env.now() + fadeMs + gapMs, fadeMs };
    } else if (id !== null && cur.track === id) {
      startOn(cur, id, fadeMs);
    } else {
      if (cur.track) {
        fadeOut(cur, fadeMs, 'unload');
        active = 1 - active;
      }
      if (id !== null) startOn(slots[active], id, fadeMs);
    }
    kick();
  }

  const port: MusicPort = {
    setTrack(id, fadeMs, gapMs = 0) {
      if (id === wanted) return;
      wanted = id;
      if (duckRamp || duckReleaseAt !== null || duckLevel < 1) {
        duckReleaseAt = null;
        duckRamp = { from: duckLevel, to: 1, start: env.now(), ms: opts.duckDownMs };
      }
      if (!enabled) return;
      if (pending) {
        // Still in the gap: keep its timing and just change what comes next.
        if (id === null) pending = null;
        else pending.id = id;
        kick();
        return;
      }
      crossTo(id, fadeMs, gapMs);
    },

    duck(level, holdMs) {
      const now = env.now();
      duckRamp = { from: duckLevel, to: clamp01(level), start: now, ms: opts.duckDownMs };
      duckReleaseAt = now + opts.duckDownMs + holdMs;
      kick();
    },

    pause() {
      if (paused) return;
      paused = true;
      // Jump every fade to its end so nothing is left half-done while hidden
      for (const s of slots) if (s.ramp) s.ramp = { ...s.ramp, ms: 0 };
      if (duckRamp) duckRamp = { ...duckRamp, ms: 0 };
      tick();
      for (const s of slots) s.el.pause();
    },

    resume() {
      if (!paused) return;
      paused = false;
      tryPlay(slots[active]);
    },

    setEnabled(on) {
      if (on === enabled) return;
      enabled = on;
      if (!on) {
        pending = null;
        for (const s of slots) {
          if (s.track) fadeOut(s, opts.toggleOutMs, s === slots[active] ? 'pause' : 'unload');
        }
        kick();
        return;
      }
      if (wanted !== null) crossTo(wanted, opts.toggleInMs);
    },
  };

  env.onVisibilityChange((hidden) => (hidden ? port.pause() : port.resume()));
  return port;
}
