import { describe, expect, test } from 'vitest';
import { decodeWavSamples, encodeWav } from '../src/audio-synth/wav.ts';

const ascii = (bytes: Uint8Array, at: number, len: number) =>
  String.fromCharCode(...Array.from(bytes.subarray(at, at + len)));

describe('encodeWav', () => {
  test('writes a RIFF/WAVE header for 16-bit mono', () => {
    const bytes = encodeWav(Float32Array.from([0, 0.5, -0.5]), 44100);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(ascii(bytes, 0, 4)).toBe('RIFF');
    expect(ascii(bytes, 8, 4)).toBe('WAVE');
    expect(ascii(bytes, 12, 4)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16); // PCM fmt chunk size
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(28, true)).toBe(44100 * 2); // byte rate
    expect(view.getUint16(32, true)).toBe(2); // block align
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(ascii(bytes, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(3 * 2);
    expect(bytes.length).toBe(44 + 3 * 2);
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
  });

  test('clamps samples outside the range instead of wrapping', () => {
    const { samples } = decodeWavSamples(encodeWav(Float32Array.from([2, -2]), 8000));
    expect(samples[0]).toBeCloseTo(1, 3);
    expect(samples[1]).toBeCloseTo(-1, 3);
  });
});

describe('round trip', () => {
  test('decoding what was encoded returns the same audio within 16-bit precision', () => {
    const original = new Float32Array(512);
    for (let i = 0; i < original.length; i++) original[i] = Math.sin((i / 512) * Math.PI * 8) * 0.8;
    const { sampleRate, samples } = decodeWavSamples(encodeWav(original, 22050));
    expect(sampleRate).toBe(22050);
    expect(samples.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) expect(samples[i]).toBeCloseTo(original[i], 3);
  });

  test('an empty buffer survives the trip', () => {
    const { samples } = decodeWavSamples(encodeWav(new Float32Array(0), 44100));
    expect(samples.length).toBe(0);
  });
});
