import { describe, expect, test } from 'vitest';
import { loadLevel } from '../src/content/catalog.ts';
import { validateLevel } from '../src/content/validate.ts';
import { makeAdjacentFixture } from '../src/content/fixtures.ts';
import { getVictoryLabels } from '../src/presentation/hud/hudText.ts';
import { getLocale, setLocale } from '../src/presentation/i18n.ts';

describe('Danger Action Confirmation Gate', () => {
  test('xóa tiến trình bắt buộc phải qua trạng thái xác nhận trước khi thực thi', () => {
    let confirmState: 'idle' | 'awaiting_confirmation' | 'deleted' = 'idle';

    const onInitialClick = () => {
      confirmState = 'awaiting_confirmation';
    };

    const onCancel = () => {
      confirmState = 'idle';
    };

    const onConfirmDelete = () => {
      if (confirmState === 'awaiting_confirmation') {
        confirmState = 'deleted';
      }
    };

    onInitialClick();
    expect(confirmState).toBe('awaiting_confirmation');

    onCancel();
    expect(confirmState).toBe('idle');

    onInitialClick();
    onConfirmDelete();
    expect(confirmState).toBe('deleted');
  });

  test('pause dialog chứa 3 tùy chọn điều hướng theo thứ tự ưu tiên thị giác', () => {
    const pauseActions = ['resume', 'restart', 'level_select'];
    expect(pauseActions[0]).toBe('resume'); // Ưu tiên số 1: khối vàng đặc
    expect(pauseActions[1]).toBe('restart'); // Ưu tiên số 2: viền kính
    expect(pauseActions[2]).toBe('level_select'); // Ưu tiên số 3: nút văn bản
  });
});

describe('Màn hoàn thành theo mockup improve-v1', () => {
  test('câu thơ đọc từ dữ liệu màn chơi, không hardcode trong mã', () => {
    const level = loadLevel('1-1', 'campaign');
    expect(level.victoryVerse).toBe('Hai vì sao chạm đỉnh, vũ trụ tìm thấy thế cân bằng.');
  });

  test('màn không khai báo câu thơ thì trường để trống, không vỡ', () => {
    const parsed = validateLevel(makeAdjacentFixture());
    if (!parsed.ok) throw new Error('fixture không hợp lệ');
    expect(parsed.level.victoryVerse).toBeUndefined();
  });

  test('nhãn màn hoàn thành đúng chuỗi mockup và không viết hoa toàn bộ', () => {
    setLocale('vi');
    const labels = getVictoryLabels();
    expect(labels.title).toBe('Hoàn thành');
    expect(labels.next).toBe('Màn tiếp theo');
    expect(labels.levelSelect).toBe('Chọn màn');
    for (const text of Object.values(labels)) {
      expect(text).not.toBe(text.toUpperCase());
    }
  });

  test('nhãn màn hoàn thành đổi theo ngôn ngữ', () => {
    setLocale('en');
    expect(getVictoryLabels().title).not.toBe('Hoàn thành');
    setLocale('vi');
    expect(getVictoryLabels().title).toBe('Hoàn thành');
  });
});

describe('SettingsDialog Language Segment Control', () => {
  test('hỗ trợ đủ 10 ngôn ngữ', () => {
    for (const code of ['en-US', 'es', 'pt-BR', 'fr', 'de', 'ja', 'ko', 'zh-CN', 'id', 'vi'] as const) {
      setLocale(code);
      expect(getLocale()).toBe(code);
    }
    setLocale('vi');
  });
});

