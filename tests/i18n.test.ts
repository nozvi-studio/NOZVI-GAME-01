import { describe, expect, test, beforeEach } from 'vitest';
import { getLocale, setLocale, t, getLevelTitle, getChapterLabel, onLocaleChange } from '../src/presentation/i18n.ts';

describe('i18n translation system', () => {
  beforeEach(() => {
    setLocale('vi');
  });

  test('mặc định là tiếng Việt', () => {
    expect(getLocale()).toBe('vi');
    expect(t('btn_start')).toBe('Bắt đầu');
    expect(t('level_select_title')).toBe('Chòm Sao Tiên Tri');
  });

  test('chuyển sang tiếng Anh thành công', () => {
    setLocale('en');
    expect(getLocale()).toBe('en-US');
    expect(t('btn_start')).toBe('Start');
    expect(t('level_select_title')).toBe('Prophecy Constellations');
    expect(t('pause_title')).toBe('Paused');
  });

  test('thay thế tham số động trong chuỗi', () => {
    setLocale('vi');
    expect(t('match_count', { matched: 2, total: 3 })).toBe('2/3 mảnh đã khớp');

    setLocale('en');
    expect(t('match_count', { matched: 2, total: 3 })).toBe('2/3 pieces matched');
  });

  test('dịch tên màn chơi theo ngôn ngữ', () => {
    setLocale('vi');
    expect(getLevelTitle('1-1', 'Song Tinh')).toBe('Song Tinh');

    setLocale('en');
    expect(getLevelTitle('1-1', 'Song Tinh')).toBe('Twin Stars');
    expect(getLevelTitle('9-9', 'Không Tồn Tại')).toBe('Không Tồn Tại');
  });

  test('dịch tên và nhãn chương theo ngôn ngữ', () => {
    setLocale('vi');
    expect(getChapterLabel(1)).toBe('Chương I · Khởi Nguyên');
    expect(getChapterLabel(2)).toBe('Chương II · Giao Thoa');
    expect(getChapterLabel(3)).toBe('Chương III · Luân Chuyển');
    expect(getChapterLabel(4)).toBe('Chương IV · Hội Tụ');
    expect(getChapterLabel(5)).toBe('Chương V · Lăng Kính');

    setLocale('en');
    expect(getChapterLabel(1)).toBe('Chapter I · Genesis');
    expect(getChapterLabel(2)).toBe('Chapter II · Intersections');
    expect(getChapterLabel(3)).toBe('Chapter III · Rotations');
    expect(getChapterLabel(4)).toBe('Chapter IV · Convergence');
    expect(getChapterLabel(5)).toBe('Chapter V · Prism');
  });

  test('dịch các nút HUD và thông báo toast', () => {
    setLocale('vi');
    expect(t('btn_reset')).toBe('Đặt lại');
    expect(t('btn_rotate')).toBe('Xoay');
    expect(t('toast_level_locked', { id: '1-2' })).toBe('Màn 1-2 chưa mở khóa');
    expect(t('toast_level_polishing', { id: '2-1' })).toBe('Màn 2-1 đang được tinh chỉnh');
    expect(t('map_coming_soon')).toBe('Sắp ra mắt');

    setLocale('en');
    expect(t('btn_reset')).toBe('Reset');
    expect(t('btn_rotate')).toBe('Rotate');
    expect(t('toast_level_locked', { id: '1-2' })).toBe('Level 1-2 is locked');
    expect(t('toast_level_polishing', { id: '2-1' })).toBe('Level 2-1 is being polished');
    expect(t('map_coming_soon')).toBe('Coming soon');
  });

  test('listener nhận được thông báo khi đổi ngôn ngữ', () => {
    let notifiedLocale = '';
    const unsubscribe = onLocaleChange((loc) => {
      notifiedLocale = loc;
    });

    setLocale('en');
    expect(notifiedLocale).toBe('en-US');

    unsubscribe();
    setLocale('vi');
    expect(notifiedLocale).toBe('en-US'); // Không còn nhận vì đã unsubscribe
  });
});
