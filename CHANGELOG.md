# CHANGELOG

Change history following [Keep a Changelog](https://keepachangelog.com/). Only add new entries; never edit old ones.

## [Unreleased]

### Added
- `docs/testing/release-checklist-gameplay.md`: GAME-01..04 findings and device test plan.
- `gate_locked` string ("Locked") in all ten locales for the locked chapter 1 Endless gate badge, replacing "Coming Soon" there.
- `docs/testing/release-checklist-compliance.md`: COMP-01..05 findings and device/console to-dos.
- `docs/testing/release-checklist-localization.md`: LOC-01..05 release checklist, decisions and on-device test list.
- `npm run android:setup` (`scripts/android/ensure-sdk.ts`) and `npm run android:build`: Gradle failed with "SDK location not found" on any machine without `ANDROID_HOME` or the git-ignored `android/local.properties`; the script now detects the default SDK folder and writes the file.
- Five locales: Spanish (es), French (fr), German (de), Korean (ko), Simplified Chinese (zh-CN); device tags `es-*`, `fr-*`, `de-*`, `ko-*`, `zh-*` resolve to them.
- `CLAUDE.md`: AI onboarding guide (commands, architecture, rules).
- `AGENT.md`: agent/task menu (onboarding, memory/log, level, localization, audio, release).
- `STATUS.md` and `CHANGELOG.md`: project log maintained by the memory agent.

### Fixed
- Intro splash: removed the looping shine/clip-path layer and drop-shadow filter that made the fly-in lag; ring and burst animations now use `forwards` fill.
- Star rating: the budget no longer clamps to 20–45 s; the 3-star window is `par x THREE_STAR_PAR_RATIO` (1.25), so levels with 2+ pieces no longer share a window shorter than their own par.
- Target badge touch area: the hit circle is centred in its 192 px box (`targetBadgeHit.ts`), instead of landing up and to the left.
- Dropping a piece next to the bottom of the board on touch no longer counts as "return to tray": the drop test uses the piece position, not the fingertip.
- Tray pieces keep their relative sizes (`trayRefFrame`) instead of each shrinking to fit its slot.
- Snap hint pill overflow and HUD / menu layout adjustments (`Hud`, `hudText`, `menuLayout`, `layout`, `tutorialGeometry`).
- Simplified Chinese no longer renders Han characters with Japanese glyphs: the CJK system font stack is ordered by the active locale (`setFontLocale` in `designTokens.ts`).
- German `btn_reset` was translated as "Back"; two settings dialog input tests dropped during the language-picker refactor are restored.

### Changed
- Touch drag carries the piece `fingerLift` (80 design units) above the fingertip; mouse drag is unchanged.
- Removed the `version_footer` string from all ten locales and the menu footer.
- `index.html` `lang` is now `en` (was `vi`), matching the English default.
- Settings language control is now a button that opens the language picker (ten languages do not fit the segmented track).
- Language picker lists all ten locales; CJK font fallbacks added for Korean and Simplified Chinese.

### Changed (Android)
- Application ID / package renamed from `com.nkhanh.nozvi` to `com.nozvi.mirror` (`capacitor.config.ts`, `build.gradle`, `strings.xml`, `MainActivity.java` and its folder). Uninstall any old debug build first; it installs as a separate app.

### Removed
- Chapter 2 Endless gate on the level map (unfinished, no endless pool): `ENDLESS_UNLOCK_LEVEL` is now `{ 1: '1-10' }` and `endlessGateRules` tests updated.
- Unused legacy `CHAPTER_NAMES` table in `src/presentation/i18n.ts` (chapter names come from `LocalizationManager`).

## [1.0.0]

### Added
- Initial import of the Nozvi game (Phaser 3, TypeScript, Vite, Capacitor Android).
