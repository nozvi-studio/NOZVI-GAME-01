import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGalaxyLayers, type GalaxyLayerHost } from '../src/presentation/galaxy/galaxyLayers.ts';
import { addGalaxyArtwork } from '../src/presentation/galaxy/GalaxyArtwork.ts';
import { GALAXY_ART_FILES } from '../src/presentation/galaxy/galaxyArtFiles.ts';
import { GALAXY_THEMES } from '../src/presentation/galaxy/galaxyTheme.ts';
import { setMotionScale } from '../src/presentation/transitions/motion.ts';

vi.mock('phaser', () => ({ default: {
  BlendModes: { ADD: 1 }, Scenes: { Events: { UPDATE: 'update' } },
  GameObjects: { Events: { DESTROY: 'destroy' } },
} }));

function node() {
  const view = { scaleX: 1, scaleY: 1, visible: true };
  return Object.assign(view, Object.fromEntries([
    'setName', 'setDisplaySize', 'setOrigin', 'setPosition', 'setAlpha', 'setScale',
    'setAngle', 'setTint', 'setBlendMode', 'add', 'once', 'setData',
  ].map(method => [method, vi.fn().mockReturnValue(view)])));
}

function setup(missing: readonly string[]) {
  const image = vi.fn((_x: number, _y: number, _key: string) => node());
  const tween = vi.fn((config: { targets: unknown; onComplete?: () => void }) => {
    expect(config.targets).toBeTruthy();
    config.onComplete?.();
    return { pause() {}, resume() {}, remove() {} };
  });
  const scene = {
    textures: { exists: (key: string) => !missing.includes(key) },
    add: { image, container: () => node() },
    tweens: { add: tween }, events: { on: vi.fn(), off: vi.fn() },
  } as unknown as Phaser.Scene;
  const host: GalaxyLayerHost = {
    scene, root: node() as unknown as Phaser.GameObjects.Container,
    size: 350, motion: [], frame: [], heldIntro: [],
  };
  return { scene, host, image };
}

afterEach(() => setMotionScale(1));

describe.each([1, 0])('missing galaxy textures (motion scale %s)', motionScale => {
  for (const themeId of ['ring', 'cluster', 'prism']) {
    it.each(GALAXY_ART_FILES[themeId])(`skips missing ${themeId} layer %s and keeps other layers`, stem => {
      setMotionScale(motionScale);
      const missing = `galaxy-${stem}`;
      const { host, image } = setup([missing]);
      buildGalaxyLayers(host, themeId);
      host.frame.forEach(animate => animate(3000));
      const keys = image.mock.calls.map(call => call[2]);
      expect(keys).not.toContain(missing);
      for (const other of GALAXY_ART_FILES[themeId].filter(value => value !== stem)) {
        expect(keys).toContain(`galaxy-${other}`);
      }
    });
  }

  it.each(Object.values(GALAXY_THEMES))('can build $id artwork when all its SVG textures failed', theme => {
    setMotionScale(motionScale);
    const missing = GALAXY_ART_FILES[theme.id].map(stem => `galaxy-${stem}`);
    const { scene, image } = setup(missing);
    expect(addGalaxyArtwork(scene, theme, 0, 0, 350)).toBeDefined();
    for (const key of missing) {
      expect(image.mock.calls.map(call => call[2])).not.toContain(key);
    }
  });
});
