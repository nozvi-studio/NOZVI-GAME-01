import { describe, expect, it } from 'vitest';
import type { LevelSource, PieceSource } from '../src/content/authoring.ts';
import { daiAnLuanChuyen } from '../src/content/sources/3-10.ts';
import { linkEdges, linkRoles, pressSummary, toggleDrive } from '../src/studio/links.ts';

const tri = (id: string, drives?: string[]): PieceSource => ({
  id,
  shapeKind: 'triangle',
  orientation: 0,
  frameSize: 16,
  anchors: [{ id: 'A', x: 0, y: 0 }],
  ...(drives ? { drives } : {}),
});

const turns = (pairs: Array<[string, number]>): LevelSource['sampleSolutions'] => [
  pairs.map(([pieceId, t]) => ({ pieceId, anchorId: 'A', turns: t as 0 | 1 | 2 | 3 })),
];

describe('linkEdges and linkRoles', () => {
  it('lists the real links of level 3-10 in piece order', () => {
    expect(linkEdges(daiAnLuanChuyen.pieces)).toEqual([
      { from: 'S1', to: 'P1' },
      { from: 'R1', to: 'F1' },
      { from: 'R1', to: 'F2' },
    ]);
  });

  it('ignores self links and unknown ids', () => {
    expect(linkEdges([tri('A', ['A', 'ZZ', 'B']), tri('B')])).toEqual([{ from: 'A', to: 'B' }]);
  });

  it('gives each linked piece a role and leaves the others out', () => {
    expect(linkRoles(daiAnLuanChuyen.pieces)).toEqual({
      S1: 'driver',
      R1: 'driver',
      P1: 'driven',
      F1: 'driven',
      F2: 'driven',
    });
    expect(linkRoles([tri('A', ['B']), tri('B', ['A']), tri('C')])).toEqual({ A: 'both', B: 'both' });
  });
});

describe('toggleDrive', () => {
  it('adds a missing id and removes a present one', () => {
    expect(toggleDrive(['B'], 'C')).toEqual(['B', 'C']);
    expect(toggleDrive(['B', 'C'], 'B')).toEqual(['C']);
  });
});

describe('pressSummary', () => {
  it('is none when nothing is linked', () => {
    expect(pressSummary({ pieces: [tri('A'), tri('B')], sampleSolutions: turns([['A', 1], ['B', 2]]) })).toEqual({
      kind: 'none',
    });
  });

  it('finds the fewest presses: A drives B, target A 1 turn and B 2 turns', () => {
    expect(
      pressSummary({ pieces: [tri('A', ['B']), tri('B')], sampleSolutions: turns([['A', 1], ['B', 2]]) })
    ).toEqual({
      kind: 'plan',
      presses: [
        { id: 'A', count: 1 },
        { id: 'B', count: 1 },
      ],
      total: 2,
    });
  });

  it('needs no presses when every target is 0 turns', () => {
    expect(
      pressSummary({ pieces: [tri('A', ['B']), tri('B')], sampleSolutions: turns([['A', 0], ['B', 0]]) })
    ).toEqual({ kind: 'plan', presses: [], total: 0 });
  });

  it('names the pieces to rethink when the target is unreachable', () => {
    // A and B drive each other, so they always end on the same turn: targets 1 and 2 cannot both hold.
    expect(
      pressSummary({ pieces: [tri('A', ['B']), tri('B', ['A'])], sampleSolutions: turns([['A', 1], ['B', 2]]) })
    ).toEqual({ kind: 'unreachable', culprits: ['A', 'B'] });
  });

  it('declines above eight pieces', () => {
    const many = Array.from({ length: 9 }, (_, i) => tri(`P${i}`, i === 0 ? ['P1'] : undefined));
    expect(pressSummary({ pieces: many, sampleSolutions: turns([]) })).toEqual({ kind: 'too-many' });
  });

  it('level 3-10 has a reachable plan', () => {
    expect(pressSummary(daiAnLuanChuyen).kind).toBe('plan');
  });
});
