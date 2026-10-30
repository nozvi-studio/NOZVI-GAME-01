export type LoadingTask = Readonly<{ id: string; weight: number }>;
export type LoadingOptions = Readonly<{ minMs: number; maxMs: number }>;
export type LoadingState = Readonly<{ percent: number; done: boolean }>;

/** Time constant of the bar easing; small enough to feel live, large enough to hide jumps. */
const EASE_MS = 120;
/** The bar counts as full once the eased value passes this. */
const FINISH_AT = 0.98;

/**
 * Waypoints (time, progress), both 0..1 over the minimum time, of the steady fill shown when
 * assets are ready early: it runs, hesitates, runs again, like real work. Each run eases in
 * and out (smoothstep) so the stops look natural; flat stretches are the hesitations.
 */
const PACE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.16, 0.28],
  [0.3, 0.28],
  [0.5, 0.6],
  [0.62, 0.6],
  [0.82, 0.9],
  [0.9, 0.9],
  [1, 1],
];

/** The paced fill at normalised time `t` (elapsed / minMs). */
export function pacedProgress(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  for (let i = 1; i < PACE.length; i += 1) {
    const [t1, p1] = PACE[i];
    if (t <= t1) {
      const [t0, p0] = PACE[i - 1];
      const k = (t - t0) / (t1 - t0);
      return p0 + (p1 - p0) * k * k * (3 - 2 * k);
    }
  }
  return 1;
}

/**
 * Turns task reports into a steady, monotonic percentage. Pure: the scene calls `tick` every
 * frame and reads the state, so none of this needs Phaser to be tested.
 */
export class LoadingProgress {
  private readonly fractions = new Map<string, number>();
  private elapsed = 0;
  private shown = 0;
  private finished = false;

  constructor(
    private readonly tasks: readonly LoadingTask[],
    private readonly options: LoadingOptions
  ) {
    for (const task of tasks) this.fractions.set(task.id, 0);
  }

  /** A task's progress, 0..1. Unknown ids are ignored and a task never goes backwards. */
  report(id: string, fraction: number): void {
    const current = this.fractions.get(id);
    if (current === undefined) return;
    this.fractions.set(id, Math.max(current, Math.min(1, Math.max(0, fraction))));
  }

  /** Mark a task done (also used for a failed asset: the game goes on without it). */
  complete(id: string): void {
    this.report(id, 1);
  }

  tick(deltaMs: number): LoadingState {
    if (!this.finished) {
      const dt = Math.max(0, deltaMs);
      this.elapsed += dt;
      const timedOut = this.elapsed >= this.options.maxMs;
      const ceiling = pacedProgress(this.elapsed / this.options.minMs);
      const target = timedOut ? 1 : Math.min(this.weighted(), ceiling);
      this.shown = Math.max(this.shown, this.shown + (target - this.shown) * (1 - Math.exp(-dt / EASE_MS)));
      const allDone = this.tasks.every((task) => (this.fractions.get(task.id) ?? 0) >= 1);
      if (timedOut || (allDone && this.elapsed >= this.options.minMs && this.shown >= FINISH_AT)) {
        this.finished = true;
        this.shown = 1;
      }
    }
    return this.state;
  }

  get state(): LoadingState {
    return {
      percent: this.finished ? 100 : Math.min(99, Math.floor(this.shown * 100)),
      done: this.finished,
    };
  }

  private weighted(): number {
    const total = this.tasks.reduce((sum, task) => sum + task.weight, 0);
    if (total <= 0) return 1;
    const done = this.tasks.reduce((sum, task) => sum + task.weight * (this.fractions.get(task.id) ?? 0), 0);
    return done / total;
  }
}
