import { describe, expect, test } from 'vitest';
import { resolveLaunch } from '../src/launchParams.ts';

describe('resolveLaunch', () => {
  test('mặc định mở menu', () => {
    expect(resolveLaunch('', true)).toEqual({ scene: 'MenuScene' });
  });

  test('chọn màn chơi, mặc định 1-1 ở campaign', () => {
    expect(resolveLaunch('?scene=play', false)).toEqual({ scene: 'PlayScene', levelId: '1-1', mode: 'campaign' });
    expect(resolveLaunch('?scene=play&level=1-3', false)).toEqual({ scene: 'PlayScene', levelId: '1-3', mode: 'campaign' });
  });

  test('harness chỉ bật ở dev', () => {
    expect(resolveLaunch('?scene=play&level=1-3&mode=harness', true)).toEqual({
      scene: 'PlayScene', levelId: '1-3', mode: 'harness',
    });
    expect(resolveLaunch('?scene=play&level=1-3&mode=harness', false)).toEqual({
      scene: 'PlayScene', levelId: '1-3', mode: 'campaign',
    });
  });

  test('mở thẳng màn chọn màn', () => {
    expect(resolveLaunch('?scene=levelSelect', false)).toEqual({ scene: 'LevelSelectScene' });
  });

  test('focus cuộn bản đồ tới một màn, chỉ ở dev', () => {
    expect(resolveLaunch('?scene=levelSelect&focus=3-4', true)).toEqual({ scene: 'LevelSelectScene', focusLevelId: '3-4' });
    expect(resolveLaunch('?scene=levelSelect&focus=3-4', false)).toEqual({ scene: 'LevelSelectScene' });
    expect(resolveLaunch('?scene=levelSelect', true)).toEqual({ scene: 'LevelSelectScene' });
  });
  test('chapter previews the menu theme, dev only, 1-5 only', () => {
    expect(resolveLaunch('?scene=menu&chapter=4', true)).toEqual({ scene: 'MenuScene', skipSplash: true, chapter: 4 });
    expect(resolveLaunch('?scene=menu&chapter=4', false)).toEqual({ scene: 'MenuScene', skipSplash: true });
    expect(resolveLaunch('?scene=menu&chapter=6', true)).toEqual({ scene: 'MenuScene', skipSplash: true });
    expect(resolveLaunch('?scene=menu&chapter=x', true)).toEqual({ scene: 'MenuScene', skipSplash: true });
  });

  test('revealAll opens the whole map, dev only', () => {
    expect(resolveLaunch('?scene=levelSelect&revealAll=1', true)).toEqual({ scene: 'LevelSelectScene', revealAll: true });
    expect(resolveLaunch('?scene=levelSelect&revealAll=1', false)).toEqual({ scene: 'LevelSelectScene' });
    expect(resolveLaunch('?scene=levelSelect&focus=3-4&revealAll=1', true)).toEqual({ scene: 'LevelSelectScene', focusLevelId: '3-4', revealAll: true });
  });

  test('tutorial=1 forces the coach overlay, only in dev', () => {
    expect(resolveLaunch('?scene=play&level=1-1&mode=harness&tutorial=1', true)).toEqual({
      scene: 'PlayScene', levelId: '1-1', mode: 'harness', tutorial: true,
    });
    expect(resolveLaunch('?scene=play&level=1-1&tutorial=1', false)).toEqual({
      scene: 'PlayScene', levelId: '1-1', mode: 'campaign',
    });
  });
});
