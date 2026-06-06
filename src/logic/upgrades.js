// Pure, framework-free tower-upgrade helpers. A tower def may carry an optional
// `upgrades` array; each entry overrides a subset of stats and supplies the art
// for the next level. Level is 1-based (level 1 = base def, no upgrade applied).

// The upgrade entry that takes a tower from `level` → `level + 1`, or null if the
// tower is already at its max level (or has no upgrades).
export function nextUpgrade(def, level) {
  const upgrades = def.upgrades;
  if (!upgrades || level > upgrades.length) return null;
  return upgrades[level - 1] ?? null;
}

// Sell refund: half of everything invested in the tower (build + all upgrades).
export function sellRefund(totalSpent) {
  return Math.floor(totalSpent / 2);
}

// Effective stats for a tower at a given level: the base def with each upgrade up
// to `level` shallow-merged on top. Never mutates the base def. `level` is clamped
// to the highest defined upgrade level.
export function mergedStats(def, level) {
  const stats = { ...def };
  const upgrades = def.upgrades ?? [];
  const max = Math.min(level, upgrades.length + 1);
  for (let l = 2; l <= max; l++) {
    Object.assign(stats, upgrades[l - 2]);
  }
  return stats;
}
