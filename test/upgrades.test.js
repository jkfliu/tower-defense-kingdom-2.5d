import { describe, it, expect } from 'vitest';
import { nextUpgrade, sellRefund, mergedStats, upgradeCost } from '../src/logic/upgrades.js';

// A minimal mage-like def with one upgrade level. Upgrade cost is derived
// (0.7 × base cost), so upgrade entries no longer carry their own cost.
const mage = {
  key: 'mage',
  image: 'L1.png',
  damage: 100,
  range: 170,
  fireRate: 1400,
  cost: 70,
  bulletType: 'orb',
  upgrades: [
    { image: 'L2.png', damage: 160, range: 195, fireRate: 1200 },
  ],
};

const plain = { key: 'arrow', damage: 25, cost: 40 }; // no upgrades

describe('nextUpgrade', () => {
  it('returns the level-2 upgrade when at level 1', () => {
    expect(nextUpgrade(mage, 1)).toBe(mage.upgrades[0]);
  });

  it('returns null when already at max level', () => {
    expect(nextUpgrade(mage, 2)).toBe(null);
  });

  it('returns null for a tower with no upgrades', () => {
    expect(nextUpgrade(plain, 1)).toBe(null);
  });
});

describe('sellRefund', () => {
  it('refunds half the total spent, floored', () => {
    expect(sellRefund(70)).toBe(35);
    expect(sellRefund(140)).toBe(70);
    expect(sellRefund(75)).toBe(37);
  });
});

describe('upgradeCost', () => {
  it('is 0.8 × base cost, rounded to the nearest whole number', () => {
    expect(upgradeCost({ cost: 70 })).toBe(56);   // 56.0
    expect(upgradeCost({ cost: 80 })).toBe(64);   // 64.0
    expect(upgradeCost({ cost: 100 })).toBe(80);  // 80.0
    expect(upgradeCost({ cost: 40 })).toBe(32);   // 32.0
    expect(upgradeCost({ cost: 45 })).toBe(36);   // 36.0
  });
});

describe('mergedStats', () => {
  it('returns base stats at level 1', () => {
    const s = mergedStats(mage, 1);
    expect(s.damage).toBe(100);
    expect(s.range).toBe(170);
    expect(s.fireRate).toBe(1400);
    expect(s.image).toBe('L1.png');
  });

  it('applies the level-2 overrides, leaving untouched fields intact', () => {
    const s = mergedStats(mage, 2);
    expect(s.damage).toBe(160);
    expect(s.range).toBe(195);
    expect(s.fireRate).toBe(1200);
    expect(s.image).toBe('L2.png');
    expect(s.bulletType).toBe('orb');   // not overridden → preserved
  });

  it('does not mutate the base def', () => {
    mergedStats(mage, 2);
    expect(mage.damage).toBe(100);
    expect(mage.image).toBe('L1.png');
  });

  it('clamps to the highest defined level', () => {
    const s = mergedStats(mage, 5);   // only 2 levels exist
    expect(s.damage).toBe(160);
  });
});
