// Synchronous key/value storage backed by Capacitor Preferences on Android
// (survives WebView cache clears) with localStorage as a mirror/fallback.
// Call `await storage.init()` once before the game/app starts, then use get/set
// synchronously anywhere (high scores, settings, unlocked levels, app data).
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const PREFIX = 'app:';
const cache = new Map();
const native = Capacitor.isNativePlatform();

function lsGet(k) { try { return localStorage.getItem(PREFIX + k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(PREFIX + k, v); } catch { /* private mode */ } }
function lsDel(k) { try { localStorage.removeItem(PREFIX + k); } catch { /* ignore */ } }

export const storage = {
  async init() {
    if (native) {
      const { keys } = await Preferences.keys();
      await Promise.all(keys.filter(k => k.startsWith(PREFIX)).map(async k => {
        const { value } = await Preferences.get({ key: k });
        if (value != null) cache.set(k.slice(PREFIX.length), value);
      }));
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(PREFIX) && !cache.has(k.slice(PREFIX.length))) cache.set(k.slice(PREFIX.length), localStorage.getItem(k));
      }
    } catch { /* ignore */ }
  },
  get(key, fallback = null) {
    const raw = cache.has(key) ? cache.get(key) : lsGet(key);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  },
  set(key, value) {
    const raw = JSON.stringify(value);
    cache.set(key, raw);
    lsSet(key, raw);
    if (native) Preferences.set({ key: PREFIX + key, value: raw });
  },
  remove(key) {
    cache.delete(key);
    lsDel(key);
    if (native) Preferences.remove({ key: PREFIX + key });
  },
  // Keeps the best value and returns true when it's a new record.
  setBest(key, value, higherIsBetter = true) {
    const prev = this.get(key, null);
    const better = prev == null || (higherIsBetter ? value > prev : value < prev);
    if (better) this.set(key, value);
    return better;
  }
};
