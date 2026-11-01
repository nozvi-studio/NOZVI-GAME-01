import { describe, expect, test } from 'vitest';
import { clearGameAnalyticsStore } from '../src/infrastructure/gameAnalyticsStore.ts';

describe('clearGameAnalyticsStore', () => {
  test('xóa đúng bốn key của SDK theo gameKey và giữ key khác', () => {
    const map = new Map<string, string>([
      ['GA::gk::ga_event', '[1]'],
      ['GA::gk::ga_session', '[2]'],
      ['GA::gk::ga_progression', '[3]'],
      ['GA::gk::ga_items', '[4]'],
      ['GA::other::ga_event', '[5]'],
      ['nozvi.progress', '{}'],
    ]);
    clearGameAnalyticsStore({ removeItem: (k) => void map.delete(k) }, 'gk');
    expect([...map.keys()]).toEqual(['GA::other::ga_event', 'nozvi.progress']);
  });

  test('storage null hoặc ném lỗi thì không ném', () => {
    expect(() => clearGameAnalyticsStore(null, 'gk')).not.toThrow();
    expect(() => clearGameAnalyticsStore({ removeItem: () => { throw new Error('x'); } }, 'gk')).not.toThrow();
  });
});
