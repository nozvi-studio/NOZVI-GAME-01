# STATUS

> The *current* state of the project. Overwrite when things change; history lives in `CHANGELOG.md`.
> Last updated: 2026-10-29

## Branches
- Now: `chore/code-cleanup` (cut from `release/v1.0.0`, 2026-10-29, merged into local `release/v1.0.0`, not pushed): removed dead chapter-one FX in `LevelSelectScene`, fixed the `ethereal:ripple` listener leak in `BackgroundScene`, removed unreferenced `studio.svg`. `TextureFactory.generateAll` checked: every texture is guarded by `exists`, so repeat calls are cheap and need no change. Not done: unused `piece` imports in `src/content/sources/3-11..3-20` (generated files, fix in the author template), unused vars in a few tests and `tools/experiments`, scan of unused dependencies and `experiments/`; `public/icon.svg` unreferenced, kept as icon source.
- Before it: `perf/phaser-ui-load` (cut from `release/v1.0.0`, 2026-10-29): fix the lag on Menu to Level Select on weak devices. Done: galaxy artwork loads lazily per theme, the level map intro plays once per session, the piece sheen was made cheap (see CHANGELOG). Open question: should the intro-seen flag survive restarts (storage) instead of once per launch? Next: measure on the weak device (CPU throttle in the dev server), then lower SVG raster size for soft layers (check sharpness; map art shows at 920-1500 design units), spread `buildConstellation` over frames.
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

- [ ] `feature/ethereal-ui` perf pass (merged into local `release/v1.0.0` with `feature/admob-ads`, 2026-10-29, not pushed): parallax stars baked to textures; typecheck + tests pass, but frame rate not yet measured on laptop/Android. Possible next step: consider lower density on low-end devices.
- [x] Localization release checklist (LOC-01..05) on `feature/release-checklist-localization`: see `docs/testing/release-checklist-localization.md`. Scope locked; device evidence not collected yet. LOC-05 is N/A (no IAP). Chapter 2 Endless gate removed; chapters 4/5 "Coming soon" kept pending the leader.

- [x] Compliance checklist (COMP-01..05): see `docs/testing/release-checklist-compliance.md`. Blocker: no Privacy Policy / Terms link or URL yet (COMP-01). COMP-03 and COMP-05 are N/A (no IAP, no accounts).

- [x] Gameplay checklist (GAME-01..04): see `docs/testing/release-checklist-gameplay.md`. No lose state or currency reward in the game (confirm with the leader); no network code, so GAME-03 is N/A; device evidence still to collect.

- [ ] Monetization checklist (MON-01..06): see `docs/testing/release-checklist-monetization.md`. No ads/IAP/analytics SDK, so MON-01..05 are N/A; MON-06 (analytics events) left open for the owner.

## Next steps
- Ads (AdMob, banner + privacy row + stuck hint done, test ads only; branch `feature/admob-ads`, worktree `../NOZVI-GAME-01-ads`): create the AdMob account/app, real App ID + banner/rewarded unit IDs, UMP message in Privacy & messaging, Privacy Policy URL (COMP-01), Data Safety + "Contains ads" in Play Console. Privacy settings row in Settings is done (hidden outside EEA/UK; check it on a device with UMP debug geography EEA). The stuck hint (rewarded ad) is built and checked in the dev server with the headless browser; still to check on a device with real test ads: the `?` button spot (top right, where the retired eye button was), the ad actually starting from Watch, and the clock staying paused through the ad. Hint on linked-rotation levels (chapter 3) puts a piece straight onto its turns without rotating its group, so rotating a driver afterwards turns the driven piece away; judge on device. The banner overlays the bottom of the level map; check on device. `npm run android:build` calls `gradlew` without `.` and fails on Windows; run `gradlew.bat assembleDebug` in `android/`.
- Crash reporting (`feature/sentry-crash-reporting`): Sentry web driver is in; needs a DSN in `.env.local` to verify end to end with `__crashTest` (not yet verified against real Sentry). Still to do: CrazyGames SDK driver, `@sentry/capacitor` for Android/iOS, source maps upload (builds ship none, so stacks are minified), check CrazyGames' rules on outbound requests, update Privacy Policy / Data Safety (COMP-01).
- Remaining unused params left on purpose: `Hud` `title`, `endlessCatalog` `chapter`.
- Have a native speaker review the machine-drafted es, fr, de, ko, zh-CN strings.
- Check CJK glyph rendering on device (ja/ko/zh-CN rely on system fonts; no CJK webfont is bundled). The font stack now follows the active locale (`setFontLocale`).

## Blockers / open questions
- Android package rename (`com.nozvi.mirror`) compiles: `gradlew assembleDebug` passed on 2026-10-22. On a fresh machine run `npm run android:setup` (or set `ANDROID_HOME`) first; `local.properties` is git-ignored.
- None. `en` from the system list is treated as an alias of `en-US` (kept as default/fallback).
