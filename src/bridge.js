// Native bridge to the Java TvBridge plugin. In a desktop browser (development
// preview) a simulator stands in so every screen can be exercised without a TV.
import { Capacitor, registerPlugin } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();
const Native = isNative ? registerPlugin('TvBridge') : null;

const listeners = new Map();
function emit(evt, data) { (listeners.get(evt) || []).forEach(fn => fn(data)); }
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- simulator
const sim = {
  log: [],
  async info() { return { hasIr: true, sdk: 34, model: 'Simulator' }; },
  async irTransmit({ pattern }) { this.log.push(['ir', pattern.length]); },
  async discover() {
    await wait(2600);
    return { devices: [
      { type: 'androidtv', host: '192.168.1.21', name: 'Xiaomi TV A Pro 43', model: 'Android TV / Google TV' },
      { type: 'samsung', host: '192.168.1.35', name: 'Samsung 55" Crystal UHD', model: 'Samsung UA55AU7000' },
      { type: 'lg', host: '192.168.1.40', name: 'LG webOS TV UQ75', model: 'LG Electronics 43UQ7500' },
    ] };
  },
  async http({ url }) {
    await wait(200);
    if (url.includes('device-info')) return { status: 200, body: '<friendly-device-name>Roku TV</friendly-device-name><wifi-mac>aa:bb:cc:dd:ee:ff</wifi-mac>' };
    if (url.includes(':8001/api/v2')) return { status: 200, body: JSON.stringify({ device: { name: 'Samsung TV', wifiMac: '8c:79:f5:11:22:33' } }) };
    return { status: 200, body: '' };
  },
  async wsOpen({ id, url }) {
    await wait(400);
    setTimeout(() => {
      if (url.includes('samsung')) emit('wsMessage', { id, text: JSON.stringify({ event: 'ms.channel.connect', data: { token: '12345678' } }) });
    }, 1800);
    this.lastWs = id;
  },
  async wsSend({ id, text }) {
    try {
      const m = JSON.parse(text);
      if (m.type === 'register') {
        emit('wsMessage', { id, text: JSON.stringify({ type: 'response', id: m.id, payload: { pairingType: 'PROMPT', returnValue: true } }) });
        setTimeout(() => emit('wsMessage', { id, text: JSON.stringify({ type: 'registered', id: m.id, payload: { 'client-key': 'simkey' } }) }), 1800);
      } else if (m.type === 'request') {
        const payload = m.uri.includes('getPointerInputSocket') ? { returnValue: true, socketPath: 'ws://sim/pointer' }
          : m.uri.includes('getVolume') ? { returnValue: true, volume: 14, muted: false } : { returnValue: true };
        setTimeout(() => emit('wsMessage', { id, text: JSON.stringify({ type: 'response', id: m.id, payload }) }), 60);
      }
    } catch { /* pointer socket lines */ }
  },
  async wsClose() {},
  async atvStartPairing() { await wait(900); },
  async atvFinishPairing({ code }) { await wait(500); if (!/^[0-9A-F]{6}$/i.test(code)) throw new Error('BAD_CODE'); localStorage.setItem('sim:paired', '1'); },
  async atvCancelPairing() {},
  async atvConnect() {
    await wait(700);
    if (!localStorage.getItem('sim:paired')) throw new Error('NOT_PAIRED');
    setTimeout(() => emit('atvVolume', { level: 18, max: 100, muted: false }), 300);
  },
  async atvDisconnect() {},
  async atvKey() {}, async atvText() {}, async atvLaunch() {},
  async wol() { await wait(300); },
  async speech() { await wait(1200); return { text: 'film komedi terbaru' }; },
  async setVolumeKeys() {},
  async adbConnect() { await wait(800); },
  async adbScreenshot() { await wait(500); return { path: 'demo-tv.svg', time: Date.now(), bytes: 1 }; },
  async adbClose() {},
  async fetchToFile() { await wait(400); return { path: 'demo-tv.svg', time: Date.now() }; },
  async castSettings() { await wait(200); return { opened: 'sim' }; },
  async adbShell({ cmd }) { await wait(120); return { out: cmd.includes('start-foreground-service') || cmd.includes('-n com.yblig') ? 'Starting service: Intent' : 'Starting: Intent' }; },
  async castEnsure() { await wait(600); return { installed: true, already: true }; },
  async adbPush() { await wait(300); return { info: '81234' }; },
  async ttsToFile({ text }) { await wait(500); return { data: '', ext: 'wav', empty: true, said: text }; },
};

function call(name, args = {}) {
  if (isNative) return Native[name](args);
  return sim[name](args);
}

export const bridge = {
  isNative,
  call,
  on(evt, fn) {
    if (isNative) {
      const h = Native.addListener(evt, fn);
      return () => Promise.resolve(h).then(x => x.remove());
    }
    if (!listeners.has(evt)) listeners.set(evt, []);
    listeners.get(evt).push(fn);
    return () => listeners.set(evt, listeners.get(evt).filter(f => f !== fn));
  },
};
