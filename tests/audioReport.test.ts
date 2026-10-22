import { describe, expect, test } from 'vitest';
import { renderAudioReport, renderWaveformSvg } from '../src/audio-synth/report.ts';
import type { ReportRow } from '../src/audio-synth/report.ts';

const rows: ReportRow[] = [
  { key: 'bell', durationMs: 1400, peak: 0.9, rms: 0.21, pitchHz: 587.32, limitMs: 1500, withinLimit: true },
  { key: 'tick', durationMs: 120, peak: 0.5, rms: 0.08, pitchHz: null, limitMs: 150, withinLimit: true },
  { key: 'swish', durationMs: 700, peak: 0.5, rms: 0.1, pitchHz: null, limitMs: 600, withinLimit: false },
];

describe('renderWaveformSvg', () => {
  test('produces a self-contained svg sized as asked', () => {
    const svg = renderWaveformSvg(Float32Array.from([0, 0.5, -0.5, 1, -1]), 200, 40);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 200 40"');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('<polyline');
  });

  test('an empty buffer still yields valid svg', () => {
    const svg = renderWaveformSvg(new Float32Array(0), 100, 20);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });
});

describe('renderAudioReport', () => {
  test('lists every row in a markdown table', () => {
    const md = renderAudioReport(rows);
    expect(md).toContain('| key | duration | limit | peak | rms | pitch |');
    for (const row of rows) expect(md).toContain(`| ${row.key} |`);
  });

  test('marks rows outside their limit', () => {
    const md = renderAudioReport(rows);
    const swishLine = md.split('\n').find((l) => l.startsWith('| swish |')) ?? '';
    const bellLine = md.split('\n').find((l) => l.startsWith('| bell |')) ?? '';
    expect(swishLine).toContain('OVER');
    expect(bellLine).not.toContain('OVER');
  });

  test('says how many failed', () => {
    expect(renderAudioReport(rows)).toContain('1 of 3 over the limit');
    expect(renderAudioReport([rows[0]])).toContain('all 1 within the limit');
  });

  test('shows a dash where there is no pitch', () => {
    const tickLine = renderAudioReport(rows).split('\n').find((l) => l.startsWith('| tick |')) ?? '';
    expect(tickLine).toContain('| — |');
  });
});
