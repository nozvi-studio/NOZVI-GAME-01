import type { Patch, PatchIssue } from '../../audio-synth/patch.ts';
import { validatePatch } from '../../audio-synth/patch.ts';
import { renderPatch } from '../../audio-synth/render.ts';

export type RenderAttempt =
  | { ok: true; samples: Float32Array }
  | { ok: false; issues: PatchIssue[] };

/**
 * Renders a patch only if it validates. A slider can easily drag a patch out
 * of range (cutoff above Nyquist, zero duration) and renderPatch throws on
 * those, so the Lab asks here first and shows the issues instead.
 */
export function tryRender(patch: Patch, sampleRate: number): RenderAttempt {
  const issues = validatePatch(patch, sampleRate);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, samples: renderPatch(patch, sampleRate) };
}

export function formatIssues(issues: readonly PatchIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
}

/** What the Lab shows for one successful render. */
export type RenderView = { samples: Float32Array; stats: string; typescript: string };

/**
 * Remembers the last good view of each cue separately. When a cue's patch is
 * invalid the page shows that cue's own last view (or nothing), never another
 * cue's, so Copy can never hand out the wrong patch body.
 */
export class ViewMemory {
  private readonly views = new Map<string, RenderView>();

  remember(cue: string, view: RenderView): void {
    this.views.set(cue, view);
  }

  forCue(cue: string): RenderView | null {
    return this.views.get(cue) ?? null;
  }
}

/** Slider caption: the full path, so layer 0 and layer 3 are never confused. */
export function sliderLabel(path: string, value: number | string): string {
  return `${path} = ${value}`;
}
