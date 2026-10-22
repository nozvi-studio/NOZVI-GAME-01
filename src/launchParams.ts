export type LaunchTarget =
  | { scene: 'MenuScene'; skipSplash?: boolean; chapter?: number }
  | { scene: 'LevelSelectScene'; focusLevelId?: string; revealAll?: boolean }
  | { scene: 'PlayScene'; levelId?: string; mode: 'campaign' | 'harness' | 'endless'; chapter?: number; endlessLevel?: number; tutorial?: boolean };

/**
 * Đọc tham số URL lúc khởi động. Harness cho phép chơi thử màn validated,
 * nên chỉ có hiệu lực ở dev; bản build luôn dùng campaign với màn approved.
 */
export function resolveLaunch(search: string, isDev: boolean): LaunchTarget {
  const params = new URLSearchParams(search);
  const scene = params.get('scene');
  if (scene === 'play') {
    const modeParam = params.get('mode');
    if (isDev && modeParam === 'endless') {
      const chapter = Number(params.get('chapter')) || 1;
      const endlessLevel = Number(params.get('level')) || 1;
      return { scene: 'PlayScene', mode: 'endless', chapter, endlessLevel };
    }
    const levelId = params.get('level') ?? '1-1';
    const mode = isDev && modeParam === 'harness' ? 'harness' : 'campaign';
    // tutorial=1 ignores the "seen" flag so testers can replay the coach overlay (dev only)
    const tutorial = isDev && params.get('tutorial') === '1';
    return { scene: 'PlayScene', levelId, mode, ...(tutorial ? { tutorial: true } : {}) };
  }
  if (scene === 'levelSelect') {
    // focus chỉ dùng ở dev để chụp ảnh một chòm sao bất kỳ
    const focus = params.get('focus');
    // revealAll lifts the map fog so every band can be captured (dev only)
    return {
      scene: 'LevelSelectScene',
      ...(isDev && focus ? { focusLevelId: focus } : {}),
      ...(isDev && params.get('revealAll') === '1' ? { revealAll: true } : {}),
    };
  }
  const skipSplash = params.get('skipSplash') === '1' || params.get('scene') === 'menu';
  // chapter forces the menu's galaxy theme so chapters without levels can be previewed (dev only)
  const chapter = Number(params.get('chapter'));
  const preview = isDev && Number.isInteger(chapter) && chapter >= 1 && chapter <= 5 ? { chapter } : {};
  return skipSplash ? { scene: 'MenuScene', skipSplash: true, ...preview } : { scene: 'MenuScene' };
}
