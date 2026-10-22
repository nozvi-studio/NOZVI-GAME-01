import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('shoot-level bằng chứng ảnh mới', () => {
  test('xóa ảnh cũ trước Chrome và chỉ báo thành công khi ảnh mới có dữ liệu', () => {
    const source = readFileSync(new URL('../scripts/dev/shoot-level.sh', import.meta.url), 'utf8');
    const remove = source.indexOf('rm -f -- "$image"');
    const launch = source.indexOf('"$CHROME" --headless');
    const verify = source.indexOf('[[ ! -s "$image" ]]');
    const success = source.indexOf('echo "$image"');
    expect(remove).toBeGreaterThan(-1);
    expect(remove).toBeLessThan(launch);
    expect(verify).toBeGreaterThan(launch);
    expect(success).toBeGreaterThan(verify);
    expect(source.slice(verify, success)).toContain('>&2');
    expect(source.slice(verify, success)).toContain('return 1');
    expect(source.match(/shoot (?:play|drag|win).*\|\| exit 1/g)).toHaveLength(3);
  });
});
