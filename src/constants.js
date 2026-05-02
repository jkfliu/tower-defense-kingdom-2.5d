export const DEV_MODE = false;

export const CANVAS_W = 900;
export const CANVAS_H = 560;

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
