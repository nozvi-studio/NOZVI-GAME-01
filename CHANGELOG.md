# CHANGELOG

Change history following [Keep a Changelog](https://keepachangelog.com/). Only add new entries; never edit old ones.

## [Unreleased]

### Removed (cleanup)
- `LevelSelectScene`: the unused chapter-one FX (`chapterOneFx`, `addChapterOneFx`, `updateChapterOneFx`); chapter atmosphere now lives only in `chapterAtmosphereFx`.
- `public/assets/studio.svg`: an old logo that nothing referenced. `public/icon.svg` is also unreferenced but kept (likely the source for the PNG icons).

### Fixed (cleanup)
- `BackgroundScene` now removes its `ethereal:ripple` listener from `game.events` on shutdown, so a scene restart no longer stacks a second listener.

### Changed (performance, level map intro)
- The level map plays its arrival animations (galaxy fade-ins and layer intros, chapter title cards) only on the first visit of a session (`galaxy/mapIntroSeen.ts`, in memory, so it resets on each launch). Later visits show the artwork at rest: `addGalaxyArtwork(..., skipIntro)` / `GalaxyLayerHost.skipIntro` skip the layer tweens, title cards never play, and art slots fill after 200 ms instead of 600 ms. Textures stay in Phaser's texture manager, so nothing is loaded again either. `tests/mapIntroSeen.test.ts`. Not yet measured on a weak device.

### Added (gameplay tilt)
- `PlayTiltMotes` (`sky/PlayTiltMotes.ts`): 10 very faint motes (one shared soft-dot texture) between the sky and the board in `PlayScene`, leaning with `deviceTilt` (gyroscope on device, mouse on desktop) by up to 7 design units, with a slow bob and twinkle. Board, tray and pieces never move, so drag hit-testing is unchanged. Still at rest under reduced motion. The shared sky already followed the tilt in play.
- Glass pieces catch a soft streak of light that slides across them as the device tilts (`board/pieceSheen.ts`). Each (piece x turn) bakes a strip of 7 frames of the streak clipped to the piece outline (`PieceTextureKeys.sheen`, optional) at half the silhouette size; `PieceView` swaps the frame from `deviceTilt`, alpha 0.08 at rest up to 0.3 leaning. Made cheap after it stuttered: normal blend (an ADD image between normal ones split the batch once per piece), strips bake lazily one per frame only when the piece queue is empty (`PieceTextureCache.sheenQueue`, never inside `ensure`, so turning a piece no longer bakes), and a quarter of the earlier pixels. Only the pieces shine; the board and tray frames and drags are untouched. Not yet measured on a weak device.

### Changed (performance, level select)
- `LevelSelectScene` no longer loads every galaxy theme in `preload` (5 themes, 23 SVGs rasterised at 1024 px, about 90 MB of textures, all at the moment of the Menu to map transition, which froze weak devices). Each artwork place is now an empty slot container and `fillArtSlots` loads one theme at a time in the background (starting 600 ms after the scene is up, 150 ms apart) and fills its slots. A slot that scrolled into view before its theme was ready plays its arrival once filled. Not yet measured on a weak device.

### Added (ads)
- Google AdMob via `@capacitor-community/admob` 8.2.1 (Android only; web and tests stay no-op). `AdsPort` in `application/platformPort.ts` (`init`, `showBanner`, `hideBanner`, `showRewarded`, `privacyOptionsRequired`, `showPrivacyOptions`), `createAds` in `infrastructure/platformServices.ts` swallows driver errors, `infrastructure/admobDriver.ts` runs the UMP consent flow before SDK init and only requests ads when UMP allows it.
- Banner at the bottom of the level map (`LevelSelectScene` shows it on create, hides it on shutdown). Rewarded is used by the stuck hint below.
- Test ads by default. Real ads need `VITE_ADMOB_USE_TEST_ADS=false` plus `VITE_ADMOB_BANNER_ID` and `VITE_ADMOB_REWARDED_ID`; missing IDs turn ads off instead of falling back to test ads. Manifest App ID comes from `-PADMOB_APP_ID` (default: Google test App ID).
- Settings: a "Privacy settings" row (`setting_privacy`, all ten locales) that reopens the UMP consent form. It shows only when `AdsPort.privacyOptionsRequired()` is true (EEA/UK), so players can always withdraw consent.
- Stuck hint (rewarded ad): once every star is gone (`timer.stars === 0`, 75 % of the time budget) a `?` button flies in at the top right (`HintButton`, `FEEDBACK_TOKENS.hintButton`). It opens `HintDialog` ("Stuck? Watch a short ad and we will place one piece for you"); the ad starts only after Watch. A completed ad puts one piece on its sample-solution spot (`domain/hintPlacement.ts` `applyHint`, `PlayController.onHint`), clearing wrong pieces that sit on those cells, and plays the normal snap feedback. Early close gives nothing; no ad shows "No ad is available right now" and keeps the button. The level clock stops while the dialog or the ad is open. The button needs `AdsPort.rewardedReady()` (never on web); the dev server shows it and grants the hint without an ad. Strings `hint_title/body/watch/no_ad` in all ten locales.
- `tests/admobDriver.test.ts`, `tests/hintPlacement.test.ts` (hints win every approved campaign level, also with a wrong piece on a target), `tests/playControllerHint.test.ts`, cases in `tests/dialogsInput.test.ts`.

### Changed (performance)
- Ethereal parallax star layers are baked into textures once (`sky/parallaxStars.ts`) instead of Phaser `Graphics` with hundreds or thousands of `fillCircle` calls, which were re-triangulated (earcut) every frame: menu deep/mid layers are Images, the level map deep layer is a repeating `TileSprite` tile (was 360 circles per 2048 px of map height).
- `SkyBackdrop` twinkling stars are 30 tinted sprites with per-frame alpha (was a Graphics cleared and refilled each frame, parsing hex colours per star); the ripple layer is only redrawn while ripples exist.
- Menu ambient motes are sprites sharing one soft-dot texture (were 14 Graphics).

### Added (visuals & interactions)
- Ethereal Observatory theme & interaction upgrade (Direction 2):
  - 3-layer parallax sky in `SkyBackdrop` (deep cosmos tile layer + midfield + twinkling stars) with subtle pointer parallax response.
  - Dedicated discrete 3-layer dynamic parallax containers on `MenuScene` and `LevelSelectScene`:
    - Deepest background starfield (`deepStarsContainer` / `mapDeepStarsContainer`): 160-360 tiny, rich-tinted stars (amber, star sapphire, young star magenta, starlight) sweeping fastest at `tilt * 46px` to produce unmistakable celestial depth.
    - Middle celestial layer (`midStarsContainer` & `galaxy` / `mapMidStarsContainer` & `galaxyLayers`): glowing mid-tier stars, nebulae, and chapter galaxy artwork drifting at medium speed (`tilt * 20px`).
    - Outermost foreground layer (`emblem` & motes / constellation nodes, lines & chapter cards): subtle, grounded anchor (`tilt * 6px` counter-drift) keeping tactile UI solid.
    - Cleaned static stars previously baked into `galaxyGradient` and `galaxyMapGradient` canvases, ensuring every star on screen is dynamically responsive to tilt/motion.
  - Calibrated 3-layer Parallax speeds per user feedback: outermost foreground (emblems/UI) moves slowest (0.25x), middle layer (main stars & galaxy art) moves at medium speed (0.75x), and deepest background layer (tiny rich-tinted stars) sweeps fastest (1.35x).
  - Soft luminous starlight aura ripples (`ethereal:ripple`) on touch/click across BackgroundScene, MenuScene, LevelSelectScene, and PauseDialog.
  - Ambient orbiting starlight motes and interactive touch resonance for the MenuScene hero emblem.
  - Chapter-specific atmosphere effects (sparkling stars, meteors, tinted dust) across all chapters in `LevelSelectScene`.
  - Celestial snap resonance: snapping a piece on target triggers background starlight ripple (`FeedbackDirector`).
  - Smooth arrival and exit animations for `PauseDialog` with soft scale & fade easing.

### Fixed
- "X/N pieces matched" counted any piece resting on the board. In free placement every drop snaps to a grid point, so a random drop read as a match (bar, ring, rising bell). It now counts only pieces on their sample-solution placement (`domain/targetMatch.ts`: `isOnTarget`, `matchedPieceCount`; identical pieces may swap, a won level counts all). `PlayViewSnapshot.snappedCount` is now `matchedCount`.
- With Sound Effects off, the level music no longer ducks when a level is won: `playVictoryAudio` ducks only if `SfxPort.isEnabled()` (new; false when the setting is off or there is no driver).
- Double tap on a piece (rotation levels): the drop under the second tap no longer sounds together with the turn; only the turn's sound plays (`DoubleTap.wouldComplete`, `FeedbackDirector.handle(..., { silent })`).
- The "Release to snap" label and the magnet ring show only when the dragged piece is on its target (`DragUpdate.onTarget`, `DragInfo.onTarget`).

### Changed
- Feedback: a `snap` event carries `onTarget`, `x`, `y`. Off target the piece just glides in (no bounce, light, ring or counter pop).
- Star rating: `THREE_STAR_PAR_RATIO` 1.25 to 1.125, so every level's time budget and star windows are 10% tighter (no level data touched; `parMs` unchanged).
- Star rating: on top of the 10% above, levels with up to 3 pieces are tightened another 10% and levels with 4+ pieces another 5% (`threeStarRatio(pieceCount)`; `timeBudget` and `parInfo` now take the piece count).

### Changed (audio)
- Piece sounds are one instrument, a kalimba, and each piece has its own note (`PIECE_NOTES`, a D major triad then up; `pieceSemitones`). Lift: a light touch of the note. Set down short of the target (or dropped without snapping): the same note, short. On target: the note rings (`kalimba-ring`) and a soft echo of it follows, two notes in all. Handed back to the tray: the note an octave down. Victory (`victoryCues`): the level's piece notes run up, then the root chord (root, fifth, octave) rolls out. This replaces the bell that rose with the match count, the separate `stinger-win` in play (the patch stays for the Audio Lab and `bell` for UI cues) and the `tick` on lift.
- Level music (`music-stele`) plays at half level (`AUDIO_TOKENS.trackLevel`, new optional `MusicOptions.trackLevel`) so the move sounds stand out; menu and map music are unchanged.
- `AUDIO_TOKENS.maxVoices` 6 to 12: ringing notes and the victory run overlap.

### Added
- Sentry tags and source maps: every event carries `platform` and `native` (set at init) and `level`, `chapter`, `mode` (set by `LevelTracker.start`, plus a `level_start` breadcrumb). `vite.config.ts` now uses `@sentry/vite-plugin` (dev dependency): only when `SENTRY_AUTH_TOKEN` is set in the shell (with `SENTRY_ORG`, `SENTRY_PROJECT`) it builds hidden source maps, uploads them under release `package.json` version and deletes every `.map` from `dist`, so the APK and web bundle still ship none. Without the token nothing changes. A failed upload does not fail the build.
- GameAnalytics driver (`infrastructure/gameAnalyticsDriver.ts`, `gameAnalyticsSdk.ts`, `analyticsSetup.ts`): `level_start`, `level_complete` and `level_abandon` go out as progression events (`chapter<N>` / level id; `Complete` carries the stars as score, `Fail` is used for an abandoned level) plus design events `Complete:Moves:<levelId>`, `Complete:Resets:<levelId>` and `Abandon:<levelId>`. Active only in the native Android app and only with both `VITE_GA_GAME_KEY` and `VITE_GA_SECRET_KEY` set; the SDK (`gameanalytics` 5.0.0) is a separate chunk loaded only after consent, and is never loaded when the keys are unset. The SDK drops events sent before its session starts, so it is initialised right after consent (`warmUp`) and the driver waits for `isSdkReady` (up to 10 s) before sending. SDK or network failures never reach the game.
- Placeholder analytics consent (`infrastructure/analyticsConsent.ts`, `presentation/consent/consentGate.ts`): when GameAnalytics is active the game shows one question with an **Đồng ý** button on first launch and does not start until the player agrees; the choice is stored. Final UI, wording and localisation are still to do.
- Level tracking: `LevelTracker` (`application/levelTracker.ts`) counts moves, rotations and resets in memory and sends only `level_start`, `level_complete` (time, stars, counts) and `level_abandon` (time, counts, reason) through `AnalyticsPort`, so the 100-event queue never drops `level_start`. One closing event per run; a second `start` closes the previous run as abandoned. Campaign and endless are tracked (endless ids are `endless-<chapter>-<number>` because pool ids repeat); harness runs are not. `main.ts` registers the tracker in the Phaser registry (`presentation/levelTracking.ts`) and reports `app-exit` on `pagehide`. `TelemetryEvent` gained `chapter`, `mode`, `moveCount`, `rotateCount` and the `level_abandon` type. No driver yet, so nothing is sent.
- Sentry crash reporting (web), opt-in: set `VITE_SENTRY_DSN` in `.env.local` (git-ignored). Without it nothing is bundled or sent. `@sentry/browser` loads through a dynamic `import()` into its own chunk and initialises in the background (`initInBackground`, 8 s timeout), so a blocked or hung SDK never delays boot. Sentry's own GlobalHandlers are off; errors go through `installGlobalErrorHandlers` once. `sendDefaultPii` is off.
- Crash reporter guards: max 10 reports and 100 breadcrumbs per 60 s, duplicate reports dropped, re-entrant `capture` blocked. Analytics `track` only queues (max 100, flushed in batches after 2 s, and on `pagehide`).
- Dev-only crash test: `window.__crashTest('capture' | 'throw' | 'reject')` (not in release builds).
- Sounds `kalimba` (short) and `kalimba-ring` (about 3.5 s) in `content/audio/sources/`; cue tokens `place`, `victoryNote`, `victoryEnd`, `victoryStepMs`, `victoryChordGapMs`, `echo`, `echoDelayMs`.
- Pause dialog: Background Music and Sound Effects switches under the title (same settings as the Settings dialog); Resume stands alone and Restart / Level Select share one row. The Language picker is also in Pause (`onLanguageChange`). Hidden when `audio` is not passed.
- Tutorial 1-1: a new first step (now 3 steps) that spotlights the time bar and stars with a pulsing frame; tap the card to continue. The clock starts on the first press, so reading it costs no time. New keys `tutorial_time_title/body/chip` in all ten locales; `tutorial_drag_body` is back to its original text.
- `PlatformServices` seam (`application/platformPort.ts`, `infrastructure/platformServices.ts`): `CrashReporterPort` and `AnalyticsPort` with no-op defaults; driver errors are swallowed so an external SDK (Sentry, CrazyGames, Firebase) can never break the game. `main.ts` routes `error` / `unhandledrejection` through it (still logged to console).
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
- Dead code: `trayScale`, the `getMenuTagline` wrapper and `LEVEL_TITLES_EN`; unused imports, locals and private fields in `src/`, `tests/` (e.g. `CHAPTER_TINTS`, `LoadingScene.factLabel`, `MenuScene.viewHeight`); no behavior change.
- Chapter 2 Endless gate on the level map (unfinished, no endless pool): `ENDLESS_UNLOCK_LEVEL` is now `{ 1: '1-10' }` and `endlessGateRules` tests updated.
- Unused legacy `CHAPTER_NAMES` table in `src/presentation/i18n.ts` (chapter names come from `LocalizationManager`).

## [1.0.0]

### Added
- Initial import of the Nozvi game (Phaser 3, TypeScript, Vite, Capacitor Android).
