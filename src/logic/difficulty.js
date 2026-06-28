// Difficulty settings and path-assignment helpers. Pure and framework-free so the
// logic is unit-testable (no Phaser, no window).
//
// Easy reproduces the original single-path game. Medium activates every path a level
// defines and spreads each spawn randomly across them (Option B). The config is kept
// open so future fields (e.g. enemy HP/count scaling) can be added per difficulty.
export const DIFFICULTIES = {
  easy:   { label: 'Easy',   activePaths: 1 },
  medium: { label: 'Medium', activePaths: 'all' },
};

// How many of a level's `totalPaths` are active for the given difficulty. Always at
// least 1, never more than the paths that actually exist. Unknown/undefined
// difficulty falls back to a single path (Easy behaviour).
export function activePathCount(difficulty, totalPaths) {
  const cfg = DIFFICULTIES[difficulty];
  if (cfg?.activePaths === 'all') return Math.max(1, totalPaths);
  return 1;
}

// Pick a random active path index in [0, activeCount). With one active path this is
// always 0, so Easy spawns are unaffected.
export function pickPathIndex(activeCount) {
  return Math.floor(Math.random() * Math.max(1, activeCount));
}
