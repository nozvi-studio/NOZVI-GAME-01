/**
 * Play time as the sum of frame deltas. The scene simply stops calling `tick` while paused or
 * won, and Phaser stops updating in a hidden tab, so no pause bookkeeping lives here.
 */
export class LevelClock {
  private ms = 0;
  private isRunning = false;
  private hasStarted = false;

  /** Starts once; a clock that has started (even if stopped) is not restarted until `reset`. */
  start(): void {
    if (this.hasStarted) return;
    this.hasStarted = true;
    this.isRunning = true;
  }

  tick(dtMs: number): void {
    if (this.isRunning) this.ms += dtMs;
  }

  stop(): void {
    this.isRunning = false;
  }

  reset(): void {
    this.ms = 0;
    this.isRunning = false;
    this.hasStarted = false;
  }

  get elapsedMs(): number {
    return this.ms;
  }

  get started(): boolean {
    return this.hasStarted;
  }

  get running(): boolean {
    return this.isRunning;
  }
}
