import { beforeEach, describe, expect, it } from 'vitest';
import { mapIntroSeen, markMapIntroSeen, resetMapIntroSeen } from '../src/presentation/galaxy/mapIntroSeen.ts';

describe('mapIntroSeen', () => {
  beforeEach(() => resetMapIntroSeen());

  it('is unseen until the first map visit marks it', () => {
    expect(mapIntroSeen()).toBe(false);
    markMapIntroSeen();
    expect(mapIntroSeen()).toBe(true);
  });
});
