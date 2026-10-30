import { afterEach, describe, expect, test, vi } from 'vitest';
import { SceneDirector } from '../../../src/engine/core/transitions/SceneDirector.ts';
import type { Choreographed, DirectorConfig, SceneHost } from '../../../src/engine/core/transitions/SceneDirector.ts';
import { setMotionScale } from '../../../src/engine/core/transitions/motion.ts';

type Key = 'alpha' | 'beta';
type Route = 'forward' | 'back';
type Mood = 'calm' | 'busy';

const config: DirectorConfig<Key, Route, Mood> = {
  routeMood: { forward: 'busy', back: 'calm' },
  bootRoute: { alpha: 'back', beta: 'forward' },
  trackFor: (scene) => `track-${scene}`,
  timing: {
    crossfadeMs: 150,
    moodMs: 1000,
    handoffMs: () => 200,
    sceneSwapFadeMs: 700,
    sceneSwapGapMs: 600,
    bootFadeMs: 900,
  },
};

class FakeHost implements SceneHost<Key, Mood> {
  readonly log: string[] = [];
  readonly moods: Array<[Mood, number]> = [];
  start(key: Key): void {
    this.log.push(`start:${key}`);
  }
  restart(key: Key): void {
    this.log.push(`restart:${key}`);
  }
  stop(key: Key): void {
    this.log.push(`stop:${key}`);
  }
  setInputEnabled(): void {}
  setCameraAlpha(): void {}
  setMood(mood: Mood, durationMs: number): void {
    this.moods.push([mood, durationMs]);
  }
  armSkip(): void {}
  disarmSkip(): void {}
  onStep(): void {}
}

const scene = (key: Key): Choreographed<Key, Route> => ({ directorKey: key, playIn() {}, playOut() {} });

function setup() {
  const director = new SceneDirector<Key, Route, Mood>(config);
  const host = new FakeHost();
  director.setHost(host);
  return { director, host };
}

afterEach(() => setMotionScale(1));

describe('SceneDirector with a non-Mirror config', () => {
  test('go settles the sky into the route mood and refuses a second go while busy', () => {
    const { director, host } = setup();
    expect(director.go(scene('alpha'), 'beta', {}, { route: 'forward' })).toBe(true);
    expect(host.moods).toEqual([['busy', 1000]]);
    expect(director.isTransitioning()).toBe(true);
    expect(director.go(scene('alpha'), 'beta', {}, { route: 'forward' })).toBe(false);
  });

  test('reduced motion settles the mood at once', () => {
    setMotionScale(0);
    const { director, host } = setup();
    director.go(scene('alpha'), 'beta', {}, { route: 'back' });
    expect(host.moods).toEqual([['calm', 0]]);
  });

  test('go asks for the target scene track with the scene-swap fade and gap', () => {
    const { director } = setup();
    const setTrack = vi.fn();
    director.setMusic({ setTrack });
    director.go(scene('alpha'), 'beta', {}, { route: 'forward' });
    expect(setTrack).toHaveBeenCalledWith('track-beta', 700, 600);
  });

  test('boot starts the scene with the boot route mood and the boot fade', () => {
    const { director, host } = setup();
    const setTrack = vi.fn();
    director.setMusic({ setTrack });
    director.boot('beta', { from: 'test' });
    expect(host.log).toEqual(['start:beta']);
    expect(host.moods).toEqual([['busy', 0]]);
    expect(setTrack).toHaveBeenCalledWith('track-beta', 900);
  });
});
