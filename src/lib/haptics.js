// Vibration feedback that works on Android (Capacitor Haptics) and falls back to
// navigator.vibrate in browsers. Respects a persisted on/off setting.
//   haptics.tap()      UI buttons, toggles
//   haptics.light()    collecting, small hits
//   haptics.medium()   jumps landing, combos
//   haptics.heavy()    damage, explosions, game over
//   haptics.success() / haptics.error()  results
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { storage } from './storage.js';

const native = Capacitor.isNativePlatform();
let last = 0;

function enabled() { return storage.get('haptics', true); }
function gate(ms = 25) { const n = performance.now(); if (n - last < ms) return false; last = n; return enabled(); }
function fallback(ms) { try { navigator.vibrate?.(ms); } catch { /* ignore */ } }

export const haptics = {
  setEnabled(on) { storage.set('haptics', !!on); },
  isEnabled: enabled,
  tap() { if (!gate()) return; native ? Haptics.selectionChanged() : fallback(8); },
  light() { if (!gate()) return; native ? Haptics.impact({ style: ImpactStyle.Light }) : fallback(12); },
  medium() { if (!gate()) return; native ? Haptics.impact({ style: ImpactStyle.Medium }) : fallback(22); },
  heavy() { if (!gate(60)) return; native ? Haptics.impact({ style: ImpactStyle.Heavy }) : fallback(45); },
  success() { if (!gate(80)) return; native ? Haptics.notification({ type: NotificationType.Success }) : fallback([15, 40, 25]); },
  error() { if (!gate(80)) return; native ? Haptics.notification({ type: NotificationType.Error }) : fallback([40, 30, 40]); }
};
