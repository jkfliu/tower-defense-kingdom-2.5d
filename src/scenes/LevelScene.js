import { CANVAS_W, CANVAS_H, scaleX, scaleY, DEFAULT_LIVES, DEFAULT_WAVES } from '../constants.js';
import { LEVELS } from '../data/levels.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { TURRET_TYPES } from '../data/turrets.js';

const SELL_HIT_R   = 28;
const WP_HIT_R     = 30;
const TILE_W       = 32;
const TILE_H       = 18;

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
      if (turret.image) {
        this.load.image(`turret_${turret.key}`, turret.image);
      } else {
        this.load.spritesheet(`turret_${turret.key}`, turret.spritesheet, {
          frameWidth: turret.frameWidth,
          frameHeight: turret.frameHeight,
        });
      }
    }
    this.load.image('arrow', 'assets/Arrow_01.png');
    this.load.image('orb', 'assets/Ecto_Orb.png');
  }

  create(data = {}) {
    document.getElementById('info').style.display      = '';
    document.getElementById('hud').style.display       = '';
    document.getElementById('statusbar').style.display = '';

    // Support levelId passed from MapScene; fall back to level 0
    const levelId = data.levelId ?? 0;
    this._currentLevel = data.currentLevel ?? levelId; // campaign progress
    this.levelConfig = LEVELS[Math.min(levelId, LEVELS.length - 1)];

    this._buildAnims();

    const bg = this.add.image(0, 0, 'bg').setOrigin(0, 0);
    bg.setDisplaySize(CANVAS_W, CANVAS_H);
    bg.setDepth(0);

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

    this._towerPopup     = null; // { x, y, cards: [...Text] } or null
    this._overButton     = false;
    this._restartConfirm = null;

    this.debugGraphics   = this.add.graphics().setDepth(10);
    this.entityGraphics  = this.add.graphics().setDepth(700);
    this.previewGraphics = this.add.graphics().setDepth(800);

    this._redrawDebug();

    // --- Overlay layer (gameover / victory / between) ---
    this.overlayGraphics = this.add.graphics().setDepth(1200);
    this.overlayPanel    = this.add.graphics().setDepth(1250);
    this.overlayText     = this.add.text(CANVAS_W / 2, CANVAS_H / 2 - 20, '', {
      fontSize: '42px', fontFamily: 'Cinzel', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(1300).setVisible(false);
    this.overlaySubText  = this.add.text(CANVAS_W / 2, CANVAS_H / 2 + 36, '', {
      fontSize: '18px', fontFamily: 'Cinzel', color: '#cccccc',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1300).setVisible(false);

    // --- Buttons ---
    this.startWaveBtn = this._makeButton(CANVAS_W / 2, CANVAS_H - 36, '▶  Start Wave 1', 'gold', 900, () => this._startWave());

    this.retryLevelBtn = this._makeButton(CANVAS_W / 2, CANVAS_H / 2 + 96, '↺  Retry Level', 'gold', 1300, () => {
      const levelId = LEVELS.indexOf(this.levelConfig);
      this.scene.start('LevelScene', { levelId, currentLevel: this._currentLevel });
    });
    this.retryLevelBtn.setVisible(false);

    this.backToMapBtn = this._makeButton(CANVAS_W / 2, CANVAS_H / 2 + 100, '← Back to Map', 'dark', 1300, () => this._goToMap());
    this.backToMapBtn.setVisible(false);

    this.quitBtn = this._makeButton(8, 8, '← Map', 'dark', 900, () => this.scene.start('CampaignMapScene', {
      currentLevel: this._currentLevel,
      justCompletedLevel: -1,
      reveal: false,
    }), { origin: 0 });

    this._enemyPreview = this._buildEnemyPreview();

    this.paused = false;
    this.pauseText = this.add.text(CANVAS_W / 2, CANVAS_H / 2, 'PAUSED', {
      fontSize: '48px', fontFamily: 'Cinzel', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setVisible(false).setDepth(1100);

    this.debug = false;
    this.debugGraphics.setVisible(false);

    this.editorMode     = false;
    this.editorText     = this.add.text(8, 8, 'EDITOR', {
      fontSize: '13px', fontFamily: 'Cinzel', color: '#00ff88',
      stroke: '#000000', strokeThickness: 3,
    }).setVisible(false).setDepth(1100);

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

      if (this._towerPopup) this._drawPlacementPreview(this._towerPopup.x, this._towerPopup.y);
      else this._drawPlacementPreview(p.x, p.y);
    });

    this._onMouseLeave = () => {
      this.previewGraphics.clear();
      this._setStatusBar('');
    };
    this.game.canvas.addEventListener('mouseleave', this._onMouseLeave);
    this.events.once('shutdown', () => {
      this.game.canvas.removeEventListener('mouseleave', this._onMouseLeave);
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

    this.input.keyboard.on('keydown-S', () => { this._startWave(); });
    this.input.keyboard.on('keydown-R', () => {
      if (this.phase === 'victory' || this.phase === 'gameover') {
        this._goToMap();
      } else {
        this._showRestartConfirm();
      }
    });
    this.input.keyboard.on('keydown-P', () => {
      if (this.phase === 'gameover' || this.phase === 'victory') return;
      this.paused = !this.paused;
      this.pauseText.setVisible(this.paused);
      this._setStatusBar(this.paused ? 'Game Paused' : 'Game Resumed', 'valid');
    });
    this.input.keyboard.on('keydown-D', () => {
      this.debug = !this.debug;
      this.debugGraphics.setVisible(this.debug || this.editorMode);
      this._redrawDebug();
      this._setStatusBar(this.debug ? 'Debug Mode On' : 'Debug Mode Off', 'valid');
      document.getElementById('info-debug').classList.toggle('info-active', this.debug);
    });
    this.input.keyboard.on('keydown-E', () => {
      this.editorMode = !this.editorMode;
      this.editorText.setVisible(this.editorMode);
      this.debugGraphics.setVisible(this.debug || this.editorMode);
      document.getElementById('info-editor').classList.toggle('info-active', this.editorMode);
      if (this.editorMode) {
        console.log('%c EDITOR MODE ON — open DevTools with F12 (Win) or Cmd+Option+I (Mac) to see waypoint/zone output', 'background:#1a2a1a;color:#00ff88;padding:4px 8px;font-weight:bold;');
        this._setStatusBar('Editor Mode On — open DevTools (F12 / Cmd+Option+I) to see output', 'valid');
      } else {
        this._setStatusBar('Editor Mode Off', 'valid');
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
    this._setStatusBar('Click to place Tower · Start Wave button to begin', 'valid');
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
    this._dismissEnemyPreview();
    this._updateHUD();
  }

  _enterPlacingPhase() {
    this.phase = 'placing';
    this.startWaveBtn.setText(`▶  Start Wave ${this.wave + 1}`);
    this.startWaveBtn.setVisible(true);
    this._enemyPreview = this._buildEnemyPreview();
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

  _showOverlay(title, sub, color = '#ffffff', showBackBtn = false, showRetryBtn = false) {
    this.entityGraphics.clear();
    this.overlayGraphics.clear();
    this.overlayGraphics.fillStyle(0x000000, 0.65);
    this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Layout constants
    const padV       = 28;  // top and bottom panel padding
    const titleH     = 42;  // font size
    const subGap     = 16;  // title → subtitle
    const subH       = 18;  // font size
    const btnGap     = 24;  // subtitle → first button (or between buttons)
    const btnH       = 34;  // approx rendered button height (gold 18px Cinzel + pad)
    const btnDarkH   = 26;  // dark button (13px Cinzel + pad)
    const panelW     = 380;
    const cx         = CANVAS_W / 2;

    // Compute total content height
    let contentH = titleH + subGap + subH;
    if (showRetryBtn) contentH += btnGap + btnH;
    if (showBackBtn)  contentH += (showRetryBtn ? btnGap : btnGap) + btnDarkH;

    const panelH   = padV + contentH + padV;
    const panelTop = CANVAS_H / 2 - panelH / 2;
    const panelX   = cx - panelW / 2;

    // Draw panel
    this.overlayPanel.clear();
    this.overlayPanel.fillStyle(0x1a1a2e, 0.92);
    this.overlayPanel.fillRoundedRect(panelX, panelTop, panelW, panelH, 10);
    this.overlayPanel.lineStyle(1, 0x3a3a5a, 1);
    this.overlayPanel.strokeRoundedRect(panelX, panelTop, panelW, panelH, 10);

    // Position each element from top of panel
    let cursor = panelTop + padV;

    this.overlayText.setPosition(cx, cursor + titleH / 2).setText(title).setColor(color).setVisible(true);
    cursor += titleH + subGap;

    this.overlaySubText.setPosition(cx, cursor + subH / 2).setText(sub).setVisible(true);
    cursor += subH;

    if (showRetryBtn) {
      cursor += btnGap;
      this.retryLevelBtn.setPosition(cx, cursor + btnH / 2);
      cursor += btnH;
    }
    this.retryLevelBtn.setVisible(showRetryBtn);

    if (showBackBtn) {
      cursor += btnGap;
      this.backToMapBtn.setPosition(cx, cursor + btnDarkH / 2);
    }
    this.backToMapBtn.setVisible(showBackBtn);
  }

  _hideOverlay() {
    this.overlayGraphics.clear();
    this.overlayPanel.clear();
    this.overlayText.setVisible(false);
    this.overlaySubText.setVisible(false);
    this.retryLevelBtn.setVisible(false);
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

  // ─── Enemy preview ───────────────────────────────────────────────────────

  _buildEnemyPreview() {
    const pool        = this.levelConfig.spawnPool;
    const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
    const perWave     = this.enemiesPerWave;
    const pad = 10, rowH = 44, iconSize = 36;
    const cardW = 160;
    const cardH = pad + pool.length * rowH + pad;
    const cx = 8, cy = 48; // below quitBtn

    const objects = [];

    const titleH  = 20;
    const totalH  = cardH + titleH;

    const gfx = this.add.graphics().setDepth(901);
    gfx.fillStyle(0x0d1117, 0.85);
    gfx.fillRoundedRect(cx, cy, cardW, totalH, 6);
    gfx.lineStyle(1, 0x2a2a4a, 1);
    gfx.strokeRoundedRect(cx, cy, cardW, totalH, 6);
    gfx.lineStyle(1, 0x2a2a4a, 1);
    gfx.beginPath();
    gfx.moveTo(cx + 8, cy + titleH);
    gfx.lineTo(cx + cardW - 8, cy + titleH);
    gfx.strokePath();
    objects.push(gfx);

    const waveLabel = this.add.text(cx + cardW / 2, cy + titleH / 2, `Wave ${this.wave + 1} enemies`, {
      fontSize: '10px', fontFamily: 'Cinzel', color: '#f0c040',
    }).setOrigin(0.5, 0.5).setDepth(902);
    objects.push(waveLabel);

    const closeBtn = this.add.text(cx + cardW - 8, cy + 4, '✕', {
      fontSize: '10px', fontFamily: 'Cinzel', color: '#888888',
    }).setOrigin(1, 0).setDepth(902).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setStyle({ color: '#ffffff' }));
    closeBtn.on('pointerout',  () => closeBtn.setStyle({ color: '#888888' }));
    closeBtn.on('pointerdown', () => this._dismissEnemyPreview());
    objects.push(closeBtn);

    pool.forEach(({ type, weight }, i) => {
      const def   = ENEMY_TYPES[type];
      const count = Math.max(1, Math.round((weight / totalWeight) * perWave));
      const ry    = cy + titleH + pad + i * rowH;

      const icon = this.add.sprite(cx + pad + iconSize / 2, ry + rowH / 2, def.key)
        .setScale(def.displayScale * 0.22)
        .setDepth(902);
      icon.play(`${def.key}_walk`);
      objects.push(icon);

      const label = this.add.text(cx + pad + iconSize + 8, ry + 6, def.key.charAt(0).toUpperCase() + def.key.slice(1), {
        fontSize: '11px', fontFamily: 'Cinzel', color: '#cccccc',
      }).setDepth(902);
      objects.push(label);

      const stats = this.add.text(cx + pad + iconSize + 8, ry + 22, `HP ${def.hp}  ×${count}/wave`, {
        fontSize: '10px', fontFamily: 'Cinzel', color: '#888888',
      }).setDepth(902);
      objects.push(stats);
    });

    return objects;
  }

  _dismissEnemyPreview() {
    if (!this._enemyPreview) return;
    for (const obj of this._enemyPreview) obj.destroy();
    this._enemyPreview = null;
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

      if (this.debug || this.editorMode) {
        for (let vi = 0; vi < zone.length; vi++) {
          const { x, y } = zone[vi];
          const isSelected = this.editorMode && this._drag && this._drag.zoneIdx === zi && this._drag.vertIdx === vi;
          this.debugGraphics.fillStyle(isSelected ? 0xffff00 : 0x00ff88, 1);
          this.debugGraphics.fillCircle(x, y, 5);
          this.debugGraphics.lineStyle(1, 0xffffff, 0.8);
          this.debugGraphics.strokeCircle(x, y, 5);
        }
      }
    }
  }

  _getPlacementState(x, y) {
    const allTypes  = Object.values(TURRET_TYPES);
    const minSpace  = Math.min(...allTypes.map(t => t.minSpacing));
    const minCost   = Math.min(...allTypes.map(t => t.cost));
    const inZone    = this.levelConfig.placementZones.some(z => this._pointInPolygon(x, y, z));
    const tooClose  = this.waypoints.some(wp => Math.hypot(x - wp.x, y - wp.y) < WP_HIT_R)
                    || this.turrets.some(t  => Math.hypot(x - t.cx, y - t.cy) < minSpace);
    const canAfford = this.gold >= minCost;
    return { inZone, tooClose, canAfford, isValid: inZone && !tooClose && canAfford, minCost, allTypes };
  }

  _drawPlacementPreview(x, y) {
    this.previewGraphics.clear();

    if (this.phase === 'gameover' || this.phase === 'victory') return;

    // Tower hover — show its range ring
    for (const t of this.turrets) {
      if (Math.hypot(x - t.cx, y - t.cy) < SELL_HIT_R) {
        const def = TURRET_TYPES[t.type];
        this.previewGraphics.lineStyle(1, def.bulletColor, 0.5);
        this.previewGraphics.strokeEllipse(t.cx, t.cy, def.range * 2, def.range, 64);
        this._setStatusBar('Click to sell tower', 'valid');
        return;
      }
    }

    const { inZone, tooClose, canAfford, isValid, allTypes } = this._getPlacementState(x, y);

    const fillAlpha = isValid ? 0.35 : (inZone ? 0.35 : 0.15);
    this.previewGraphics.fillStyle(isValid ? 0x00ff88 : 0xff4444, fillAlpha);
    this.previewGraphics.fillEllipse(x, y, TILE_W * 2, TILE_H * 2);
    this.previewGraphics.lineStyle(1, isValid ? 0x00ff88 : 0xff4444, isValid ? 0.7 : (inZone ? 0.7 : 0.3));
    this.previewGraphics.strokeEllipse(x, y, TILE_W * 2, TILE_H * 2);

    if (inZone && !tooClose) {
      for (const def of allTypes) {
        if (this.gold < def.cost) continue;
        this.previewGraphics.lineStyle(1, def.bulletColor, 0.4);
        this.previewGraphics.strokeEllipse(x, y, def.range * 2, def.range, 64);
      }
    }

    if (!inZone) {
      this._setStatusBar('Not a valid placement zone', 'invalid');
    } else if (tooClose) {
      this._setStatusBar('Proximity too close to an existing tower', 'invalid');
    } else if (!canAfford) {
      this._setStatusBar('Insufficient gold', 'invalid');
    } else {
      this._setStatusBar('', 'valid');
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

  // ─── Restart confirm ─────────────────────────────────────────────────────

  _showRestartConfirm() {
    if (this._restartConfirm) return;
    const W = 280, H = 110;
    const rx = (CANVAS_W - W) / 2, ry = (CANVAS_H - H) / 2;

    const gfx = this.add.graphics().setDepth(1400);
    gfx.fillStyle(0x000000, 0.6);
    gfx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    gfx.fillStyle(0x0d1117, 1);
    gfx.fillRoundedRect(rx, ry, W, H, 8);
    gfx.lineStyle(1, 0x2a2a4a, 1);
    gfx.strokeRoundedRect(rx, ry, W, H, 8);

    const msg = this.add.text(CANVAS_W / 2, ry + 28, 'Restart level?', {
      fontSize: '16px', fontFamily: 'Cinzel', color: '#cccccc',
    }).setOrigin(0.5).setDepth(1401);

    const yesBtn = this._makeButton(CANVAS_W / 2 - 54, ry + H - 28, 'Restart', 'gold', 1401, () => {
      this._hideRestartConfirm();
      this.scene.restart({ levelId: this._currentLevel, currentLevel: this._currentLevel });
    }, { shadow: false });
    const noBtn = this._makeButton(CANVAS_W / 2 + 54, ry + H - 28, 'Cancel', 'dark', 1401, () => {
      this._hideRestartConfirm();
    }, { shadow: false });

    this._restartConfirm = { gfx, msg, yesBtn, noBtn };
  }

  _hideRestartConfirm() {
    if (!this._restartConfirm) return;
    const { gfx, msg, yesBtn, noBtn } = this._restartConfirm;
    gfx.destroy();
    msg.destroy();
    yesBtn._gfx.destroy(); yesBtn._txt.destroy();
    noBtn._gfx.destroy();  noBtn._txt.destroy();
    this._restartConfirm = null;
  }

  // ─── Button factory ───────────────────────────────────────────────────────

  _makeButton(bx0, by0, label, style, depth, onPress, opts = {}) {
    let x = bx0, y = by0;
    const origin = opts.origin ?? 0.5;
    const shadow = opts.shadow ?? true;

    const palettes = {
      gold: { face: 0xd4a010, hi: 0xffe066, sh: 0x7a5800, text: '#1a0e00' },
      dark: { face: 0x1e2244, hi: 0x2e3466, sh: 0x080a14, text: '#cccccc' },
    };
    const pal = palettes[style] ?? palettes.dark;

    const pad = { x: style === 'gold' ? 18 : 14, y: style === 'gold' ? 8 : 6 };
    const fontSize = opts.fontSize ?? (style === 'gold' ? '18px' : '13px');

    const txt = this.add.text(0, 0, label, {
      fontSize, fontFamily: 'Cinzel', color: pal.text,
    }).setDepth(depth + 1);

    const tw = txt.width  + pad.x * 2;
    const th = txt.height + pad.y * 2;
    const gfx = this.add.graphics().setDepth(depth);

    const draw = (pressed, hovered) => {
      gfx.clear();
      const face = hovered ? pal.hi : pal.face;
      const radius = 5;
      const ox = origin === 0.5 ? -tw / 2 : 0;
      const oy = origin === 0.5 ? -th / 2 : 0;
      const bx = x + ox, by = y + oy;

      if (!pressed && shadow) {
        gfx.fillStyle(pal.sh, 1);
        gfx.fillRoundedRect(bx + 3, by + 3, tw, th, radius);
      }
      gfx.fillStyle(face, 1);
      gfx.fillRoundedRect(bx + (pressed ? 2 : 0), by + (pressed ? 2 : 0), tw, th, radius);
      gfx.fillStyle(0xffffff, pressed ? 0 : 0.18);
      gfx.fillRoundedRect(bx + (pressed ? 2 : 0), by + (pressed ? 2 : 0), tw, radius, { tl: radius, tr: radius, bl: 0, br: 0 });
      gfx.fillRoundedRect(bx + (pressed ? 2 : 0), by + (pressed ? 2 : 0), radius, th, { tl: radius, tr: 0, bl: radius, br: 0 });

      txt.setPosition(
        bx + (pressed ? 2 : 0) + pad.x,
        by + (pressed ? 2 : 0) + pad.y
      );
    };

    draw(false, false);

    txt.setInteractive({ useHandCursor: true });
    txt.on('pointerover',  () => { this._overButton = true;  this.previewGraphics.clear(); this._setStatusBar(''); draw(false, true); });
    txt.on('pointerout',   () => { this._overButton = false; draw(false, false); });
    txt.on('pointerdown',  () => { draw(true, false); onPress(); });
    txt.on('pointerup',    () => draw(false, true));

    return {
      setVisible(v)      { gfx.setVisible(v); txt.setVisible(v); return this; },
      setText(t)         { txt.setText(t); draw(false, false); return this; },
      setPosition(nx, ny){ x = nx; y = ny; draw(false, false); return this; },
      _gfx: gfx, _txt: txt,
    };
  }

  // ─── Tower placement ──────────────────────────────────────────────────────

  onTileClick(pointer) {
    if (this.phase === 'gameover' || this.phase === 'victory') return;

    // Close existing popup if open
    if (this._towerPopup) {
      this._closeTowerPopup();
      return;
    }

    // Hit-test existing turrets first — click on a tower to sell it
    for (const t of this.turrets) {
      if (Math.hypot(pointer.x - t.cx, pointer.y - t.cy) < SELL_HIT_R) {
        this._openSellPopup(t, pointer.x, pointer.y);
        return;
      }
    }

    const { inZone, tooClose, canAfford } = this._getPlacementState(pointer.x, pointer.y);
    if (!inZone || tooClose || !canAfford) return;

    this._drawPlacementPreview(pointer.x, pointer.y);
    this._openTowerPopup(pointer.x, pointer.y);
  }

  _openTowerPopup(x, y) {
    const types  = Object.values(TURRET_TYPES);
    const cardW  = 130, cardH = 90, gap = 8, pad = 10;
    const totalW = types.length * cardW + (types.length - 1) * gap + pad * 2;
    const totalH = cardH + pad * 2 + 20;

    const px = Math.min(Math.max(x - totalW / 2, 4), CANVAS_W - totalW - 4);
    const py = Math.max(y - totalH - 12, 4);

    const gfx = this.add.graphics().setDepth(1000);
    gfx.fillStyle(0x0d1117, 0.92);
    gfx.fillRoundedRect(px, py, totalW, totalH, 6);
    gfx.lineStyle(1, 0x2a2a4a, 1);
    gfx.strokeRoundedRect(px, py, totalW, totalH, 6);

    const title = this.add.text(px + totalW / 2, py + pad, 'Choose tower', {
      fontSize: '11px', fontFamily: 'Cinzel', color: '#888888',
    }).setOrigin(0.5, 0).setDepth(1001);

    const cards = types.map((def, i) => {
      const cx = px + pad + i * (cardW + gap);
      const cy = py + pad + 18;
      return this._makeCardUI(def, cx, cy, cardW, cardH, x, y);
    });

    this._towerPopup = { x, y, gfx, title, cards };
  }

  _makeCardUI(def, cx, cy, cardW, cardH, placeX, placeY) {
    const canAfford = this.gold >= def.cost;

    const cardGfx = this.add.graphics().setDepth(1001);
    const drawCard = (hovered) => {
      cardGfx.clear();
      cardGfx.fillStyle(hovered ? 0x224422 : (canAfford ? 0x1a2a1a : 0x2a1a1a), 1);
      cardGfx.fillRoundedRect(cx, cy, cardW, cardH, 4);
      cardGfx.lineStyle(1, hovered ? 0x66cc66 : (canAfford ? 0x44aa44 : 0x663333), 1);
      cardGfx.strokeRoundedRect(cx, cy, cardW, cardH, 4);
    };
    drawCard(false);

    const icon = this.add.image(cx + cardW / 2, cy + 28, `turret_${def.key}`, def.frameIndex)
      .setScale(def.displayScale * 0.55).setDepth(1002).setAlpha(canAfford ? 1 : 0.4);

    const nameText = this.add.text(cx + cardW / 2, cy + 54, def.label ?? def.key, {
      fontSize: '11px', fontFamily: 'Cinzel',
      color: canAfford ? '#ccffcc' : '#996666',
    }).setOrigin(0.5, 0).setDepth(1002);

    const costText = this.add.text(cx + cardW / 2, cy + 70, `${def.cost}g`, {
      fontSize: '13px', fontFamily: 'Cinzel',
      color: canAfford ? '#f0c040' : '#664444',
    }).setOrigin(0.5, 0).setDepth(1002);

    const hitZone = this.add.zone(cx, cy, cardW, cardH).setOrigin(0, 0).setDepth(1002).setInteractive({ useHandCursor: canAfford });
    if (canAfford) {
      hitZone.on('pointerdown', () => { this._closeTowerPopup(); this.previewGraphics.clear(); this._placeTower(placeX, placeY, def.key); });
      hitZone.on('pointerover',  () => drawCard(true));
      hitZone.on('pointerout',   () => drawCard(false));
    }

    return { cardGfx, icon, nameText, costText, hitZone };
  }

  _openSellPopup(turret, px, py) {
    const def    = TURRET_TYPES[turret.type];
    const refund = Math.floor(turret.cost / 2);
    const cardW  = 150, cardH = 130, pad = 10;

    const ox = Math.min(Math.max(px - cardW / 2, 4), CANVAS_W - cardW - 4);
    const oy = Math.max(py - cardH - 12, 4);

    const gfx = this.add.graphics().setDepth(1000);
    gfx.fillStyle(0x0d1117, 0.92);
    gfx.fillRoundedRect(ox, oy, cardW, cardH, 6);
    gfx.lineStyle(1, 0x4a2a0a, 1);
    gfx.strokeRoundedRect(ox, oy, cardW, cardH, 6);

    const title = this.add.text(ox + cardW / 2, oy + pad, def.label ?? def.key, {
      fontSize: '11px', fontFamily: 'Cinzel', color: '#aaaaaa',
    }).setOrigin(0.5, 0).setDepth(1001);

    const icon = this.add.image(ox + cardW / 2, oy + pad + 18 + 16, `turret_${def.key}`, def.frameIndex)
      .setScale(def.displayScale * 0.5)
      .setDepth(1002);

    const refundText = this.add.text(ox + cardW / 2, oy + 82, `Sell for ${refund}g`, {
      fontSize: '11px', fontFamily: 'Cinzel', color: '#f0c040',
    }).setOrigin(0.5, 0).setDepth(1002);

    const sellBtn = this._makeButton(ox + cardW / 2, oy + cardH - 20, 'Sell Tower', 'dark', 1002, () => {
      this._closeTowerPopup();
      this._sellTower(turret);
    }, { shadow: false });

    this._towerPopup = { x: px, y: py, gfx, title, cards: [
      { cardGfx: null, icon, nameText: refundText, costText: null, hitZone: null },
    ], _sellBtn: sellBtn };
  }

  _closeTowerPopup() {
    if (!this._towerPopup) return;
    const { gfx, title, cards, _sellBtn } = this._towerPopup;
    gfx.destroy();
    title.destroy();
    for (const { cardGfx, icon, nameText, costText, hitZone } of cards) {
      cardGfx?.destroy();
      icon?.destroy();
      nameText?.destroy();
      costText?.destroy();
      hitZone?.destroy();
    }
    if (_sellBtn) { _sellBtn._gfx.destroy(); _sellBtn._txt.destroy(); }
    this._towerPopup = null;
    this._overButton = false;
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
      cost: def.cost,
      sprite,
      range:        def.range,
      fireRate:     def.fireRate,
      fireCooldown: 0,
      damage:       def.damage,
      bulletSpeed:  def.bulletSpeed,
      bulletColor:  def.bulletColor,
      bulletType:   def.bulletType,
      arcHeight:    def.arcHeight ?? 0,
      arcDuration:  def.arcDuration ?? 0,
      aimAngle:     0,
    });
  }

  _sellTower(turret) {
    const refund = Math.floor(turret.cost / 2);
    turret.sprite.destroy();
    this.turrets.splice(this.turrets.indexOf(turret), 1);
    this.gold += refund;
    this._updateHUD();
    this.previewGraphics.clear();
    this._setStatusBar(`Sold for ${refund}g`, 'valid');
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
      this._showOverlay('GAME OVER', `Score: ${this.score}`, '#ff4444', true, true);
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
        let sprite;
        if (t.bulletType === 'orb') {
          sprite = this.add.image(t.cx, t.cy, 'orb').setScale(0.18);
        } else {
          sprite = this.add.image(t.cx, t.cy, 'arrow').setScale(1.125);
        }
        sprite.setDepth(600);
        if (t.bulletType === 'arrow') {
          // Lead the target: predict position after arcDuration seconds
          const wp     = this.waypoints[nearest.waypointIdx];
          const wdx    = wp.x - nearest.x;
          const wdy    = wp.y - nearest.y;
          const wdist  = Math.sqrt(wdx * wdx + wdy * wdy);
          const travel = nearest.speed * t.arcDuration;
          const frac   = wdist > 0 ? Math.min(travel / wdist, 1) : 0;
          const endX   = nearest.x + wdx * frac;
          const endY   = nearest.y + wdy * frac;
          this.bullets.push({
            bulletType: 'arrow',
            startX: t.cx, startY: t.cy,
            endX, endY,
            arcHeight: t.arcHeight,
            arcDuration: t.arcDuration,
            elapsed: 0,
            damage: t.damage,
            targetId: nearest.id,
            sprite,
          });
        } else {
          // Multi-waypoint lead: walk enemy along path for flightTime seconds
          const odx        = nearest.x - t.cx;
          const ody        = nearest.y - t.cy;
          const oDist      = Math.sqrt(odx * odx + ody * ody);
          const flightTime = oDist / t.bulletSpeed;
          let remaining    = nearest.speed * flightTime;
          let px = nearest.x, py = nearest.y;
          for (let wi = nearest.waypointIdx; wi < this.waypoints.length && remaining > 0; wi++) {
            const wp   = this.waypoints[wi];
            const wdx  = wp.x - px;
            const wdy  = wp.y - py;
            const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
            if (wlen <= remaining) {
              px = wp.x; py = wp.y;
              remaining -= wlen;
            } else {
              px += (wdx / wlen) * remaining;
              py += (wdy / wlen) * remaining;
              remaining = 0;
            }
          }
          const toDx = px - t.cx;
          const toDy = py - t.cy;
          const toD  = Math.sqrt(toDx * toDx + toDy * toDy);
          this.bullets.push({
            bulletType: 'orb',
            x: t.cx, y: t.cy,
            vx: (toDx / toD) * t.bulletSpeed,
            vy: (toDy / toD) * t.bulletSpeed,
            maxDist: toD + 40,
            travelled: 0,
            damage: t.damage,
            sprite,
          });
        }
      }
    }

    // Move bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];

      if (b.bulletType === 'arrow') {
        b.elapsed += dt;
        const tRaw = b.elapsed / b.arcDuration;

        if (tRaw >= 1) {
          // Arrival — damage nearest enemy within 20px of landing point
          b.sprite.destroy();
          this.bullets.splice(i, 1);
          const hit = this.enemies.find(e => !e.dying &&
            Math.sqrt((e.x - b.endX) ** 2 + (e.y - b.endY) ** 2) < 25);
          if (hit) {
            hit.hp -= b.damage;
            if (hit.hp <= 0 && !hit.dying) {
              this.killEnemy(hit);
            } else if (!hit.dying && hit.sprite.anims.currentAnim?.key !== `${hit.type}_hurt`) {
              hit.sprite.removeAllListeners('animationcomplete');
              hit.sprite.play(`${hit.type}_hurt`);
              hit.sprite.once('animationcomplete', () => {
                if (!hit.dying) hit.sprite.play(`${hit.type}_walk`);
              });
            }
          }
          continue;
        }

        const tc   = Math.min(tRaw, 1);
        const prevT = Math.max(0, tc - 0.01);
        const arcY  = (t) => -b.arcHeight * 4 * t * (1 - t);
        const px = b.startX + (b.endX - b.startX) * tc   + 0;
        const py = b.startY + (b.endY - b.startY) * tc   + arcY(tc);
        const qx = b.startX + (b.endX - b.startX) * prevT;
        const qy = b.startY + (b.endY - b.startY) * prevT + arcY(prevT);
        b.sprite.setPosition(px, py);
        b.sprite.setRotation(Math.atan2(py - qy, px - qx));

      } else {
        // Fixed-trajectory orb
        const stepX = b.vx * dt;
        const stepY = b.vy * dt;
        b.x += stepX;
        b.y += stepY;
        b.travelled += Math.sqrt(stepX * stepX + stepY * stepY);
        b.sprite.setPosition(b.x, b.y);
        b.sprite.setRotation(Math.atan2(b.vy, b.vx));

        if (b.travelled >= b.maxDist) {
          b.sprite.destroy();
          this.bullets.splice(i, 1);
          continue;
        }

        const hit = this.enemies.find(e => !e.dying &&
          Math.sqrt((e.x - b.x) ** 2 + (e.y - b.y) ** 2) < 15);
        if (hit) {
          b.sprite.destroy();
          this.bullets.splice(i, 1);
          hit.hp -= b.damage;
          if (hit.hp <= 0 && !hit.dying) {
            this.killEnemy(hit);
          } else if (!hit.dying && hit.sprite.anims.currentAnim?.key !== `${hit.type}_hurt`) {
            hit.sprite.removeAllListeners('animationcomplete');
            hit.sprite.play(`${hit.type}_hurt`);
            hit.sprite.once('animationcomplete', () => {
              if (!hit.dying) hit.sprite.play(`${hit.type}_walk`);
            });
          }
        }
      }
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
