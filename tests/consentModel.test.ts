import { describe, expect, test } from 'vitest';
import { choicesFor } from '../src/presentation/consent/consentModel.ts';

describe('choicesFor', () => {
  test('ads follows accept, reject and save only when offered', () => {
    expect(choicesFor('accept_all', ['ads'], {})).toEqual({ analytics: false, diagnostics: false, ads: true });
    expect(choicesFor('reject_all', ['ads'], { ads: true })).toEqual({ analytics: false, diagnostics: false, ads: false });
    expect(choicesFor('save', ['ads'], { ads: true })).toEqual({ analytics: false, diagnostics: false, ads: true });
    expect(choicesFor('save', ['ads'], { ads: false })).toEqual({ analytics: false, diagnostics: false, ads: false });
    expect(choicesFor('save', [], { ads: true })).toEqual({ analytics: false, diagnostics: false, ads: false });
  });

  test('đồng ý tất cả chỉ bật mục được đưa ra', () => {
    expect(choicesFor('accept_all', ['diagnostics'], {})).toEqual({ analytics: false, diagnostics: true, ads: false });
    expect(choicesFor('accept_all', ['analytics', 'diagnostics'], {})).toEqual({ analytics: true, diagnostics: true, ads: false });
  });

  test('từ chối tất cả tắt hết, bỏ qua công tắc', () => {
    expect(choicesFor('reject_all', ['analytics', 'diagnostics'], { analytics: true })).toEqual({
      analytics: false,
      diagnostics: false,
      ads: false,
    });
  });

  test('lưu lựa chọn theo công tắc, mục không đưa ra luôn tắt', () => {
    expect(choicesFor('save', ['analytics'], { analytics: true, diagnostics: true, ads: true })).toEqual({
      analytics: true,
      diagnostics: false,
      ads: false,
    });
  });
});
