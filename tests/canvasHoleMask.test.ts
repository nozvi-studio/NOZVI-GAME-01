import { expect, it } from 'vitest';
import { clipOutsideHoles } from '../src/presentation/board/canvasHoleMask.ts';

function recorder() {
  const calls: string[] = [];
  const rec = (name: string) => (...args: unknown[]) => { calls.push(`${name}(${args.join(',')})`); };
  const ctx = {
    canvas: { width: 300, height: 600 },
    save: rec('save'), setTransform: rec('setTransform'), beginPath: rec('beginPath'), rect: rec('rect'),
    moveTo: rec('moveTo'), lineTo: rec('lineTo'), closePath: rec('closePath'), clip: rec('clip'),
  };
  return { ctx, calls };
}

const square = (x: number, y: number) => [{ x, y }, { x: x + 10, y }, { x: x + 10, y: y + 10 }, { x, y: y + 10 }];

it('saves once and cuts every hole with its own even-odd clip over the whole canvas', () => {
  const { ctx, calls } = recorder();
  clipOutsideHoles(ctx as never, [square(0, 0), square(5, 5)], { a: 2, b: 0, c: 0, d: 2, e: 7, f: 9 });
  expect(calls.filter(c => c === 'save()')).toHaveLength(1);
  expect(calls.filter(c => c === 'clip(evenodd)')).toHaveLength(2);
  expect(calls.filter(c => c === 'rect(0,0,300,600)')).toHaveLength(2);
  // The canvas rectangle is added in device space, the hole through the world matrix.
  const first = calls.slice(0, calls.indexOf('clip(evenodd)') + 1);
  expect(first).toEqual([
    'save()', 'beginPath()', 'setTransform(1,0,0,1,0,0)', 'rect(0,0,300,600)', 'setTransform(2,0,0,2,7,9)',
    'moveTo(0,0)', 'lineTo(10,0)', 'lineTo(10,10)', 'lineTo(0,10)', 'closePath()', 'clip(evenodd)',
  ]);
});

it('with no holes it only saves, so the matching restore leaves the context unchanged', () => {
  const { ctx, calls } = recorder();
  clipOutsideHoles(ctx as never, [], { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  expect(calls).toEqual(['save()']);
});

it('the board wires the Canvas clip into both inverted hole masks', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/presentation/board/BoardRenderer.ts', import.meta.url), 'utf8');
  expect(src).toContain('invertOnCanvas(this.holeMask, this.holeShape');
  expect(src).toContain('invertOnCanvas(this.deepHoleMask, this.deepHoleShape');
});
