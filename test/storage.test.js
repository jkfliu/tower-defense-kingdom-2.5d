import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SAVE_VERSION,
  serializeProgress,
  deserializeProgress,
  loadProgress,
  saveProgress,
  clearProgress,
  importProgressFile,
} from '../src/utils/storage.js';

// storage.js takes the campaign bound as an argument rather than importing
// levels.js, which keeps it free of constants.js (and its `window` access).
// Scene callers pass CAMPAIGN_LEVELS.length - 1; a stand-in serves here.
const MAX_LEVEL = 5;

// A minimal in-memory localStorage stand-in. The real one isn't available under
// vitest's default environment, and stubbing it keeps these tests hermetic.
function stubStorage() {
  const map = new Map();
  const store = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
  vi.stubGlobal('localStorage', store);
  return store;
}

describe('serializeProgress / deserializeProgress', () => {
  it('round-trips a full progress state', () => {
    const state = { currentLevel: 3, campaignScore: 1200, difficulty: 'medium' };
    expect(deserializeProgress(serializeProgress(state))).toEqual(state);
  });

  it('tags the payload with the save version', () => {
    const raw = JSON.parse(serializeProgress({ currentLevel: 1, campaignScore: 0, difficulty: 'easy' }));
    expect(raw.version).toBe(SAVE_VERSION);
  });

  it('returns null for malformed JSON rather than throwing', () => {
    expect(deserializeProgress('{not json')).toBeNull();
  });

  it('returns null for a payload from a different save version', () => {
    const raw = JSON.stringify({ version: SAVE_VERSION + 1, currentLevel: 2, campaignScore: 5, difficulty: 'easy' });
    expect(deserializeProgress(raw)).toBeNull();
  });

  it('returns null when the payload is not an object', () => {
    expect(deserializeProgress('42')).toBeNull();
    expect(deserializeProgress('null')).toBeNull();
  });

  it('clamps currentLevel into the campaign range', () => {
    const high = JSON.stringify({ version: SAVE_VERSION, currentLevel: 999, campaignScore: 0, difficulty: 'easy' });
    expect(deserializeProgress(high, MAX_LEVEL).currentLevel).toBe(MAX_LEVEL);

    const low = JSON.stringify({ version: SAVE_VERSION, currentLevel: -5, campaignScore: 0, difficulty: 'easy' });
    expect(deserializeProgress(low, MAX_LEVEL).currentLevel).toBe(0);
  });

  it('coerces non-numeric fields to safe defaults', () => {
    const raw = JSON.stringify({ version: SAVE_VERSION, currentLevel: 'x', campaignScore: null, difficulty: 'easy' });
    const state = deserializeProgress(raw);
    expect(state.currentLevel).toBe(0);
    expect(state.campaignScore).toBe(0);
  });

  it('falls back to easy for an unknown difficulty', () => {
    const raw = JSON.stringify({ version: SAVE_VERSION, currentLevel: 0, campaignScore: 0, difficulty: 'nightmare' });
    expect(deserializeProgress(raw).difficulty).toBe('easy');
  });
});

describe('loadProgress / saveProgress / clearProgress', () => {
  beforeEach(() => { stubStorage(); });

  it('returns a fresh-game default when nothing is stored', () => {
    expect(loadProgress()).toEqual({ currentLevel: 0, campaignScore: 0, difficulty: 'easy' });
  });

  it('round-trips through storage', () => {
    saveProgress({ currentLevel: 2, campaignScore: 800, difficulty: 'medium' });
    expect(loadProgress()).toEqual({ currentLevel: 2, campaignScore: 800, difficulty: 'medium' });
  });

  it('returns the default when the stored value is corrupt', () => {
    localStorage.setItem('tdk_progress_v1', '{broken');
    expect(loadProgress()).toEqual({ currentLevel: 0, campaignScore: 0, difficulty: 'easy' });
  });

  it('clearProgress wipes the save', () => {
    saveProgress({ currentLevel: 4, campaignScore: 10, difficulty: 'easy' });
    clearProgress();
    expect(loadProgress()).toEqual({ currentLevel: 0, campaignScore: 0, difficulty: 'easy' });
  });

  it('survives localStorage throwing (e.g. private browsing)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    });
    expect(loadProgress()).toEqual({ currentLevel: 0, campaignScore: 0, difficulty: 'easy' });
    expect(() => saveProgress({ currentLevel: 1, campaignScore: 0, difficulty: 'easy' })).not.toThrow();
  });
});

describe('importProgressFile', () => {
  // Stands in for a browser File: importProgressFile only needs text().
  const fakeFile = (contents) => ({ text: () => Promise.resolve(contents) });

  it('resolves with the parsed state for a valid save file', async () => {
    const json = serializeProgress({ currentLevel: 3, campaignScore: 77, difficulty: 'medium' });
    await expect(importProgressFile(fakeFile(json)))
      .resolves.toEqual({ currentLevel: 3, campaignScore: 77, difficulty: 'medium' });
  });

  it('rejects a file that is not valid JSON', async () => {
    await expect(importProgressFile(fakeFile('nope'))).rejects.toThrow();
  });

  it('rejects a save from an incompatible version', async () => {
    const raw = JSON.stringify({ version: SAVE_VERSION + 1, currentLevel: 0, campaignScore: 0, difficulty: 'easy' });
    await expect(importProgressFile(fakeFile(raw))).rejects.toThrow();
  });
});
