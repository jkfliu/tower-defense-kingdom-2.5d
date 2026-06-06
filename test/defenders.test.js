import { describe, it, expect } from 'vitest';
import { defenderForLevel, DEFENDER_TYPE, WARDEN_TYPE } from '../src/data/defenders.js';

describe('defenderForLevel', () => {
  it('fields the footman at level 1', () => {
    expect(defenderForLevel(1)).toBe(DEFENDER_TYPE);
  });

  it('fields the warden at level 2', () => {
    expect(defenderForLevel(2)).toBe(WARDEN_TYPE);
  });

  it('clamps levels beyond the table to the highest unit', () => {
    expect(defenderForLevel(3)).toBe(WARDEN_TYPE);
    expect(defenderForLevel(99)).toBe(WARDEN_TYPE);
  });

  it('the two units are distinct sprites', () => {
    expect(DEFENDER_TYPE.spritesheet).not.toBe(WARDEN_TYPE.spritesheet);
    expect(DEFENDER_TYPE.key).not.toBe(WARDEN_TYPE.key);
  });
});
