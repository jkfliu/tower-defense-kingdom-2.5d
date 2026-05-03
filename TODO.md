# TODO

## Turrets
- [ ] Tower upgrade tiers (3 tiers per type)
- [ ] Mage Tower unlocked at Level 2 (locked/greyed out before then)
- [ ] Bomber Tower unlocked at Level 3 (locked/greyed out before then)

## Levels
- [ ] Difficulty select in campaign map level popup (Easy / Normal / Hard)
- [ ] Add additional levels (Level 3 onwards)
- [ ] Multi-path support — enemies split across branching routes (requires data model change: `waypoints` → `paths[]`, enemy assigned a path on spawn, editor extended to edit multiple paths)

## Enemies
- [ ] Add Werebear and Slime to level wave configs (currently defined in enemies.js but not spawned)

## Assets
- [ ] Find ground explosion sprite for Bomber Tower impact (currently using programmatic ellipse flash)
- [ ] Create building/construction tower sprite (shown while tower is being placed or built)

## UI
- [ ] 'Unlock Preview' popup shown below the Wave Preview popup — teases which tower or enemy is unlocked next

## Audio
- [ ] Web Audio (arrow shot, enemy death sounds)

---

## Completed

### Turrets
- [x] Set up sprites for Arrow tower and bullets
- [x] Restrict placement of turrets (only allow on valid zones)
- [x] Tower sell mechanic (50% refund)
- [x] Set up Mage tower type (second turret type)
- [x] Bullet trajectory — arrows arc with lead targeting; orbs travel straight with multi-waypoint lead
- [x] Add Bomber Tower (AoE splash, arc trajectory, explosion flash)

### Levels
- [x] Kingdom map / campaign screen (port from Sylvan Defenders)
- [x] Level start / between-wave enemy preview card (with ✕ close button)
- [x] Structured waves with placing phase
- [x] Lives system (enemies reaching end cost 1 life)
- [x] Gold economy (enemies drop gold, towers cost gold)
- [x] Add Level 2 (Goblin Warren) with map, waypoints, placement zones, per-wave difficulty

### Enemies
- [x] Set up enemy Orcs
- [x] Add variety of enemies on a level + vary their spawn timing and speed

### Editor
- [x] Extend editor mode to support editing path waypoints (drag, insert, delete)
