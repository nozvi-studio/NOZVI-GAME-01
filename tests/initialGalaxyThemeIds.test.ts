import { describe, expect, it } from 'vitest';
import { campaignManifest } from '../src/content/manifest.ts';
import { initialGalaxyThemeIds } from '../src/presentation/galaxy/initialGalaxyThemeIds.ts';

describe('initialGalaxyThemeIds', () => {
  it('queues only dwarf artwork for a new or partially completed campaign', () => {
    expect(initialGalaxyThemeIds([])).toEqual(['dwarf']);
    expect(initialGalaxyThemeIds(['1-1', '1-2'])).toEqual(['dwarf']);
  });

  it('queues only the current chapter after completing earlier chapters', () => {
    const completedThrough = (chapter: number) => campaignManifest
      .filter((entry) => entry.chapter <= chapter).map((entry) => entry.id);
    expect(initialGalaxyThemeIds(completedThrough(1))).toEqual(['spiral']);
    expect(initialGalaxyThemeIds(completedThrough(2))).toEqual(['ring']);
    expect(initialGalaxyThemeIds(completedThrough(3))).toEqual(['ring']);
  });
});
