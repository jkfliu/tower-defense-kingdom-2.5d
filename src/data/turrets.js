export const TURRET_TYPES = {
  arrow: {
    key: 'arrow',
    label: 'Archer Tower',
    image: 'assets/towers/Firefly_Gemini_archer_tower.128x128.png',
    displayScale: 0.6,
    cost: 40,
    range: 180,
    minSpacing: 120,
    fireRate: 900,
    damage: 25,
    bulletSpeed: 260,
    bulletColor: 0xffdd00,
    bulletType: 'arrow',
    hitRadius: 15,
    arcDuration: 0.5,
    arcHeight: 60,
  },
  mage: {
    key: 'mage',
    label: 'Mage Tower',
    image: 'assets/towers/Mystic_Dais_Tower.L1.png',
    displayScale: 0.75,
    cost: 70,
    range: 170,
    minSpacing: 120,
    fireRate: 1400,
    damage: 100,
    bulletSpeed: 120,
    bulletColor: 0x9933ff,
    bulletType: 'orb',
    hitRadius: 20,
    // Upgrade levels (1-based: base is L1). Each entry overrides a subset of stats
    // and supplies the art for that level. Loaded as turret_mage_2, etc.
    upgrades: [
      { image: 'assets/towers/Mystic_Dais_Tower.L2.png', cost: 70, damage: 160, range: 195, fireRate: 1200 },
    ],
  },
  bomber: {
    key: 'bomber',
    label: 'Bomber Tower',
    image: 'assets/towers/Firefly_Gemini_bomber_tower.128x128.png',
    displayScale: 0.7,
    cost: 100,
    range: 160,
    minSpacing: 120,
    fireRate: 2500,
    damage: 60,
    splashRadius: 50,
    bulletColor: 0xff6600,
    bulletType: 'bomb',
    arcDuration: 1.0,
    arcHeight: 80,
  },
  barracks: {
    key: 'barracks',
    label: 'Barracks',
    image: 'assets/towers/Defender_Barracks_Tower.L1.png',
    displayScale: 0.7,
    cost: 80,
    range: 170,
    minSpacing: 120,
    bulletType: 'none',   // spawns Defenders instead of firing projectiles
    defenderCount: 2,
    respawnDelay: 5000,   // ms before a dead Defender respawns
    rallyStagger: 25,     // px each Defender stands up-/down-path from the choke
    // L2: wider patrol + faster reinforcements. (Warden unit swap to follow once
    // its sprite is ready; for now the L2 Barracks still fields the base Defender.)
    upgrades: [
      { image: 'assets/towers/Defender_Barracks_Tower.L2.png', cost: 80, range: 200, respawnDelay: 4000 },
    ],
  },
};
