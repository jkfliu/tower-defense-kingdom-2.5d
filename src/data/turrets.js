export const TURRET_TYPES = {
  basic: {
    key: 'basic',
    spritesheet: 'assets/TowerArcher.png',
    frameWidth: 843,
    frameHeight: 1067,
    frameIndex: 0,       // first frame = vines variant
    displayScale: 0.08,  // scale down to fit tile world
    range: 180,
    minSpacing: 120,
    fireRate: 900,
    damage: 25,
    bulletSpeed: 260,
    bulletColor: 0xffdd00,
  },
};
