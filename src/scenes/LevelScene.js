import { CANVAS_W, CANVAS_H, scaleX, scaleY, DEFAULT_LIVES, DEFAULT_WAVES } from '../constants.js';
import { LEVELS } from '../data/levels.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { TURRET_TYPES } from '../data/turrets.js';

export default class LevelScene extends Phaser.Scene {
  constructor() { super('LevelScene'); }

  preload() {
    const level = LEVELS[0]; // background is shared for now — all levels use level 0's map
    this.load.image('bg', level.background);
    for (const enemy of Object.values(ENEMY_TYPES)) {
      this.load.spritesheet(enemy.key, enemy.spritesheet, {
        frameWidth: enemy.frameWidth,
        frameHeight: enemy.frameHeight,
      });
    }
    for (const turret of Object.values(TURRET_TYPES)) {
      this.load.spritesheet(`turret_${turret.key}`, turret.spritesheet, {
        frameWidth: turret.frameWidth,
        frameHeight: turret.frameHeight,
      });
    }
    this.load.image('arrow', 'assets/Arrow_01.png');
  }

  create(data = {}) {
    // Support levelId passed from MapScene; fall back to level 0
    const levelId = data.levelId ?? 0;
    this._currentLevel = data.currentLevel ?? levelId; // campaign progress
    this.levelConfig = LEVELS[Math.min(levelId, LEVELS.length - 1)];

    this._buildAnims();

    const bg = this.add.image(0, 0, 'bg').setOrigin(0, 0);
    bg.setDisplaySize(CANVAS_W, CANVAS_H);
    bg.setDepth(-1);

    // Game entity arrays
    this.turrets    = [];
    this.enemies    = [];
    this.bullets    = [];
    this.enemyId    = 0;

    // Economy & game state
    this.gold        = this.levelConfig.startGold ?? 100;
    this.lives       = this.levelConfig.lives      ?? DEFAULT_LIVES;
    this.totalWaves  = this.levelConfig.waves       ?? DEFAULT_WAVES;
    this.wave        = 0;
    this.score       = 0;
    this.phase       = 'placing'; // 'placing' | 'wave' | 'between' | 'gameover' | 'victory'
    this.spawnedCount    = 0;
    this.enemiesPerWave  = this.levelConfig.enemiesPerWave ?? 8;
    this.spawnTimer      = 0;
    this.spawnInterval   = this._nextSpawnDelay();
    this._betweenTimer   = 0;

    this.waypoints = this.levelConfig.waypoints;

    this._towerPopup = null; // { x, y, cards: [...Text] } or null

    this.debugGraphics   = this.add.graphics().setDepth(50);
    this.entityGraphics  = this.add.graphics().setDepth(9999);
    this.previewGraphics = this.add.graphics().setDepth(200);

    this._redrawDebug();

    // --- Overlay layer (gameover / victory / between) ---
    this.overlayGraphics = this.add.graphics().setDepth(1000);
    this.overlayText     = this.add.text(CANVAS_W / 2, CANVAS_H / 2 - 20, '', {
      fontSize: '42px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(1001).setVisible(false);
    this.overlaySubText  = this.add.text(CANVAS_W / 2, CANVAS_H / 2 + 36, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#cccccc',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1001).setVisible(false);

    // --- Start Wave button (Phaser DOM) ---
    this.startWaveBtn = this.add.text(CANVAS_W / 2, CANVAS_H - 36, '▶  Start Wave 1', {
      fontSize: '18px', fontFamily: 'monospace', color: '#111111',
      backgroundColor: '#f0c040', padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setDepth(500).setInteractive({ useHandCursor: true });
    this.startWaveBtn.on('pointerdown', () => this._startWave());
    this.startWaveBtn.on('pointerover',  () => this.startWaveBtn.setStyle({ backgroundColor: '#ffe566' }));
    this.startWaveBtn.on('pointerout',   () => this.startWaveBtn.setStyle({ backgroundColor: '#f0c040' }));

    // "Back to Map" button — shown on gameover/victory overlay
    this.backToMapBtn = this.add.text(CANVAS_W / 2, CANVAS_H / 2 + 90, '← Back to Map', {
      fontSize: '15px', fontFamily: 'monospace', color: '#cccccc',
      backgroundColor: '#222244', padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setDepth(1002).setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.backToMapBtn.on('pointerdown', () => this._goToMap());
    this.backToMapBtn.on('pointerover',  () => this.backToMapBtn.setStyle({ backgroundColor: '#333366' }));
    this.backToMapBtn.on('pointerout',   () => this.backToMapBtn.setStyle({ backgroundColor: '#222244' }));

    // "Quit to Map" button — always visible in top-left during play
    this.quitBtn = this.add.text(8, 8, '← Map', {
      fontSize: '12px', fontFamily: 'monospace', color: '#aaaaaa',
      backgroundColor: '#111122', padding: { x: 8, y: 4 },
    }).setDepth(300).setInteractive({ useHandCursor: true });
    this.quitBtn.on('pointerdown', () => this.scene.start('CampaignMapScene', {
      currentLevel: this._currentLevel,
      justCompletedLevel: -1,
      reveal: false,
    }));

    this.paused = false;
    this.pauseText = this.add.text(CANVAS_W / 2, CANVAS_H / 2, 'PAUSED', {
      fontSize: '48px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setVisible(false).setDepth(100);

    this.debug = false;
    this.debugGraphics.setVisible(false);

    this.editorMode     = false;
    this.editorText     = this.add.text(8, 8, 'EDITOR', {
      fontSize: '13px', fontFamily: 'monospace', color: '#00ff88',
      stroke: '#000000', strokeThickness: 3,
    }).setVisible(false).setDepth(200);

    // _drag: { type: 'path', idx } | { type: 'zone', zoneIdx, vertIdx }
    this._drag          = null;
    this._lastClickTime = 0;
    this._lastClickX    = 0;
    this._lastClickY    = 0;

    this.input.on('pointermove', (p) => {
      if (this.editorMode && this._drag) {
        const pt = { x: Math.round(p.x), y: Math.round(p.y) };
        if (this._drag.type === 'path') {
          this.waypoints[this._drag.idx] = pt;
        } else {
          this.levelConfig.placementZones[this._drag.zoneIdx][this._drag.vertIdx] = pt;
        }
        this._redrawDebug();
      }

      if (!this.editorMode) this._drawPlacementPreview(p.x, p.y);
    });

    this.input.on('pointerout', () => {
      this.previewGraphics.clear();
      this._setStatusBar('');
    });

    this.input.on('pointerdown', (p) => {
      if (this.editorMode) {
        this._editorPointerDown(p);
      } else {
        this.onTileClick(p);
      }
    });

    this.input.on('pointerup', () => {
      if (this._drag) {
        if (this._drag.type === 'path') this._logWaypoints();
        else this._logZones();
        this._drag = null;
        this._redrawDebug();
      }
    });

    this.input.keyboard.on('keydown-R', () => {
      if (this.phase === 'victory' || this.phase === 'gameover') {
        this._goToMap();
      } else {
        this.scene.restart({ levelId: this._currentLevel, currentLevel: this._currentLevel });
      }
    });
    this.input.keyboard.on('keydown-P', () => {
      if (this.phase === 'gameover' || this.phase === 'victory') return;
      this.paused = !this.paused;
      this.pauseText.setVisible(this.paused);
    });
    this.input.keyboard.on('keydown-D', () => {
      this.debug = !this.debug;
      this.debugGraphics.setVisible(this.debug);
    });
    this.input.keyboard.on('keydown-E', () => {
      this.editorMode = !this.editorMode;
      this.editorText.setVisible(this.editorMode);
      if (this.editorMode && !this.debug) {
        this.debug = true;
        this.debugGraphics.setVisible(true);
      }
      this._drag = null;
      this._redrawDebug();
    });
    this.input.keyboard.on('keydown-DELETE', () => {
      if (!this.editorMode || !this._drag) return;
      if (this._drag.type === 'path') {
        if (this.waypoints.length > 2) {
          this.waypoints.splice(this._drag.idx, 1);
          this._drag = null;
          this._redrawDebug();
          this._logWaypoints();
        }
      } else {
        const { zoneIdx, vertIdx } = this._drag;
        const zone = this.levelConfig.placementZones[zoneIdx];
        if (zone.length > 3) {
          zone.splice(vertIdx, 1);
          this._drag = null;
          this._redrawDebug();
          this._logZones();
        }
      }
    });

    this._updateHUD();
  }

  // ─── Wave / phase management ──────────────────────────────────────────────

  _startWave() {
    if (this.phase !== 'placing') return;
    this.wave++;
    this.spawnedCount = 0;
    this.spawnTimer   = 0;
    this.phase        = 'wave';
    this.startWaveBtn.setVisible(false);
    this._hideOverlay();
    this._updateHUD();
  }

  _enterPlacingPhase() {
    this.phase = 'placing';
    this.startWaveBtn.setText(`▶  Start Wave ${this.wave + 1}`);
    this.startWaveBtn.setVisible(true);
    this._updateHUD();
  }

  _goToMap() {
    const nextLevel = this.phase === 'victory'
      ? Math.min(this._currentLevel + 1, 9)
      : this._currentLevel;
    const doReveal = this.phase === 'victory' && this._currentLevel < 9;
    this.scene.start('CampaignMapScene', {
      currentLevel:       nextLevel,
      justCompletedLevel: doReveal ? this._currentLevel : -1,
      reveal:             doReveal,
    });
  }

  _showOverlay(title, sub, color = '#ffffff', showBackBtn = false) {
    this.overlayGraphics.clear();
    this.overlayGraphics.fillStyle(0x000000, 0.65);
    this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this.overlayText.setText(title).setColor(color).setVisible(true);
    this.overlaySubText.setText(sub).setVisible(true);
    this.backToMapBtn.setVisible(showBackBtn);
  }

  _hideOverlay() {
    this.overlayGraphics.clear();
    this.overlayText.setVisible(false);
    this.overlaySubText.setVisible(false);
    this.backToMapBtn.setVisible(false);
  }

  // ─── HUD ──────────────────────────────────────────────────────────────────

  _updateHUD() {
    const waveStr = this.wave === 0 ? `— / ${this.totalWaves}` : `${this.wave} / ${this.totalWaves}`;
    document.getElementById('hud-wave').textContent  = waveStr;
    document.getElementById('hud-lives').textContent = this.lives;
    document.getElementById('hud-score').textContent = this.score;
    document.getElementById('hud-gold').textContent  = this.gold;
  }

  _setStatusBar(msg, style = 'neutral') {
    const el = document.getElementById('statusbar');
    el.textContent = msg;
    el.className   = style;
  }

  // ─── Animations ──────────────────────────────────────────────────────────

  _buildAnims() {
    for (const enemy of Object.values(ENEMY_TYPES)) {
      for (const def of enemy.animations) {
        const key = `${enemy.key}_${def.key}`;
        if (this.anims.exists(key)) this.anims.remove(key);
        const frameIndices = [];
        for (let f = 0; f < def.frames; f++) {
          frameIndices.push(def.row * enemy.sheetCols + f);
        }
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(enemy.key, { frames: frameIndices }),
          frameRate: def.frameRate,
          repeat: def.repeat,
        });
      }
    }
  }

  // ─── Debug / editor drawing ───────────────────────────────────────────────

  _redrawDebug() {
    this.debugGraphics.clear();
    this._drawDebugPath();
    this._drawPlacementZones();
  }

  _drawDebugPath() {
    this.debugGraphics.lineStyle(2, 0xff0000, 0.6);
    this.debugGraphics.beginPath();
    this.debugGraphics.moveTo(this.waypoints[0].x, this.waypoints[0].y);
    for (let i = 1; i < this.waypoints.length; i++) {
      this.debugGraphics.lineTo(this.waypoints[i].x, this.waypoints[i].y);
    }
    this.debugGraphics.strokePath();
    for (const { x, y } of this.waypoints) {
      this.debugGraphics.fillStyle(0xff0000, 0.9);
      this.debugGraphics.fillCircle(x, y, 6);
      this.debugGraphics.lineStyle(1, 0xffffff, 0.8);
      this.debugGraphics.strokeCircle(x, y, 6);
    }
  }

  _drawPlacementZones() {
    const zones = this.levelConfig.placementZones;
    for (let zi = 0; zi < zones.length; zi++) {
      const zone = zones[zi];
      this.debugGraphics.fillStyle(0x00ff88, 0.15);
      this.debugGraphics.fillPoints(zone, true);
      this.debugGraphics.lineStyle(1, 0x00ff88, 0.5);
      this.debugGraphics.strokePoints(zone, true);

      if (this.editorMode) {
        for (let vi = 0; vi < zone.length; vi++) {
          const { x, y } = zone[vi];
          const isSelected = this._drag && this._drag.zoneIdx === zi && this._drag.vertIdx === vi;
          this.debugGraphics.fillStyle(isSelected ? 0xffff00 : 0x00ff88, 1);
          this.debugGraphics.fillCircle(x, y, 5);
          this.debugGraphics.lineStyle(1, 0xffffff, 0.8);
          this.debugGraphics.strokeCircle(x, y, 5);
        }
      }
    }
  }

  _drawPlacementPreview(x, y) {
    this.previewGraphics.clear();

    if (this.phase === 'gameover' || this.phase === 'victory') return;
    if (this._towerPopup) return;

    const zones    = this.levelConfig.placementZones;
    const allTypes   = Object.values(TURRET_TYPES);
    const minSpace   = Math.min(...allTypes.map(t => t.minSpacing));
    const minCost    = Math.min(...allTypes.map(t => t.cost));
    const inZone     = zones.some(z => this._pointInPolygon(x, y, z));
    const tooClose   = this.waypoints.some(wp => Math.hypot(x - wp.x, y - wp.y) < 30)
                     || this.turrets.some(t => Math.hypot(x - t.cx, y - t.cy) < minSpace);
    const canAfford  = this.gold >= minCost;
    const isValid    = inZone && !tooClose && canAfford;

    const tileW = 32, tileH = 18;
    const fillAlpha = isValid ? 0.35 : (inZone ? 0.35 : 0.15);
    this.previewGraphics.fillStyle(isValid ? 0x00ff88 : 0xff4444, fillAlpha);
    this.previewGraphics.fillEllipse(x, y, tileW * 2, tileH * 2);
    this.previewGraphics.lineStyle(1, isValid ? 0x00ff88 : 0xff4444, isValid ? 0.7 : (inZone ? 0.7 : 0.3));
    this.previewGraphics.strokeEllipse(x, y, tileW * 2, tileH * 2);

    if (!inZone) {
      this._setStatusBar('Not a valid placement zone', 'invalid');
    } else if (tooClose) {
      this._setStatusBar('Placement too close to an existing tower', 'invalid');
    } else if (!canAfford) {
      this._setStatusBar('Insufficient gold', 'invalid');
    } else {
      this._setStatusBar('Click to place a tower', 'valid');
    }
  }

  // ─── Editor ───────────────────────────────────────────────────────────────

  _editorPointerDown(p) {
    const now = Date.now();
    const dblClick = (now - this._lastClickTime) < 300
      && Math.abs(p.x - this._lastClickX) < 10
      && Math.abs(p.y - this._lastClickY) < 10;
    this._lastClickTime = now;
    this._lastClickX    = p.x;
    this._lastClickY    = p.y;

    const zones = this.levelConfig.placementZones;

    for (let i = 0; i < this.waypoints.length; i++) {
      const { x, y } = this.waypoints[i];
      if (Math.hypot(p.x - x, p.y - y) <= 12) {
        this._drag = { type: 'path', idx: i };
        this._redrawDebug();
        return;
      }
    }

    for (let zi = 0; zi < zones.length; zi++) {
      for (let vi = 0; vi < zones[zi].length; vi++) {
        const { x, y } = zones[zi][vi];
        if (Math.hypot(p.x - x, p.y - y) <= 12) {
          this._drag = { type: 'zone', zoneIdx: zi, vertIdx: vi };
          this._redrawDebug();
          return;
        }
      }
    }

    if (dblClick) {
      let bestPath = { dist: Infinity, idx: -1 };
      for (let i = 0; i < this.waypoints.length - 1; i++) {
        const d = this._distToSegment(p.x, p.y, this.waypoints[i], this.waypoints[i + 1]);
        if (d < bestPath.dist) bestPath = { dist: d, idx: i };
      }
      if (bestPath.dist < 20) {
        this.waypoints.splice(bestPath.idx + 1, 0, { x: Math.round(p.x), y: Math.round(p.y) });
        this._redrawDebug();
        this._logWaypoints();
        return;
      }
    }

    if (dblClick) {
      let best = { dist: Infinity, zoneIdx: -1, vertIdx: -1 };
      for (let zi = 0; zi < zones.length; zi++) {
        const zone = zones[zi];
        for (let vi = 0; vi < zone.length; vi++) {
          const a = zone[vi];
          const b = zone[(vi + 1) % zone.length];
          const d = this._distToSegment(p.x, p.y, a, b);
          if (d < best.dist) best = { dist: d, zoneIdx: zi, vertIdx: vi };
        }
      }
      if (best.dist < 20) {
        zones[best.zoneIdx].splice(best.vertIdx + 1, 0, { x: Math.round(p.x), y: Math.round(p.y) });
        this._redrawDebug();
        this._logZones();
      }
    }
  }

  _distToSegment(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  _logWaypoints() {
    const lines = this.waypoints.map(({ x, y }) =>
      `  bgPt(${Math.round(x / scaleX)}, ${Math.round(y / scaleY)}),`
    ).join('\n');
    console.log('waypoints: [\n' + lines + '\n]');
  }

  _logZones() {
    const lines = this.levelConfig.placementZones.map((zone, zi) => {
      const pts = zone.map(({ x, y }) =>
        `    bgPt(${Math.round(x / scaleX)}, ${Math.round(y / scaleY)})`
      ).join(',\n');
      return `  // Zone ${zi}\n  [\n${pts},\n  ]`;
    });
    console.log('placementZones: [\n' + lines.join(',\n') + '\n]');
  }

  _pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  // ─── Tower placement ──────────────────────────────────────────────────────

  onTileClick(pointer) {
    if (this.phase === 'gameover' || this.phase === 'victory') return;

    // Close existing popup if open
    if (this._towerPopup) {
      this._closeTowerPopup();
      return;
    }

    const zones  = this.levelConfig.placementZones;
    const inZone = zones.some(z => this._pointInPolygon(pointer.x, pointer.y, z));
    if (!inZone) return;

    for (const wp of this.waypoints) {
      if (Math.hypot(pointer.x - wp.x, pointer.y - wp.y) < 30) return;
    }
    const minSpace = Math.min(...Object.values(TURRET_TYPES).map(t => t.minSpacing));
    for (const t of this.turrets) {
      if (Math.hypot(pointer.x - t.cx, pointer.y - t.cy) < minSpace) return;
    }

    this._openTowerPopup(pointer.x, pointer.y);
  }

  _openTowerPopup(x, y) {
    const types  = Object.values(TURRET_TYPES);
    const cardW  = 130, cardH = 90, gap = 8, pad = 10;
    const totalW = types.length * cardW + (types.length - 1) * gap + pad * 2;
    const totalH = cardH + pad * 2 + 20; // 20 for title row

    // Anchor popup above the click point, clamped to canvas
    const px = Math.min(Math.max(x - totalW / 2, 4), CANVAS_W - totalW - 4);
    const py = Math.max(y - totalH - 12, 4);

    const gfx = this.add.graphics().setDepth(600);
    gfx.fillStyle(0x0d1117, 0.92);
    gfx.fillRoundedRect(px, py, totalW, totalH, 6);
    gfx.lineStyle(1, 0x2a2a4a, 1);
    gfx.strokeRoundedRect(px, py, totalW, totalH, 6);

    const title = this.add.text(px + totalW / 2, py + pad, 'Choose tower', {
      fontSize: '11px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5, 0).setDepth(601);

    const cards = [];
    types.forEach((def, i) => {
      const cx = px + pad + i * (cardW + gap);
      const cy = py + pad + 18;
      const canAfford = this.gold >= def.cost;

      const cardGfx = this.add.graphics().setDepth(601);
      cardGfx.fillStyle(canAfford ? 0x1a2a1a : 0x2a1a1a, 1);
      cardGfx.fillRoundedRect(cx, cy, cardW, cardH, 4);
      cardGfx.lineStyle(1, canAfford ? 0x44aa44 : 0x663333, 1);
      cardGfx.strokeRoundedRect(cx, cy, cardW, cardH, 4);

      const icon = this.add.image(cx + cardW / 2, cy + 28, `turret_${def.key}`, def.frameIndex)
        .setScale(def.displayScale * 0.55)
        .setDepth(602)
        .setAlpha(canAfford ? 1 : 0.4);

      const nameText = this.add.text(cx + cardW / 2, cy + 54, def.label ?? def.key, {
        fontSize: '11px', fontFamily: 'monospace',
        color: canAfford ? '#ccffcc' : '#996666',
      }).setOrigin(0.5, 0).setDepth(602);

      const costText = this.add.text(cx + cardW / 2, cy + 70, `${def.cost}g`, {
        fontSize: '13px', fontFamily: 'monospace',
        color: canAfford ? '#f0c040' : '#664444',
      }).setOrigin(0.5, 0).setDepth(602);

      // Invisible hit zone for the card
      const hitZone = this.add.zone(cx, cy, cardW, cardH).setOrigin(0, 0).setDepth(602).setInteractive({ useHandCursor: canAfford });
      if (canAfford) {
        hitZone.on('pointerdown', () => {
          this._closeTowerPopup();
          this._placeTower(x, y, def.key);
        });
        hitZone.on('pointerover', () => {
          cardGfx.clear();
          cardGfx.fillStyle(0x224422, 1);
          cardGfx.fillRoundedRect(cx, cy, cardW, cardH, 4);
          cardGfx.lineStyle(1, 0x66cc66, 1);
          cardGfx.strokeRoundedRect(cx, cy, cardW, cardH, 4);
        });
        hitZone.on('pointerout', () => {
          cardGfx.clear();
          cardGfx.fillStyle(0x1a2a1a, 1);
          cardGfx.fillRoundedRect(cx, cy, cardW, cardH, 4);
          cardGfx.lineStyle(1, 0x44aa44, 1);
          cardGfx.strokeRoundedRect(cx, cy, cardW, cardH, 4);
        });
      }

      cards.push({ cardGfx, icon, nameText, costText, hitZone });
    });

    this._towerPopup = { x, y, gfx, title, cards };
    this.previewGraphics.clear();
  }

  _closeTowerPopup() {
    if (!this._towerPopup) return;
    const { gfx, title, cards } = this._towerPopup;
    gfx.destroy();
    title.destroy();
    for (const { cardGfx, icon, nameText, costText, hitZone } of cards) {
      cardGfx.destroy();
      icon.destroy();
      nameText.destroy();
      costText.destroy();
      hitZone.destroy();
    }
    this._towerPopup = null;
  }

  _placeTower(x, y, typeKey) {
    const def = TURRET_TYPES[typeKey];
    if (this.gold < def.cost) return;

    this.gold -= def.cost;
    this._updateHUD();

    const sprite = this.add.image(x, y, `turret_${def.key}`, def.frameIndex);
    sprite.setScale(def.displayScale);
    sprite.setDepth(y);
    this.turrets.push({
      cx: x, cy: y,
      type: def.key,
      sprite,
      range:       def.range,
      fireRate:    def.fireRate,
      fireCooldown: 0,
      damage:      def.damage,
      bulletSpeed: def.bulletSpeed,
      bulletColor: def.bulletColor,
      aimAngle:    0,
    });
  }

  // ─── Spawning ─────────────────────────────────────────────────────────────

  _nextSpawnDelay() {
    const { min, max } = this.levelConfig.spawnDelay;
    return min + Math.random() * (max - min);
  }

  _pickEnemyType() {
    const pool = this.levelConfig.spawnPool;
    const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
    let r = Math.random() * totalWeight;
    for (const entry of pool) {
      r -= entry.weight;
      if (r <= 0) return entry.type;
    }
    return pool[pool.length - 1].type;
  }

  spawnEnemy(type) {
    const typeDef = ENEMY_TYPES[type];
    const startX  = this.waypoints[0].x;
    const startY  = this.waypoints[0].y;

    const sprite = this.add.sprite(startX, startY, typeDef.key);
    sprite.setScale(typeDef.displayScale);
    sprite.setDepth(startY);
    sprite.play(`${typeDef.key}_walk`);
    sprite.setFlipX(false);

    this.enemies.push({
      id: this.enemyId++,
      type: typeDef.key,
      sprite,
      waypointIdx: 0,
      x: startX,
      y: startY,
      speed: typeDef.speed.base + Math.random() * typeDef.speed.variance,
      hp: typeDef.hp,
      maxHp: typeDef.hp,
      dying: false,
    });
  }

  killEnemy(enemy) {
    enemy.dying = true;
    // Award gold and score
    this.gold  += ENEMY_TYPES[enemy.type].goldReward;
    this.score += 10;
    this._updateHUD();

    enemy.sprite.removeAllListeners('animationcomplete');
    enemy.sprite.play(`${enemy.type}_death`);
    enemy.sprite.once('animationcomplete', () => {
      enemy.sprite.destroy();
      const idx = this.enemies.indexOf(enemy);
      if (idx >= 0) this.enemies.splice(idx, 1);
      // Check wave-complete condition after each enemy is fully removed
      this._checkWaveComplete();
    });
  }

  _checkWaveComplete() {
    if (this.phase !== 'wave') return;
    if (this.spawnedCount < this.enemiesPerWave) return;
    if (this.enemies.length > 0) return;

    if (this.wave >= this.totalWaves) {
      this.phase = 'victory';
      this._showOverlay('LEVEL COMPLETE', `Score: ${this.score}`, '#f0c040', true);
      this.startWaveBtn.setVisible(false);
    } else {
      this.phase = 'between';
      this._betweenTimer = 0;
      this._showOverlay(`Wave ${this.wave} Complete!`, 'Prepare your defences…', '#88ff88');
    }
  }

  // ─── Main loop ────────────────────────────────────────────────────────────

  _enemyEscaped(enemy, index) {
    enemy.sprite.destroy();
    this.enemies.splice(index, 1);
    this.lives--;
    this._updateHUD();
    if (this.lives <= 0) {
      this.phase = 'gameover';
      this._showOverlay('GAME OVER', `Score: ${this.score}`, '#ff4444', true);
      this.startWaveBtn.setVisible(false);
    } else {
      this._checkWaveComplete();
    }
  }

  update(_time, delta) {
    if (this.paused) return;
    if (this.phase === 'gameover' || this.phase === 'victory') return;

    // Between-wave pause (~2s) then return to placing
    if (this.phase === 'between') {
      this._betweenTimer += delta;
      if (this._betweenTimer >= 2000) {
        this._hideOverlay();
        this._enterPlacingPhase();
      }
      return;
    }

    // Placing phase: static — no spawning, no movement
    if (this.phase === 'placing') return;

    // ── Wave phase ──────────────────────────────────────────────────────────

    // Spawn enemies up to limit
    if (this.spawnedCount < this.enemiesPerWave) {
      this.spawnTimer += delta;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer    = 0;
        this.spawnInterval = this._nextSpawnDelay();
        if (this.waypoints.length > 1) {
          this.spawnEnemy(this._pickEnemyType());
          this.spawnedCount++;
        }
      }
    }

    const dt = delta / 1000;

    // Move enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dying) continue;

      const target = this.waypoints[e.waypointIdx];
      if (!target) {
        this._enemyEscaped(e, i);
        continue;
      }

      const dx   = target.x - e.x;
      const dy   = target.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        e.waypointIdx++;
        if (e.waypointIdx >= this.waypoints.length) {
          this._enemyEscaped(e, i);
          continue;
        }
      } else {
        const speed = e.speed * dt;
        e.x += (dx / dist) * speed;
        e.y += (dy / dist) * speed;
        e.sprite.setFlipX(dx < 0);
      }

      e.sprite.setPosition(e.x, e.y);
      e.sprite.setDepth(e.y);
    }

    // Turrets fire
    for (const t of this.turrets) {
      t.fireCooldown -= delta;
      if (t.fireCooldown > 0) continue;

      let nearest = null, nearestDist = Infinity;
      for (const e of this.enemies) {
        if (e.dying) continue;
        const dx = e.x - t.cx;
        const dy = e.y - t.cy;
        const d  = Math.sqrt((dx / t.range) ** 2 + (dy / (t.range * 0.5)) ** 2);
        if (d <= 1 && d < nearestDist) { nearest = e; nearestDist = d; }
      }

      if (nearest) {
        t.fireCooldown = t.fireRate;
        t.aimAngle = Math.atan2(nearest.y - t.cy, nearest.x - t.cx);
        const sprite = this.add.image(t.cx, t.cy, 'arrow');
        sprite.setScale(1.125);
        sprite.setDepth(500);
        this.bullets.push({
          x: t.cx, y: t.cy,
          targetId: nearest.id,
          speed: t.bulletSpeed,
          damage: t.damage,
          sprite,
        });
      }
    }

    // Move bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b      = this.bullets[i];
      const target = this.enemies.find(e => e.id === b.targetId);
      if (!target || target.dying) {
        b.sprite.destroy();
        this.bullets.splice(i, 1);
        continue;
      }

      const dx   = target.x - b.x;
      const dy   = target.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 8) {
        b.sprite.destroy();
        target.hp -= b.damage;
        this.bullets.splice(i, 1);
        if (target.hp <= 0 && !target.dying) {
          this.killEnemy(target);
        } else if (!target.dying && target.sprite.anims.currentAnim?.key !== `${target.type}_hurt`) {
          target.sprite.removeAllListeners('animationcomplete');
          target.sprite.play(`${target.type}_hurt`);
          target.sprite.once('animationcomplete', () => {
            if (!target.dying) target.sprite.play(`${target.type}_walk`);
          });
        }
        continue;
      }

      b.x += (dx / dist) * b.speed * dt;
      b.y += (dy / dist) * b.speed * dt;
      b.sprite.setPosition(b.x, b.y);
      b.sprite.setRotation(Math.atan2(dy, dx));
    }

    this._drawEntities();
  }

  // ─── Entity rendering ─────────────────────────────────────────────────────

  _drawEntities() {
    this.entityGraphics.clear();

    if (this.debug) {
      for (const t of this.turrets) {
        this.entityGraphics.lineStyle(1, 0xffffff, 0.25);
        this.entityGraphics.strokeEllipse(t.cx, t.cy, t.range * 2, t.range, 64);
      }
      for (const e of this.enemies) {
        if (e.dying) continue;
        this.entityGraphics.lineStyle(1, 0xffff00, 0.7);
        this.entityGraphics.strokeCircle(e.x, e.y, 6);
      }
    }

    for (const e of this.enemies) {
      if (e.dying) continue;
      const barW = 32, barH = 5;
      const bx   = e.x - barW / 2;
      const by   = e.y - 26;
      const pct  = e.hp / e.maxHp;

      this.entityGraphics.fillStyle(0x220000);
      this.entityGraphics.fillRect(bx, by, barW, barH);
      const barColor = pct > 0.5 ? 0x44dd44 : pct > 0.25 ? 0xddaa00 : 0xdd2222;
      this.entityGraphics.fillStyle(barColor);
      this.entityGraphics.fillRect(bx, by, barW * pct, barH);
      this.entityGraphics.lineStyle(1, 0x000000, 0.6);
      this.entityGraphics.strokeRect(bx, by, barW, barH);
    }
  }
}
