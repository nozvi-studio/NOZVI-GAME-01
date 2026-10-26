/** Chế độ chơi được theo dõi; màn harness/Studio của dev không bao giờ được gửi. */
export type PlayMode = 'campaign' | 'endless';

export type TelemetryEvent =
  | { type: 'session_start'; sessionId: string; timestamp: number }
  | { type: 'session_end'; sessionId: string; elapsedMs: number; reason: string; timestamp: number }
  | { type: 'level_start'; levelId: string; chapter: number; mode: PlayMode; timestamp: number }
  | {
      type: 'level_complete';
      levelId: string;
      chapter: number;
      mode: PlayMode;
      elapsedMs: number;
      stars: number;
      resetCount: number;
      moveCount: number;
      rotateCount: number;
      timestamp: number;
    }
  | {
      type: 'level_abandon';
      levelId: string;
      chapter: number;
      mode: PlayMode;
      elapsedMs: number;
      resetCount: number;
      moveCount: number;
      rotateCount: number;
      reason: string;
      timestamp: number;
    }
  | { type: 'piece_drop'; levelId: string; pieceId: string; outcome: string; timestamp: number }
  | { type: 'piece_rotate'; levelId: string; pieceId: string; timestamp: number }
  | { type: 'level_reset'; levelId: string; timestamp: number }
  | { type: 'ftue_step_seen'; levelId: string; stepId: string; timestamp: number }
  | { type: 'ftue_step_done'; levelId: string; stepId: string; timestamp: number };

export interface TelemetryRecorder {
  record(event: TelemetryEvent): void;
  getEvents(): readonly TelemetryEvent[];
  clear(): void;
}
