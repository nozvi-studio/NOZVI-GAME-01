import { describe, expect, test, vi } from 'vitest';
import { openExternal } from '../src/presentation/openExternal.ts';

describe('openExternal', () => {
  test('mở ở cửa sổ riêng, noopener', () => {
    const open = vi.fn();
    openExternal('https://x.test/p', { open });
    expect(open).toHaveBeenCalledWith('https://x.test/p', '_blank', 'noopener');
  });

  test('nuốt lỗi khi không mở được', () => {
    expect(() => openExternal('https://x.test/p', { open: () => { throw new Error('blocked'); } })).not.toThrow();
  });
});
