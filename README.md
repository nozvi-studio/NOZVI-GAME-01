# Nozvi

A rebuild of the Mirror puzzle game, following the design and architecture specification approved on 2026-09-30. Built with Phaser 3, TypeScript and Vite, and packaged for Android with Capacitor.

> **Proprietary software.** Copyright (c) 2026 Nozvi. All rights reserved. The source code and assets are the exclusive property of the organization; see [LICENSE](LICENSE). Third-party components are listed in [NOTICE.md](NOTICE.md).

## Requirements

- **Node.js:** `v24.13.1`
- **npm:** `11.13.0`
- **Java SDK:** `22.0.1`
- **Android SDK:** `compileSdkVersion 36`, `targetSdkVersion 36`, `minSdkVersion 24`

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Vite dev server (also serves the dev tools below) |
| `npm test` | Run the full Vitest suite |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run build` | Type-check and bundle the web build into `dist/` |
| `npm run build:release` | Validate content with the release gate, then build |
| `npm run content:validate` | Validate the schema and data of every campaign level |
| `npm run content:author -- <id...> \| --all` | Generate `src/content/levels/<id>.json` from `src/content/sources/<id>.ts`, plus a preview `docs/testing/levels/<id>.svg` and a solver report `<id>-report.md` |
| `npm run content:new -- <id> [--from <source-id>] [--title "<name>"]` | Create `src/content/sources/<id>.ts` by cloning an existing level (or `_template.ts`) and register it in `sources/index.ts`; see `docs/content/level-kit.md` |
| `npm run content:promote` | Promote a Studio level into the campaign content |
| `npm run content:gallery` | Render the level-kit gallery into `docs/content/kit` |
| `npm run audio:author` | Render the sound effects to listening copies in `docs/testing/audio` |
| `npm run android:sync` | Build the web bundle and sync it into the Capacitor Android project |
| `npm run android:setup` | Locate the Android SDK and write the git-ignored `android/local.properties` if `ANDROID_HOME` is not set |
| `npm run android:build` | Setup + sync + build the Android debug APK (works on a fresh clone) |
| `cmd /c .\gradlew.bat assembleDebug` (inside `android/`) | Build the debug APK directly; needs `android:setup` or `ANDROID_HOME` first |

## Project layout

```
src/
  domain/           Pure game rules and models (no rendering)
  application/      Play controller, tutorial, FTUE, telemetry, progress port
  content/          Level sources, generated level JSON, catalog, solver, validation
  presentation/     Phaser rendering and UI
    scenes/         Loading, menu, level-select, play and background scenes
    board/          Board renderer, pieces, layout, drag and snap helpers
    galaxy/         Campaign map: constellations, galaxy themes and artwork
    sky/            Sky backdrop, star field and mood
    hud/            HUD, time bar, hints and result card model
    tutorial/       Tutorial coach and gesture icons
    dialogs/        Pause, settings and language dialogs
    audio/          Audio services, tracks and UI cues
    feedback/       Feedback events, victory sequence, haptics
    menu/           Menu emblems and layout
    transitions/    Scene director, routes and choreography
  engine/           Reusable runtime (see src/engine/ENGINE.md)
    core/           Platform, audio, synth, boot, viewport, transitions, localization engine
  infrastructure/   Audio, haptics, progress storage and lifecycle adapters
  localization/     Locale resolution and manager
  locales/          Translation files (en-US, es, pt-BR, fr, de, ja, ko, zh-CN, id, vi)
  studio/           In-browser level editor (Studio)
  devtools/         Developer tools such as the Audio Lab
scripts/
  content/          Level authoring, validation and promotion CLIs
  audio/            Audio rendering CLI
  checks/           Browser-based boot and galaxy checks (Playwright)
  assets/           Asset extraction scripts
  dev/              Developer helpers such as `shoot-level.sh`
  studio/           Vite plugin and capture script for Studio
tools/
  studio.html       Level Studio entry (dev server only)
  audiolab.html     Audio Lab entry (dev server only)
  experiments/      Endless-mode level generation experiments
tests/              Vitest suites, fixtures and helpers
docs/               Content guides and generated test artifacts
android/            Capacitor Android project
public/             Static assets
```

## Dev tools

With `npm run dev` running:

- Level Studio: `http://localhost:5173/tools/studio.html`
- Audio Lab: `http://localhost:5173/tools/audiolab.html`

Both are served only by the dev server and are not part of the production build.

## Architecture notes

### Scene transitions

Every scene change goes through `director.go(...)` in `src/presentation/transitions/SceneDirector.ts`. Do not call `scene.start` directly; the `sceneStartGate` test enforces this. Each scene implements `playIn` / `playOut`, and the step table for each route lives in `transitions/routes.ts`. The sky belongs to `BackgroundScene`.

### In-level feedback

A piece is a `PieceView` (its texture is drawn once in `PieceTextureCache`, one piece per frame). `BoardRenderer.tick()` runs every frame from `PlayScene.update`. Every player command goes through `feedbackEvents()` and then `FeedbackDirector.handle()`. Durations are defined in `FEEDBACK_TOKENS` and `VICTORY_TOKENS` in `src/presentation/designTokens.ts`.
