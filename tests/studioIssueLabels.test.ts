import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ISSUE_LABELS, describeIssue, issueLabel } from '../src/studio/issueLabels.ts';

const validatorSource = readFileSync(new URL('../src/content/validate.ts', import.meta.url), 'utf8');
const literalCodes = [...new Set([...validatorSource.matchAll(/code: '([a-z0-9-]+)'/g)].map((m) => m[1]))];

describe('Studio issue labels', () => {
  it('reads a believable number of codes from the validator', () => {
    expect(literalCodes.length).toBeGreaterThan(40);
  });

  it('has a label for every literal validator code', () => {
    const missing = literalCodes.filter((code) => !ISSUE_LABELS[code]);
    expect(missing).toEqual([]);
  });

  it('labels the dynamic no-overlap code per chapter', () => {
    expect(issueLabel('chapter-1-no-overlap')).toContain('Chương 1');
    expect(issueLabel('chapter-3-no-overlap')).toContain('Chương 3');
  });

  it('describeIssue shows label and code, or the raw code when unknown', () => {
    expect(describeIssue('drives-self')).toBe(`${ISSUE_LABELS['drives-self']} (drives-self)`);
    expect(describeIssue('something-new')).toBe('something-new');
  });
});
