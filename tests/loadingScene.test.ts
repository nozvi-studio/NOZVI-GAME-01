import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadingScene } from '../src/presentation/scenes/LoadingScene.ts';
import { LoadingProgress } from '../src/application/loadingProgress.ts';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

function setup() {
  const scene = new LoadingScene();
  const load = Object.assign(new EventEmitter(), {
    svg: vi.fn(), start: vi.fn(), isLoading: () => true,
  });
  const progress = new LoadingProgress([{ id: 'galaxy', weight: 1 }], { minMs: 0, maxMs: 8000 });
  Object.assign(scene, { load, textures: { exists: () => false }, progress });
  // Exercise the deferred loader without constructing the loading screen's canvas UI.
  (scene as unknown as { startLoading(): void }).startLoading();
  load.svg.mockClear();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  return { load, progress, warn, error };
}

afterEach(() => vi.restoreAllMocks());

describe('LoadingScene galaxy retry', () => {
  it('requeues the same SVG key and URL once and waits for loader completion', () => {
    const { load, progress, warn, error } = setup();
    const file = { key: 'galaxy-ring', url: 'assets/galaxies/ring.svg' };
    load.emit('loaderror', file);
    expect(load.svg).toHaveBeenCalledTimes(1);
    expect(load.svg).toHaveBeenCalledWith(file.key, file.url);
    expect(progress.tick(1000).done).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    load.emit('complete');
    expect(progress.tick(1000).done).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  it('warns after retry failure and still completes, with one retry per file', () => {
    const { load, progress, warn, error } = setup();
    const ring = { key: 'galaxy-ring', url: 'assets/galaxies/ring.svg' };
    const core = { key: 'galaxy-ring-core', url: 'assets/galaxies/ring-core.svg' };
    load.emit('loaderror', ring);
    load.emit('loaderror', core);
    load.emit('loaderror', { ...ring });
    load.emit('loaderror', { ...core });
    expect(load.svg.mock.calls).toEqual([[ring.key, ring.url], [core.key, core.url]]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith('[loading] failed to load', ring.key);
    load.emit('complete');
    expect(progress.tick(2000).done).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });
});
