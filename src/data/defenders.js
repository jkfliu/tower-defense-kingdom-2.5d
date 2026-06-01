// Defender footman — the melee unit spawned and owned by the Barracks tower.
// Kept separate from ENEMY_TYPES so it is never treated as a spawnable enemy.
// Spritesheet: assets/towers/Defender.png — 800x300 → 8 cols x 3 rows of 100x100.
// Rows: 0 = Hurt (8 frames), 1 = Walk (8), 2 = Attack (6). No idle/death rows.
export const DEFENDER_TYPE = {
  key: 'defender',
  spritesheet: 'assets/towers/Defender.png',
  frameWidth: 100,
  frameHeight: 100,
  sheetCols: 8,
  displayScale: 1.6,
  speed: 110,        // px/sec while seeking/returning
  hp: 120,
  damage: 20,        // melee damage per attack
  attackRate: 900,   // ms between melee swings
  meleeRange: 22,    // px proximity to engage / stay engaged
  animations: [
    { key: 'hurt',   row: 0, frames: 8, frameRate: 12, repeat: 0  },
    { key: 'walk',   row: 1, frames: 8, frameRate: 10, repeat: -1 },
    { key: 'attack', row: 2, frames: 6, frameRate: 10, repeat: 0  },
  ],
};
