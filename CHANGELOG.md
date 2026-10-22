# CHANGELOG

Change history following [Keep a Changelog](https://keepachangelog.com/). Only add new entries; never edit old ones.

## [Unreleased]

### Added
- `npm run android:setup` (`scripts/android/ensure-sdk.ts`) and `npm run android:build`: Gradle failed with "SDK location not found" on any machine without `ANDROID_HOME` or the git-ignored `android/local.properties`; the script now detects the default SDK folder and writes the file.
- Five locales: Spanish (es), French (fr), German (de), Korean (ko), Simplified Chinese (zh-CN); device tags `es-*`, `fr-*`, `de-*`, `ko-*`, `zh-*` resolve to them.
- `CLAUDE.md`: AI onboarding guide (commands, architecture, rules).
- `AGENT.md`: agent/task menu (onboarding, memory/log, level, localization, audio, release).
- `STATUS.md` and `CHANGELOG.md`: project log maintained by the memory agent.

### Fixed
- Simplified Chinese no longer renders Han characters with Japanese glyphs: the CJK system font stack is ordered by the active locale (`setFontLocale` in `designTokens.ts`).
- German `btn_reset` was translated as "Back"; two settings dialog input tests dropped during the language-picker refactor are restored.

### Changed
- Settings language control is now a button that opens the language picker (ten languages do not fit the segmented track).
- Language picker lists all ten locales; CJK font fallbacks added for Korean and Simplified Chinese.

### Changed (Android)
- Application ID / package renamed from `com.nkhanh.nozvi` to `com.nozvi.mirror` (`capacitor.config.ts`, `build.gradle`, `strings.xml`, `MainActivity.java` and its folder). Uninstall any old debug build first; it installs as a separate app.

### Removed
- Unused legacy `CHAPTER_NAMES` table in `src/presentation/i18n.ts` (chapter names come from `LocalizationManager`).

## [1.0.0]

### Added
- Initial import of the Nozvi game (Phaser 3, TypeScript, Vite, Capacitor Android).
