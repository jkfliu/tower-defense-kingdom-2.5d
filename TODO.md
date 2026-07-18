# TODO

## Levels
- [ ] Add additional levels (Level 3 onwards)
- [ ] Multi-path — add secondary path waypoints for Mudflats & Stoneback Ridge (engine + editor done)
- [ ] Editor: "add new path" action — currently new paths are added by hand in `src/data/levels.js`; editor can only edit/move/insert/delete on existing paths.
- [ ] Promote difficulty from per-level (current) to a single campaign-wide setting that cascades to all levels — save payload already carries `difficulty`, so no save migration needed
- [ ] Add Veteran difficulty + per-difficulty stat scaling (HP/count/gold) — config in `src/logic/difficulty.js` is structured for it

## Turrets
- [ ] Tower upgrade tiers (3 tiers per type)

## Assets
- [ ] Create building/construction tower sprite (shown while tower is being placed or built)
- [ ] Create a flying enemy

## Audio
- [ ] Background music (ambient loop per level)

---

## Completed

### Display
- [x] Single responsive canvas (`Scale.FIT` + `autoCenter`), in-canvas HUD (`src/utils/hud.js` `HudOverlay`), DOM HUD removed

### Levels
- [x] Kingdom map / campaign screen (port from Sylvan Defenders)
- [x] Level start / between-wave enemy preview card (with ✕ close button)
- [x] Structured waves with placing phase
- [x] Lives system (enemies reaching end cost 1 life)
- [x] Gold economy (enemies drop gold, towers cost gold)
- [x] Add Level 2 (Goblin Warren) with map, waypoints, placement zones, per-wave difficulty
- [x] Unlock Preview card at level start showing newly available towers and enemies
- [x] Campaign score persisted across levels, reset on game over
- [x] Difficulty select (Easy/Medium) on the level Begin popup — segmented toggle, Medium disabled on single-path levels
- [x] Multi-path support — `paths[]` data model; Easy uses path 0, Medium spreads spawns across all paths; per-enemy assigned path; editor edits every path and exports all paths

### Turrets
- [x] User-defined Barracks rally points (drag-to-place, range/zone-clamped, even iso-ring, runtime proximity ordering)
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
- [x] Extend editor mode to support editing path waypoints (drag, insert, delete) — across all paths on multi-path levels
- [x] Set up DEV_MODE flag enabled at run-time for easier debugging
- [x] Refactored pop-up screens, enabled FocusGroup keyboard navigation (Enter/Space confirm, Left/Right/Tab cycle, Escape dismiss)
- [x] Keyboard nav on Campaign map Begin popup, Restart confirm, Sell popup, Game Over overlay

### Save / Load
- [x] Campaign progress persisted to localStorage — autosaved when a level ends, restored on page load
- [x] Export / Import save files (JSON) for moving progress between browsers/devices — 💾 dropdown next to the map's `?` button
- [x] Versioned save payload (`SAVE_VERSION`) — mismatched or corrupt saves fall back to a fresh game rather than half-loading

### Code quality
- [x] Level-index getter refactor — closed the `_playingLevel`-vs-`_frontierLevel` bug class
- [x] LevelScene refactor pass — pure logic extracted & tested, `BULLET_KINDS` registry, shared helpers (93 tests)
