# Engine

Reusable runtime for puzzle games of the Mirror family. To start a new game, copy `src/engine/` and `tests/engine/` into it.

Engine version: 0.1.0 (`core` only; `puzzle` arrives in phase 2). Bump it when an extension point changes, and write the new number in the copying game's changelog so drift between copies stays visible.

## Layers

    game  ->  engine/puzzle  ->  engine/core

Imports only go left to right. `tests/engineBoundary.test.ts` fails on a violation: `core` may import nothing outside `src/engine/core`; `puzzle` only `core` and itself.

## What is in `core`

| Folder | Contents |
| --- | --- |
| `platform/` | `createPlatformServices` and the ads / crash / analytics ports, the AdMob driver, lifecycle, safe storage, haptics |
| `audio/` | `createMusic`, `createSfx`, the synth driver and the browser environment. Ids are plain strings |
| `audio-synth/` | The procedural sound synthesizer (see its README) |
| `boot/` | `bootGate`, font URL, loading progress |
| `viewport/` | Viewport maths, design viewport, CJK wrapping |
| `transitions/` | Easing and the motion-scale switch, `TransitionTimeline`, the generic `SceneDirector` and `PhaserSceneHost` |
| `localization/` | `Localization` (state machine) and `interpolate` |
| `levelClock.ts` | Level timer |

## Extension points

- **Scene transitions:** build a `DirectorConfig<K, R, M>` (route to sky mood, boot route, track chooser, timings) and create `new SceneDirector(config)`. Subclass `PhaserSceneHost` with the key of your sky scene. See `src/presentation/transitions/director.ts`.
- **Localization:** `new Localization(bundles, fallbackLocale, initialLocale, persist)`. Keep the accessors your game needs in a wrapper, as `src/localization/LocalizationManager.ts` does.
- **Audio:** pass your own track URLs to `createMusic` and your own buffers to `synthSfxDriver`. The engine does not know your track or sfx names.
- **Platform:** `createPlatformServices({ ads, crash })`; a missing driver is a no-op.

## Not in the engine (stays in each game)

Progress storage (it depends on star ratings and the campaign manifest), the track list, the sfx patches, design tokens, scene classes, content, locales, and all tooling (Studio, solver, validate, Audio Lab).

## Constants a new game changes

In `src/engine/core/viewport/viewport.ts`, `DESIGN_WIDTH = 720` and `DESIGN_HEIGHT = 1280` define Mirror's design size. `designViewport.ts` imports `DESIGN_WIDTH`; change these constants for a new game's design size.

## Copy into a new game

1. Copy `src/engine/` and `tests/engine/`, plus `tests/engineBoundary.test.ts`, `tests/helpers/importBoundary.ts` and `scripts/dev/move-files.ts`.
2. Define your scene keys, route ids and sky moods; write your `DirectorConfig` and a `director.ts` like Mirror's.
3. Write your `LocalizationManager` wrapper over `Localization`.
4. Wire `createPlatformServices`, `createMusic` and `createSfx` in your `main.ts`.
5. Run `npm run typecheck` and `npm test`.
