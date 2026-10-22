import { describe, expect, test } from 'vitest';
import { TransitionTimeline } from '../src/presentation/transitions/TransitionTimeline.ts';

describe('TransitionTimeline', () => {
  test('tween tuyến tính theo thời gian, giá trị đầu lấy lúc tween bắt đầu', () => {
    const target = { x: 0 };
    const tl = new TransitionTimeline().at(100, target, { x: 10 }, 200, 'linear');
    target.x = 4; // đổi trước khi tween bắt đầu: tween phải đi từ 4
    tl.advance(100);
    expect(target.x).toBe(4);
    tl.advance(100);
    expect(target.x).toBeCloseTo(7, 9);
    tl.advance(100);
    expect(target.x).toBe(10);
    expect(tl.isFinished()).toBe(true);
  });

  test('originMs dời mốc: mốc tuyến 300 với origin 200 chạy ở mốc riêng 100', () => {
    const target = { a: 0 };
    const tl = new TransitionTimeline(200).at(300, target, { a: 1 }, 100, 'linear');
    expect(tl.durationMs).toBe(200);
    tl.advance(150);
    expect(target.a).toBeCloseTo(0.5, 9);
  });

  test('call chạy đúng một lần khi qua mốc', () => {
    const calls: number[] = [];
    const tl = new TransitionTimeline().call(50, () => calls.push(50));
    tl.advance(49);
    expect(calls).toEqual([]);
    tl.advance(1);
    tl.advance(10);
    expect(calls).toEqual([50]);
  });

  test('complete đưa mọi tween về đích, chạy call còn lại theo thứ tự mốc, đúng một lần', () => {
    const order: string[] = [];
    const a = { v: 0 };
    const tl = new TransitionTimeline()
      .call(300, () => order.push('c300'))
      .at(100, a, { v: 5 }, 100, 'cubicOut', () => order.push(`u${a.v}`))
      .call(0, () => order.push('c0'));
    tl.advance(0);
    tl.complete();
    tl.complete();
    expect(a.v).toBe(5);
    expect(order).toEqual(['c0', 'u5', 'c300']);
  });

  test('onDone chạy một lần khi xong; đăng ký sau khi xong thì chạy ngay', () => {
    let done = 0;
    const tl = new TransitionTimeline().at(0, { v: 0 }, { v: 1 }, 10).onDone(() => done++);
    tl.advance(5);
    expect(done).toBe(0);
    tl.advance(5);
    tl.advance(5);
    expect(done).toBe(1);
    tl.onDone(() => done++);
    expect(done).toBe(2);
  });

  test('timeline rỗng xong ngay ở advance(0)', () => {
    let done = false;
    const tl = new TransitionTimeline().onDone(() => (done = true));
    tl.advance(0);
    expect(done).toBe(true);
    expect(tl.durationMs).toBe(0);
  });

  test('tween thời lượng 0 nhảy thẳng tới đích', () => {
    const t = { y: 3 };
    new TransitionTimeline().at(0, t, { y: 9 }, 0).advance(0);
    expect(t.y).toBe(9);
  });
});
