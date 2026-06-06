// Melee units spawned and owned by the Barracks tower. Kept separate from
// ENEMY_TYPES so they are never treated as spawnable enemies. Which unit a Barracks
// fields depends on its upgrade level (see DEFENDER_TYPES, keyed by tower level).
//
// Spritesheets are 800x300 → 8 cols x 3 rows of 100x100.
// Rows: 0 = Hurt (8 frames), 1 = Walk (8), 2 = Attack (6). No idle/death rows.

const ANIMS = [
  { key: 'hurt',   row: 0, frames: 8, frameRate: 12, repeat: 0  },
  { key: 'walk',   row: 1, frames: 8, frameRate: 10, repeat: -1 },
  { key: 'attack', row: 2, frames: 6, frameRate: 10, repeat: 0  },
];

// L1 footman.
export const DEFENDER_TYPE = {
  key: 'defender',
  spritesheet: 'assets/towers/Defender_Defender.L1.png',
  frameWidth: 100,
  frameHeight: 100,
  sheetCols: 8,
  displayScale: 1.6,
  speed: 110,        // px/sec while seeking/returning
  hp: 120,
  damage: 20,        // melee damage per attack
  attackRate: 900,   // ms between melee swings
  meleeRange: 22,    // px proximity to engage / stay engaged
  animations: ANIMS,
};

// L2 warden — a tougher veteran fielded by an upgraded (L2) Barracks.
export const WARDEN_TYPE = {
  key: 'warden',
  spritesheet: 'assets/towers/Defender_Warden.L2.png',
  frameWidth: 100,
  frameHeight: 100,
  sheetCols: 8,
  displayScale: 1.6,
  speed: 110,
  hp: 200,
  damage: 32,
  attackRate: 800,
  meleeRange: 22,
  animations: ANIMS,
};

// All defender unit types, indexed for preload/anim building.
export const DEFENDER_TYPES = [DEFENDER_TYPE, WARDEN_TYPE];

// The defender unit a Barracks fields at a given (1-based) tower level. Clamps to
// the highest defined unit so levels beyond the table still resolve.
export function defenderForLevel(level) {
  return DEFENDER_TYPES[Math.min(level, DEFENDER_TYPES.length) - 1];
}
