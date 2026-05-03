// Manages keyboard focus and hover-state sync for a group of buttons.
// Handles Enter (confirm), Left/Right/Tab/Shift+Tab (cycle), Escape (dismiss).
export class FocusGroup {
  constructor(scene, buttons, opts = {}) {
    // buttons: [{ btn, action }]  btn is a makeButton return object
    // opts.onEscape: optional callback for Escape key
    this._scene   = scene;
    this._buttons = buttons;
    this._index   = 0;
    this._onEscape = opts.onEscape ?? null;

    this._onEnter    = () => { this.confirm(); };
    this._onSpace    = () => { this.confirm(); };
    this._onLeft     = () => { this.prev(); };
    this._onRight    = () => { this.next(); };
    this._onTab      = (e) => { e.stopImmediatePropagation(); this.next(); };
    this._onShiftTab = (e) => { e.stopImmediatePropagation(); this.prev(); };
    this._onEscKey   = () => { this._onEscape?.(); };

    const kb = scene.input.keyboard;
    kb.on('keydown-ENTER',     this._onEnter);
    kb.on('keydown-SPACE',     this._onSpace);
    kb.on('keydown-LEFT',      this._onLeft);
    kb.on('keydown-RIGHT',     this._onRight);
    kb.on('keydown-TAB',       this._onTab);
    kb.on('keydown-ESCAPE',    this._onEscKey);

    // Wire mouse hover → keyboard focus sync
    buttons.forEach(({ btn }, i) => {
      btn._txt.on('pointerover', () => this.focus(i));
    });

    // Start with first button focused
    this.focus(0);
  }

  focus(index) {
    this._index = index;
    this._buttons.forEach(({ btn }, i) => btn.setHovered(i === index));
  }

  next() {
    this.focus((this._index + 1) % this._buttons.length);
  }

  prev() {
    this.focus((this._index - 1 + this._buttons.length) % this._buttons.length);
  }

  confirm() {
    this._buttons[this._index].action();
  }

  destroy() {
    const kb = this._scene.input.keyboard;
    kb.off('keydown-ENTER',  this._onEnter);
    kb.off('keydown-SPACE',  this._onSpace);
    kb.off('keydown-LEFT',   this._onLeft);
    kb.off('keydown-RIGHT',  this._onRight);
    kb.off('keydown-TAB',    this._onTab);
    kb.off('keydown-ESCAPE', this._onEscKey);
    this._buttons.forEach(({ btn }) => btn.setHovered(false));
  }
}
