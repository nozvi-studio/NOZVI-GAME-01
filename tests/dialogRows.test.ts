import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { createToggleRow } from '../src/presentation/dialogs/dialogRows.ts';
import { fakeScene } from './helpers/fakeScene.ts';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/presentation/audio/uiCues.ts', () => ({ playUiCue: () => {} }));

describe('toggle confirmation', () => {
  it('keeps its drawing and value until confirmation succeeds, ignoring repeated taps while pending', async () => {
    const ui = fakeScene({});
    const container = ui.scene.add.container(0, 0);
    const onChange = vi.fn();
    let resolve!: (accepted: boolean) => void;
    const confirm = vi.fn(() => new Promise<boolean>((done) => { resolve = done; }));
    createToggleRow(ui.scene, container, 0, 'Statistics', true, onChange, confirm);
    const track = ui.items.find((i) => i.kind === 'graphics') as unknown as Phaser.GameObjects.Graphics;
    const clear = vi.fn(() => track);
    track.clear = clear;

    ui.tap(200, 0);
    ui.tap(200, 0);
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(false);
    expect(clear).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    resolve(false);
    await Promise.resolve();
    expect(clear).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    ui.tap(200, 0);
    expect(confirm).toHaveBeenLastCalledWith(false);
    resolve(true);
    await Promise.resolve();
    expect(clear).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
