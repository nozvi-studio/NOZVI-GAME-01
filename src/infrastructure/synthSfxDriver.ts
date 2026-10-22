/**
 * An SfxDriver backed by the synth engine instead of loaded audio files.
 *
 * Buffers are rendered once at boot (see renderAll) and played here. The
 * SfxPort above this does all the voice limiting and repeat guarding; this
 * layer only starts sounds and reports how long they last.
 */
import type { SfxKey } from '../content/audio/index.ts';
import type { SfxDriver } from './sfx.ts';

export function synthSfxDriver(
  ctx: AudioContext,
  buffers: Partial<Record<SfxKey, AudioBuffer>>,
): SfxDriver {
  return {
    isLocked: () => ctx.state !== 'running',
    has: (key) => buffers[key] !== undefined,
    play: (key, config) => {
      const buffer = buffers[key];
      if (!buffer) return 0;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = config.rate;

      const gain = ctx.createGain();
      gain.gain.value = config.volume;

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      return (buffer.duration * 1000) / Math.max(0.01, config.rate);
    },
  };
}
