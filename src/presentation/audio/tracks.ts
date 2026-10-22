import type { TrackId } from '../../infrastructure/audioManifest.ts';
import type { SceneKey } from '../transitions/SceneDirector.ts';

/** Spec G §3.6: Menu and Map share the sky track; the level has its own. */
export function trackFor(scene: SceneKey): TrackId {
  return scene === 'PlayScene' ? 'music-stele' : 'music-sky';
}
