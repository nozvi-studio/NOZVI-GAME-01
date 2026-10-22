import { describe, expect, test } from 'vitest';
import type Phaser from 'phaser';
import type { AudioCue } from '../src/infrastructure/sfx.ts';
import { AUDIO_REGISTRY_KEY, SILENT_AUDIO } from '../src/presentation/audio/audioServices.ts';
import { playUiCue, uiCue } from '../src/presentation/audio/uiCues.ts';
import { AUDIO_TOKENS } from '../src/presentation/designTokens.ts';

const C = AUDIO_TOKENS.cues;

describe('ui cues', () => {
  test('each UI cue maps to one sample at its token volume', () => {
    expect(uiCue('tap')).toEqual({ key: 'tick', rate: 1, volume: C.uiTap, delayMs: 0 });
    expect(uiCue('open')).toEqual({ key: 'tap-soft', rate: 1, volume: C.uiDialog, delayMs: 0 });
    expect(uiCue('close')).toEqual({ key: 'tap-soft', rate: 1, volume: C.uiDialog, delayMs: 0 });
    expect(uiCue('node')).toEqual({ key: 'bell', rate: 1, volume: C.uiNode, delayMs: 0 });
    expect(uiCue('locked')).toEqual({ key: 'thud', rate: 1, volume: C.uiLocked, delayMs: 0 });
  });

  test('playUiCue sends the cue to the registered SfxPort', () => {
    const played: AudioCue[][] = [];
    const services = { music: SILENT_AUDIO.music, sfx: { ...SILENT_AUDIO.sfx, play: (c: readonly AudioCue[]) => played.push([...c]) } };
    const scene = { registry: { get: (k: string) => (k === AUDIO_REGISTRY_KEY ? services : undefined) } } as unknown as Phaser.Scene;
    playUiCue(scene, 'node');
    expect(played).toEqual([[uiCue('node')]]);
  });
});
