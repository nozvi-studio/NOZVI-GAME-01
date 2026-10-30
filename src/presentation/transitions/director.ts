import type Phaser from 'phaser';
import {
  PhaserSceneHost as CorePhaserSceneHost,
  SceneDirector,
} from '../../engine/core/transitions/SceneDirector.ts';
import type {
  Choreographed as CoreChoreographed,
  DirectorConfig,
  SceneHost as CoreSceneHost,
  TransitionContext as CoreTransitionContext,
} from '../../engine/core/transitions/SceneDirector.ts';
import { trackFor } from '../audio/tracks.ts';
import { AUDIO_TOKENS, TRANSITION_TOKENS } from '../designTokens.ts';
import type { SkyMood } from '../sky/skyMood.ts';
import type { RouteId } from './motion.ts';

export type SceneKey = 'MenuScene' | 'LevelSelectScene' | 'PlayScene';
export type TransitionContext = CoreTransitionContext<SceneKey, RouteId>;
export type Choreographed = CoreChoreographed<SceneKey, RouteId>;
export type SceneHost = CoreSceneHost<SceneKey, SkyMood>;
export type Director = SceneDirector<SceneKey, RouteId, SkyMood>;

const ROUTE_MOOD: Record<RouteId, SkyMood> = {
  'menu-to-play': 'play',
  'map-to-play': 'play',
  'next-level': 'play',
  'play-to-map': 'map',
  'play-to-menu': 'menu',
  'menu-to-map': 'map',
  'map-to-menu': 'menu',
};

/** Tuyến dùng cho phần vào khi khởi động thẳng vào một cảnh */
const BOOT_ROUTE: Record<SceneKey, RouteId> = {
  MenuScene: 'play-to-menu',
  LevelSelectScene: 'menu-to-map',
  PlayScene: 'menu-to-play',
};

const CONFIG: DirectorConfig<SceneKey, RouteId, SkyMood> = {
  routeMood: ROUTE_MOOD,
  bootRoute: BOOT_ROUTE,
  trackFor,
  timing: {
    crossfadeMs: TRANSITION_TOKENS.crossfadeMs,
    moodMs: TRANSITION_TOKENS.moodMs,
    handoffMs: (route) => TRANSITION_TOKENS.routes[route].handoffMs,
    sceneSwapFadeMs: AUDIO_TOKENS.sceneSwapFadeMs,
    sceneSwapGapMs: AUDIO_TOKENS.sceneSwapGapMs,
    bootFadeMs: AUDIO_TOKENS.bootFadeMs,
  },
};

/** A fresh director; tests build their own. */
export function createDirector(): Director {
  return new SceneDirector<SceneKey, RouteId, SkyMood>(CONFIG);
}

export const director: Director = createDirector();

/** The Phaser host wired to Mirror's sky scene. */
export class PhaserSceneHost extends CorePhaserSceneHost<SceneKey, SkyMood> {
  constructor(game: Phaser.Game) {
    super(game, 'BackgroundScene');
  }
}
