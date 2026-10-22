# STATUS

> The *current* state of the project. Overwrite when things change; history lives in `CHANGELOG.md`.
> Last updated: 2026-10-22

## Branches
- Working on: `feature/ai-onboarding-memory-agent-i18n` (cut from `release/v1.0.0`)
- Release branch: `release/v1.0.0` · Main: `main` · Development: `dev`

## Version
- `1.0.0` (per `package.json`)

## In progress
- [x] AI onboarding setup: `CLAUDE.md`, `AGENT.md`
- [x] Project log setup: `STATUS.md`, `CHANGELOG.md`
- [x] Add 5 languages: es, fr, de, ko, zh-CN (now 10 locales)

## Next steps
- Have a native speaker review the machine-drafted es, fr, de, ko, zh-CN strings.
- Check CJK glyph rendering on device (ja/ko/zh-CN rely on system fonts; no CJK webfont is bundled). The font stack now follows the active locale (`setFontLocale`).

## Blockers / open questions
- Android package rename (`com.nozvi.mirror`) is synced but not compiled here: no Android SDK on this machine. Run `gradlew.bat assembleDebug` on a machine with the SDK.
- None. `en` from the system list is treated as an alias of `en-US` (kept as default/fallback).
