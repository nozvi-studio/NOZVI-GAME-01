import { chapterOfLevelId } from '../content/chapters.ts';
import type { AnalyticsPort, CrashReporterPort } from './platformPort.ts';
import type { PlayMode } from './telemetry.ts';

type Run = {
  levelId: string;
  chapter: number;
  mode: PlayMode;
  startedAt: number;
  moveCount: number;
  rotateCount: number;
  resetCount: number;
};

/**
 * Theo dõi một lượt chơi màn: đếm thao tác trong bộ nhớ và chỉ phát sự kiện ở các mốc (vào, thắng, bỏ).
 * Không phát từng lần kéo thả để hàng đợi của AnalyticsPort không đẩy mất `level_start`.
 * Mỗi lượt có đúng một sự kiện kết thúc, dù scene gọi `leave` nhiều lần.
 */
export class LevelTracker {
  private run: Run | null = null;

  constructor(
    private readonly analytics: AnalyticsPort,
    private readonly now: () => number = Date.now,
    private readonly crash?: CrashReporterPort
  ) {}

  /** `chapter` chỉ cần truyền khi mã màn không mang chương (endless). */
  start(levelId: string, mode: PlayMode, chapter?: number): void {
    this.leave('restart-level');
    this.run = {
      levelId,
      chapter: chapter ?? chapterOfLevelId(levelId) ?? 0,
      mode,
      startedAt: this.now(),
      moveCount: 0,
      rotateCount: 0,
      resetCount: 0,
    };
    // Lỗi xảy ra trong lúc chơi sẽ mang theo màn, chương và chế độ để lọc trên Sentry.
    this.crash?.setContext('level', levelId);
    this.crash?.setContext('chapter', this.run.chapter);
    this.crash?.setContext('mode', mode);
    this.crash?.breadcrumb(`level_start ${levelId}`);
    this.analytics.track({
      type: 'level_start',
      levelId,
      chapter: this.run.chapter,
      mode,
      timestamp: this.run.startedAt,
    });
  }

  moved(): void {
    if (this.run) this.run.moveCount += 1;
  }

  rotated(): void {
    if (this.run) this.run.rotateCount += 1;
  }

  reset(): void {
    if (this.run) this.run.resetCount += 1;
  }

  completed(result: { elapsedMs: number; stars: number }): void {
    const run = this.run;
    if (!run) return;
    this.run = null;
    this.analytics.track({
      type: 'level_complete',
      levelId: run.levelId,
      chapter: run.chapter,
      mode: run.mode,
      elapsedMs: result.elapsedMs,
      stars: result.stars,
      resetCount: run.resetCount,
      moveCount: run.moveCount,
      rotateCount: run.rotateCount,
      timestamp: this.now(),
    });
  }

  leave(reason: string): void {
    const run = this.run;
    if (!run) return;
    this.run = null;
    const timestamp = this.now();
    this.analytics.track({
      type: 'level_abandon',
      levelId: run.levelId,
      chapter: run.chapter,
      mode: run.mode,
      elapsedMs: timestamp - run.startedAt,
      resetCount: run.resetCount,
      moveCount: run.moveCount,
      rotateCount: run.rotateCount,
      reason,
      timestamp,
    });
  }
}
