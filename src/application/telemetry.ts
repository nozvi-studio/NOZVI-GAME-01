export type TelemetryEvent =
  | { type: 'session_start'; sessionId: string; timestamp: number }
  | { type: 'session_end'; sessionId: string; elapsedMs: number; reason: string; timestamp: number }
  | { type: 'level_start'; levelId: string; timestamp: number }
  | { type: 'level_complete'; levelId: string; elapsedMs: number; resetCount: number; timestamp: number; stars?: number }
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
