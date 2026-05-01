import { CANVAS_W, CANVAS_H } from '../constants.js';
import { CAMPAIGN_LEVELS } from '../data/levels.js';

const MAP_IMG_W = 1124;
const MAP_IMG_H = 1124;
const NODE_R    = 16;

export default class CampaignMapScene extends Phaser.Scene {
  constructor() { super('CampaignMapScene'); }

  preload() {
    this.load.image('mapbg', 'assets/levels/CampaignMap.jpg');
  }

  create(data = {}) {
    document.getElementById('info').style.display      = 'none';
    document.getElementById('hud').style.display       = 'none';
    document.getElementById('statusbar').style.display = 'none';

    // Campaign progression state (persisted via scene data passing)
    this.currentLevel       = data.currentLevel       ?? 0;
    this.justCompletedLevel = data.justCompletedLevel ?? -1;
    this.revealProgress     = 0;
    this._revealing         = data.reveal             ?? false;

    // Map camera state
    this._zoom    = 0; // set in _resetCamera
    this._camX    = 0;
    this._camY    = 0;
    this._dragging     = false;
    this._dragStartX   = 0;
    this._dragStartY   = 0;
    this._dragCamX     = 0;
    this._dragCamY     = 0;

    // Popup state
    this._popup = null; // { levelId } or null

    // Two graphics layers: bg (depth 0, behind map image) and overlay (depth 2, above map image)
    this._bgGfx  = this.add.graphics().setDepth(0);
    this._gfx    = this.add.graphics().setDepth(2);
    this._nodeTexts = []; // label Text objects, one per level node

    // Pre-create label texts (reused each frame)
    for (let i = 0; i < CAMPAIGN_LEVELS.length; i++) {
      const t = this.add.text(0, 0, '', {
        fontSize: '11px', fontFamily: 'Cinzel', color: '#ffffff',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(10);
      this._nodeTexts.push(t);
    }

    // Popup card texts
    this._popupTitle = this.add.text(0, 0, '', {
      fontSize: '16px', fontFamily: 'Cinzel', color: '#3a2408',
    }).setOrigin(0.5, 0).setDepth(20).setVisible(false);
    this._popupDesc = this.add.text(0, 0, '', {
      fontSize: '14px', fontFamily: 'Cinzel', color: '#5a3c10',
      wordWrap: { width: 320 }, align: 'center',
    }).setOrigin(0.5, 0).setDepth(20).setVisible(false);
    this._popupBeginBtn = this.add.text(0, 0, 'Begin!', {
      fontSize: '16px', fontFamily: 'Cinzel', color: '#d4eeaa',
      backgroundColor: '#1a5c10', padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0.5).setDepth(20).setVisible(false)
      .setInteractive({ useHandCursor: true });
    this._popupBeginBtn.on('pointerdown', () => this._beginLevel());
    this._popupBeginBtn.on('pointerover',  () => this._popupBeginBtn.setStyle({ backgroundColor: '#2a8020' }));
    this._popupBeginBtn.on('pointerout',   () => this._popupBeginBtn.setStyle({ backgroundColor: '#1a5c10' }));

    // Between-wave label text (for reveal)
    this._revealText = this.add.text(CANVAS_W / 2, 32, '', {
      fontSize: '22px', fontFamily: 'Cinzel', color: '#f0e080',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(20).setVisible(false);

    this._resetCamera();

    // Pre-computed stable offsets for sparkle trail particles (avoids per-frame Math.random jitter)
    const SPARKLE_COUNT = 18;
    this._sparkleOffsets = Array.from({ length: SPARKLE_COUNT }, () => ({
      dx: (Math.random() - 0.5) * 8,
      dy: (Math.random() - 0.5) * 8,
      r:  Math.max(0.5, 2 + Math.random() * 2),
    }));

    // Map image sits above the dark bg fill (depth 0), below node graphics (depth 2)
    this._mapImg = this.add.image(0, 0, 'mapbg').setOrigin(0, 0).setDepth(1);

    this._titleText = this.add.text(CANVAS_W / 2, 22, 'Kingdom of Sylvan', {
      fontSize: '28px', fontFamily: 'Cinzel', color: '#e8d8a0',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setDepth(15);

    const dictBtn = this.add.text(CANVAS_W - 14, 14, '?', {
      fontSize: '18px', fontFamily: 'Cinzel', color: '#888888',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(15).setInteractive({ useHandCursor: true });
    dictBtn.on('pointerover', () => dictBtn.setStyle({ color: '#f0c040' }));
    dictBtn.on('pointerout',  () => dictBtn.setStyle({ color: '#888888' }));
    dictBtn.on('pointerdown', () => { window.open('dictionary.html', '_blank'); });

    // Input
    this.input.on('pointerdown', (p) => this._onPointerDown(p));
    this.input.on('pointermove', (p) => this._onPointerMove(p));
    this.input.on('pointerup',   (p) => this._onPointerUp(p));
    this.input.on('wheel',       (p, _dx, _dy, deltaY) => this._onWheel(p, deltaY));
  }

  // ─── Camera ──────────────────────────────────────────────────────────────────

  _baseZoom() {
    return Math.min(CANVAS_W / MAP_IMG_W, CANVAS_H / MAP_IMG_H);
  }

  _resetCamera() {
    this._zoom = this._baseZoom();
    this._camX = (CANVAS_W  - MAP_IMG_W * this._zoom) / 2;
    this._camY = (CANVAS_H - MAP_IMG_H * this._zoom) / 2;
    this._clampCamera();
  }

  _clampCamera() {
    const iw = MAP_IMG_W * this._zoom;
    const ih = MAP_IMG_H * this._zoom;
    const mxX = iw > CANVAS_W  ? 0 : (CANVAS_W  - iw) / 2;
    const mxY = ih > CANVAS_H ? 0 : (CANVAS_H - ih) / 2;
    this._camX = Math.min(mxX, Math.max(CANVAS_W  - iw - mxX, this._camX));
    this._camY = Math.min(mxY, Math.max(CANVAS_H - ih - mxY, this._camY));
  }

  // Convert map-image coords → canvas coords
  _worldToCanvas(wx, wy) {
    return { x: this._camX + wx * this._zoom, y: this._camY + wy * this._zoom };
  }

  // Convert canvas coords → map-image coords
  _canvasToWorld(sx, sy) {
    return { x: (sx - this._camX) / this._zoom, y: (sy - this._camY) / this._zoom };
  }

  // ─── Input ───────────────────────────────────────────────────────────────────

  _onPointerDown(p) {
    if (this._popup) return; // let begin-btn handle its own click
    this._dragging   = true;
    this._dragStartX = p.x;
    this._dragStartY = p.y;
    this._dragCamX   = this._camX;
    this._dragCamY   = this._camY;
  }

  _onPointerMove(p) {
    if (this._dragging && !this._popup) {
      this._camX = this._dragCamX + (p.x - this._dragStartX);
      this._camY = this._dragCamY + (p.y - this._dragStartY);
      this._clampCamera();
    }
  }

  _onPointerUp(p) {
    const dragDist = Math.hypot(p.x - this._dragStartX, p.y - this._dragStartY);
    this._dragging = false;

    // Suppress click if it was a drag
    if (dragDist > 5 && !this._popup) return;

    // Close popup on click outside card
    if (this._popup) {
      const { px, py, PW, PH } = this._popup;
      if (p.x < px || p.x > px + PW || p.y < py || p.y > py + PH) {
        this._closePopup();
      }
      return;
    }

    // Hit-test nodes
    const hitR = NODE_R / this._zoom;
    const w    = this._canvasToWorld(p.x, p.y);
    for (let i = 0; i <= this.currentLevel && i < CAMPAIGN_LEVELS.length; i++) {
      const lv = CAMPAIGN_LEVELS[i];
      if (Math.hypot(w.x - lv.mx, w.y - lv.my) <= hitR) {
        this._openPopup(i);
        return;
      }
    }
  }

  _onWheel(p, deltaY) {
    if (this._popup) return;
    const delta   = deltaY < 0 ? 1.1 : 0.91;
    const newZoom = Math.min(2.5, Math.max(this._baseZoom(), this._zoom * delta));
    this._camX    = p.x - (p.x - this._camX) * (newZoom / this._zoom);
    this._camY    = p.y - (p.y - this._camY) * (newZoom / this._zoom);
    this._zoom    = newZoom;
    this._clampCamera();
  }

  // ─── Popup ───────────────────────────────────────────────────────────────────

  _openPopup(levelId) {
    const lv = CAMPAIGN_LEVELS[levelId];
    const PW = 380, pad = 20;

    this._popupTitle.setText(lv.name).setPosition(0, 0).setVisible(true);
    this._popupDesc.setText(lv.description).setPosition(0, 0).setVisible(true);

    const titleH  = 44;
    const descTop = 16;
    const descBot = 16;
    const descH   = this._popupDesc.height;
    const btnH    = 36;
    const PH      = titleH + descTop + descH + descBot + btnH + pad;
    const px      = (CANVAS_W - PW) / 2;
    const py      = (CANVAS_H - PH) / 2;

    this._popupTitle.setPosition(px + PW / 2, py + 16);
    this._popupDesc.setPosition(px + PW / 2, py + titleH + descTop);
    this._popupBeginBtn.setPosition(px + PW / 2, py + titleH + descTop + descH + descBot + pad).setVisible(true);

    this._popup = { levelId, px, py, PW, PH };
  }

  _closePopup() {
    this._popup = null;
    this._popupTitle.setVisible(false);
    this._popupDesc.setVisible(false);
    this._popupBeginBtn.setVisible(false);
  }

  _beginLevel() {
    const id = this._popup.levelId;
    this._closePopup();
    this.scene.start('LevelScene', {
      levelId:      id,
      currentLevel: this.currentLevel,
    });
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  update(_time, delta) {
    if (this._revealing) {
      this.revealProgress = Math.min(1, this.revealProgress + (delta / 1000) / 2.2);
      if (this.revealProgress >= 1) this._revealing = false;
    }
    this._draw();
  }

  // ─── Drawing ─────────────────────────────────────────────────────────────────

  _draw() {
    const g   = this._gfx;
    const now = Date.now();
    g.clear();
    this._bgGfx.clear();

    // Dark background drawn behind the map image
    this._bgGfx.fillStyle(0x1a1008, 1);
    this._bgGfx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this._mapImg.setPosition(this._camX, this._camY);
    this._mapImg.setScale(this._zoom);

    const nodeR = Math.max(10, NODE_R * this._zoom);

    // Draw nodes up to currentLevel (and just-completed during reveal)
    const maxDraw = this._revealing
      ? Math.min(this.justCompletedLevel + 1, CAMPAIGN_LEVELS.length - 1)
      : Math.min(this.currentLevel, CAMPAIGN_LEVELS.length - 1);

    for (let i = 0; i <= maxDraw; i++) {
      this._drawNode(g, i, now, nodeR);
    }

    // Reveal: sparkle trail + pop-in of next node
    if (this._revealing && this.justCompletedLevel >= 0 && this.currentLevel < CAMPAIGN_LEVELS.length) {
      this._drawReveal(g, now, nodeR);
    }

    // Title bar (no background fill — title text floats over the map)

    // Popup card
    if (this._popup) this._drawPopup(g);

    // Position node label texts
    for (let i = 0; i < CAMPAIGN_LEVELS.length; i++) {
      const visible = i <= maxDraw;
      const t = this._nodeTexts[i];
      if (visible) {
        const lv = CAMPAIGN_LEVELS[i];
        const { x, y } = this._worldToCanvas(lv.mx, lv.my);
        t.setPosition(x, y - nodeR - 6).setText(lv.name).setVisible(true);
      } else {
        t.setVisible(false);
      }
    }

  }

  _drawNode(g, i, now, nodeR) {
    const lv   = CAMPAIGN_LEVELS[i];
    const done = i < this.currentLevel;
    const { x, y } = this._worldToCanvas(lv.mx, lv.my);

    // Pulsing gold ring for the next node to play
    if (i === this.currentLevel) {
      const pulse = 0.55 + 0.45 * Math.sin(now * 0.003);
      g.lineStyle(4, 0xe8c030, pulse);
      g.strokeCircle(x, y, nodeR + 8);
    }

    // Node circle
    g.fillStyle(done ? 0x7ab060 : 0xe8d070, 1);
    g.fillCircle(x, y, nodeR);
    g.lineStyle(2.5, done ? 0x3a6820 : 0xc09010, 1);
    g.strokeCircle(x, y, nodeR);

    this._drawNodeIcon(g, x, y, lv.icon, nodeR);

    // Checkmark for completed
    if (done) {
      const bx = x + nodeR * 0.65;
      const by = y - nodeR * 0.65;
      g.fillStyle(0x2a8020, 1);
      g.fillCircle(bx, by, 9);
      g.lineStyle(1.5, 0xffffff, 1);
      g.strokeCircle(bx, by, 9);
      g.lineStyle(2, 0xffffff, 1);
      g.beginPath();
      g.moveTo(bx - 4, by);
      g.lineTo(bx - 1, by + 3);
      g.lineTo(bx + 5, by - 4);
      g.strokePath();
    }
  }

  _drawNodeIcon(g, x, y, icon, nodeR) {
    const sc = nodeR / NODE_R;

    if (icon === 'forest') {
      g.fillStyle(0x2d6e2d, 1);
      for (const [dx, dy] of [[-8, 4], [0, -6], [8, 4]]) {
        g.fillTriangle(
          x + (dx) * sc,        y + (dy - 10) * sc,
          x + (dx - 7) * sc,    y + (dy + 2) * sc,
          x + (dx + 7) * sc,    y + (dy + 2) * sc
        );
      }
    } else if (icon === 'mountain') {
      g.fillStyle(0x8a7860, 1);
      g.fillTriangle(x, y - 12 * sc, x - 14 * sc, y + 10 * sc, x + 14 * sc, y + 10 * sc);
      g.fillStyle(0xffffff, 0.7);
      g.fillTriangle(x, y - 12 * sc, x - 5 * sc, y - 4 * sc, x + 5 * sc, y - 4 * sc);
    } else if (icon === 'river') {
      g.lineStyle(3 * sc, 0x4488cc, 1);
      for (const dy of [-5, 2, 9]) {
        g.beginPath();
        g.moveTo(x - 12 * sc, y + dy * sc);
        g.lineTo(x + 12 * sc, y + dy * sc);
        g.strokePath();
      }
    } else if (icon === 'village') {
      g.fillStyle(0xa06030, 1);
      g.fillRect(x - 10 * sc, y - 2 * sc, 10 * sc, 12 * sc);
      g.fillRect(x + 2  * sc, y + 2 * sc, 10 * sc, 8  * sc);
      g.fillStyle(0xc03010, 1);
      g.fillTriangle(x - 12 * sc, y - 2 * sc, x - 5 * sc, y - 10 * sc, x + 2 * sc, y - 2 * sc);
      g.fillTriangle(x,           y + 2 * sc, x + 7 * sc, y - 5  * sc, x + 14 * sc, y + 2 * sc);
    } else if (icon === 'volcano') {
      g.fillStyle(0x5a3020, 1);
      g.fillTriangle(x, y - 14 * sc, x - 16 * sc, y + 10 * sc, x + 16 * sc, y + 10 * sc);
      g.fillStyle(0xff6010, 1);
      g.fillEllipse(x, y - 13 * sc, 10 * sc, 6 * sc);
      g.fillStyle(0xffcc00, 1);
      g.fillEllipse(x, y - 13 * sc, 4 * sc, 3 * sc);
    }
  }

  _drawReveal(g, now, nodeR) {
    const from = this._worldToCanvas(CAMPAIGN_LEVELS[this.justCompletedLevel].mx, CAMPAIGN_LEVELS[this.justCompletedLevel].my);
    const to   = this._worldToCanvas(CAMPAIGN_LEVELS[this.currentLevel].mx,       CAMPAIGN_LEVELS[this.currentLevel].my);

    const trailP = Math.min(1, this.revealProgress * 2);
    const nodeP  = Math.max(0, (this.revealProgress - 0.5) * 2);

    // Sparkle trail (stable per-particle offsets, only alpha animates)
    const count = this._sparkleOffsets.length;
    for (let j = 0; j < count; j++) {
      const t     = (j / (count - 1)) * trailP;
      const tx    = from.x + (to.x - from.x) * t;
      const ty    = from.y + (to.y - from.y) * t;
      const age   = trailP - t;
      const alpha = Math.max(0, 1 - age * 1.8) * (0.6 + 0.4 * Math.sin(now * 0.008 + j));
      const color = j % 3 === 0 ? 0xffe860 : j % 3 === 1 ? 0xffffff : 0xc0a0ff;
      const { dx, dy, r } = this._sparkleOffsets[j];
      g.fillStyle(color, alpha);
      g.fillCircle(tx + dx, ty + dy, r);
    }

    // Pop-in of new node
    if (nodeP > 0) {
      const pop = nodeP < 0.6 ? nodeP / 0.6 : 1 + 0.15 * Math.sin((nodeP - 0.6) / 0.4 * Math.PI);
      // Draw the node at the destination with scaled radius
      this._drawNode(g, this.currentLevel, now, nodeR * pop);
    }
  }

  _drawPopup(g) {
    const { px, py, PW, PH } = this._popup;

    // Dim overlay
    g.fillStyle(0x000000, 0.5);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Card
    g.fillStyle(0xede0b0, 1);
    g.fillRoundedRect(px, py, PW, PH, 10);
    g.lineStyle(2.5, 0x7a5018, 1);
    g.strokeRoundedRect(px, py, PW, PH, 10);

    // Divider
    g.lineStyle(1, 0xc0a060, 1);
    g.beginPath();
    g.moveTo(px + 20, py + 44);
    g.lineTo(px + PW - 20, py + 44);
    g.strokePath();
  }

}
