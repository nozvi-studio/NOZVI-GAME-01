import type { CrashReporterPort } from '../application/platformPort.ts';

export type CrashTestKind = 'throw' | 'reject' | 'capture';

// Mỗi loại tạo lỗi trong một hàm riêng: Sentry gom issue theo stack, nên dùng chung một hàm sẽ làm các loại
// lỗi dồn vào cùng một issue và trông như bị mất.
function throwUncaught(stamp: string): void {
  // Ném ngoài call stack hiện tại để thành lỗi chưa bắt (window.onerror)
  setTimeout(function crashTestUncaught() {
    throw new Error(`[crash-test] uncaught error ${stamp}`);
  }, 0);
}

function rejectUnhandled(stamp: string): void {
  void Promise.reject(new Error(`[crash-test] unhandled rejection ${stamp}`));
}

function captureManually(crash: CrashReporterPort, stamp: string): void {
  crash.capture(new Error(`[crash-test] manual capture ${stamp}`), { source: 'crash-test' });
}

/** Gây lỗi giả để kiểm chứng đường báo lỗi. Chỉ cài ở dev (xem `main.ts`). */
export function runCrashTest(kind: CrashTestKind, crash: CrashReporterPort): void {
  const stamp = new Date().toISOString();
  if (kind === 'throw') throwUncaught(stamp);
  else if (kind === 'reject') rejectUnhandled(stamp);
  else captureManually(crash, stamp);
}

export function installCrashTest(target: object, crash: CrashReporterPort): void {
  (target as Record<string, unknown>).__crashTest = (kind: CrashTestKind = 'capture') => runCrashTest(kind, crash);
}
