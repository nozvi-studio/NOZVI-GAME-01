# STATUS

> The *current* state of the project. Overwrite when things change; history lives in `CHANGELOG.md`.
> Last updated: 2026-10-28

## Branches
- Last worked on: `feature/placement-feedback-audio` (X/N matched counts only pieces on target; kalimba piece sounds with a note per piece and a slow victory run; level music at half level; music no longer ducks with effects off; double-tap sound fix; merged into local `release/v1.0.0`, 2026-10-28, not pushed). Audio values are tuned by ear and may still move (`designTokens.ts`, Audio Lab).
- Before it: `fix/release-issues` (no Sentry/GA; 10% tighter star time, 3-star hint in tutorial 1-1, Sound switch in Pause; pushed with `release/v1.0.0`, 2026-10-28). Before it: `fix/intro-fly-in-lag` (merged 2026-10-24). Before it: `feature/release-checklist-localization` (merged 2026-10-23)
- Release branch: `release/v1.0.0` · Main: `main` · Development: `dev`

## Version
- `1.0.0` (per `package.json`)

## In progress
- [x] AI onboarding setup: `CLAUDE.md`, `AGENT.md`
- [x] Project log setup: `STATUS.md`, `CHANGELOG.md`
- [x] Add 5 languages: es, fr, de, ko, zh-CN (now 10 locales)
- [x] Ethereal Observatory theme & interaction upgrade (Direction 2): discrete 3-layer dynamic parallax on MenuScene & LevelSelectScene (deepest tiny rich-tinted stars sweep fastest at ±46px, mid-tier stars & galaxy artwork drift at ±20px, foreground emblems/nodes anchored at ±6px), gentle touch ripples, hero emblem ambient motes & tap resonance, full-chapter atmosphere FX, celestial snap feedback, smooth dialog transitions, and gyroscope device tilt/shake parallax.

- [ ] `feature/ethereal-ui` perf pass (uncommitted): parallax stars baked to textures; typecheck + tests pass, but frame rate not yet measured on laptop/Android. Possible next steps: `ethereal:ripple` listener in `BackgroundScene` is never removed (leaks on scene restart); consider lower density on low-end devices.
- [x] Localization release checklist (LOC-01..05) on `feature/release-checklist-localization`: see `docs/testing/release-checklist-localization.md`. Scope locked; device evidence not collected yet. LOC-05 is N/A (no IAP). Chapter 2 Endless gate removed; chapters 4/5 "Coming soon" kept pending the leader.

- [x] Compliance checklist (COMP-01..05): see `docs/testing/release-checklist-compliance.md`. Blocker: no Privacy Policy / Terms link or URL yet (COMP-01). COMP-03 and COMP-05 are N/A (no IAP, no accounts).

- [x] Gameplay checklist (GAME-01..04): see `docs/testing/release-checklist-gameplay.md`. No lose state or currency reward in the game (confirm with the leader); no network code, so GAME-03 is N/A; device evidence still to collect.

- [ ] Monetization checklist (MON-01..06): see `docs/testing/release-checklist-monetization.md`. No ads/IAP/analytics SDK, so MON-01..05 are N/A; MON-06 (analytics events) left open for the owner.

## Next steps
- Crash reporting / tracking: plug real drivers into `createPlatformServices()` in `main.ts` (web: CrazyGames SDK, native: `@sentry/capacitor`); check CrazyGames' rules on outbound requests first. Update Privacy Policy / Data Safety (COMP-01).
- Remaining unused params left on purpose: `Hud` `title`, `endlessCatalog` `chapter`.
- Have a native speaker review the machine-drafted es, fr, de, ko, zh-CN strings.
- Check CJK glyph rendering on device (ja/ko/zh-CN rely on system fonts; no CJK webfont is bundled). The font stack now follows the active locale (`setFontLocale`).

## Blockers / open questions
- Android package rename (`com.nozvi.mirror`) compiles: `gradlew assembleDebug` passed on 2026-10-22. On a fresh machine run `npm run android:setup` (or set `ANDROID_HOME`) first; `local.properties` is git-ignored.
- None. `en` from the system list is treated as an alias of `en-US` (kept as default/fallback).
