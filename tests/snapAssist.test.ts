import { describe, expect, it } from 'vitest';
import { NO_ASSIST, snapAssistFor } from '../src/presentation/board/snapAssist.ts';

describe('snapAssistFor', () => {
  it('keeps the glow, label and ring on the first two levels', () => {
    expect(snapAssistFor('1-1', 'campaign')).toEqual({ targetGlow: true, dropLabel: true, ring: true });
    expect(snapAssistFor('1-2', 'campaign')).toEqual({ targetGlow: true, dropLabel: true, ring: true });
  });

  it('keeps only the ring on the third level', () => {
    expect(snapAssistFor('1-3', 'campaign')).toEqual({ targetGlow: false, dropLabel: false, ring: true });
  });

  it('shows nothing from level 4 on, in later chapters and in endless', () => {
    expect(snapAssistFor('1-4', 'campaign')).toEqual(NO_ASSIST);
    expect(snapAssistFor('2-1', 'campaign')).toEqual(NO_ASSIST);
    expect(snapAssistFor('1-1', 'endless')).toEqual(NO_ASSIST);
    expect(snapAssistFor('endless-1-5', 'campaign')).toEqual(NO_ASSIST);
  });
});
