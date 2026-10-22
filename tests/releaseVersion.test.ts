import { expect, test } from 'vitest';
import pkg from '../package.json';

test('release branch identifies version 1.0.0', () => {
  expect(pkg.version).toBe('1.0.0');
});
