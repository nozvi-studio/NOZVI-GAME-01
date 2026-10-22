/**
 * The resonance bus — dev only, listening prototype.
 *
 * This is approach A in one picture:
 *
 *   source → filter → voice gain ─┬─────────────────────→ dry ─┐
 *                                 └→ send → convolver ──→ wet ─┼→ master
 *                                         ↘ delay ↻ ────→ wet ─┘
 *
 * One convolver, one delay, shared by every sound. That sharing is the point:
 * eight separate sounds in one room read as a place, while eight sounds each
 * carrying their own baked reverb read as eight recordings played at once.
 *
 * It also carries a voice manager that steals instead of refusing, which is
 * the policy change src/infrastructure/sfx.ts needs and does not have.
 */
import type { SfxKey } from '../../content/audio/index.ts';
import { generateImpulse } from './rooms.ts';
import type { RoomSpec } from './rooms.ts';
import type { VoiceSpec } from './pieceVoice.ts';

/** Lower steals first. Player actions must never be stolen for ambience. */
export const PRIORITY = { breath: 0, ui: 1, action: 2, victory: 3 } as const;
export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

/** Milliseconds of fade before a stolen voice is stopped. Below ~5 ms it clicks. */
const STEAL_FADE_MS = 8;

type ActiveVoice = {
  startedAt: number;
  priority: Priority;
  gain: GainNode;
  source: AudioBufferSourceNode;
  stop(): void;
};

export type ResonanceBus = {
  setRoom(spec: RoomSpec): void;
  setWet(level: number): void;
  setMaster(level: number): void;
  setMaxVoices(n: number): void;
  play(voice: VoiceSpec, priority: Priority): void;
  activeCount(): number;
  stolenCount(): number;
  resetCounters(): void;
  stopAll(): void;
};

export function createResonanceBus(
  ctx: AudioContext,
  buffers: Partial<Record<SfxKey, AudioBuffer>>
): ResonanceBus {
  // Safety net for a listening tool: stacked voices plus their reverb can pass
  // full scale, and a clipped chord would be mistaken for a bad instrument.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 8;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  limiter.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(limiter);

  const dry = ctx.createGain();
  dry.gain.value = 1;
  dry.connect(master);

  const wet = ctx.createGain();
  wet.gain.value = 0;
  wet.connect(master);

  const convolver = ctx.createConvolver();
  convolver.normalize = false;
  convolver.connect(wet);

  // The echo is a separate voice from the tail: the tail is the room's size,
  // the echo is a distinct repeat you can count. "Vọng" rather than "vang".
  const delay = ctx.createDelay(2);
  const feedback = ctx.createGain();
  feedback.gain.value = 0;
  const delayDamp = ctx.createBiquadFilter();
  delayDamp.type = 'lowpass';
  delayDamp.frequency.value = 2600;
  delay.connect(delayDamp);
  delayDamp.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);

  let maxVoices = 12;
  let stolen = 0;
  const active: ActiveVoice[] = [];

  function reap(): void {
    // Nothing to do beyond letting onended prune; this keeps the array tight.
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].source.buffer === null) active.splice(i, 1);
    }
  }

  /**
   * Frees one slot. Takes the lowest priority first and, within a priority,
   * the oldest — so ambience dies before anything the player caused, and the
   * sound that has already been ringing longest is the one cut.
   */
  function steal(): void {
    if (active.length === 0) return;
    let victim = 0;
    for (let i = 1; i < active.length; i++) {
      const a = active[i];
      const b = active[victim];
      if (a.priority < b.priority || (a.priority === b.priority && a.startedAt < b.startedAt)) {
        victim = i;
      }
    }
    active[victim].stop();
    active.splice(victim, 1);
    stolen++;
  }

  return {
    setRoom(spec) {
      const ir = generateImpulse(spec, ctx.sampleRate);
      const buffer = ctx.createBuffer(2, ir.left.length, ctx.sampleRate);
      buffer.copyToChannel(ir.left, 0);
      buffer.copyToChannel(ir.right, 1);
      convolver.buffer = buffer;

      const now = ctx.currentTime;
      if (spec.echoMs > 0) {
        delay.delayTime.setTargetAtTime(spec.echoMs / 1000, now, 0.02);
        feedback.gain.setTargetAtTime(spec.echoFeedback, now, 0.05);
      } else {
        feedback.gain.setTargetAtTime(0, now, 0.05);
      }
      wet.gain.setTargetAtTime(spec.wet, now, 0.05);
    },

    setWet(level) {
      wet.gain.setTargetAtTime(level, ctx.currentTime, 0.03);
    },

    setMaster(level) {
      master.gain.setTargetAtTime(level, ctx.currentTime, 0.02);
    },

    setMaxVoices(n) {
      maxVoices = Math.max(1, Math.floor(n));
    },

    play(voice, priority) {
      const buffer = voice.buffer ?? buffers[voice.strike];
      if (!buffer) return;
      void ctx.resume();

      reap();
      while (active.length >= maxVoices) steal();

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // Cents folded into the rate rather than into `detune`, which is not
      // universally implemented on buffer sources.
      source.playbackRate.value = voice.rate * 2 ** (voice.detuneCents / 1200);

      // Instruments are already shaped by their patch and carry no filter.
      let filter: BiquadFilterNode | null = null;
      if (voice.filter) {
        filter = ctx.createBiquadFilter();
        filter.type = voice.filter.type;
        filter.frequency.value = voice.filter.hz;
        filter.Q.value = voice.filter.q;
        if (voice.filter.type === 'peaking') filter.gain.value = 5;
      }

      const gain = ctx.createGain();
      gain.gain.value = voice.gain;

      const send = ctx.createGain();
      send.gain.value = voice.send;

      if (filter) {
        source.connect(filter);
        filter.connect(gain);
      } else {
        source.connect(gain);
      }
      gain.connect(dry);
      gain.connect(send);
      send.connect(convolver);
      send.connect(delay);

      const entry: ActiveVoice = {
        startedAt: ctx.currentTime,
        priority,
        gain,
        source,
        stop() {
          const t = ctx.currentTime;
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(gain.gain.value, t);
          gain.gain.linearRampToValueAtTime(0, t + STEAL_FADE_MS / 1000);
          try {
            source.stop(t + STEAL_FADE_MS / 1000);
          } catch {
            /* already stopped */
          }
        },
      };

      source.onended = () => {
        const i = active.indexOf(entry);
        if (i >= 0) active.splice(i, 1);
        source.disconnect();
        filter?.disconnect();
        gain.disconnect();
        send.disconnect();
      };

      active.push(entry);
      source.start(ctx.currentTime + voice.delayMs / 1000);
    },

    activeCount: () => active.length,
    stolenCount: () => stolen,
    resetCounters: () => {
      stolen = 0;
    },

    stopAll() {
      for (const v of [...active]) v.stop();
      active.length = 0;
    },
  };
}
