import { describe, expect, test } from 'vitest';
import { ftueStepsOf } from '../src/content/catalog.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { hintController, hintTextKey, HINT_TEXT_KEYS } from '../src/presentation/hud/levelHints.ts';
import enCommon from '../src/locales/en-US/common.json';
import viCommon from '../src/locales/vi/common.json';
import idCommon from '../src/locales/id/common.json';
import ptCommon from '../src/locales/pt-BR/common.json';
import jaCommon from '../src/locales/ja/common.json';

const LOCALES = { 'en-US': enCommon, vi: viCommon, id: idCommon, 'pt-BR': ptCommon, ja: jaCommon } as Record<string, Record<string, string>>;

describe('Gợi ý đầu màn (3-1 xoay, 3-8 liên động)', () => {
  test('chỉ các bước có khoá ngôn ngữ mới hiện; màn cũ có ftueSteps (1-1, 1-2, 2-1) không bị hiện chữ tiếng Việt', () => {
    expect(hintController('3-1')?.getState()).toMatchObject({ stepId: 'rotate-first', visible: true });
    expect(hintController('3-8')?.getState()).toMatchObject({ stepId: 'linked-rotation', visible: true });
    for (const id of ['1-1', '1-2', '2-1', '3-2', '3-10']) expect(hintController(id), id).toBeNull();
    expect(ftueStepsOf('1-1').length).toBeGreaterThan(0);
  });

  test('gợi ý tắt sau lần khớp đầu tiên và không tự hiện lại', () => {
    const hint = hintController('3-1')!;
    hint.onAction('drag-start');
    expect(hint.getState().visible).toBe(true);
    hint.onAction('snap');
    expect(hint.getState()).toEqual({ stepId: null, visible: false, text: null });
    hint.onAction('snap');
    expect(hint.getState().visible).toBe(false);
  });

  test('mọi bước ftue của màn campaign có khoá ngôn ngữ hợp lệ trong cả 5 ngôn ngữ, không rỗng', () => {
    for (const [stepId, key] of Object.entries(HINT_TEXT_KEYS)) {
      expect(hintTextKey(stepId)).toBe(key);
      for (const [locale, bundle] of Object.entries(LOCALES)) {
        expect(typeof bundle[key], `${key} in ${locale}`).toBe('string');
        expect(bundle[key].trim().length, `${key} in ${locale}`).toBeGreaterThan(10);
      }
    }
    expect(hintTextKey('drag-first')).toBeNull();
  });

  test('mỗi khoá gợi ý có ít nhất một màn campaign dùng bước đó', () => {
    for (const stepId of Object.keys(HINT_TEXT_KEYS)) {
      const used = campaignManifest.some((e) => ftueStepsOf(e.id).some((s) => s.id === stepId));
      expect(used, stepId).toBe(true);
    }
  });
});
