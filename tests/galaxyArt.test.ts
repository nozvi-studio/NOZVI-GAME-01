import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { GALAXY_ART_FILES, isLayeredGalaxy } from '../src/presentation/galaxy/galaxyArtFiles.ts';
import { GALAXY_THEMES } from '../src/presentation/galaxy/galaxyTheme.ts';

describe('galaxy art registry', () => {
  it('has a file list for every theme id', () => {
    for (const theme of Object.values(GALAXY_THEMES)) expect(GALAXY_ART_FILES[theme.id], theme.id).toBeDefined();
  });

  it('every listed file exists under public/assets/galaxies', () => {
    for (const files of Object.values(GALAXY_ART_FILES)) {
      for (const file of files) expect(existsSync(`public/assets/galaxies/${file}.svg`), file).toBe(true);
    }
  });

  it('only ring, cluster and prism use the layered builder', () => {
    expect(['dwarf', 'spiral', 'ring', 'cluster', 'prism'].filter(isLayeredGalaxy)).toEqual(['ring', 'cluster', 'prism']);
  });
});
