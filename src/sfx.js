// Sound + haptic feedback, both respecting the user's settings.
import { audio } from './lib/audio.js';
import { haptics } from './lib/haptics.js';
import { useStore } from './store.js';

const NAMES = ['btn', 'nav', 'ok', 'vol', 'power', 'select', 'toggle', 'whoosh', 'back', 'confirm', 'connected', 'error', 'type', 'notify', 'scan', 'found'];

export async function loadSfx() {
  await audio.load(Object.fromEntries(NAMES.map(n => [n, `audio/${n}.wav`])));
}

const on = () => useStore.getState().sound;
const play = (n, o) => { if (on()) audio.play(n, o); };

const NAV = new Set(['up', 'down', 'left', 'right']);
const VOL = new Set(['volup', 'voldown', 'chup', 'chdown']);

export const fx = {
  play,
  press(key) {
    if (key === 'power') { play('power'); haptics.medium(); return; }
    if (key === 'ok' || key === 'enter') { play('ok'); haptics.light(); return; }
    if (NAV.has(key)) { play('nav', { rate: 0.96 + Math.random() * 0.08 }); haptics.tap(); return; }
    if (VOL.has(key)) { play('vol', { rate: key.endsWith('up') ? 1.08 : 0.92 }); haptics.tap(); return; }
    play('btn', { rate: 0.97 + Math.random() * 0.06 }); haptics.tap();
  },
  tap() { play('btn'); haptics.tap(); },
  select() { play('select'); haptics.tap(); },
  toggle() { play('toggle'); haptics.tap(); },
  whoosh() { play('whoosh'); },
  back() { play('back'); haptics.tap(); },
  confirm() { play('confirm'); haptics.success(); },
  connected() { play('connected'); haptics.success(); },
  error() { play('error'); haptics.error(); },
  type() { play('type', { rate: 0.9 + Math.random() * 0.25, throttleMs: 15 }); haptics.tap(); },
  notify() { play('notify'); haptics.medium(); },
  scan() { play('scan'); },
  found() { play('found'); haptics.light(); },
};

useStore.subscribe((s, p) => { if (s.haptics !== p.haptics) haptics.setEnabled(s.haptics); });
