import type { CrashReporterPort } from '../application/platformPort.ts';

export type CrashTestKind = 'throw' | 'reject' | 'capture';

/** Gây lỗi giả để kiểm chứng đường báo lỗi. Chỉ cài ở dev (xem `main.ts`). */
export function runCrashTest(kind: CrashTestKind, crash: CrashReporterPort): void {
  const stamp = new Date().toISOString();
  if (kind === 'throw') {
    // Ném ngoài call stack hiện tại để thành lỗi chưa bắt (window.onerror)
    setTimeout(() => {
      throw new Error(`[crash-test] uncaught error ${stamp}`);
    }, 0);
  } else if (kind === 'reject') {
    void Promise.reject(new Error(`[crash-test] unhandled rejection ${stamp}`));
  } else {
    crash.capture(new Error(`[crash-test] manual capture ${stamp}`), { source: 'crash-test' });
  }
}

export function installCrashTest(target: object, crash: CrashReporterPort): void {
  (target as Record<string, unknown>).__crashTest = (kind: CrashTestKind = 'capture') => runCrashTest(kind, crash);
}
