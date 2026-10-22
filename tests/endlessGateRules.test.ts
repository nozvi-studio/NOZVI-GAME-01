import { describe, expect, it } from 'vitest';
import { ENDLESS_UNLOCK_LEVEL, endlessGateState, galaxyCentreNear } from '../src/presentation/galaxy/endlessGateRules.ts';

describe('endlessGateState', () => {
  it('opens chapter 1 only after level 1-10 and chapter 2 after 2-15', () => {
    expect(ENDLESS_UNLOCK_LEVEL).toEqual({ 1: '1-10', 2: '2-15' });
    expect(endlessGateState(1, ['1-1', '1-9'], false).reached).toBe(false);
    expect(endlessGateState(1, ['1-9', '1-10'], false).reached).toBe(true);
    expect(endlessGateState(2, ['2-14'], false).reached).toBe(false);
    expect(endlessGateState(2, ['2-14', '2-15'], false).reached).toBe(true);
  });

  it('is playable only where an endless pool exists', () => {
    expect(endlessGateState(1, ['1-10'], false)).toMatchObject({ reached: true, playable: true, open: true });
    expect(endlessGateState(2, ['2-15'], false)).toMatchObject({ reached: true, playable: false, open: false });
  });

  it('harness mode previews every gate as reached', () => {
    expect(endlessGateState(1, [], true).open).toBe(true);
    expect(endlessGateState(2, [], true).reached).toBe(true);
  });

  it('names the level that opens the gate, so the locked toast can say it', () => {
    expect(endlessGateState(2, [], false).unlockLevelId).toBe('2-15');
  });
});

describe('galaxyCentreNear', () => {
  const art = [{ x: 520, y: 700 }, { x: 200, y: 1680 }, { x: 520, y: 2660 }];

  it('returns the centre of the galaxy closest to the level', () => {
    expect(galaxyCentreNear(art, 2580)).toEqual({ x: 520, y: 2660 });
    expect(galaxyCentreNear(art, 1500)).toEqual({ x: 200, y: 1680 });
  });

  it('gives nothing when the band has no explicit galaxies', () => {
    expect(galaxyCentreNear(undefined, 100)).toBeUndefined();
    expect(galaxyCentreNear([], 100)).toBeUndefined();
  });
});
