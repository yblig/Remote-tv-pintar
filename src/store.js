import { create } from 'zustand';
import { storage } from './lib/storage.js';

const SAVE_KEYS = ['onboarded', 'tvs', 'lastTvId', 'theme', 'accent', 'sound', 'haptics', 'shake', 'volumeKeys',
  'autoReconnect', 'remotePreview', 'favTexts', 'history', 'macros', 'channels', 'remoteMode'];

const DEFAULT_MACROS = [
  { id: 'm1', name: 'Mode Nonton', icon: 'film', steps: [{ key: 'home' }, { wait: 1200 }, { app: 'youtube' }] },
  { id: 'm2', name: 'Senyap Cepat', icon: 'volume-x', steps: [{ key: 'mute' }] },
  { id: 'm3', name: 'Volume Pelan', icon: 'volume-1', steps: Array.from({ length: 5 }, () => ({ key: 'voldown' })) },
];

const defaults = {
  onboarded: false,
  tvs: [],
  lastTvId: null,
  theme: 'dark',
  accent: '#6c7bff',
  sound: true,
  haptics: true,
  shake: false,
  volumeKeys: true,
  autoReconnect: true,
  remotePreview: false,
  favTexts: ['terima kasih', 'film terbaru 2026', 'musik santai'],
  history: [],
  macros: DEFAULT_MACROS,
  channels: [{ id: 'c1', name: 'TVRI', number: '1' }, { id: 'c2', name: 'RCTI', number: '3' }],
  remoteMode: 'dpad',
};

export const useStore = create((set, get) => ({
  ...defaults,
  ...(storage.get('state', {}) || {}),
  // runtime only
  tab: 'remote',
  status: 'idle', // idle | connecting | connected | lost
  activeTvId: null,
  volume: null,
  toast: null,
  sleepEnd: null,
  set(partial) { set(partial); },
  activeTv() { return get().tvs.find(t => t.id === get().activeTvId) || null; },
  upsertTv(tv) {
    const tvs = get().tvs.slice();
    const i = tvs.findIndex(t => t.id === tv.id);
    if (i >= 0) tvs[i] = { ...tvs[i], ...tv }; else tvs.unshift(tv);
    set({ tvs });
  },
  removeTv(id) { set({ tvs: get().tvs.filter(t => t.id !== id), lastTvId: get().lastTvId === id ? null : get().lastTvId }); },
  showToast(text, kind = 'info') {
    const id = Date.now();
    set({ toast: { id, text, kind } });
    setTimeout(() => { if (get().toast?.id === id) set({ toast: null }); }, 2600);
  },
  addHistory(text) {
    const t = text.trim();
    if (!t) return;
    set({ history: [t, ...get().history.filter(h => h !== t)].slice(0, 25) });
  },
}));

let saveTimer;
useStore.subscribe(state => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const out = {};
    SAVE_KEYS.forEach(k => { out[k] = state[k]; });
    storage.set('state', out);
  }, 200);
});
