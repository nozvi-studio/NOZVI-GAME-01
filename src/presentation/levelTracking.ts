import type Phaser from 'phaser';
import type { LevelTracker } from '../application/levelTracker.ts';

/** main.ts stores the tracker in game.registry under this key. */
export const LEVEL_TRACKER_REGISTRY_KEY = 'levelTracker';

/** Null before main.ts has registered one (FixtureScene, tests): callers skip tracking. */
export function levelTracker(scene: Phaser.Scene): LevelTracker | null {
  return (scene.registry?.get(LEVEL_TRACKER_REGISTRY_KEY) as LevelTracker | undefined) ?? null;
}
