/** SVG file stems per theme id (public/assets/galaxies/<stem>.svg). */
export const GALAXY_ART_FILES: Readonly<Record<string, readonly string[]>> = {
  dwarf: ['dwarf', 'dwarf-cloudA', 'dwarf-cloudB'],
  spiral: ['spiral'],
  ring: ['ring', 'ring-core'],
  cluster: [
    'cluster', 'cluster-web', 'cluster-core',
    'cluster-galaxies-0', 'cluster-galaxies-1', 'cluster-galaxies-2', 'cluster-galaxies-3',
    'cluster-meteor-0', 'cluster-meteor-1', 'cluster-meteor-2',
  ],
  prism: ['prism', 'prism-beam', 'prism-fan', 'prism-glass', 'prism-shards-0', 'prism-shards-1', 'prism-shards-2'],
};

const LAYERED = new Set(['ring', 'cluster', 'prism']);
export const isLayeredGalaxy = (themeId: string): boolean => LAYERED.has(themeId);
