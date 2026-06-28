export function makeButton(scene, bx0, by0, label, style, depth, onPress, opts = {}) {
  let x = bx0, y = by0;
  const origin = opts.origin ?? 0.5;
  const shadow = opts.shadow ?? true;

  const palettes = {
    gold: { face: 0xd4a010, hi: 0xffe066, sh: 0x7a5800, text: '#1a0e00' },
    dark: { face: 0x1e2244, hi: 0x2e3466, sh: 0x080a14, text: '#cccccc' },
  };
  const pal = palettes[style] ?? palettes.dark;

  const pad      = { x: style === 'gold' ? 18 : 14, y: style === 'gold' ? 8 : 6 };
  const fontSize = opts.fontSize ?? (style === 'gold' ? '18px' : '13px');

  const txt = scene.add.text(0, 0, label, {
    fontSize, fontFamily: 'Cinzel', color: pal.text,
  }).setDepth(depth + 1);

  const tw  = txt.width  + pad.x * 2;
  const th  = txt.height + pad.y * 2;
  const gfx = scene.add.graphics().setDepth(depth);

  const draw = (pressed, hovered) => {
    gfx.clear();
    const face   = hovered ? pal.hi : pal.face;
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

  // Hit area covers the FULL padded button rect, not just the text glyphs — so
  // hovering/clicking the button edges still registers (otherwise the padding
  // region falls through to the scene, e.g. reading as a tower placement).
  // Origin is fixed to (0,0) BEFORE setInteractive so the input hit rectangle aligns
  // with the drawn rect; positionHit then only moves it (size/origin stay constant).
  const hit = scene.add.zone(0, 0, tw, th).setOrigin(0, 0).setDepth(depth + 2);
  const positionHit = () => {
    const ox = origin === 0.5 ? -tw / 2 : 0;
    const oy = origin === 0.5 ? -th / 2 : 0;
    hit.setPosition(x + ox, y + oy);
  };
  positionHit();
  hit.setInteractive({ useHandCursor: true });
  hit.on('pointerover',  () => { opts.onHover?.(); draw(false, true); });
  hit.on('pointerout',   () => { opts.onOut?.();   draw(false, false); });
  hit.on('pointerdown',  () => { draw(true,  false); onPress(); });
  hit.on('pointerup',    () => draw(false, true));

  return {
    setVisible(v)       { gfx.setVisible(v); txt.setVisible(v); hit.setVisible(v); if (v) hit.setInteractive({ useHandCursor: true }); else hit.disableInteractive(); return this; },
    setText(t)          { txt.setText(t); draw(false, false); positionHit(); return this; },
    setPosition(nx, ny) { x = nx; y = ny; draw(false, false); positionHit(); return this; },
    setHovered(v)       { draw(false, v); return this; },
    _draw: draw,
    _gfx: gfx,
    _txt: txt,
    _hit: hit,
  };
}
