# CLAUDE.md — Nozvi

A rebuild of the Mirror puzzle game: Phaser 3 + TypeScript + Vite, packaged for Android with Capacitor. Proprietary source code (see `LICENSE`, `NOTICE.md`).

> Read in this order: this file → `AGENT.md` (agent/task menu) → `STATUS.md` (current state) → `CHANGELOG.md` (history). Full commands and layout are in `README.md`.

## Common commands

| Task | Command |
| --- | --- |
| Run dev server (includes Studio, Audio Lab) | `npm run dev` |
| Run all tests / only changed | `npm test` / `npm run test:changed` |
| Type-check | `npm run typecheck` |
| Validate level data | `npm run content:validate` |
| Build web / release | `npm run build` / `npm run build:release` |
| Sync Android | `npm run android:sync` |

Environment: Node `>=24.13.1 <25`, npm 11.13.0.

## Architecture (layered, dependencies point one way)

`domain` (pure rules, no rendering) → `application` (controller, tutorial, FTUE, telemetry) → `presentation` (Phaser: scenes, board, hud, dialogs, ...). `infrastructure` holds adapters (audio, haptics, progress storage). `content` holds levels, solver and validation. `localization` + `locales` handle i18n.

## Hard rules (enforced by tests)

- Scene changes go **only** through `director.go(...)` (`src/presentation/transitions/SceneDirector.ts`); never call `scene.start` directly (`sceneStartGate` test).
- Every player command goes through `feedbackEvents()` → `FeedbackDirector.handle()`; durations come from `FEEDBACK_TOKENS` / `VICTORY_TOKENS` in `src/presentation/designTokens.ts`.
- Levels: edit `src/content/sources/<id>.ts`, then run `content:author`; never hand-edit the generated JSON in `src/content/levels/`.
- Current locales: en-US, es, pt-BR, fr, de, ja, ko, zh-CN, id, vi (`src/locales/`; `en` is an alias of `en-US`). A new locale needs: a `src/locales/<code>/` folder, an entry in `types.ts`, `localizationConfig.ts`, `LocaleResolver.ts`, `LocalizationManager.ts`, and the locale lists in the tests.

## Workflow

- Branches: cut from `release/v1.0.0`; the branch for the current work is `feature/ai-onboarding-memory-agent-i18n`.
- Before declaring work done: run `npm run typecheck` and `npm test`; if levels were touched, also `npm run content:validate`.
- After every significant change: update `STATUS.md` and `CHANGELOG.md` (see `AGENT.md` → Memory / Log).
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
