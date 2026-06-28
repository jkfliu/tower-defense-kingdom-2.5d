import { describe, it, expect } from 'vitest';
import { DIFFICULTIES, activePathCount, pickPathIndex } from '../src/logic/difficulty.js';

describe('DIFFICULTIES', () => {
  it('defines easy and medium', () => {
    expect(DIFFICULTIES.easy).toBeTruthy();
    expect(DIFFICULTIES.medium).toBeTruthy();
  });
});

describe('activePathCount', () => {
  // Easy uses only the primary path; Medium uses every defined path.
  it('easy always uses a single path', () => {
    expect(activePathCount('easy', 1)).toBe(1);
    expect(activePathCount('easy', 3)).toBe(1);
  });

  it('medium uses all available paths', () => {
    expect(activePathCount('medium', 1)).toBe(1);
    expect(activePathCount('medium', 3)).toBe(3);
  });

  it('never returns more than the paths that exist', () => {
    // A level with only one path can never have two active, even on Medium.
    expect(activePathCount('medium', 1)).toBe(1);
  });

  it('returns at least 1 and defaults unknown difficulty to a single path', () => {
    expect(activePathCount('veteran', 3)).toBe(1);
    expect(activePathCount(undefined, 3)).toBe(1);
  });
});

describe('pickPathIndex', () => {
  it('returns 0 when only one path is active', () => {
    for (let i = 0; i < 20; i++) expect(pickPathIndex(1)).toBe(0);
  });

  it('always returns an in-range integer index', () => {
    for (let i = 0; i < 200; i++) {
      const idx = pickPathIndex(3);
      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(3);
    }
  });

  it('can reach every active path index', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) seen.add(pickPathIndex(3));
    expect(seen).toEqual(new Set([0, 1, 2]));
  });
});
