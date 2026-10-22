import { describe, expect, it } from 'vitest';
import { playBubbleBelow } from '../src/presentation/hud/playBubble.ts';

const box = { halfW: 81, top: -110, bottom: -50 };

describe('playBubbleBelow', () => {
  it('stays above when no chapter pill is near', () => {
    expect(playBubbleBelow(360, 1000, box, [200, 2400])).toBe(false);
  });

  it('flips below when the bubble would cover a chapter pill', () => {
    expect(playBubbleBelow(360, 300, box, [220])).toBe(true);
  });

  it('stays above when the node is far to the side of the pill', () => {
    expect(playBubbleBelow(80, 300, { ...box, halfW: 20 }, [220])).toBe(false);
  });
});
