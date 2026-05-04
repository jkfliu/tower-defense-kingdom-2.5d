# TODO

## Levels
- [ ] Add additional levels (Level 3 onwards)
- [ ] Multi-path support — enemies split across branching routes (requires data model change: `waypoints` → `paths[]`, enemy assigned a path on spawn, editor extended to edit multiple paths)
- [ ] Difficulty select in campaign map level popup (Easy / Normal / Hard)

## Turrets
- [ ] Tower upgrade tiers (3 tiers per type)

## Assets
- [ ] Create building/construction tower sprite (shown while tower is being placed or built)
- [ ] Create a flying enemy

## Audio
- [ ] Background music (ambient loop per level)

---

## Completed

### Levels
- [x] Kingdom map / campaign screen (port from Sylvan Defenders)
- [x] Level start / between-wave enemy preview card (with ✕ close button)
- [x] Structured waves with placing phase
- [x] Lives system (enemies reaching end cost 1 life)
- [x] Gold economy (enemies drop gold, towers cost gold)
- [x] Add Level 2 (Goblin Warren) with map, waypoints, placement zones, per-wave difficulty
- [x] Unlock Preview card at level start showing newly available towers and enemies
- [x] Campaign score persisted across levels, reset on game over

### Turrets
- [x] Set up sprites for Arrow tower and bullets
- [x] Restrict placement of turrets (only allow on valid zones)
- [x] Tower sell mechanic (50% refund)
- [x] Set up Mage tower type (second turret type)
- [x] Bullet trajectory — arrows arc with lead targeting; orbs travel straight with multi-waypoint lead
- [x] Add Bomber Tower (AoE splash, arc trajectory, explosion flash)
- [x] Find ground explosion sprite for Bomber Tower impact (currently using programmatic ellipse flash)
- [x] Mage Tower unlocked at Level 2 (Goblin Warren)
- [x] Bomber Tower unlocked at Level 3 (Mudflats)
- [x] Tower unlock framework — locked towers greyed out with lock icon + level name

### Assets
- [x] Set up enemy Orcs
- [x] Add variety of enemies on a level + vary their spawn timing and speed
- [x] Add Slime and Werebear enemies with full animation support
- [x] Dynamic wave spawn pools via waveProgression (interpolated weights per wave)

### UI
- [x] Created Debug mode (keyboard "D")
- [x] Extend editor mode to support editing path waypoints (drag, insert, delete)
- [x] Set up DEV_MODE flag enabled at run-time for easier debugging
- [x] Refactored pop-up screens, enabled FocusGroup keyboard navigation (Enter/Space confirm, Left/Right/Tab cycle, Escape dismiss)
- [x] Keyboard nav on Campaign map Begin popup, Restart confirm, Sell popup, Game Over overlay
