// The save game: one JSON blob in localStorage holding money, story
// progress, collected packages and where Reyes was standing. Written when
// a mission ends, a package is pocketed or the player saves from pause.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function storeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Private mode or a full store: the game simply runs unsaved.
  }
}

export function wipeSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to wipe.
  }
}

export function hasSave() {
  return loadSave() !== null;
}
