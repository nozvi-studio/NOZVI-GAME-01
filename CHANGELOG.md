# CHANGELOG

Change history following [Keep a Changelog](https://keepachangelog.com/). Only add new entries; never edit old ones.

## [Unreleased]

### Added
- Five locales: Spanish (es), French (fr), German (de), Korean (ko), Simplified Chinese (zh-CN); device tags `es-*`, `fr-*`, `de-*`, `ko-*`, `zh-*` resolve to them.
- `CLAUDE.md`: AI onboarding guide (commands, architecture, rules).
- `AGENT.md`: agent/task menu (onboarding, memory/log, level, localization, audio, release).
- `STATUS.md` and `CHANGELOG.md`: project log maintained by the memory agent.

### Changed
- Settings language control is now a button that opens the language picker (ten languages do not fit the segmented track).
- Language picker lists all ten locales; CJK font fallbacks added for Korean and Simplified Chinese.

## [1.0.0]

### Added
- Initial import of the Nozvi game (Phaser 3, TypeScript, Vite, Capacitor Android).
