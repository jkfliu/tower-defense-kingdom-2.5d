// Campaign progress persistence. Two layers over one shared serializer:
//   - localStorage autosave (loadProgress/saveProgress) — the everyday path, so
//     reopening the page resumes where you left off.
//   - file export/import — the portability layer, for moving a save between
//     browsers or devices, where localStorage can't reach.
//
// Bump SAVE_VERSION whenever the payload shape changes. Saves from a different
// version are rejected rather than guessed at, so a stale file can't half-load
// into a state the game doesn't understand.
export const SAVE_VERSION = 1;

const STORAGE_KEY = 'tdk_progress_v1';
const EXPORT_FILENAME = 'kingdom-save.json';

// Difficulty isn't user-selectable campaign-wide yet (it's picked per level in
// the map popup), but it's carried in the save so enabling that later needs no
// save migration.
const VALID_DIFFICULTIES = ['easy', 'medium'];
const DEFAULT_DIFFICULTY = 'easy';

function freshProgress() {
  return { currentLevel: 0, campaignScore: 0, difficulty: DEFAULT_DIFFICULTY };
}

// Coerce a value to a finite integer, falling back when it isn't one. Guards
// against hand-edited save files carrying strings, null or NaN.
function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

export function serializeProgress(state) {
  return JSON.stringify({
    version:       SAVE_VERSION,
    currentLevel:  toInt(state.currentLevel),
    campaignScore: toInt(state.campaignScore),
    difficulty:    state.difficulty ?? DEFAULT_DIFFICULTY,
  });
}

// Parse and validate a save payload. Returns null for anything unusable —
// malformed JSON, a non-object, or a version mismatch — so callers can fall
// back to a fresh game instead of crashing on a corrupt save.
//
// `maxLevel` is passed in rather than derived from CAMPAIGN_LEVELS so this
// module imports nothing: like logic/combat.js, it stays unit-testable without
// dragging in constants.js (which touches `window` at load time). Callers in
// scene code already have CAMPAIGN_LEVELS in scope.
export function deserializeProgress(json, maxLevel = Infinity) {
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version !== SAVE_VERSION)    return null;

  return {
    // The frontier can't point past the last campaign level, which would leave
    // the map with no node to highlight.
    currentLevel:  clamp(toInt(raw.currentLevel), 0, maxLevel),
    campaignScore: Math.max(0, toInt(raw.campaignScore)),
    difficulty:    VALID_DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : DEFAULT_DIFFICULTY,
  };
}

// --- localStorage autosave -------------------------------------------------
// Every access is wrapped: localStorage throws outright in some private-browsing
// modes, and a save failure should never take the game down with it.

export function loadProgress(maxLevel = Infinity) {
  let json;
  try {
    json = localStorage.getItem(STORAGE_KEY);
  } catch {
    return freshProgress();
  }
  if (!json) return freshProgress();
  return deserializeProgress(json, maxLevel) ?? freshProgress();
}

export function saveProgress(state) {
  try {
    localStorage.setItem(STORAGE_KEY, serializeProgress(state));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

// --- file export / import --------------------------------------------------

// Trigger a download of the current progress as a .json file. Uses a synthetic
// anchor click, the only way to name a downloaded blob from script.
export function exportProgressFile(state, filename = EXPORT_FILENAME) {
  const blob = new Blob([serializeProgress(state)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the blob once the click has been dispatched, or it leaks for the
  // lifetime of the document.
  URL.revokeObjectURL(url);
}

// Read a user-picked File back into a progress state. Rejects (rather than
// returning a default) so the caller can tell the user their file was bad
// instead of silently wiping progress to level 0.
export async function importProgressFile(file, maxLevel = Infinity) {
  const text  = await file.text();
  const state = deserializeProgress(text, maxLevel);
  if (!state) throw new Error('Not a valid Kingdom save file.');
  return state;
}

// Open the OS file picker and resolve with the chosen progress state. Resolves
// null if the user dismisses the dialog without picking anything.
export function pickProgressFile(maxLevel = Infinity) {
  return new Promise((resolve, reject) => {
    const input  = document.createElement('input');
    input.type   = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) { resolve(null); return; }
      importProgressFile(file, maxLevel).then(resolve, reject);
    });
    input.click();
  });
}
