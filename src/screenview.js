// Shared, ref-free singleton that keeps one live capture loop of the TV screen.
// Both the Screen tab and the small preview above the Remote read from it, so the
// TV is only captured once no matter how many views are open.
import { Capacitor } from '@capacitor/core';
import { tv } from './tv.js';
import { bridge } from './bridge.js';
import { fx } from './sfx.js';

const srcOf = r => r.dataUrl || ((bridge.isNative ? Capacitor.convertFileSrc(r.path) : r.path) + '?t=' + r.time);

const subs = new Set();
let promptBound = false;

export const screenview = {
  state: 'off',       // off | starting | prompt | live | error
  frame: null,        // { src, time }
  err: '',
  rate: 5000,
  _on: false,
  _timer: null,
  _gen: 0,

  supported() { return !!tv.driver?.capture; },

  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  _emit() { subs.forEach(f => f()); },
  _set(s) { Object.assign(this, s); this._emit(); },

  setRate(ms) { this.rate = ms; this._emit(); },

  start() {
    if (!promptBound) { promptBound = true; bridge.on('adbPrompt', () => { if (this._on) { fx.notify(); this._set({ state: 'prompt' }); } }); }
    if (!this.supported()) { this._set({ state: 'error', err: 'TV ini belum didukung untuk melihat layar.' }); return; }
    if (this._on) return;
    this._on = true;
    const gen = ++this._gen;
    this._set({ state: this.frame ? 'live' : 'starting', err: '' });
    const tick = async () => {
      if (!this._on || gen !== this._gen) return;
      try {
        const r = await tv.driver.capture();
        if (!this._on || gen !== this._gen) return;
        this._set({ frame: { src: srcOf(r), time: r.time }, state: 'live' });
        this._timer = setTimeout(tick, this.rate);
      } catch (e) {
        if (gen !== this._gen) return;
        this._on = false;
        fx.error();
        this._set({ state: 'error', err: String(e?.message || e) });
      }
    };
    tick();
  },

  stop() {
    this._on = false;
    this._gen++;
    clearTimeout(this._timer);
    if (this.state !== 'error') this._set({ state: 'off' });
  },

  reset() { this.stop(); this.frame = null; this.err = ''; this.state = 'off'; },
};

// Drop the frame when the TV changes or disconnects.
let lastTv = null;
import('./store.js').then(({ useStore }) => {
  useStore.subscribe(s => {
    if (s.activeTvId !== lastTv) { lastTv = s.activeTvId; screenview.reset(); }
  });
});
