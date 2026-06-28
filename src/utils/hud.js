import { GAME_W, GAME_H, CANVAS_H, HUD_TOP, HUD_BOTTOM, DEV_MODE } from '../constants.js';
import { soundManager } from './sound.js';

// In-canvas HUD: a top band (level label + wave/lives/score/gold + sound toggle) and a
// bottom band (keyboard-hint actions + status line). Replaces the old DOM HUD so the
// whole display is one responsive canvas.
//
// The play field is rendered by the scene's main camera, scrolled up by HUD_TOP so it
// sits in the middle strip; the HUD lives in the bands above/below. HUD objects use
// scrollFactor 0 so they stay pinned to the screen regardless of that camera scroll.
const STATUS_COLORS = { valid: '#f0c040', invalid: '#ff6666', neutral: '#cccccc' };
const HUD_DEPTH = 1150;

export class HudOverlay {
  // actions: { start, pause, restart, ff, debug, editor } — callbacks for the hint bar.
  constructor(scene, actions = {}) {
    this.scene   = scene;
    this.actions = actions;
    this.objects = [];
    this._bottomY = HUD_TOP + CANVAS_H;   // top of the bottom band

    this._buildBands();
    this._buildTopBar();
    this._buildBottomBar();

    // The main camera uses a viewport that clips the play field to the middle strip,
    // so it can't draw the HUD in the bands. A dedicated full-canvas HUD camera draws
    // the HUD. To avoid either camera double-drawing the other's objects:
    //   • main camera ignores the (small, fixed) HUD set;
    //   • HUD camera ignores the world — re-asserted every frame so newly-spawned
    //     enemies/bullets/popups can never leak onto it (an addedtoscene hook proved
    //     unreliable across object types).
    this.camera = scene.cameras.add(0, 0, GAME_W, GAME_H);
    this.camera.setScroll(0, 0);
    scene.cameras.main.ignore(this.objects);

    this._syncIgnore = () => {
      const world = scene.children.list.filter(o => !this.objects.includes(o));
      if (world.length) this.camera.ignore(world);
    };
    this._syncIgnore();
    scene.events.on('update', this._syncIgnore);
    scene.events.once('shutdown', () => scene.events.off('update', this._syncIgnore));
  }

  // HUD objects sit at a high depth, pinned to the screen on the HUD camera.
  _track(obj) {
    this.objects.push(obj);
    obj.setDepth(HUD_DEPTH).setScrollFactor(0);
    return obj;
  }

  _buildBands() {
    const g = this.scene.add.graphics();
    g.fillStyle(0x0d1117, 1);
    g.fillRect(0, 0, GAME_W, HUD_TOP);                       // top band
    g.fillRect(0, this._bottomY, GAME_W, HUD_BOTTOM);        // bottom band
    g.lineStyle(1, 0x2a2a4a, 1);
    g.lineBetween(0, HUD_TOP, GAME_W, HUD_TOP);
    g.lineBetween(0, this._bottomY, GAME_W, this._bottomY);
    this._track(g);
  }

  _txt(x, y, str, opts = {}) {
    const t = this.scene.add.text(x, y, str, {
      fontSize: '13px', fontFamily: 'Cinzel', color: '#cccccc', ...opts,
    });
    return this._track(t);
  }

  _buildTopBar() {
    const midY = HUD_TOP / 2;
    this._levelText = this._txt(12, midY, '', { fontSize: '13px', color: '#e8d8a0' }).setOrigin(0, 0.5);

    // Right-aligned stat cluster: Wave / Lives / Score / Gold + sound toggle.
    this._statText = this._txt(GAME_W - 40, midY, '', { fontSize: '13px' }).setOrigin(1, 0.5);

    this._soundBtn = this._txt(GAME_W - 14, midY, soundManager.isMuted() ? '🔇' : '🔊', { fontSize: '15px' })
      .setOrigin(1, 0.5);
    this._soundBtn.setInteractive({ useHandCursor: true });
    this._soundBtn.on('pointerdown', () => {
      soundManager.setMuted(!soundManager.isMuted());
      this._soundBtn.setText(soundManager.isMuted() ? '🔇' : '🔊');
    });
  }

  _buildBottomBar() {
    const midY = this._bottomY + HUD_BOTTOM / 2;

    // Status line (left).
    this._statusText = this._txt(12, midY, '', { fontSize: '12px' }).setOrigin(0, 0.5);

    // Hint actions (right) — each a clickable label that calls back into the scene.
    const hints = [
      { key: 'start',   label: 'S Start Wave', dev: false },
      { key: 'pause',   label: 'P Pause',      dev: false },
      { key: 'restart', label: 'R Restart',    dev: false },
      { key: 'ff',      label: 'F Fast Fwd',   dev: true  },
      { key: 'debug',   label: 'D Debug',      dev: true  },
      { key: 'editor',  label: 'E Editor',     dev: true  },
    ].filter(h => !h.dev || DEV_MODE);

    this._hintByKey = {};
    this._hintActive = {};
    let x = GAME_W - 12;
    for (let i = hints.length - 1; i >= 0; i--) {
      const h = hints[i];
      const t = this._txt(x, midY, h.label, { fontSize: '12px', color: '#bbbbbb' }).setOrigin(1, 0.5);
      const fn = this.actions[h.key];
      if (fn) {
        t.setInteractive({ useHandCursor: true });
        t.on('pointerover', () => t.setColor('#f0c040'));
        t.on('pointerout',  () => t.setColor(this._hintActive[h.key] ? '#f0c040' : '#bbbbbb'));
        t.on('pointerdown', fn);
      }
      this._hintByKey[h.key] = t;
      x -= t.width + 14;
    }
  }

  setLevel(text)  { this._levelText.setText(text); }

  setStats({ wave, lives, score, gold }) {
    this._statText.setText(`Wave ${wave}   Lives ${lives}   Score ${score}   Gold ${gold}`);
  }

  setStatus(msg, kind = 'neutral') {
    this._statusText.setText(msg ?? '');
    this._statusText.setColor(STATUS_COLORS[kind] ?? STATUS_COLORS.neutral);
    this._statusText.setAlpha(kind === 'neutral' ? 0.5 : 1);
  }

  // Toggle the "active" highlight on a hint (Debug / Editor on).
  setHintActive(key, on) {
    this._hintActive[key] = on;
    this._hintByKey[key]?.setColor(on ? '#f0c040' : '#bbbbbb');
  }

  destroy() {
    if (this._syncIgnore) this.scene.events.off('update', this._syncIgnore);
    if (this.camera) this.scene.cameras.remove(this.camera);
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }
}
