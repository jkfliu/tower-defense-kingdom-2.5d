export const DEV_MODE = new URLSearchParams(window.location.search).get('dev_mode') === '1';

// Play-field size — everything gameplay references (backgrounds, waypoints, zones,
// iso math) is in this 900×560 space. Unchanged by the responsive-canvas work.
export const CANVAS_W = 900;
export const CANVAS_H = 560;

// HUD bands sit above/below the play field inside the canvas. The full Phaser canvas
// is GAME_W × GAME_H; the play field is rendered into the middle via a camera viewport
// offset by HUD_TOP, so game coordinates stay 0..CANVAS_H (no ripple through gameplay).
export const HUD_TOP    = 36;
export const HUD_BOTTOM = 36;
export const GAME_W = CANVAS_W;
export const GAME_H = CANVAS_H + HUD_TOP + HUD_BOTTOM;

export const DEFAULT_LIVES = 3;
export const DEFAULT_WAVES = 3;

const NATIVE_W = 1072;
const NATIVE_H = 904;
export const scaleX = CANVAS_W / NATIVE_W;
export const scaleY = CANVAS_H / NATIVE_H;

// Convert a coordinate in the native background image space to canvas space.
export function bgPt(x, y) {
  return { x: Math.round(x * scaleX), y: Math.round(y * scaleY) };
}
