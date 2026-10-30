# Engine extraction — design

Status: approved in brainstorming 2026-10-30, pending written-spec review.

## Goal

Split the reusable part of Nozvi into an engine so the next puzzle game of the same family (board, pieces, chapters, level map) can start from it instead of from a copy-and-edit of the whole repo.

## Decisions

| Question | Decision |
| --- | --- |
| What kind of games reuse it | Puzzle games like Mirror. The engine includes the game shell **and** the reusable gameplay |
| How it is packaged | A folder inside this repo, `src/engine/`. A new game copies the folder. No monorepo, no npm package |
| Tooling (Studio, solver, validate, `content:*`, Audio Lab) | Stays in Nozvi. Out of scope |
| Approach | Two layers, done in phases, each phase leaves tests green |

## Layout and dependency rule

```
game (Nozvi)  →  engine/puzzle  →  engine/core
```

Imports only go left to right. A test, `engineBoundary` (same style as `sceneStartGate`), scans imports and fails on a violation. Only `src/main.ts` and the game folders may wire the layers together.

| Zone | Contents |
| --- | --- |
| `engine/core` | Platform services and the ads / crash / analytics ports; Capacitor, AdMob and Sentry adapters; `safeStorage`, `lifecycle`, haptics, `music` / `sfx`, `audio-synth`; `LocalizationManager` and `LocaleResolver`; `SceneDirector`, `TransitionTimeline`, `motion`, `viewport`, `cjkWrap`; `bootGate`, boot helpers; `levelClock`, `telemetry`, progress and platform ports |
| `engine/puzzle` | Domain: `model`, `geometry`, `mask`, `session`, `freePlacement`, `linkedRotation`, `hintPlacement`, `targetMatch`, `starRating`. Application: `playController`, `drag`, `tutorial`, `ftue`. Presentation: `board/*`, `hud/*`, `tutorial/*`, `FeedbackDirector`, `victorySequence`. The `LevelDocument` type |
| game (Nozvi) | `content/*` (levels, chapters, catalog, manifest), `campaign`, `cosmicFacts`, `locales/*`, `galaxy`, `sky`, `menu`, Menu / LevelSelect / Loading / Background scenes, `routes.ts`, `launchParams`, `main.ts`, Mirror values of `designTokens`, plus all tooling |

The zone of each file is judged from its name and the coupling survey, not from reading every file. Any file found in the wrong zone while moving it is moved to the right one and noted in `STATUS.md`.

## Extension points

Two existing idioms are reused: services in the Phaser registry (like `ADS_REGISTRY_KEY`, `AUDIO_REGISTRY_KEY`) and boot-time `configureX()` calls (like `setMotionScale`). No new injection mechanism.

**`engine/core`**
- `SceneDirector` becomes generic over `SceneKey`. The route table (`routes.ts`) is passed in by the game.
- `launchParams` moves to the game. Core keeps only a generic `LaunchTarget` type.
- Localization takes `{ locales, fallback }` from the game. It no longer imports `content` or `infrastructure`.
- Tokens: core owns the structure and defaults; the game calls `configureTokens(overrides)`. A new game never edits its copy of the engine to change values.

**`engine/puzzle`**
- `Chapter` (1..5) becomes `ChapterId = number`. Nozvi narrows it in game code. Rotation rules must read level fields (`rotationEnabled`, `drives`), not the chapter number; verified in phase 2.
- Grid 128×160 is set once with `configurePuzzle({ grid })` at boot, not threaded through every function (18 files use the constants; one game per app). Trade-off: two grid sizes cannot coexist in one process; tests need a reset function.
- The five `ShapeKind`s stay as the built-in shape set. A game needing a new shape adds it to the engine. `color: 'amber'` widens to a palette key (`string`).
- Hit-test geometry in `board/layout.ts` (`pieceHitbox`, `pointNearPolygon`, `LayoutMetrics`, origin helpers) moves to `puzzle/geometry`. This removes the 4 imports by which `application` reaches into `presentation`.
- `PlayScene` stays in the engine. Its Mirror-specific imports (`campaign`, `catalog`, `endlessCatalog`, `manifest`, `sky`, `adsServices`) become `PlayHooks` registered through the registry: `resolveLevel(launch)`, `nextLevel`, `onComplete(result)`, `backdrop`, `victoryExtras`, `ads`.
- `TextureFactory` (705 lines) is split: generic textures stay, galaxy / constellation textures move to the game and register through `registerTextures`. The exact split is fixed in the implementation plan after reading the file.

## Phases

**Phase 0 — prepare (no behaviour change).** Record the baseline: passing test count, `typecheck`, `content:validate`, bundle size. Add `engineBoundary` in permissive mode with an explicit exception list that shrinks to zero. Move files with `git mv` to keep history.

**Phase 1 — `engine/core`.**
1. Move the already-clean modules: `audio-synth`, `safeStorage`, `lifecycle`, haptics, platform adapters, `viewport`, `cjkWrap`, `bootGate`.
2. Make `SceneDirector` generic; move the route table to the game.
3. Remove the reverse imports in localization; inject `{ locales, fallback }`.
4. Add `configureTokens`; split `designTokens`.
5. Make `engineBoundary` strict for `core`.

**Phase 2 — `engine/puzzle`.**
1. Spike: count the real call sites of the grid constants and `Chapter`. Stop and report if the result exceeds the estimate above.
2. Move geometry out of `board/layout.ts` into `puzzle/geometry`.
3. Move `domain`, the puzzle `application` files, `board`, `hud`, `tutorial`, `feedback`.
4. Add `configurePuzzle`; widen `ChapterId` and `color`.
5. Split `PlayScene` into engine + `PlayHooks`; split `TextureFactory`.
6. Make `engineBoundary` strict for `puzzle`.

## Verification

- Every small step ends with `npm run typecheck` and `npm test`; steps that touch levels also run `npm run content:validate`. One step per commit.
- Existing tests are the behaviour safety net (`boardRenderer*`, `playController`, `choreography`, `sceneStartGate`, ...). They move with the zone of the file they cover and change **only their import paths**. A test that needs a logic change means behaviour changed: stop and report.
- New tests: `engineBoundary`; `configurePuzzle` (set then reset); `PlayScene` driven by fake `PlayHooks`.
- End of each phase: `npm run build` and a manual run in the dev server (play one level, reach the win screen, open Pause). Bundle size stays near the baseline.
- Scripts run with `node --experimental-strip-types` (`content:*`, `audio:author`) import from `src/` directly; re-run them after every path change.

## Documentation

- `src/engine/ENGINE.md`: engine version, the two-layer diagram, the extension points (`configureTokens`, `configurePuzzle`, `PlayHooks`, route table, locales), the "copy into a new game" steps and a checklist for wiring a new game in `main.ts`.
- Update `CLAUDE.md` (architecture section, hard rules: add the engine boundary), `README.md` (layout), `STATUS.md`, `CHANGELOG.md`.

## Out of scope

Extracting the tooling (Studio, solver, validate), a monorepo or npm package, new shapes, and any gameplay or visual change.

## Risks

- `PlayScene` (964 lines, ~50 imports) and the grid constants are the hardest parts; both are in phase 2 and gated by the spike.
- Copies of `src/engine/` in other games will drift. Mitigation: the version in `ENGINE.md`, and extension points so a game does not need to edit its copy.
- Work branch is cut from `release/v1.0.0`; the Sentry branch work is parked and untouched.
