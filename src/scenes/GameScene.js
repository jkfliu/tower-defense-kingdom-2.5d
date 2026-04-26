import { CANVAS_W, CANVAS_H, scaleX, scaleY } from '../constants.js';
import { LEVELS } from '../data/levels.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { TURRET_TYPES } from '../data/turrets.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  preload() {
    const level = LEVELS[0];
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

  create() {
    this.levelConfig = LEVELS[0];

    this._buildAnims();

    const bg = this.add.image(0, 0, 'bg').setOrigin(0, 0);
    bg.setDisplaySize(CANVAS_W, CANVAS_H);
    bg.setDepth(-1);

    this.turrets    = [];
    this.enemies    = [];
    this.bullets    = [];
    this.spawnTimer = 0;
    this.spawnInterval = this._nextSpawnDelay();
    this.enemyId    = 0;

    this.waypoints = this.levelConfig.waypoints;

    this.debugGraphics   = this.add.graphics();
    this.entityGraphics  = this.add.graphics();
    this.previewGraphics = this.add.graphics();
    this.previewGraphics.setDepth(200);

    this._drawDebugPath();
    this._drawPlacementZones();

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
      const imgX = Math.round(p.x / scaleX);
      const imgY = Math.round(p.y / scaleY);
      document.getElementById('statusbar').textContent = `x: ${imgX}, y: ${imgY}`;
      if (this.editorMode && this._drag) {
        const pt = { x: Math.round(p.x), y: Math.round(p.y) };
        if (this._drag.type === 'path') {
          this.waypoints[this._drag.idx] = pt;
        } else {
          this.levelConfig.placementZones[this._drag.zoneIdx][this._drag.vertIdx] = pt;
        }
        this._drawDebugPath();
        this._drawPlacementZones();
      }

      if (!this.editorMode) this._drawPlacementPreview(p.x, p.y);
    });

    this.input.on('pointerout', () => {
      this.previewGraphics.clear();
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
        this._drawDebugPath();
        this._drawPlacementZones();
      }
    });

    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-P', () => {
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
      this._drawDebugPath();
      this._drawPlacementZones();
    });
    this.input.keyboard.on('keydown-DELETE', () => {
      if (!this.editorMode || !this._drag) return;
      if (this._drag.type === 'path') {
        if (this.waypoints.length > 2) {
          this.waypoints.splice(this._drag.idx, 1);
          this._drag = null;
          this._drawDebugPath();
          this._drawPlacementZones();
          this._logWaypoints();
        }
      } else {
        const { zoneIdx, vertIdx } = this._drag;
        const zone = this.levelConfig.placementZones[zoneIdx];
        if (zone.length > 3) {
          zone.splice(vertIdx, 1);
          this._drag = null;
          this._drawDebugPath();
          this._drawPlacementZones();
          this._logZones();
        }
      }
    });
  }

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

  _drawDebugPath() {
    this.debugGraphics.clear();
    // Path line
    this.debugGraphics.lineStyle(2, 0xff0000, 0.6);
    this.debugGraphics.beginPath();
    this.debugGraphics.moveTo(this.waypoints[0].x, this.waypoints[0].y);
    for (let i = 1; i < this.waypoints.length; i++) {
      this.debugGraphics.lineTo(this.waypoints[i].x, this.waypoints[i].y);
    }
    this.debugGraphics.strokePath();
    // Waypoint dots — red
    for (const { x, y } of this.waypoints) {
      this.debugGraphics.fillStyle(0xff0000, 0.9);
      this.debugGraphics.fillCircle(x, y, 6);
      this.debugGraphics.lineStyle(1, 0xffffff, 0.8);
      this.debugGraphics.strokeCircle(x, y, 6);
    }
    this.debugGraphics.setDepth(50);
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
    const zones  = this.levelConfig.placementZones;
    const def      = TURRET_TYPES.basic;
    const valid    = zones.some(z => this._pointInPolygon(x, y, z));
    const tooClose = this.waypoints.some(wp => Math.hypot(x - wp.x, y - wp.y) < 30)
                  || this.turrets.some(t => Math.hypot(x - t.cx, y - t.cy) < def.minSpacing);
    const isValid  = valid && !tooClose;

    const tileW = 32, tileH = 18;

    // Tile highlight — ellipse footprint
    this.previewGraphics.fillStyle(isValid ? 0x00ff88 : 0xff4444, 0.35);
    this.previewGraphics.fillEllipse(x, y, tileW * 2, tileH * 2);
    this.previewGraphics.lineStyle(1, isValid ? 0x00ff88 : 0xff4444, 0.7);
    this.previewGraphics.strokeEllipse(x, y, tileW * 2, tileH * 2);

    if (isValid) {
      this.previewGraphics.lineStyle(1, 0xffffff, 0.3);
      this.previewGraphics.strokeEllipse(x, y, def.range * 2, def.range, 64);
    }
  }

  _editorPointerDown(p) {
    const now = Date.now();
    const dblClick = (now - this._lastClickTime) < 300
      && Math.abs(p.x - this._lastClickX) < 10
      && Math.abs(p.y - this._lastClickY) < 10;
    this._lastClickTime = now;
    this._lastClickX    = p.x;
    this._lastClickY    = p.y;

    const zones = this.levelConfig.placementZones;

    // Hit-test path waypoints → start drag
    for (let i = 0; i < this.waypoints.length; i++) {
      const { x, y } = this.waypoints[i];
      if (Math.hypot(p.x - x, p.y - y) <= 12) {
        this._drag = { type: 'path', idx: i };
        this._drawDebugPath();
        this._drawPlacementZones();
        return;
      }
    }

    // Hit-test zone vertices → start drag
    for (let zi = 0; zi < zones.length; zi++) {
      for (let vi = 0; vi < zones[zi].length; vi++) {
        const { x, y } = zones[zi][vi];
        if (Math.hypot(p.x - x, p.y - y) <= 12) {
          this._drag = { type: 'zone', zoneIdx: zi, vertIdx: vi };
          this._drawDebugPath();
          this._drawPlacementZones();
          return;
        }
      }
    }

    // Double-click on a path segment → insert new waypoint
    if (dblClick) {
      let bestPath = { dist: Infinity, idx: -1 };
      for (let i = 0; i < this.waypoints.length - 1; i++) {
        const d = this._distToSegment(p.x, p.y, this.waypoints[i], this.waypoints[i + 1]);
        if (d < bestPath.dist) bestPath = { dist: d, idx: i };
      }
      if (bestPath.dist < 20) {
        this.waypoints.splice(bestPath.idx + 1, 0, { x: Math.round(p.x), y: Math.round(p.y) });
        this._drawDebugPath();
        this._drawPlacementZones();
        this._logWaypoints();
        return;
      }
    }

    // Double-click on a zone edge → insert new vertex
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
        this._drawDebugPath();
        this._drawPlacementZones();
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

  onTileClick(pointer) {
    const zones = this.levelConfig.placementZones;
    const inZone = zones.some(z => this._pointInPolygon(pointer.x, pointer.y, z));
    if (!inZone) return;

    for (const wp of this.waypoints) {
      const dx = pointer.x - wp.x;
      const dy = pointer.y - wp.y;
      if (Math.sqrt(dx * dx + dy * dy) < 30) return;
    }
    const def = TURRET_TYPES.basic;
    for (const t of this.turrets) {
      if (Math.hypot(pointer.x - t.cx, pointer.y - t.cy) < def.minSpacing) return;
    }
    const sprite = this.add.image(pointer.x, pointer.y, `turret_${def.key}`, def.frameIndex);
    sprite.setScale(def.displayScale);
    sprite.setDepth(pointer.y);
    this.turrets.push({
      cx: pointer.x,
      cy: pointer.y,
      type: def.key,
      sprite,
      range: def.range,
      fireRate: def.fireRate,
      fireCooldown: 0,
      damage: def.damage,
      bulletSpeed: def.bulletSpeed,
      bulletColor: def.bulletColor,
      aimAngle: 0,
    });
  }

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
    enemy.sprite.removeAllListeners('animationcomplete');
    enemy.sprite.play(`${enemy.type}_death`);
    enemy.sprite.once('animationcomplete', () => {
      enemy.sprite.destroy();
      const idx = this.enemies.indexOf(enemy);
      if (idx >= 0) this.enemies.splice(idx, 1);
    });
  }

  update(_time, delta) {
    if (this.paused) return;

    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnInterval = this._nextSpawnDelay();
      if (this.waypoints.length > 1) this.spawnEnemy(this._pickEnemyType());
    }

    const dt = delta / 1000;

    // Move enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dying) continue;

      const target = this.waypoints[e.waypointIdx];
      if (!target) {
        e.sprite.destroy();
        this.enemies.splice(i, 1);
        continue;
      }

      const dx   = target.x - e.x;
      const dy   = target.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        e.waypointIdx++;
        if (e.waypointIdx >= this.waypoints.length) {
          e.sprite.destroy();
          this.enemies.splice(i, 1);
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
        // Ellipse distance test matching the isometric range visual (rx=range, ry=range*0.5)
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

  _drawEntities() {
    this.entityGraphics.clear();
    this.entityGraphics.setDepth(9999);

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
