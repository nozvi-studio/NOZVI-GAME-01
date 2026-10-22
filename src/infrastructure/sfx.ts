import type { SfxKey } from '../content/audio/index.ts';

export type AudioCue = { key: SfxKey; rate: number; volume: number; delayMs: number };

export type SfxDriver = {
  isLocked(): boolean;
  has(key: SfxKey): boolean;
  /** Starts the sound and returns its length in ms (0 if unknown) */
  play(key: SfxKey, config: { rate: number; volume: number }): number;
};

export type SfxEnv = {
  now(): number;
  setTimeout(cb: () => void, ms: number): number;
  clearTimeout(id: number): void;
  warn(msg: string): void;
};

export type SfxOptions = { volume: number; maxVoices: number; repeatGapMs: number };

export interface SfxPort {
  play(cues: readonly AudioCue[]): void;
  setEnabled(on: boolean): void;
}

/** Sound effects are decoration: every failure is swallowed (spec G §2.2, §6). */
export function createSfx(driver: SfxDriver | null, env: SfxEnv, opts: SfxOptions): SfxPort {
  let enabled = true;
  const voiceEnds: number[] = [];
  const lastStart = new Map<SfxKey, number>();
  const pending = new Set<number>();
  const warned = new Set<SfxKey>();

  const warnOnce = (key: SfxKey, why: string) => {
    if (warned.has(key)) return;
    warned.add(key);
    env.warn(`[sfx] ${key}: ${why}`);
  };

  function fire(cue: AudioCue): void {
    if (!enabled || !driver) return;
    try {
      if (driver.isLocked()) return;
      if (!driver.has(cue.key)) {
        warnOnce(cue.key, 'not loaded');
        return;
      }
      const now = env.now();
      for (let i = voiceEnds.length - 1; i >= 0; i--) if (voiceEnds[i] <= now) voiceEnds.splice(i, 1);
      const last = lastStart.get(cue.key);
      if (last !== undefined && now - last < opts.repeatGapMs) return;
      if (voiceEnds.length >= opts.maxVoices) return;
      const lengthMs = driver.play(cue.key, { rate: cue.rate, volume: cue.volume * opts.volume });
      lastStart.set(cue.key, now);
      voiceEnds.push(now + Math.max(0, lengthMs));
    } catch {
      warnOnce(cue.key, 'play failed');
    }
  }

  return {
    play(cues) {
      if (!enabled) return;
      for (const cue of cues) {
        if (cue.delayMs > 0) {
          const id = env.setTimeout(() => {
            pending.delete(id);
            fire(cue);
          }, cue.delayMs);
          pending.add(id);
        } else {
          fire(cue);
        }
      }
    },

    setEnabled(on) {
      enabled = on;
      if (on) return;
      for (const id of pending) env.clearTimeout(id);
      pending.clear();
    },
  };
}
