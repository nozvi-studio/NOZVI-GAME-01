import { describe, expect, test } from 'vitest';
import { LevelClock } from '../src/application/levelClock.ts';

describe('LevelClock', () => {
  test('does not count before start', () => {
    const c = new LevelClock();
    c.tick(500);
    expect(c.elapsedMs).toBe(0);
    expect(c.started).toBe(false);
  });
  test('counts only after start and stops on stop', () => {
    const c = new LevelClock();
    c.start();
    c.tick(300);
    c.tick(200);
    expect(c.elapsedMs).toBe(500);
    c.stop();
    c.tick(1000);
    expect(c.elapsedMs).toBe(500);
    expect(c.running).toBe(false);
  });
  test('start after stop does not resume', () => {
    const c = new LevelClock();
    c.start();
    c.tick(100);
    c.stop();
    c.start();
    c.tick(100);
    expect(c.elapsedMs).toBe(100);
  });
  test('reset returns to not started', () => {
    const c = new LevelClock();
    c.start();
    c.tick(100);
    c.reset();
    expect(c.elapsedMs).toBe(0);
    expect(c.started).toBe(false);
    c.start();
    c.tick(50);
    expect(c.elapsedMs).toBe(50);
  });
});
