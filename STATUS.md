# STATUS

> The *current* state of the project. Overwrite when things change; history lives in `CHANGELOG.md`.
> Last updated: 2026-10-26

## Branches
- Last worked on: `feature/game-analytics` (level tracking + GameAnalytics driver, cut from `feature/sentry-crash-reporting`, 2026-10-26). Before it: `fix/intro-fly-in-lag` (merged into `release/v1.0.0`, 2026-10-24)
- Release branch: `release/v1.0.0` · Main: `main` · Development: `dev`

## Version
- `1.0.0` (per `package.json`)

## In progress
- [x] AI onboarding setup: `CLAUDE.md`, `AGENT.md`
- [x] Project log setup: `STATUS.md`, `CHANGELOG.md`
- [x] Add 5 languages: es, fr, de, ko, zh-CN (now 10 locales)

- [x] Localization release checklist (LOC-01..05) on `feature/release-checklist-localization`: see `docs/testing/release-checklist-localization.md`. Scope locked; device evidence not collected yet. LOC-05 is N/A (no IAP). Chapter 2 Endless gate removed; chapters 4/5 "Coming soon" kept pending the leader.

- [x] Compliance checklist (COMP-01..05): see `docs/testing/release-checklist-compliance.md`. Blocker: no Privacy Policy / Terms link or URL yet (COMP-01). COMP-03 and COMP-05 are N/A (no IAP, no accounts).

- [x] Gameplay checklist (GAME-01..04): see `docs/testing/release-checklist-gameplay.md`. No lose state or currency reward in the game (confirm with the leader); no network code, so GAME-03 is N/A; device evidence still to collect.
- [ ] Monetization checklist (MON-01..06): see `docs/testing/release-checklist-monetization.md`. No ads/IAP/analytics SDK, so MON-01..05 are N/A; MON-06 (analytics events) left open for the owner.

## Next steps
- Analytics (`feature/game-analytics`, cut from `feature/sentry-crash-reporting`): `LevelTracker`, the GameAnalytics driver and a placeholder consent screen are in and tests are green. Still to do: real consent UI and wording (Vietnamese law requires consent for analytics), Privacy Policy / Data Safety (COMP-01), and an on-device check in the Capacitor WebView (confirm the events reach the GameAnalytics dashboard, and whether importing the SDK sends anything before the first event). The two GameAnalytics keys must be in `.env.local` when the APK is built.
- Crash reporting (`feature/sentry-crash-reporting`): Sentry web driver is in; needs a DSN in `.env.local` to verify end to end with `__crashTest` (not yet verified against real Sentry). Still to do: CrazyGames SDK driver, `@sentry/capacitor` for Android/iOS, source maps upload (builds ship none, so stacks are minified), check CrazyGames' rules on outbound requests, update Privacy Policy / Data Safety (COMP-01).
- Remaining unused params left on purpose: `Hud` `title`, `endlessCatalog` `chapter`.
- Have a native speaker review the machine-drafted es, fr, de, ko, zh-CN strings.
- Check CJK glyph rendering on device (ja/ko/zh-CN rely on system fonts; no CJK webfont is bundled). The font stack now follows the active locale (`setFontLocale`).

## Blockers / open questions
- Android package rename (`com.nozvi.mirror`) compiles: `gradlew assembleDebug` passed on 2026-10-22. On a fresh machine run `npm run android:setup` (or set `ANDROID_HOME`) first; `local.properties` is git-ignored.
- None. `en` from the system list is treated as an alias of `en-US` (kept as default/fallback).
