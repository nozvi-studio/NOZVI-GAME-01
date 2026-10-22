import { describe, expect, test } from 'vitest';
import { FtueController } from '../src/application/ftue.ts';

describe('FTUE Tutorial Guidance', () => {
  const steps = [
    {
      id: 'drag-first',
      trigger: 'idle' as const,
      end: 'drag-start' as const,
      text: 'Kéo mảnh vào bóng mục tiêu',
    },
    {
      id: 'second-step',
      trigger: 'first-snap' as const,
      end: 'snap' as const,
      text: 'Đặt mảnh thứ hai tiếp giáp',
    },
  ];

  test('khởi động với bước idle hiển thị chỉ dẫn đầu tiên', () => {
    const ftue = new FtueController(steps);
    const state = ftue.getState();

    expect(state.visible).toBe(true);
    expect(state.stepId).toBe('drag-first');
    expect(state.text).toBe('Kéo mảnh vào bóng mục tiêu');
  });

  test('khi người chơi bắt đầu kéo (drag-start), chỉ dẫn biến mất ngay', () => {
    const ftue = new FtueController(steps);
    ftue.onAction('drag-start');

    const state = ftue.getState();
    expect(state.visible).toBe(false);
    expect(state.text).toBeNull();
  });

  test('kích hoạt bước tiếp theo qua onEvent', () => {
    const ftue = new FtueController(steps);
    ftue.onAction('drag-start');

    ftue.onEvent('first-snap');
    const state = ftue.getState();
    expect(state.visible).toBe(true);
    expect(state.stepId).toBe('second-step');
    expect(state.text).toBe('Đặt mảnh thứ hai tiếp giáp');

    ftue.onAction('snap');
    expect(ftue.getState().visible).toBe(false);
  });
});
