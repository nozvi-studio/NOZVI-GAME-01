import { describe, expect, test } from 'vitest';
import { loadLevel } from '../src/content/catalog.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { parFromSolution } from '../src/domain/starRating.ts';
import { validateLevel } from '../src/content/validate.ts';
import levelJson from '../src/content/levels/1-1.json';

describe('parMs on loaded levels', () => {
  test('every approved campaign level has parMs equal to its first solution par', () => {
    const approved = campaignManifest.filter((m) => m.status === 'approved');
    expect(approved.length).toBeGreaterThan(0);
    for (const entry of approved) {
      const level = loadLevel(entry.id, 'campaign');
      expect(level.parMs, entry.id).toBe(parFromSolution(level.targetPlacements ?? []));
    }
  });
});

test('a stored parMs that disagrees with the solution is rejected', () => {
  const result = validateLevel({ ...(levelJson as any), parMs: 1 });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.issues.some((i) => i.code === 'par-mismatch')).toBe(true);
});

test('a document without parMs still validates and gets a computed parMs', () => {
  const { parMs: _drop, ...rest } = levelJson as any;
  const result = validateLevel(rest);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.level.parMs).toBeGreaterThan(0);
});
