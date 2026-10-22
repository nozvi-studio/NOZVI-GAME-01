import type Phaser from 'phaser';
import type { AudioCue } from '../../infrastructure/sfx.ts';
import { AUDIO_TOKENS } from '../designTokens.ts';
import { audioServices } from './audioServices.ts';

export type UiCue = 'tap' | 'open' | 'close' | 'node' | 'locked';

/** Spec G §3.4 */
export function uiCue(cue: UiCue): AudioCue {
  const c = AUDIO_TOKENS.cues;
  switch (cue) {
    case 'tap':
      return { key: 'tick', rate: 1, volume: c.uiTap, delayMs: 0 };
    case 'open':
    case 'close':
      return { key: 'tap-soft', rate: 1, volume: c.uiDialog, delayMs: 0 };
    case 'node':
      return { key: 'bell', rate: 1, volume: c.uiNode, delayMs: 0 };
    case 'locked':
      return { key: 'thud', rate: 1, volume: c.uiLocked, delayMs: 0 };
  }
}

export function playUiCue(scene: Phaser.Scene, cue: UiCue): void {
  audioServices(scene).sfx.play([uiCue(cue)]);
}
