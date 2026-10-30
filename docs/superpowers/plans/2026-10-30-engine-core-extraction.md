# Engine extraction, phases 0 and 1 (`engine/core`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the game-independent runtime of Nozvi into `src/engine/core/`, guarded by an import-boundary test, without changing any game behaviour.

**Architecture:** Files enter `src/engine/core/` only after they no longer import anything Mirror-specific, so the boundary test is strict from the first commit. A small tool (`scripts/dev/move-files.ts`) does `git mv` and rewrites every import, so each move is mechanical. The three modules that still know Mirror (`SceneDirector`, `LocalizationManager`, `music`/`sfx`) are decoupled first, then moved; the game keeps thin wrappers with the same public API.

**Tech Stack:** TypeScript 5.7, Vitest 2.1, Phaser 3.90, Node 24 (`node --experimental-strip-types` for scripts).

**Spec:** `docs/superpowers/specs/2026-10-30-engine-extraction-design.md` (read the "Amendments" section at its end: it overrides the first draft).

**Scope:** phases 0 and 1 of the spec only. Phase 2 (`engine/puzzle`) gets its own plan after its spike.

## Global Constraints

- Dependency direction: `game -> engine/puzzle -> engine/core`. `src/engine/core/**` imports nothing outside `src/engine/core` (npm packages are fine).
- Existing tests change only their import paths, with two named exceptions: `tests/sceneDirector.test.ts` (the line that builds the director) and `tests/audioSynthPortable.test.ts` (one path string). A test that needs any other change means behaviour changed: stop and report.
- Node `>=24.13.1 <25`, npm 11.13.0. Scripts run with `node --experimental-strip-types`: no `enum`, no constructor parameter properties, no `namespace` in any `.ts` file under `scripts/` or `src/engine/`.
- After every task: `npm run typecheck` and `npm test` pass. One task, one commit. Conventional Commits.
- Every commit message ends with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (pass it as a second `-m`).
- Stage explicit paths only (`git add src tests scripts tools docs`). **Never `git add -A` or `git add .`**: `.env.local` (may hold a DSN) and two half-edited `android/*.gradle` files are untracked or modified in this working tree and must not be committed.
- Work on branch `feature/engine-extraction` (already cut from `release/v1.0.0`).
- Heads-up for later: `platformServices.ts` and `admobDriver.ts` move in Task 4, and the parked branch `feature/sentry-crash-reporting` edits them. Merge this branch into the Sentry branch (not the other way round); git follows the renames.

## File Structure

New or changed files, and what each is for.

| Path | Responsibility |
| --- | --- |
| `scripts/dev/move-files.ts` | `git mv` plus import rewriting (Task 3) |
| `tests/moveFiles.test.ts` | Tests the rewriting function |
| `tests/helpers/importBoundary.ts` | Pure `findEscapes` helper |
| `tests/engineBoundary.test.ts` | Layering rule for `src/engine/core` and `src/engine/puzzle` |
| `src/engine/core/platform/` | `platformServices`, `platformPort`, `telemetry`, `admobDriver`, `lifecycle`, `safeStorage`, `haptics`, `capacitorHaptics` |
| `src/engine/core/audio/` | `music`, `sfx`, `synthSfxDriver`, `browserAudioEnv` (string ids) |
| `src/engine/core/audio-synth/` | The synthesizer, moved whole |
| `src/engine/core/boot/` | `bootGate`, `fontUrl`, `loadingProgress` |
| `src/engine/core/viewport/` | `viewport`, `designViewport`, `cjkWrap` |
| `src/engine/core/levelClock.ts` | Level timer |
| `src/engine/core/transitions/motion.ts` | Easing, `stagger`, motion-scale switch (new, split out of the game's `motion.ts`) |
| `src/engine/core/transitions/TransitionTimeline.ts` | Moved |
| `src/engine/core/transitions/SceneDirector.ts` | Generic director plus `PhaserSceneHost` |
| `src/engine/core/localization/Localization.ts` | Locale state machine and `interpolate` (new) |
| `src/presentation/transitions/director.ts` | Game side: Mirror keys, routes, moods, the `director` instance |
| `src/presentation/transitions/motion.ts` | Keeps `RouteId`, `anticipateOut`, `MOTION_FAMILIES`; re-exports the core functions |
| `src/localization/LocalizationManager.ts` | Same public API, now built on `Localization` |
| `src/engine/ENGINE.md` | Layers, extension points, copy-into-a-new-game steps |
| `tests/engine/core/` | Tests of core modules, moved here |

---

### Task 1: Baseline

**Files:**
- Create: `docs/superpowers/plans/2026-10-30-engine-core-baseline.md`

**Interfaces:**
- Produces: the numbers Task 9 compares against.

- [ ] **Step 1: Run the four checks and keep the output**

```bash
npm run typecheck
npm test
npm run content:validate
npm run build
```

Expected: all four exit 0. Note from the output: the Vitest line `Tests  N passed`, the `Test Files  M passed` line, and the size (raw and gzip) of each file in the `dist/assets` table that `vite build` prints.

- [ ] **Step 2: Write the baseline file**

Create `docs/superpowers/plans/2026-10-30-engine-core-baseline.md` with the real numbers (replace the angle-bracket values with what Step 1 printed; do not commit the angle brackets):

```markdown
# Baseline before engine extraction (release/v1.0.0 at 99dc79c)

- typecheck: pass
- vitest: <N> tests in <M> files, all passing
- content:validate: pass
- build: pass
- bundle (gzip): <list each chunk, e.g. phaser <x> kB, main <y> kB>
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-10-30-engine-core-baseline.md docs/superpowers/specs docs/superpowers/plans/2026-10-30-engine-core-extraction.md
git commit -m "docs: record engine extraction baseline and phase 1 plan" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Import-boundary test

**Files:**
- Create: `tests/helpers/importBoundary.ts`
- Create: `tests/engineBoundary.test.ts`

**Interfaces:**
- Produces: `findEscapes(files: readonly SourceFile[], allowedRoots: readonly string[]): string[]` and `type SourceFile = { path: string; text: string }`. Each returned string is `<file path> -> <specifier>` for a relative import that resolves outside every allowed root.

- [ ] **Step 1: Write the failing test**

Create `tests/engineBoundary.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { findEscapes } from './helpers/importBoundary.ts';
import type { SourceFile } from './helpers/importBoundary.ts';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const CORE = join(SRC, 'engine', 'core');
const PUZZLE = join(SRC, 'engine', 'puzzle');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
  });
}

function load(dir: string): SourceFile[] {
  return walk(dir).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
}

const shown = (offenders: string[]): string[] => offenders.map((line) => line.replaceAll(SRC, '').replaceAll('\\', '/'));

describe('findEscapes', () => {
  const at = (name: string, text: string): SourceFile => ({ path: join(CORE, name), text });

  test('allows imports that stay inside the allowed roots', () => {
    const file = at('a/x.ts', "import { y } from './y.ts';\nimport type { Z } from '../b/z.ts';");
    expect(findEscapes([file], [CORE])).toEqual([]);
  });

  test('flags a static import that leaves the roots', () => {
    const file = at('a/x.ts', "import { t } from '../../../presentation/designTokens.ts';");
    expect(findEscapes([file], [CORE])).toHaveLength(1);
  });

  test('flags export-from, side-effect and dynamic imports too', () => {
    const file = at(
      'a/x.ts',
      [
        "export { q } from '../../../content/q.ts';",
        "import '../../../style.css';",
        "const m = await import('../../../domain/m.ts');",
      ].join('\n')
    );
    expect(findEscapes([file], [CORE])).toHaveLength(3);
  });

  test('ignores bare package specifiers', () => {
    const file = at('a/x.ts', "import Phaser from 'phaser';\nimport { App } from '@capacitor/app';");
    expect(findEscapes([file], [CORE])).toEqual([]);
  });
});

describe('engine layering', () => {
  test('core imports nothing outside engine/core', () => {
    expect(shown(findEscapes(load(CORE), [CORE]))).toEqual([]);
  });

  test('puzzle imports only engine/core and itself', () => {
    expect(shown(findEscapes(load(PUZZLE), [CORE, PUZZLE]))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/engineBoundary.test.ts`
Expected: FAIL, "Failed to resolve import ./helpers/importBoundary.ts".

- [ ] **Step 3: Write the helper**

Create `tests/helpers/importBoundary.ts`:

```ts
import { dirname, resolve, sep } from 'node:path';

export type SourceFile = { path: string; text: string };

/** `from '…'`, `import '…'` and `import('…')` with a relative specifier. */
const RELATIVE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]*)\1/g;

/** Relative imports in `files` that resolve outside every folder in `allowedRoots`. */
export function findEscapes(files: readonly SourceFile[], allowedRoots: readonly string[]): string[] {
  const roots = allowedRoots.map((root) => resolve(root));
  const offenders: string[] = [];
  for (const file of files) {
    for (const match of file.text.matchAll(RELATIVE_IMPORT)) {
      const target = resolve(dirname(file.path), match[2]);
      const inside = roots.some((root) => target === root || target.startsWith(root + sep));
      if (!inside) offenders.push(`${file.path} -> ${match[2]}`);
    }
  }
  return offenders;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/engineBoundary.test.ts`
Expected: PASS, 6 tests. (The two layering tests pass because `src/engine/` does not exist yet.)

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/importBoundary.ts tests/engineBoundary.test.ts
git commit -m "test: add engine boundary test" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The move tool

**Files:**
- Create: `scripts/dev/move-files.ts`
- Create: `tests/moveFiles.test.ts`

**Interfaces:**
- Produces: `rewriteImports(text: string, oldFile: string, newFile: string, moved: ReadonlyMap<string, string>): string`. Paths are repo-relative with `/`. `moved` maps old path to new path. It recomputes every relative specifier for the file's new location and new targets, and rewrites quoted `'/src/...'` strings.
- Produces CLI: `node --experimental-strip-types scripts/dev/move-files.ts [--dry] <from> <to> [<from> <to> ...]`. `from` may be a folder (moved whole). `--dry` prints the move map only.

- [ ] **Step 1: Write the failing test**

Create `tests/moveFiles.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { rewriteImports } from '../scripts/dev/move-files.ts';

const map = (pairs: Array<[string, string]>): ReadonlyMap<string, string> => new Map(pairs);

describe('rewriteImports', () => {
  test('recomputes the imports of a file that moved', () => {
    const text = "import { a } from './a.ts';\nimport b from '../b.ts';";
    const out = rewriteImports(text, 'src/x/f.ts', 'src/engine/core/f.ts', map([['src/x/f.ts', 'src/engine/core/f.ts']]));
    expect(out).toBe("import { a } from '../../x/a.ts';\nimport b from '../../b.ts';");
  });

  test('repoints the importers of a file that moved', () => {
    const out = rewriteImports("import { f } from './f.ts';", 'src/x/g.ts', 'src/x/g.ts', map([['src/x/f.ts', 'src/engine/core/f.ts']]));
    expect(out).toBe("import { f } from '../engine/core/f.ts';");
  });

  test('leaves ./ imports alone when both files move to the same folder', () => {
    const moved = map([
      ['src/x/f.ts', 'src/engine/core/f.ts'],
      ['src/x/g.ts', 'src/engine/core/g.ts'],
    ]);
    const text = "import { g } from './g.ts';";
    expect(rewriteImports(text, 'src/x/f.ts', 'src/engine/core/f.ts', moved)).toBe(text);
  });

  test('handles type imports, export-from, side-effect, dynamic imports and vi.mock', () => {
    const moved = map([['src/x/f.ts', 'src/engine/core/f.ts']]);
    const text = [
      "import type { F } from '../src/x/f.ts';",
      "export { f } from '../src/x/f.ts';",
      "import '../src/x/f.ts';",
      "const m = await import('../src/x/f.ts');",
      "vi.mock('../src/x/f.ts', () => ({}));",
    ].join('\n');
    const out = rewriteImports(text, 'tests/t.test.ts', 'tests/t.test.ts', moved);
    expect(out.split('\n')).toEqual([
      "import type { F } from '../src/engine/core/f.ts';",
      "export { f } from '../src/engine/core/f.ts';",
      "import '../src/engine/core/f.ts';",
      "const m = await import('../src/engine/core/f.ts');",
      "vi.mock('../src/engine/core/f.ts', () => ({}));",
    ]);
  });

  test('rewrites quoted /src/ strings and html src attributes', () => {
    const moved = map([['src/x/f.ts', 'src/engine/core/f.ts']]);
    expect(rewriteImports("await import('/src/x/f.ts')", 'scripts/c.mjs', 'scripts/c.mjs', moved)).toBe(
      "await import('/src/engine/core/f.ts')"
    );
    expect(rewriteImports('<script src="/src/x/f.ts"></script>', 'index.html', 'index.html', moved)).toBe(
      '<script src="/src/engine/core/f.ts"></script>'
    );
  });

  test('leaves bare specifiers and unmoved relative imports untouched', () => {
    const text = "import Phaser from 'phaser';\nimport { k } from './k.ts';";
    expect(rewriteImports(text, 'src/x/f.ts', 'src/x/f.ts', map([['src/y/other.ts', 'src/z/other.ts']]))).toBe(text);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/moveFiles.test.ts`
Expected: FAIL, "Failed to resolve import ../scripts/dev/move-files.ts".

- [ ] **Step 3: Write the tool**

Create `scripts/dev/move-files.ts`:

```ts
/**
 * Moves files with `git mv` and rewrites every relative import, quoted `/src/...`
 * string and html `src=` attribute that pointed at them.
 *
 * Usage: node --experimental-strip-types scripts/dev/move-files.ts [--dry] <from> <to> [<from> <to> ...]
 * `from` may be a file or a folder (moved with its whole tree); `to` is the new path.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { pathToFileURL } from 'node:url';

const SPECIFIER =
  /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bvi\.(?:mock|doMock|unmock)\s*\(\s*)(['"])(\.{1,2}\/[^'"]*)\2/g;
const ROOTED = /(['"])\/(src\/[^'"]+)\1/g;

export function rewriteImports(
  text: string,
  oldFile: string,
  newFile: string,
  moved: ReadonlyMap<string, string>
): string {
  const withRelative = text.replace(SPECIFIER, (whole: string, lead: string, quote: string, spec: string) => {
    const old = posix.join(posix.dirname(oldFile), spec);
    const target = moved.get(old) ?? old;
    let next = posix.relative(posix.dirname(newFile), target);
    if (!next.startsWith('.')) next = `./${next}`;
    return next === spec ? whole : `${lead}${quote}${next}${quote}`;
  });
  return withRelative.replace(ROOTED, (whole: string, quote: string, path: string) => {
    const next = moved.get(path);
    return next ? `${quote}/${next}${quote}` : whole;
  });
}

const SCAN_ROOTS = ['src', 'tests', 'scripts', 'tools'];
const SCAN_FILES = ['index.html', 'vite.config.ts', 'capacitor.config.ts'];
const SCAN_EXT = /\.(ts|mjs|html)$/;

const normalize = (path: string): string => path.replaceAll('\\', '/').replace(/\/+$/, '');

function listFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => listFiles(posix.join(path, name)));
}

function scanFiles(): string[] {
  const inRoots = SCAN_ROOTS.filter((root) => existsSync(root))
    .flatMap((root) => listFiles(root))
    .filter((file) => SCAN_EXT.test(file));
  return [...inRoots, ...SCAN_FILES.filter((file) => existsSync(file))];
}

function main(argv: string[]): void {
  const dry = argv.includes('--dry');
  const args = argv.filter((arg) => arg !== '--dry');
  if (args.length === 0 || args.length % 2 !== 0) {
    console.error('usage: move-files.ts [--dry] <from> <to> [<from> <to> ...]');
    process.exit(1);
  }

  const moved = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const from = normalize(args[i]);
    const to = normalize(args[i + 1]);
    for (const file of listFiles(from)) {
      const target = file === from ? to : posix.join(to, posix.relative(from, file));
      if (existsSync(target)) throw new Error(`destination already exists: ${target}`);
      moved.set(file, target);
    }
  }

  if (dry) {
    for (const [from, to] of moved) console.log(`${from} -> ${to}`);
    return;
  }

  const rewrites: Array<{ to: string; text: string }> = [];
  for (const file of scanFiles()) {
    const text = readFileSync(file, 'utf8');
    const target = moved.get(file) ?? file;
    const next = rewriteImports(text, file, target, moved);
    if (next !== text) rewrites.push({ to: target, text: next });
  }

  for (const [from, to] of moved) {
    mkdirSync(posix.dirname(to), { recursive: true });
    execFileSync('git', ['mv', from, to], { stdio: 'inherit' });
  }
  for (const { to, text } of rewrites) writeFileSync(to, text);
  console.log(`moved ${moved.size} file(s), rewrote ${rewrites.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/moveFiles.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Type-check and preview the CLI**

```bash
npm run typecheck
node --experimental-strip-types scripts/dev/move-files.ts --dry src/boot/fontUrl.ts src/engine/core/boot/fontUrl.ts
```

Expected: typecheck clean; the CLI prints `src/boot/fontUrl.ts -> src/engine/core/boot/fontUrl.ts` and changes nothing (`git status --short` shows only the two new files).

- [ ] **Step 6: Commit**

```bash
git add scripts/dev/move-files.ts tests/moveFiles.test.ts
git commit -m "chore: add move-files tool that rewrites imports" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Move the modules that are already clean

**Files:**
- Move: see the command in Step 1 (16 source entries, `audio-synth` as a whole folder)
- Move: core-only tests into `tests/engine/core/` (Step 5)
- Modify: `tests/audioSynthPortable.test.ts` (one path string)
- Modify: `tests/engineBoundary.test.ts` (one added test)

**Interfaces:**
- Consumes: the move tool from Task 3.
- Produces: the folders `src/engine/core/{platform,boot,viewport,audio-synth}` and `src/engine/core/levelClock.ts`. Later tasks import from these paths.

These files import nothing Mirror-specific (checked by reading their import lists). `progressRepository`, `progressPort`, `cosmicFactRepository`, `playtestRecorder` and `audioManifest` are deliberately not here; see the spec amendments.

- [ ] **Step 1: Preview, then move**

```bash
node --experimental-strip-types scripts/dev/move-files.ts --dry \
  src/audio-synth src/engine/core/audio-synth \
  src/infrastructure/safeStorage.ts src/engine/core/platform/safeStorage.ts \
  src/infrastructure/lifecycle.ts src/engine/core/platform/lifecycle.ts \
  src/infrastructure/haptics.ts src/engine/core/platform/haptics.ts \
  src/infrastructure/capacitorHaptics.ts src/engine/core/platform/capacitorHaptics.ts \
  src/infrastructure/platformServices.ts src/engine/core/platform/platformServices.ts \
  src/infrastructure/admobDriver.ts src/engine/core/platform/admobDriver.ts \
  src/application/platformPort.ts src/engine/core/platform/platformPort.ts \
  src/application/telemetry.ts src/engine/core/platform/telemetry.ts \
  src/application/levelClock.ts src/engine/core/levelClock.ts \
  src/application/loadingProgress.ts src/engine/core/boot/loadingProgress.ts \
  src/boot/bootGate.ts src/engine/core/boot/bootGate.ts \
  src/boot/fontUrl.ts src/engine/core/boot/fontUrl.ts \
  src/presentation/viewport.ts src/engine/core/viewport/viewport.ts \
  src/presentation/designViewport.ts src/engine/core/viewport/designViewport.ts \
  src/presentation/cjkWrap.ts src/engine/core/viewport/cjkWrap.ts
```

Expected: 9 `audio-synth` lines (`dsp`, `normalize`, `patch`, `presets`, `render`, `report`, `wav`, `webaudio`, `README.md`) plus 15 single-file lines. Then run the same command without `--dry`.
Expected output ends with `moved 24 file(s), rewrote <some number>`.

- [ ] **Step 2: Fix the one string path the tool cannot see**

`tests/audioSynthPortable.test.ts` builds the folder path as a string, not an import:

```bash
sed -i "s#'\.\./src/audio-synth/'#'../src/engine/core/audio-synth/'#" tests/audioSynthPortable.test.ts
```

- [ ] **Step 3: Check nothing was missed**

```bash
npm run typecheck
npm test
```

Expected: both pass with the same test count as the baseline (Task 1).
Also run `grep -rn "src/audio-synth\|infrastructure/safeStorage\|application/platformPort" src tests scripts tools index.html vite.config.ts`
Expected: no output.

- [ ] **Step 4: Add the "core is not empty" test**

In `tests/engineBoundary.test.ts`, inside `describe('engine layering', ...)`, add before the first test:

```ts
  test('core has files, so the rule below is not vacuous', () => {
    expect(walk(CORE).length).toBeGreaterThan(20);
  });
```

Run: `npx vitest run tests/engineBoundary.test.ts`
Expected: PASS. In particular `core imports nothing outside engine/core` passes, which proves the moved files really are decoupled.

- [ ] **Step 5: Move the tests that only cover core modules**

List them (a test qualifies when every `src/` import it has points into `src/engine/core/`):

```bash
for f in tests/*.test.ts; do
  imports=$(grep -oE "from '[^']*src/[^']+'" "$f" | sed -E "s#.*src/##; s#'##")
  if [ -n "$imports" ] && ! echo "$imports" | grep -qv '^engine/core/'; then echo "$f"; fi
done | tee "$TEMP/core-tests.txt"
```

Review the list. Expected members include (not exhaustive): `admobDriver`, `bootGate`, `cjkWrap`, `dsp`, `haptics`, `levelClock`, `loadingProgress`, `platformServices`, `safeStorage`, `viewport`, and probably `audioSynthPortable`. `safeStorage.test.ts` also imports `progressRepository` (game) so it correctly stays in `tests/`. Then move them:

```bash
args=(); for f in $(cat "$TEMP/core-tests.txt"); do args+=("$f" "tests/engine/core/$(basename "$f")"); done
node --experimental-strip-types scripts/dev/move-files.ts "${args[@]}"
```

If `tests/engine/core/audioSynthPortable.test.ts` now exists, its path string needs two more levels:

```bash
sed -i "s#'\.\./src/engine/core/audio-synth/'#'../../../src/engine/core/audio-synth/'#" tests/engine/core/audioSynthPortable.test.ts
```

- [ ] **Step 6: Verify and commit**

```bash
npm run typecheck
npm test
```

Expected: both pass; the total test count equals the baseline plus 13 new tests (6 from Task 2, 6 from Task 3, 1 from this task). Moving a test file does not change the count.

```bash
git add src tests scripts tools
git commit -m "refactor: move platform, audio-synth, boot and viewport modules to engine/core" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `music` and `sfx` take plain string ids, then move

**Files:**
- Modify: `src/infrastructure/music.ts` (drop the `TrackId` import, use `string`)
- Modify: `src/infrastructure/sfx.ts` (drop the `SfxKey` import, use `string`)
- Modify: `src/infrastructure/synthSfxDriver.ts` (same)
- Move: `music.ts`, `sfx.ts`, `synthSfxDriver.ts`, `browserAudioEnv.ts` to `src/engine/core/audio/`

**Interfaces:**
- Produces: `createMusic(env: MusicEnv, opts: MusicOptions): MusicPort`, `createSfx(driver, env, opts): SfxPort` with ids typed `string`. The game keeps its `TrackId` / `SfxKey` unions at its own call sites; they are assignable to `string`.

The track list (`audioManifest.ts`) and the sfx patches (`content/audio`) stay in the game, so the core files must stop importing them.

- [ ] **Step 1: Replace the Mirror unions with `string`**

```bash
sed -i "1,2d" src/infrastructure/music.ts
sed -i "s/\bTrackId\b/string/g" src/infrastructure/music.ts
sed -i "1,2d" src/infrastructure/sfx.ts
sed -i "s/\bSfxKey\b/string/g" src/infrastructure/sfx.ts
sed -i "/^import type { SfxKey } from/d" src/infrastructure/synthSfxDriver.ts
sed -i "s/\bSfxKey\b/string/g" src/infrastructure/synthSfxDriver.ts
head -3 src/infrastructure/music.ts src/infrastructure/sfx.ts
```

Expected: `music.ts` now starts with `/** The part of HTMLAudioElement the port uses; tests pass a fake. */` and `sfx.ts` with `export type AudioCue = { key: string; ...`. (Line 1 of each was the removed import and line 2 was blank.)

- [ ] **Step 2: Type-check and test**

```bash
npm run typecheck
npm test
```

Expected: both pass. If typecheck reports an error in a test that passes a `Partial<Record<SfxKey, ...>>` where `Partial<Record<string, ...>>` is expected, it is a type-only widening: fix the test's annotation to `string`, do not change logic.

- [ ] **Step 3: Commit the decoupling**

```bash
git add src tests
git commit -m "refactor: music and sfx take plain string ids" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Move the four files**

```bash
node --experimental-strip-types scripts/dev/move-files.ts \
  src/infrastructure/music.ts src/engine/core/audio/music.ts \
  src/infrastructure/sfx.ts src/engine/core/audio/sfx.ts \
  src/infrastructure/synthSfxDriver.ts src/engine/core/audio/synthSfxDriver.ts \
  src/infrastructure/browserAudioEnv.ts src/engine/core/audio/browserAudioEnv.ts
```

Expected: `moved 4 file(s), rewrote <n>`.

- [ ] **Step 5: Move their tests**

Re-run the listing loop from Task 4 Step 5, review, and move any new entries (expected: `music.test.ts`, `sfx.test.ts`) with the same `args` snippet.

- [ ] **Step 6: Verify and commit**

```bash
npm run typecheck
npm test
npx vitest run tests/engineBoundary.test.ts
```

Expected: all pass.

```bash
git add src tests scripts tools
git commit -m "refactor: move music, sfx and browser audio env to engine/core" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Split `motion.ts`, move `TransitionTimeline`

**Files:**
- Create: `src/engine/core/transitions/motion.ts`
- Rewrite: `src/presentation/transitions/motion.ts`
- Create: `tests/engine/core/motion.test.ts`
- Move: `src/presentation/transitions/TransitionTimeline.ts` to `src/engine/core/transitions/TransitionTimeline.ts`
- Modify: `src/presentation/transitions/choreography.ts` (one import line)

**Interfaces:**
- Produces (core): `type EaseName` (six names, no `anticipateOut`), `EASES: Record<EaseName, (t: number) => number>`, `stagger(index, count, spanMs): number`, `getMotionScale(): number`, `setMotionScale(value: number): void`, `isReducedMotion(scale?: number): boolean`, `scaleTiming(ms, scale?): number`.
- Produces (game, same path as before): everything it exported before. It re-exports the five functions above, and defines `RouteId`, a wider `EaseName` (core names plus `'anticipateOut'`), `EASES` (core table plus `anticipateOut`), `MOTION_FAMILIES`, `motionFamily` and the family types. The 38 importers do not change.

`anticipateOut` reads `FEEDBACK_TOKENS.pickupDipLift` / `pickupDipAt` (game tokens), which is why it cannot live in core.

- [ ] **Step 1: Write the failing core test**

Create `tests/engine/core/motion.test.ts`:

```ts
import { afterEach, describe, expect, test } from 'vitest';
import {
  EASES,
  getMotionScale,
  isReducedMotion,
  scaleTiming,
  setMotionScale,
  stagger,
} from '../../../src/engine/core/transitions/motion.ts';

afterEach(() => setMotionScale(1));

describe('core easing', () => {
  test.each(Object.keys(EASES) as Array<keyof typeof EASES>)('%s runs from 0 to 1', (name) => {
    expect(EASES[name](0)).toBeCloseTo(0, 9);
    expect(EASES[name](1)).toBeCloseTo(1, 9);
  });

  test('backOut overshoots before settling', () => {
    expect(Math.max(...[0.6, 0.7, 0.8].map(EASES.backOut))).toBeGreaterThan(1);
  });

  test('the token-driven ease is not in core', () => {
    expect('anticipateOut' in EASES).toBe(false);
  });
});

describe('motion scale', () => {
  test('setMotionScale snaps to 0 or 1', () => {
    setMotionScale(0.4);
    expect(getMotionScale()).toBe(1);
    setMotionScale(0);
    expect(getMotionScale()).toBe(0);
    expect(isReducedMotion()).toBe(true);
    setMotionScale(-3);
    expect(getMotionScale()).toBe(0);
  });

  test('scaleTiming keeps a duration, or zeroes it when reduced', () => {
    expect(scaleTiming(300)).toBe(300);
    setMotionScale(0);
    expect(scaleTiming(300)).toBe(0);
  });
});

describe('stagger', () => {
  test('spreads members evenly over the span', () => {
    expect([0, 1, 2].map((i) => stagger(i, 3, 100))).toEqual([0, 50, 100]);
  });

  test('a single member, or no span, has no delay', () => {
    expect(stagger(0, 1, 100)).toBe(0);
    expect(stagger(2, 3, 0)).toBe(0);
  });
});
```

Run: `npx vitest run tests/engine/core/motion.test.ts`
Expected: FAIL, "Failed to resolve import".

- [ ] **Step 2: Create the core motion file**

Create `src/engine/core/transitions/motion.ts`:

```ts
export type EaseName = 'linear' | 'cubicOut' | 'cubicInOut' | 'quartOut' | 'backOut' | 'sineInOut';

/** Hàm easing thuần, t trong [0, 1]. Tự viết để test được mà không cần Phaser. */
export const EASES: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  cubicOut: (t) => 1 - (1 - t) ** 3,
  cubicInOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  quartOut: (t) => 1 - (1 - t) ** 4,
  backOut: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

/** Độ trễ so le của phần tử thứ `index` trong `count` phần tử, trải đều trên `spanMs`. */
export function stagger(index: number, count: number, spanMs: number): number {
  if (count <= 1 || spanMs <= 0) return 0;
  const i = Math.min(Math.max(index, 0), count - 1);
  return (i * spanMs) / (count - 1);
}

let motionScale = 1;

/** 1 là chuyển động đầy đủ, 0 là Giảm chuyển động. Không có mức giữa. */
export function getMotionScale(): number {
  return motionScale;
}

export function setMotionScale(value: number): void {
  motionScale = value <= 0 ? 0 : 1;
}

export function isReducedMotion(scale: number = motionScale): boolean {
  return scale <= 0;
}

/** Thời lượng chuyển động dịch vị trí: giữ nguyên, hoặc 0 khi Giảm chuyển động. */
export function scaleTiming(ms: number, scale: number = motionScale): number {
  return isReducedMotion(scale) ? 0 : ms;
}
```

Run: `npx vitest run tests/engine/core/motion.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 3: Rewrite the game's `motion.ts`**

Overwrite `src/presentation/transitions/motion.ts` with:

```ts
import { ANIM_TOKENS, FEEDBACK_TOKENS, TRANSITION_TOKENS } from '../designTokens.ts';
import { EASES as CORE_EASES } from '../../engine/core/transitions/motion.ts';
import type { EaseName as CoreEaseName } from '../../engine/core/transitions/motion.ts';

export {
  getMotionScale,
  isReducedMotion,
  scaleTiming,
  setMotionScale,
  stagger,
} from '../../engine/core/transitions/motion.ts';

export type RouteId = keyof typeof TRANSITION_TOKENS.routes;

/** The core ease names plus the one that reads a game token. */
export type EaseName = CoreEaseName | 'anticipateOut';

/** Hàm easing thuần, t trong [0, 1]. Tự viết để test được mà không cần Phaser. */
export const EASES: Record<EaseName, (t: number) => number> = {
  ...CORE_EASES,
  anticipateOut: (t) => {
    const { pickupDipLift: dip, pickupDipAt: at } = FEEDBACK_TOKENS;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    if (t <= at) return dip * EASES.cubicOut(t / at);
    return dip + (1 - dip) * EASES.cubicOut((t - at) / (1 - at));
  },
};

export type MotionFamilyName = 'ui' | 'glass' | 'magic' | 'piece';

/**
 * One type per family rather than a single shape full of optional fields, so
 * `MOTION_FAMILIES.ui.tapMs` is a `number` at the call site instead of
 * `number | undefined`. A shared optional shape typechecks here but pushes a
 * non-null assertion onto every consumer.
 */
export type UiFamily = Readonly<{ ease: CoreEaseName; tapMs: number; standardMs: number }>;
export type GlassFamily = Readonly<{ ease: CoreEaseName; durationMs: number }>;
export type MagicFamily = Readonly<{ ease: CoreEaseName; minMs: number; maxMs: number }>;
/** `piece` is integrated frame by frame by POSE_TAU, so it has no ease. */
export type PieceFamily = Readonly<{ ease: null; governedBy: 'POSE_TAU' }>;

export type MotionFamilies = Readonly<{
  ui: UiFamily;
  glass: GlassFamily;
  magic: MagicFamily;
  piece: PieceFamily;
}>;

export type MotionFamily = UiFamily | GlassFamily | MagicFamily | PieceFamily;

/**
 * One vocabulary for motion, so a reader can tell from the call site why a
 * value was chosen. `cubicOut` and `sineInOut` already dominate the codebase —
 * two of these four families describe what the code does rather than change it.
 */
export const MOTION_FAMILIES: MotionFamilies = {
  // Buttons, modals, toggles, navigation. Two beats: acknowledging a press
  // must feel immediate, while a transition reads better slower.
  ui: {
    ease: 'cubicOut',
    tapMs: ANIM_TOKENS.duration.buttonTapMs,
    standardMs: 200,
  },
  // Glass panels, the target medallion, the stele frame. Heavier deceleration
  // than `ui` so these read as having mass.
  glass: {
    ease: 'quartOut',
    durationMs: 300,
  },
  // Runes, constellations, shimmer, glow pulses. Slow and symmetric.
  magic: {
    ease: 'sineInOut',
    minMs: 600,
    maxMs: 1400,
  },
  // Drag, pickup, snap, settle. Governed by POSE_TAU exponential smoothing in
  // pieceMotion.ts, not by a tween — see VR0 spec §2.1 for why that model was
  // kept over the damped spring the assessment proposed.
  piece: {
    ease: null,
    governedBy: 'POSE_TAU',
  },
} as const;

/** Generic so the caller keeps the specific family type, not the union. */
export function motionFamily<K extends MotionFamilyName>(name: K): MotionFamilies[K] {
  return MOTION_FAMILIES[name];
}
```

- [ ] **Step 4: Move `TransitionTimeline` and point it at core motion**

```bash
node --experimental-strip-types scripts/dev/move-files.ts \
  src/presentation/transitions/TransitionTimeline.ts src/engine/core/transitions/TransitionTimeline.ts
sed -i "s#'\.\./\.\./\.\./presentation/transitions/motion\.ts'#'./motion.ts'#" src/engine/core/transitions/TransitionTimeline.ts
head -3 src/engine/core/transitions/TransitionTimeline.ts
```

Expected: the first two lines are `import type { EaseName } from './motion.ts';` and `import { EASES } from './motion.ts';`.

- [ ] **Step 5: Type-check and fix ease types**

Run: `npm run typecheck`
Expected: the only errors, if any, are "`'anticipateOut'` is not assignable to `EaseName`" where a game file hands the game's wider `EaseName` to `TransitionTimeline.at`. Known case: `src/presentation/transitions/choreography.ts`, line 1. Fix it by importing the type from core:

```bash
sed -i "s#^import type { EaseName } from './motion.ts';#import type { EaseName } from '../../engine/core/transitions/motion.ts';#" src/presentation/transitions/choreography.ts
```

Re-run `npm run typecheck`. If another file reports the same error, apply the same one-line change to its `EaseName` import (core path). `PieceView` and `FeedbackDirector` must keep the game's `EaseName` (they use `anticipateOut`).

- [ ] **Step 6: Move the timeline test, run everything**

Re-run the listing loop from Task 4 Step 5 (expected new entry: `transitionTimeline.test.ts`, which imports only `TransitionTimeline`) and move it.

```bash
npm test
npx vitest run tests/engineBoundary.test.ts
```

Expected: all pass. `tests/motion.test.ts` and `tests/motionFamilies.test.ts` stay in `tests/` and keep passing through the game's facade (including the `anticipateOut` test).

- [ ] **Step 7: Commit**

```bash
git add src tests scripts tools
git commit -m "refactor: split motion into engine/core easing and game tokens, move TransitionTimeline" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Generic `SceneDirector`

**Files:**
- Create: `tests/engine/core/sceneDirectorGeneric.test.ts`
- Create: `src/engine/core/transitions/SceneDirector.ts`
- Create: `src/presentation/transitions/director.ts`
- Delete: `src/presentation/transitions/SceneDirector.ts`
- Modify: every importer of the old file (found by grep in Step 5)
- Modify: `tests/sceneDirector.test.ts` (import and the line that builds the director), `tests/sceneStartGate.test.ts` (expected path)

**Interfaces:**
- Consumes: `isReducedMotion` (core `motion.ts`), `TransitionTimeline` (core), `MusicPort` (core `audio/music.ts`).
- Produces (core): `type TransitionContext<K, R>`, `interface Choreographed<K, R>`, `interface SceneHost<K, M>`, `type DirectorConfig<K, R, M>`, `class SceneDirector<K, R, M>` with `constructor(config)`, `setHost`, `setMusic`, `isTransitioning`, `go`, `boot`, `attach`, `skip`, and `class PhaserSceneHost<K, M>` with `constructor(game: Phaser.Game, moodSceneKey: string)`.
- Produces (game, `director.ts`): `SceneKey`, `TransitionContext`, `Choreographed`, `SceneHost`, `Director`, `createDirector(): Director`, `director: Director`, `PhaserSceneHost` (constructor takes only `game`).

`DirectorConfig<K, R, M>` fields: `routeMood: Readonly<Record<R, M>>`, `bootRoute: Readonly<Record<K, R>>`, `trackFor(scene: K): string`, and `timing: { crossfadeMs; moodMs; handoffMs(route: R): number; sceneSwapFadeMs; sceneSwapGapMs; bootFadeMs }`.

- [ ] **Step 1: Write the failing core test**

Create `tests/engine/core/sceneDirectorGeneric.test.ts`. It uses its own keys, so it proves the director no longer knows Mirror:

```ts
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SceneDirector } from '../../../src/engine/core/transitions/SceneDirector.ts';
import type { Choreographed, DirectorConfig, SceneHost } from '../../../src/engine/core/transitions/SceneDirector.ts';
import { setMotionScale } from '../../../src/engine/core/transitions/motion.ts';

type Key = 'alpha' | 'beta';
type Route = 'forward' | 'back';
type Mood = 'calm' | 'busy';

const config: DirectorConfig<Key, Route, Mood> = {
  routeMood: { forward: 'busy', back: 'calm' },
  bootRoute: { alpha: 'back', beta: 'forward' },
  trackFor: (scene) => `track-${scene}`,
  timing: {
    crossfadeMs: 150,
    moodMs: 1000,
    handoffMs: () => 200,
    sceneSwapFadeMs: 700,
    sceneSwapGapMs: 600,
    bootFadeMs: 900,
  },
};

class FakeHost implements SceneHost<Key, Mood> {
  readonly log: string[] = [];
  readonly moods: Array<[Mood, number]> = [];
  start(key: Key): void {
    this.log.push(`start:${key}`);
  }
  restart(key: Key): void {
    this.log.push(`restart:${key}`);
  }
  stop(key: Key): void {
    this.log.push(`stop:${key}`);
  }
  setInputEnabled(): void {}
  setCameraAlpha(): void {}
  setMood(mood: Mood, durationMs: number): void {
    this.moods.push([mood, durationMs]);
  }
  armSkip(): void {}
  disarmSkip(): void {}
  onStep(): void {}
}

const scene = (key: Key): Choreographed<Key, Route> => ({ directorKey: key, playIn() {}, playOut() {} });

function setup() {
  const director = new SceneDirector<Key, Route, Mood>(config);
  const host = new FakeHost();
  director.setHost(host);
  return { director, host };
}

afterEach(() => setMotionScale(1));

describe('SceneDirector with a non-Mirror config', () => {
  test('go settles the sky into the route mood and refuses a second go while busy', () => {
    const { director, host } = setup();
    expect(director.go(scene('alpha'), 'beta', {}, { route: 'forward' })).toBe(true);
    expect(host.moods).toEqual([['busy', 1000]]);
    expect(director.isTransitioning()).toBe(true);
    expect(director.go(scene('alpha'), 'beta', {}, { route: 'forward' })).toBe(false);
  });

  test('reduced motion settles the mood at once', () => {
    setMotionScale(0);
    const { director, host } = setup();
    director.go(scene('alpha'), 'beta', {}, { route: 'back' });
    expect(host.moods).toEqual([['calm', 0]]);
  });

  test('go asks for the target scene track with the scene-swap fade and gap', () => {
    const { director } = setup();
    const setTrack = vi.fn();
    director.setMusic({ setTrack });
    director.go(scene('alpha'), 'beta', {}, { route: 'forward' });
    expect(setTrack).toHaveBeenCalledWith('track-beta', 700, 600);
  });

  test('boot starts the scene with the boot route mood and the boot fade', () => {
    const { director, host } = setup();
    const setTrack = vi.fn();
    director.setMusic({ setTrack });
    director.boot('beta', { from: 'test' });
    expect(host.log).toEqual(['start:beta']);
    expect(host.moods).toEqual([['busy', 0]]);
    expect(setTrack).toHaveBeenCalledWith('track-beta', 900);
  });
});
```

Run: `npx vitest run tests/engine/core/sceneDirectorGeneric.test.ts`
Expected: FAIL, "Failed to resolve import".

- [ ] **Step 2: Write the generic director**

Create `src/engine/core/transitions/SceneDirector.ts`:

```ts
import type Phaser from 'phaser';
import type { MusicPort } from '../audio/music.ts';
import { isReducedMotion } from './motion.ts';
import { TransitionTimeline } from './TransitionTimeline.ts';

export type TransitionContext<K extends string, R extends string> = {
  from: K | 'boot';
  route: R;
  /** Nút hoặc node vừa bấm, để cảnh mới mọc ra từ đúng chỗ đó */
  origin?: { x: number; y: number };
};

export interface Choreographed<K extends string, R extends string> {
  readonly directorKey: K;
  playIn(tl: TransitionTimeline, ctx: TransitionContext<K, R>): void;
  playOut(tl: TransitionTimeline, ctx: TransitionContext<K, R>): void;
}

/** Cổng tới Phaser; test dùng bản giả. */
export interface SceneHost<K extends string, M extends string> {
  start(key: K, data: object): void;
  restart(key: K, data: object): void;
  stop(key: K): void;
  setInputEnabled(key: K, enabled: boolean): void;
  setCameraAlpha(key: K, alpha: number): void;
  setMood(mood: M, durationMs: number): void;
  armSkip(onSkip: () => void): void;
  disarmSkip(): void;
  onStep(cb: (deltaMs: number) => void): void;
}

/** Everything the director needs to know about a particular game. */
export type DirectorConfig<K extends string, R extends string, M extends string> = {
  /** Sky mood each route settles into */
  routeMood: Readonly<Record<R, M>>;
  /** Route used for the in-half when the game starts straight into a scene */
  bootRoute: Readonly<Record<K, R>>;
  /** Music track for a scene */
  trackFor(scene: K): string;
  timing: {
    crossfadeMs: number;
    moodMs: number;
    handoffMs(route: R): number;
    sceneSwapFadeMs: number;
    sceneSwapGapMs: number;
    bootFadeMs: number;
  };
};

export class SceneDirector<K extends string, R extends string, M extends string> {
  private readonly config: DirectorConfig<K, R, M>;
  private host: SceneHost<K, M> | null = null;
  private music: Pick<MusicPort, 'setTrack'> | null = null;
  private busy = false;
  private skipping = false;
  private fromKey: K | null = null;
  private toKey: K | null = null;
  private outTl: TransitionTimeline | null = null;
  private inTl: TransitionTimeline | null = null;
  private incoming: { key: K; ctx: TransitionContext<K, R> } | null = null;
  private outDone = false;
  private inDone = false;
  private pendingEnable: K | null = null;

  constructor(config: DirectorConfig<K, R, M>) {
    this.config = config;
  }

  setHost(host: SceneHost<K, M>): void {
    this.host = host;
    host.onStep((dt) => this.step(dt));
  }

  setMusic(music: Pick<MusicPort, 'setTrack'>): void {
    this.music = music;
  }

  isTransitioning(): boolean {
    return this.busy;
  }

  go(
    fromScene: Choreographed<K, R>,
    to: K,
    data: object,
    ctx: { route: R; origin?: { x: number; y: number } }
  ): boolean {
    const host = this.host;
    if (!host || this.busy) return false;
    const timing = this.config.timing;

    // Music leaves, rests, then returns, independent of reduced motion (spec G §3.6, §3.7)
    this.music?.setTrack(this.config.trackFor(to), timing.sceneSwapFadeMs, timing.sceneSwapGapMs);

    const fromKey = fromScene.directorKey;
    const fullCtx: TransitionContext<K, R> = { ...ctx, from: fromKey };
    const reduced = isReducedMotion();
    this.begin(fromKey, to);
    host.setInputEnabled(fromKey, false);
    host.setMood(this.config.routeMood[ctx.route], reduced ? 0 : timing.moodMs);

    const out = new TransitionTimeline(0);
    this.outTl = out;
    if (reduced) {
      const fade = { alpha: 1 };
      out.at(0, fade, { alpha: 0 }, timing.crossfadeMs, 'linear', () => host.setCameraAlpha(fromKey, fade.alpha));
    } else {
      fromScene.playOut(out, fullCtx);
    }

    this.incoming = { key: to, ctx: fullCtx };
    if (fromKey === to) {
      // Cùng scene (màn kế): đợi phần ra xong rồi mới dựng lại
      out.onDone(() => {
        this.outDone = true;
        host.restart(to, data);
      });
    } else {
      const handoff = reduced ? 0 : timing.handoffMs(ctx.route);
      out.call(handoff, () => host.start(to, data));
      out.onDone(() => {
        this.outDone = true;
        this.maybeFinish();
      });
    }
    out.advance(0);
    return true;
  }

  /** Khởi động thẳng vào một cảnh: chỉ có phần vào. */
  boot(to: K, data: object): void {
    const host = this.host;
    if (!host || this.busy) return;
    this.music?.setTrack(this.config.trackFor(to), this.config.timing.bootFadeMs);
    const route = this.config.bootRoute[to];
    this.begin(null, to);
    this.outDone = true;
    host.setMood(this.config.routeMood[route], 0);
    this.incoming = { key: to, ctx: { from: 'boot', route } };
    host.start(to, data);
  }

  /** Mỗi scene gọi ở cuối create(). Ngoài chuyển cảnh thì không làm gì. */
  attach(scene: Choreographed<K, R>): void {
    const host = this.host;
    const incoming = this.incoming;
    if (!host || !incoming || incoming.key !== scene.directorKey) return;
    this.incoming = null;
    host.setInputEnabled(incoming.key, false);
    const timing = this.config.timing;

    const reduced = isReducedMotion();
    const tl = new TransitionTimeline(reduced ? 0 : timing.handoffMs(incoming.ctx.route));
    this.inTl = tl;
    if (reduced) {
      const fade = { alpha: 0 };
      host.setCameraAlpha(incoming.key, 0);
      tl.at(0, fade, { alpha: 1 }, timing.crossfadeMs, 'linear', () => host.setCameraAlpha(incoming.key, fade.alpha));
    } else {
      scene.playIn(tl, incoming.ctx);
    }
    tl.onDone(() => {
      this.inDone = true;
      this.maybeFinish();
    });
    if (this.skipping) tl.complete();
    else tl.advance(0);
  }

  skip(): void {
    if (!this.busy) return;
    this.skipping = true;
    this.outTl?.complete();
    this.inTl?.complete();
  }

  private begin(fromKey: K | null, toKey: K): void {
    this.busy = true;
    this.skipping = false;
    this.fromKey = fromKey;
    this.toKey = toKey;
    this.outDone = false;
    this.inDone = false;
    this.outTl = null;
    this.inTl = null;
    this.host?.armSkip(() => this.skip());
  }

  private step(dt: number): void {
    if (this.pendingEnable && this.host) {
      this.host.setInputEnabled(this.pendingEnable, true);
      this.pendingEnable = null;
    }
    this.outTl?.advance(dt);
    this.inTl?.advance(dt);
  }

  private maybeFinish(): void {
    const host = this.host;
    if (!host || !this.busy || !this.outDone || !this.inDone) return;
    if (this.fromKey && this.fromKey !== this.toKey) {
      host.setCameraAlpha(this.fromKey, 1);
      host.stop(this.fromKey);
    }
    // Mở input ở khung sau: chạm vừa dùng để bỏ qua không được rơi xuống cảnh mới
    this.pendingEnable = this.toKey;
    host.disarmSkip();
    this.busy = false;
    this.skipping = false;
    this.outTl = null;
    this.inTl = null;
    this.fromKey = null;
    this.toKey = null;
  }
}

/** Chờ chừng này sau khi bắt đầu chuyển mới nhận chạm bỏ qua (tránh chính cú chạm khởi động) */
const SKIP_ARM_GUARD_MS = 80;

/** What the sky scene exposes so the director can change its mood. */
type MoodTarget<M extends string> = { setMood(mood: M, durationMs: number): void };

export class PhaserSceneHost<K extends string, M extends string> implements SceneHost<K, M> {
  private readonly game: Phaser.Game;
  private readonly moodSceneKey: string;
  private skipHandler: (() => void) | null = null;

  constructor(game: Phaser.Game, moodSceneKey: string) {
    this.game = game;
    this.moodSceneKey = moodSceneKey;
  }

  start(key: K, data: object): void {
    this.game.scene.start(key, data);
    this.game.scene.bringToTop(key);
  }

  restart(key: K, data: object): void {
    this.game.scene.getScene(key)?.scene.restart(data);
  }

  stop(key: K): void {
    this.game.scene.stop(key);
  }

  setInputEnabled(key: K, enabled: boolean): void {
    const scene = this.game.scene.getScene(key);
    if (scene?.input) scene.input.enabled = enabled;
  }

  setCameraAlpha(key: K, alpha: number): void {
    this.game.scene.getScene(key)?.cameras?.main?.setAlpha(alpha);
  }

  setMood(mood: M, durationMs: number): void {
    const background = this.game.scene.getScene(this.moodSceneKey) as unknown as MoodTarget<M> | null;
    background?.setMood(mood, durationMs);
  }

  armSkip(onSkip: () => void): void {
    this.disarmSkip();
    const armedAt = performance.now();
    this.skipHandler = () => {
      if (performance.now() - armedAt >= SKIP_ARM_GUARD_MS) onSkip();
    };
    this.game.canvas.addEventListener('pointerdown', this.skipHandler);
  }

  disarmSkip(): void {
    if (this.skipHandler) this.game.canvas.removeEventListener('pointerdown', this.skipHandler);
    this.skipHandler = null;
  }

  onStep(cb: (deltaMs: number) => void): void {
    this.game.events.on('step', (_time: number, delta: number) => cb(delta));
  }
}
```

Run: `npx vitest run tests/engine/core/sceneDirectorGeneric.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 3: Write the game-side director**

Create `src/presentation/transitions/director.ts`:

```ts
import type Phaser from 'phaser';
import {
  PhaserSceneHost as CorePhaserSceneHost,
  SceneDirector,
} from '../../engine/core/transitions/SceneDirector.ts';
import type {
  Choreographed as CoreChoreographed,
  DirectorConfig,
  SceneHost as CoreSceneHost,
  TransitionContext as CoreTransitionContext,
} from '../../engine/core/transitions/SceneDirector.ts';
import { trackFor } from '../audio/tracks.ts';
import { AUDIO_TOKENS, TRANSITION_TOKENS } from '../designTokens.ts';
import type { SkyMood } from '../sky/skyMood.ts';
import type { RouteId } from './motion.ts';

export type SceneKey = 'MenuScene' | 'LevelSelectScene' | 'PlayScene';
export type TransitionContext = CoreTransitionContext<SceneKey, RouteId>;
export type Choreographed = CoreChoreographed<SceneKey, RouteId>;
export type SceneHost = CoreSceneHost<SceneKey, SkyMood>;
export type Director = SceneDirector<SceneKey, RouteId, SkyMood>;

const ROUTE_MOOD: Record<RouteId, SkyMood> = {
  'menu-to-play': 'play',
  'map-to-play': 'play',
  'next-level': 'play',
  'play-to-map': 'map',
  'play-to-menu': 'menu',
  'menu-to-map': 'map',
  'map-to-menu': 'menu',
};

/** Tuyến dùng cho phần vào khi khởi động thẳng vào một cảnh */
const BOOT_ROUTE: Record<SceneKey, RouteId> = {
  MenuScene: 'play-to-menu',
  LevelSelectScene: 'menu-to-map',
  PlayScene: 'menu-to-play',
};

const CONFIG: DirectorConfig<SceneKey, RouteId, SkyMood> = {
  routeMood: ROUTE_MOOD,
  bootRoute: BOOT_ROUTE,
  trackFor,
  timing: {
    crossfadeMs: TRANSITION_TOKENS.crossfadeMs,
    moodMs: TRANSITION_TOKENS.moodMs,
    handoffMs: (route) => TRANSITION_TOKENS.routes[route].handoffMs,
    sceneSwapFadeMs: AUDIO_TOKENS.sceneSwapFadeMs,
    sceneSwapGapMs: AUDIO_TOKENS.sceneSwapGapMs,
    bootFadeMs: AUDIO_TOKENS.bootFadeMs,
  },
};

/** A fresh director; tests build their own. */
export function createDirector(): Director {
  return new SceneDirector<SceneKey, RouteId, SkyMood>(CONFIG);
}

export const director: Director = createDirector();

/** The Phaser host wired to Mirror's sky scene. */
export class PhaserSceneHost extends CorePhaserSceneHost<SceneKey, SkyMood> {
  constructor(game: Phaser.Game) {
    super(game, 'BackgroundScene');
  }
}
```

- [ ] **Step 4: Repoint every importer, then remove the old file**

List the importers, apply the one-line rewrite to all of them **except** `tests/sceneStartGate.test.ts` (that file mentions the path as expected text, edited by hand in Step 5) and the two new files (`director.ts` itself imports the core file, so it must not be rewritten):

```bash
files=$(grep -rlE "/SceneDirector\.ts['\"]" src tests scripts --include=*.ts --include=*.mjs \
  | grep -v "^src/engine/" | grep -v "^tests/engine/" | grep -v "tests/sceneStartGate.test.ts" \n  | grep -v "src/presentation/transitions/director.ts")
echo "$files"
sed -i -E "s#/SceneDirector\.ts(['\"])#/director.ts\1#g" $files
git rm -q src/presentation/transitions/SceneDirector.ts
```

Expected list: `src/main.ts`, `src/presentation/audio/tracks.ts`, `src/presentation/scenes/{LevelSelectScene,LoadingScene,MenuScene,PlayScene}.ts`, `src/presentation/transitions/playChoreography.ts`, `tests/sceneDirector.test.ts`, and the `scripts/checks/*.mjs` files that import `director`.

- [ ] **Step 5: Update the two tests**

In `tests/sceneDirector.test.ts` (five single-line edits; the test still exercises the Mirror config end to end):

```bash
sed -i "s#^import { SceneDirector } from '\.\./src/presentation/transitions/director\.ts';#import { createDirector } from '../src/presentation/transitions/director.ts';#" tests/sceneDirector.test.ts
sed -i "s#^  Choreographed,\$#  Choreographed,\n  Director,#" tests/sceneDirector.test.ts
sed -i "s#private readonly director: SceneDirector;#private readonly director: Director;#" tests/sceneDirector.test.ts
sed -i "s#constructor(key: SceneKey, director: SceneDirector)#constructor(key: SceneKey, director: Director)#" tests/sceneDirector.test.ts
sed -i "s#const director = new SceneDirector();#const director = createDirector();#" tests/sceneDirector.test.ts
sed -n 1,12p tests/sceneDirector.test.ts
```

Expected: the import block reads `import { createDirector } from '../src/presentation/transitions/director.ts';` then `import type { Choreographed, Director, SceneHost, SceneKey, TransitionContext } from '.../director.ts';` (one name per line). If `Director,` is missing (the file has CRLF endings, so the `$` anchor did not match), add `  Director,` by hand after `  Choreographed,`.

In `tests/sceneStartGate.test.ts`, change the expected offender:

```bash
sed -i "s#\['presentation/transitions/SceneDirector.ts'\]#['engine/core/transitions/SceneDirector.ts']#" tests/sceneStartGate.test.ts
```

(If the `sceneStartGate` test fails with `scene.start(` also appearing in another file, that file is a real violation of the hard rule: stop and report.)

- [ ] **Step 6: Type-check and test**

```bash
npm run typecheck
npm test
grep -rn "transitions/SceneDirector" src tests scripts tools index.html
```

Expected: typecheck and tests pass; the grep prints only lines that name `engine/core/transitions/SceneDirector.ts` (the core import in `director.ts`, `sceneDirectorGeneric.test.ts` and the gate test), none naming `presentation/transitions/SceneDirector`.
If typecheck complains that a scene's `implements Choreographed` no longer type-checks, the cause is almost always a `TransitionTimeline` import path left pointing at the old file: run the grep above and fix.

- [ ] **Step 7: Commit**

```bash
git add src tests scripts tools
git commit -m "refactor: make SceneDirector generic and move it to engine/core" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Generic `Localization`

**Files:**
- Create: `tests/engine/core/localization.test.ts`
- Create: `src/engine/core/localization/Localization.ts`
- Rewrite: `src/localization/LocalizationManager.ts`

**Interfaces:**
- Produces (core): `class Localization<L extends string, B>` with `constructor(bundles: Readonly<Record<L, B>>, fallback: L, initial: L, persist?: (locale: L) => void)`, `get locale(): L`, `bundle(locale?: L): B`, `isSupported(locale: string): locale is L`, `set(locale: L): boolean`, `onChange(listener: (locale: L) => void): () => void`; and `interpolate(text: string, params?: Readonly<Record<string, string | number>>): string`.
- Produces (game): `LocalizationManager` with exactly the public API it has today (`getInstance`, `getLocale`, `getMetadata`, `setLocale`, `onLocaleChange`, `t`, `getLevelTitle`, `getChapterName`, `getChapterLabel`, `getRandomMenuTagline`, `getVictoryVerse`, `getChapterTagline`, `getGalaxyType`, `getMenuTagline`, `getChapterVerses`). Its tests and `LocaleResolver`, `LocaleSettings`, `localizationConfig`, `types` stay as they are.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/core/localization.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { interpolate, Localization } from '../../../src/engine/core/localization/Localization.ts';

type L = 'en' | 'vi';
const bundles: Record<L, { hello: string }> = { en: { hello: 'Hello' }, vi: { hello: 'Xin chào' } };

describe('Localization', () => {
  test('starts on the initial locale and reads its bundle', () => {
    const loc = new Localization<L, { hello: string }>(bundles, 'en', 'vi');
    expect(loc.locale).toBe('vi');
    expect(loc.bundle().hello).toBe('Xin chào');
    expect(loc.bundle('en').hello).toBe('Hello');
  });

  test('set switches the locale, persists it, then notifies listeners, in that order', () => {
    const log: string[] = [];
    const loc = new Localization<L, { hello: string }>(bundles, 'en', 'en', (locale) => log.push(`persist:${locale}`));
    loc.onChange((locale) => log.push(`listener:${locale}`));
    expect(loc.set('vi')).toBe(true);
    expect(loc.locale).toBe('vi');
    expect(log).toEqual(['persist:vi', 'listener:vi']);
  });

  test('set is silent for the current locale and for an unknown one', () => {
    const persist = vi.fn();
    const listener = vi.fn();
    const loc = new Localization<L, { hello: string }>(bundles, 'en', 'en', persist);
    loc.onChange(listener);
    expect(loc.set('en')).toBe(false);
    expect(loc.set('xx' as L)).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  test('bundle falls back for a locale that has none', () => {
    const loc = new Localization<L, { hello: string }>(bundles, 'en', 'en');
    expect(loc.bundle('xx' as L).hello).toBe('Hello');
  });

  test('isSupported tells known locales from unknown ones', () => {
    const loc = new Localization<L, { hello: string }>(bundles, 'en', 'en');
    expect(loc.isSupported('vi')).toBe(true);
    expect(loc.isSupported('toString')).toBe(false);
  });

  test('onChange returns an unsubscribe function', () => {
    const listener = vi.fn();
    const loc = new Localization<L, { hello: string }>(bundles, 'en', 'en');
    const off = loc.onChange(listener);
    off();
    loc.set('vi');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('interpolate', () => {
  test('fills every {name} placeholder, repeats included', () => {
    expect(interpolate('{a} and {a} and {b}', { a: 'x', b: 2 })).toBe('x and x and 2');
  });

  test('returns the text unchanged without params, and ignores unknown params', () => {
    expect(interpolate('plain {a}')).toBe('plain {a}');
    expect(interpolate('plain {a}', { b: 1 })).toBe('plain {a}');
  });
});
```

Run: `npx vitest run tests/engine/core/localization.test.ts`
Expected: FAIL, "Failed to resolve import".

- [ ] **Step 2: Write the engine**

Create `src/engine/core/localization/Localization.ts`:

```ts
/**
 * Locale state shared by every game: which locale is active, who hears about a change, and the
 * bundle lookup with a fallback. What a bundle contains, and how the first locale is chosen at
 * boot, is the game's business.
 */
export class Localization<L extends string, B> {
  private readonly bundles: Readonly<Record<L, B>>;
  private readonly fallback: L;
  private readonly persist: (locale: L) => void;
  private readonly listeners = new Set<(locale: L) => void>();
  private current: L;

  constructor(bundles: Readonly<Record<L, B>>, fallback: L, initial: L, persist: (locale: L) => void = () => {}) {
    this.bundles = bundles;
    this.fallback = fallback;
    this.persist = persist;
    this.current = initial;
  }

  get locale(): L {
    return this.current;
  }

  /** The bundle of `locale`, or of the fallback locale when `locale` has none. */
  bundle(locale: L = this.current): B {
    return this.bundles[locale] ?? this.bundles[this.fallback];
  }

  isSupported(locale: string): locale is L {
    return Object.prototype.hasOwnProperty.call(this.bundles, locale);
  }

  /** Switches locale. False, and silent, when `locale` is unknown or already active. */
  set(locale: L): boolean {
    if (!this.isSupported(locale) || locale === this.current) return false;
    this.current = locale;
    this.persist(locale);
    this.listeners.forEach((listener) => listener(locale));
    return true;
  }

  onChange(listener: (locale: L) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/** Replaces every `{name}` in `text` with the matching entry of `params`. */
export function interpolate(text: string, params?: Readonly<Record<string, string | number>>): string {
  if (!params) return text;
  let out = text;
  for (const [key, value] of Object.entries(params)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return out;
}
```

Run: `npx vitest run tests/engine/core/localization.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 3: Rebuild `LocalizationManager` on top of it**

Overwrite `src/localization/LocalizationManager.ts` with the following. The behaviour of every method is unchanged; only the state moved into `Localization`.

```ts
import { chapterRoman } from '../content/chapters.ts';
import { interpolate, Localization } from '../engine/core/localization/Localization.ts';
import { LocaleResolver } from './LocaleResolver.ts';
import { LocaleSettings } from './LocaleSettings.ts';
import { localizationConfig, LOCALE_REGISTRY } from './localizationConfig.ts';
import type {
  CommonTranslations,
  GameTranslations,
  LocaleMetadata,
  SupportedLocale,
  TranslationBundle,
} from './types.ts';

import enCommon from '../locales/en-US/common.json';
import enGame from '../locales/en-US/game.json';
import viCommon from '../locales/vi/common.json';
import viGame from '../locales/vi/game.json';
import idCommon from '../locales/id/common.json';
import idGame from '../locales/id/game.json';
import ptCommon from '../locales/pt-BR/common.json';
import ptGame from '../locales/pt-BR/game.json';
import jaCommon from '../locales/ja/common.json';
import jaGame from '../locales/ja/game.json';
import esCommon from '../locales/es/common.json';
import esGame from '../locales/es/game.json';
import frCommon from '../locales/fr/common.json';
import frGame from '../locales/fr/game.json';
import deCommon from '../locales/de/common.json';
import deGame from '../locales/de/game.json';
import koCommon from '../locales/ko/common.json';
import koGame from '../locales/ko/game.json';
import zhCommon from '../locales/zh-CN/common.json';
import zhGame from '../locales/zh-CN/game.json';

export class LocalizationManager {
  private static instance: LocalizationManager;

  private readonly core: Localization<SupportedLocale, TranslationBundle>;

  private constructor() {
    const bundles: Record<SupportedLocale, TranslationBundle> = {
      'en-US': { common: enCommon as CommonTranslations, game: enGame as unknown as GameTranslations },
      vi: { common: viCommon as CommonTranslations, game: viGame as unknown as GameTranslations },
      id: { common: idCommon as CommonTranslations, game: idGame as unknown as GameTranslations },
      'pt-BR': { common: ptCommon as CommonTranslations, game: ptGame as unknown as GameTranslations },
      ja: { common: jaCommon as CommonTranslations, game: jaGame as unknown as GameTranslations },
      es: { common: esCommon as CommonTranslations, game: esGame as unknown as GameTranslations },
      fr: { common: frCommon as CommonTranslations, game: frGame as unknown as GameTranslations },
      de: { common: deCommon as CommonTranslations, game: deGame as unknown as GameTranslations },
      ko: { common: koCommon as CommonTranslations, game: koGame as unknown as GameTranslations },
      'zh-CN': { common: zhCommon as CommonTranslations, game: zhGame as unknown as GameTranslations },
    };
    this.core = new Localization(bundles, localizationConfig.fallbackLocale, LocaleResolver.resolve(), (locale) => {
      if (localizationConfig.persistSelectedLocale) LocaleSettings.saveLocale(locale);
    });
  }

  public static getInstance(): LocalizationManager {
    if (!LocalizationManager.instance) {
      LocalizationManager.instance = new LocalizationManager();
    }
    return LocalizationManager.instance;
  }

  public getLocale(): SupportedLocale {
    return this.core.locale;
  }

  public getMetadata(locale: SupportedLocale = this.core.locale): LocaleMetadata {
    return LOCALE_REGISTRY[locale];
  }

  public setLocale(locale: SupportedLocale | 'en'): void {
    const targetLocale: SupportedLocale = locale === 'en' ? 'en-US' : locale;
    if (!(localizationConfig.supportedLocales as readonly string[]).includes(targetLocale)) return;
    this.core.set(targetLocale);
  }

  public onLocaleChange(listener: (locale: SupportedLocale) => void): () => void {
    return this.core.onChange(listener);
  }

  public t(key: keyof CommonTranslations, params?: Record<string, string | number>): string {
    const dict = this.core.bundle()?.common || this.core.bundle('en-US').common;
    const text = dict[key] || this.core.bundle('en-US').common[key] || String(key);
    return interpolate(text, params);
  }

  public getLevelTitle(levelId: string, fallbackTitle = ''): string {
    const titles = this.core.bundle()?.game?.levelTitles || this.core.bundle('en-US').game.levelTitles;
    return (
      titles[levelId] ||
      (fallbackTitle ? fallbackTitle : this.core.bundle('en-US').game.levelTitles[levelId] || levelId)
    );
  }

  public getChapterName(chapter: number, fallbackName?: string): string {
    const chapters = this.core.bundle()?.game?.chapters || this.core.bundle('en-US').game.chapters;
    return chapters[String(chapter)] || fallbackName || this.core.bundle('en-US').game.chapters[String(chapter)] || `Chapter ${chapter}`;
  }

  public getChapterLabel(chapter: number, fallbackName?: string): string {
    const roman = chapterRoman(chapter);
    const prefix = this.t('chapter_prefix');
    const name = this.getChapterName(chapter, fallbackName);
    return `${prefix} ${roman} · ${name}`;
  }

  public getRandomMenuTagline(forcedIndex?: number): string {
    const list = this.core.bundle()?.game?.taglines || this.core.bundle('en-US').game.taglines;
    if (forcedIndex !== undefined && forcedIndex >= 0 && forcedIndex < list.length) {
      return list[forcedIndex];
    }
    return list[Math.floor(Math.random() * list.length)] || '';
  }

  public getVictoryVerse(levelId: string, fallbackVerse = ''): string {
    const verses = this.core.bundle()?.game?.victoryVerses || this.core.bundle('en-US').game?.victoryVerses;
    return (
      verses?.[levelId] ||
      (fallbackVerse ? fallbackVerse : this.core.bundle('en-US').game?.victoryVerses?.[levelId] || '')
    );
  }

  public getChapterTagline(chapter: number, fallbackTagline?: string): string {
    const taglines = this.core.bundle()?.game?.chapterTaglines || this.core.bundle('en-US').game?.chapterTaglines;
    return (
      taglines?.[String(chapter)] ||
      fallbackTagline ||
      this.core.bundle('en-US').game?.chapterTaglines?.[String(chapter)] ||
      ''
    );
  }

  public getGalaxyType(chapter: number, fallbackType?: string): string {
    const types = this.core.bundle()?.game?.galaxyTypes || this.core.bundle('en-US').game?.galaxyTypes;
    return (
      types?.[String(chapter)] ||
      fallbackType ||
      this.core.bundle('en-US').game?.galaxyTypes?.[String(chapter)] ||
      ''
    );
  }

  public getMenuTagline(chapter?: number, fallbackTagline?: string): string {
    if (chapter !== undefined) {
      const chTag = this.getChapterTagline(chapter);
      if (chTag) return chTag;
    }
    return fallbackTagline || this.getRandomMenuTagline();
  }

  public getChapterVerses(chapter: number): readonly string[] | undefined {
    return (
      this.core.bundle()?.game?.chapterVerses?.[String(chapter)] ||
      this.core.bundle('en-US')?.game?.chapterVerses?.[String(chapter)]
    );
  }
}
```

- [ ] **Step 4: Verify**

```bash
npm run typecheck
npm test
```

Expected: both pass. The existing `localizationManager`, `localeResolver`, `localeSettings` and `localizationCoverage` tests pass **without any edit**: that is the proof the wrapper preserves behaviour.
If `localizationManager.test.ts` fails on persistence order, compare against the old `setLocale`: it persisted before notifying listeners, which `Localization.set` also does.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "refactor: extract generic Localization engine into engine/core" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Documentation and final verification

**Files:**
- Create: `src/engine/ENGINE.md`
- Modify: `CLAUDE.md`, `AGENT.md`, `README.md`, `STATUS.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: the folder layout produced by Tasks 4 to 8.

- [ ] **Step 1: Check what `designViewport` hard-codes**

```bash
grep -nE "^(export )?const [A-Z_]+ =|[0-9]{3,4}" src/engine/core/viewport/designViewport.ts | head -20
```

If it contains Mirror's design size (for example `1080`, `1920`) as constants, list their names in `ENGINE.md` under "Constants a new game changes". If it does not, omit that subsection.

- [ ] **Step 2: Write `src/engine/ENGINE.md`**

```markdown
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

## Copy into a new game

1. Copy `src/engine/` and `tests/engine/`, plus `tests/engineBoundary.test.ts`, `tests/helpers/importBoundary.ts` and `scripts/dev/move-files.ts`.
2. Define your scene keys, route ids and sky moods; write your `DirectorConfig` and a `director.ts` like Mirror's.
3. Write your `LocalizationManager` wrapper over `Localization`.
4. Wire `createPlatformServices`, `createMusic` and `createSfx` in your `main.ts`.
5. Run `npm run typecheck` and `npm test`.
```

- [ ] **Step 3: Update `CLAUDE.md`**

Read the file first (the Edit tool needs it), then make two edits.

Add one new line directly after the Architecture paragraph (the one that starts with `` `domain` (pure rules, no rendering) ``):

```
Reusable runtime lives in `src/engine/` (see `src/engine/ENGINE.md`): `core` is game-independent; game code may import it, never the reverse.
```

Under `## Hard rules (enforced by tests)`, add this bullet after the first one:

```
- Engine boundary: `src/engine/core` imports nothing outside itself, and `src/engine/puzzle` imports only `core` and itself (`engineBoundary` test). Move files into the engine with `scripts/dev/move-files.ts`, which rewrites the imports.
```

- [ ] **Step 4: Update `AGENT.md`, `README.md`**

```bash
sed -i 's#`src/audio-synth/README.md`#`src/engine/core/audio-synth/README.md`#' AGENT.md
sed -i 's#^  audio-synth/      Procedural sound-effect synthesizer$#  engine/           Reusable runtime (see src/engine/ENGINE.md)\n    core/           Platform, audio, synth, boot, viewport, transitions, localization engine#' README.md
grep -n "audio-synth" AGENT.md README.md
```

Expected: `AGENT.md` shows the new path; `README.md` shows the two new lines under `src/` and no stale `audio-synth/` line. (If the `README.md` line has CRLF endings the second `sed` may not match; edit the line by hand with the Edit tool instead.)

- [ ] **Step 5: Update `STATUS.md` and `CHANGELOG.md`**

Read both files first. In `STATUS.md`: set `> Last updated:` to `2026-10-30`; change the line that starts `- Now: \`chore/code-cleanup\`` to start `- Before it: \`chore/code-cleanup\``; and insert as the first bullet under `## Branches`:

```
- Now: `feature/engine-extraction` (cut from `release/v1.0.0`, 2026-10-30, not pushed): phases 0 and 1 of the engine extraction (spec `docs/superpowers/specs/2026-10-30-engine-extraction-design.md`, plan `docs/superpowers/plans/2026-10-30-engine-core-extraction.md`). `src/engine/core` holds the platform, audio, synth, boot, viewport, transitions and localization-engine modules behind the `engineBoundary` test. Next: phase 2 (`engine/puzzle`), which starts with a spike counting the call sites of the grid constants and `Chapter`; it gets its own plan. Not done on purpose: progress storage stays in the game; `configureTokens` waits for phase 2. The parked `feature/sentry-crash-reporting` edits two files that moved (`platformServices.ts`, `admobDriver.ts`): merge this branch into it, not the reverse.
```

In `CHANGELOG.md`, directly under `## [Unreleased]`, add:

```
### Changed (engine extraction, phases 0 and 1)
- Game-independent runtime moved to `src/engine/core/`: platform services and drivers, `music`/`sfx` (string ids), `audio-synth`, boot helpers, viewport maths, `TransitionTimeline`, a generic `SceneDirector`, and a generic `Localization` engine. No behaviour change.
- `SceneDirector` is now generic and takes a `DirectorConfig`; Mirror's instance, keys and routes live in `src/presentation/transitions/director.ts`. Import `director` from there.
- `motion.ts` splits: easing, `stagger` and the motion-scale switch moved to core; the game file keeps `RouteId`, `anticipateOut` and `MOTION_FAMILIES` and re-exports the core functions.
- `LocalizationManager` keeps its public API and is built on `Localization`.

### Added (engine extraction)
- `engineBoundary` test: `core` may not import outside itself.
- `scripts/dev/move-files.ts`: `git mv` plus import rewriting.
- `src/engine/ENGINE.md`.
```

- [ ] **Step 6: Final verification against the baseline**

```bash
npm run typecheck
npm test
npm run content:validate
npm run build
git status --short
```

Expected: all four commands pass; the vitest test count equals the baseline (Task 1) plus the tests added by this plan (6 + 6 + 1 + 12 + 4 + 8 = 37); each chunk's gzip size is within 2% of the baseline (it should be unchanged: no code was added to the bundle). `git status --short` lists only the docs edited in this task and the two pre-existing `android/` modifications plus `.env.local`.

- [ ] **Step 7: Manual check in the dev server**

Run `npm run dev`, open `http://localhost:5173`, and: (1) reach the menu, (2) open the level map, (3) start level 1-1 and drag a piece onto the target, (4) reach the win screen, (5) open Pause and Settings, switch the language, (6) go back to the menu. Watch the browser console for errors. Expected: identical to `release/v1.0.0`; scene transitions play, music changes between menu and level.

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md AGENT.md README.md STATUS.md CHANGELOG.md src/engine/ENGINE.md
git commit -m "docs: document engine/core layout, boundary rule and extension points" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** phase 0 (baseline, strict `engineBoundary`, `git mv` history) is Tasks 1 to 3; phase 1 steps 1 to 6 of the amended spec map to Tasks 3, 4, 5, 6 and 7, 8, and the test move (Tasks 4 to 6). Docs and `ENGINE.md` are Task 9. Phase 2 and `configureTokens` are out of scope by the spec amendment.
- **Type consistency:** `SceneDirector<K, R, M>`, `DirectorConfig`, `Choreographed<K, R>`, `SceneHost<K, M>`, `PhaserSceneHost<K, M>(game, moodSceneKey)` are defined in Task 7 Step 2 and used identically in Step 3 and in the tests. `Localization<L, B>(bundles, fallback, initial, persist?)` is the same in Task 8's test, engine and wrapper. `EaseName` (core, 6 names) and the game's wider `EaseName` are defined in Task 6 and only referenced there and in Task 7 (via `RouteId`).
- **Known judgement calls the executor may hit:** which tests qualify for `tests/engine/core/` is computed by the loop, not listed by hand; typecheck decides whether further `EaseName` imports must point at core (Task 6 Step 5).
