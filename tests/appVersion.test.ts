import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { APP_VERSION } from '../src/appVersion.ts';

describe('APP_VERSION', () => {
  it('is the package.json version', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });
});
