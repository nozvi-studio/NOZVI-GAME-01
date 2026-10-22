import { resolveCurrentGalaxyTheme } from './galaxyTheme.ts';

/** Initial loading only needs the artwork used by the current chapter's menu. */
export function initialGalaxyThemeIds(completed: readonly string[]): string[] {
  return [resolveCurrentGalaxyTheme(completed).id];
}
