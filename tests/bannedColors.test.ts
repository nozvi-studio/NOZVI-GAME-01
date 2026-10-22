import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Collect every .ts file under src/ */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

const BANNED = [
  // Teal the GDD removed by name. Has now survived two cleanups.
  /4ECDC4/i,
  // Purple sky tail cut by VR1.
  /6B4BA8/i,
  /4A3A9E/i,
  // Stray yellow that is not an amber token.
  /FFD166/i,
];

describe('Màu bị cấm không được quay lại', () => {
  const files = sourceFiles('src');

  test('quét toàn bộ src/ không còn mã màu ngoài ba họ màu', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of BANNED) {
        if (pattern.test(text)) offenders.push(`${file} chứa ${pattern.source}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('quét có tác dụng thật: bắt được chuỗi mồi', () => {
    // Guards the guard: if the scan silently found no files, the test above
    // would pass vacuously.
    expect(files.length).toBeGreaterThan(40);
  });
});
