# TODO

## Levels
- [ ] Add additional levels (Level 3 onwards)
- [ ] Multi-path support — engine + editor done (Easy = path 0; Medium spreads spawns across all `level.paths`; editor edits every path; export dumps all paths). REMAINING: supply secondary path waypoints for Mudflats and Stoneback Ridge (Goblin Warren done).
- [ ] Editor: "add new path" action — currently new paths are added by hand in `src/data/levels.js`; editor can only edit/move/insert/delete on existing paths.
- [ ] Promote difficulty from per-level (current) to a single campaign-wide setting that cascades to all levels
- [ ] Add Veteran difficulty + per-difficulty stat scaling (HP/count/gold) — config in `src/logic/difficulty.js` is structured for it

## Turrets
- [ ] **(Priority)** User-defined rally points for Barracks defenders — let the player drag/set where a Barracks' defenders stand guard, instead of the fixed auto-placed rally points
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
