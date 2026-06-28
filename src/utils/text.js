// Title-case a camelCase identifier for display:
//   'skeletonArcher' → 'Skeleton Archer', 'evilPriest' → 'Evil Priest'.
// Shared by the in-game labels (LevelScene) and the dictionary page.
export function titleCaseKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
}
