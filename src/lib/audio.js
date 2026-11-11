// Audio manager for games and apps running in the Android WebView (and browsers).
// - Web Audio API: low latency, many overlapping sounds, pitch variation.
// - Unlocks itself on the first touch (WebViews start the AudioContext suspended).
// - Music loops with fades; pauses automatically when the app goes to background.
// - Volumes/mute persist through ./storage.js.
//
//   import { audio } from './lib/audio.js';
//   await audio.load({ click: 'audio/click.wav', music_menu: 'audio/music_menu.mp3' });
//   audio.play('click');                     // one-shot
//   audio.play('coin', { rate: 1 + combo * 0.05, volume: 0.8 });  // rising pitch
//   audio.playMusic('music_menu');           // loop, cross-fades from current track
import { storage } from './storage.js';

class AudioManager {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.buffers = new Map();
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.music = null;           // { key, src, gain }
    this.lastPlayed = new Map(); // throttle identical sounds
    this.settings = { sfx: 1, music: 0.6, muted: false, ...storage.get('audioSettings', {}) };
    this.applyVolumes();

    const unlock = () => {
      if (this.ctx.state !== 'running') this.ctx.resume();
      if (this.ctx.state === 'running') {
        ['pointerdown', 'touchend', 'keydown'].forEach(e => window.removeEventListener(e, unlock, true));
      }
    };
    ['pointerdown', 'touchend', 'keydown'].forEach(e => window.addEventListener(e, unlock, true));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
  }

  async load(map) {
    await Promise.all(Object.entries(map).map(async ([key, url]) => {
      try {
        const res = await fetch(url);
        const data = await res.arrayBuffer();
        this.buffers.set(key, await this.ctx.decodeAudioData(data));
      } catch (e) { console.warn('[audio] failed to load', key, url, e); }
    }));
  }

  play(key, { volume = 1, rate = 1, detune = 0, pan = 0, throttleMs = 30 } = {}) {
    const buf = this.buffers.get(key);
    if (!buf || this.settings.muted) return null;
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) || 0) < throttleMs) return null;
    this.lastPlayed.set(key, now);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.detune.value = detune;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.sfxBus);
    } else {
      g.connect(this.sfxBus);
    }
    src.start();
    return src;
  }

  // Small random pitch spread keeps repeated sounds from feeling robotic.
  playVaried(key, opts = {}) {
    return this.play(key, { ...opts, rate: (opts.rate || 1) * (0.94 + Math.random() * 0.12) });
  }

  playMusic(key, { fade = 0.8, volume = 1 } = {}) {
    if (this.music?.key === key) return;
    this.stopMusic(fade);
    const buf = this.buffers.get(key);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + fade);
    src.connect(gain).connect(this.musicBus);
    src.start();
    this.music = { key, src, gain };
  }

  stopMusic(fade = 0.5) {
    if (!this.music) return;
    const { src, gain } = this.music;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + fade);
    src.stop(t + fade + 0.05);
    this.music = null;
  }

  // Muffle music under pause menus / dialogs.
  duckMusic(on, amount = 0.35) {
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.linearRampToValueAtTime(on ? this.settings.music * amount : this.settings.music, t + 0.25);
  }

  set(partial) {
    Object.assign(this.settings, partial);
    storage.set('audioSettings', this.settings);
    this.applyVolumes();
  }

  applyVolumes() {
    const t = this.ctx.currentTime;
    this.master.gain.setValueAtTime(this.settings.muted ? 0 : 1, t);
    this.sfxBus.gain.setValueAtTime(this.settings.sfx, t);
    this.musicBus.gain.setValueAtTime(this.settings.music, t);
  }
}

export const audio = new AudioManager();
