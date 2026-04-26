export const TURRET_TYPES = {
  basic: {
    key: 'basic',
    label: 'Archer Tower',
    spritesheet: 'assets/TowerArcher.png',
    frameWidth: 843,
    frameHeight: 1067,
    frameIndex: 0,       // first frame = vines variant
    displayScale: 0.08,  // scale down to fit tile world
    cost: 40,
    range: 180,
    minSpacing: 120,
    fireRate: 900,
    damage: 25,
    bulletSpeed: 260,
    bulletColor: 0xffdd00,
  },
};
