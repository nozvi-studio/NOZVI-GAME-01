import { describe, expect, test } from 'vitest';
import { choicesFor } from '../src/presentation/consent/consentModel.ts';

describe('choicesFor', () => {
  test('đồng ý tất cả chỉ bật mục được đưa ra', () => {
    expect(choicesFor('accept_all', ['diagnostics'], {})).toEqual({ analytics: false, diagnostics: true });
    expect(choicesFor('accept_all', ['analytics', 'diagnostics'], {})).toEqual({ analytics: true, diagnostics: true });
  });

  test('từ chối tất cả tắt hết, bỏ qua công tắc', () => {
    expect(choicesFor('reject_all', ['analytics', 'diagnostics'], { analytics: true })).toEqual({
      analytics: false,
      diagnostics: false,
    });
  });

  test('lưu lựa chọn theo công tắc, mục không đưa ra luôn tắt', () => {
    expect(choicesFor('save', ['analytics'], { analytics: true, diagnostics: true })).toEqual({
      analytics: true,
      diagnostics: false,
    });
  });
});
