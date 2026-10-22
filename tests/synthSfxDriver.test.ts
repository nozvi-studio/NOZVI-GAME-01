import { describe, expect, test } from 'vitest';
import { SFX_KEYS } from '../src/content/audio/index.ts';
import type { SfxKey } from '../src/content/audio/index.ts';
import { synthSfxDriver } from '../src/infrastructure/synthSfxDriver.ts';

/**
 * Enough of WebAudio to drive the driver, and to record what it did.
 *
 * The driver creates the source, then the gain node, sets gain.value, and
 * only then calls start(), so the most recent gain node is this sound's.
 */
function fakeContext(state: AudioContextState = 'running') {
  const started: Array<{ rate: number; gain: number }> = [];
  const gains: Array<{ gain: { value: number } }> = [];
  const ctx = {
    state,
    sampleRate: 44100,
    destination: {},
    createGain() {
      const node = { gain: { value: 1 }, connect() {} };
      gains.push(node);
      return node;
    },
    createBufferSource() {
      const node = {
        buffer: null as AudioBuffer | null,
        playbackRate: { value: 1 },
        connect() {},
        start() {
          started.push({
            rate: node.playbackRate.value,
            gain: gains[gains.length - 1]?.gain.value ?? 1,
          });
        },
      };
      return node;
    },
  };
  return { ctx: ctx as unknown as AudioContext, started };
}

const buffer = (seconds: number) => ({ duration: seconds }) as AudioBuffer;

describe('synthSfxDriver', () => {
  test('has() is true only for keys that have a buffer', () => {
    const { ctx } = fakeContext();
    const driver = synthSfxDriver(ctx, { bell: buffer(1) });
    expect(driver.has('bell')).toBe(true);
    expect(driver.has('tick')).toBe(false);
  });

  test('isLocked() follows the context state', () => {
    expect(synthSfxDriver(fakeContext('running').ctx, {}).isLocked()).toBe(false);
    expect(synthSfxDriver(fakeContext('suspended').ctx, {}).isLocked()).toBe(true);
  });

  test('play() returns the buffer length in ms, adjusted for rate', () => {
    const { ctx } = fakeContext();
    const driver = synthSfxDriver(ctx, { bell: buffer(1.4) });
    expect(driver.play('bell', { rate: 1, volume: 1 })).toBeCloseTo(1400, 3);
    expect(driver.play('bell', { rate: 2, volume: 1 })).toBeCloseTo(700, 3);
  });

  test('play() applies rate and volume to the graph', () => {
    const { ctx, started } = fakeContext();
    const driver = synthSfxDriver(ctx, { bell: buffer(1) });
    driver.play('bell', { rate: 1.5, volume: 0.25 });
    expect(started).toHaveLength(1);
    expect(started[0].rate).toBeCloseTo(1.5, 5);
    expect(started[0].gain).toBeCloseTo(0.25, 5);
  });

  test('a missing key returns 0 and does not throw', () => {
    const { ctx, started } = fakeContext();
    const driver = synthSfxDriver(ctx, {});
    expect(driver.play('tick', { rate: 1, volume: 1 })).toBe(0);
    expect(started).toHaveLength(0);
  });

  test('every Mirror key can be asked for without throwing', () => {
    const { ctx } = fakeContext();
    const driver = synthSfxDriver(ctx, {});
    for (const key of SFX_KEYS) {
      expect(() => driver.play(key as SfxKey, { rate: 1, volume: 1 })).not.toThrow();
    }
  });
});
