import type { TelemetryEvent, TelemetryRecorder } from '../engine/core/platform/telemetry.ts';
import type { StoragePort } from '../application/progressPort.ts';

const TELEMETRY_KEY = 'nozvi.playtest.v1';
const MAX_EVENTS = 2000;

export class LocalPlaytestRecorder implements TelemetryRecorder {
  private storage: StoragePort;
  private events: TelemetryEvent[] = [];

  constructor(storage: StoragePort) {
    this.storage = storage;
    this.loadEvents();
  }

  private loadEvents(): void {
    try {
      const raw = this.storage.getItem(TELEMETRY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.events = parsed.slice(-MAX_EVENTS);
        }
      }
    } catch {
      this.events = [];
    }
  }

  record(event: TelemetryEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }

    try {
      this.storage.setItem(TELEMETRY_KEY, JSON.stringify(this.events));
    } catch {
      // Bỏ qua lỗi lưu bộ nhớ cục bộ
    }
  }

  getEvents(): readonly TelemetryEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
    try {
      this.storage.setItem(TELEMETRY_KEY, JSON.stringify([]));
    } catch {
      // Bỏ qua
    }
  }
}
