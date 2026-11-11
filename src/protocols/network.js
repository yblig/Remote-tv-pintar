// Network TV drivers: Android TV / Google TV, Samsung Tizen, LG webOS, Roku.
// Each driver: { type, supports, has(key), connect(hooks), disconnect(), key(k, opts),
//   typeDiff(prev, next), enter(), launch(appId), openUrl(url), youtubeSearch(q),
//   mouse?: { move(dx,dy), click(), scroll(dy) } }
import { bridge } from '../bridge.js';
import lgManifest from './lg-manifest.json';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const b64 = s => btoa(unescape(encodeURIComponent(s)));
const APP_NAME = 'Remote TV Pintar';

export function diff(prev, next) {
  let i = 0;
  while (i < prev.length && i < next.length && prev[i] === next[i]) i++;
  return { del: prev.length - i, add: next.slice(i) };
}

// ------------------------------------------------------------- Android TV / Google TV
const ATV_KEYS = {
  power: 26, up: 19, down: 20, left: 21, right: 22, ok: 23, back: 4, home: 3, menu: 82, settings: 176,
  volup: 24, voldown: 25, mute: 164, chup: 166, chdown: 167, input: 178, info: 165, guide: 172,
  playpause: 85, play: 126, pause: 127, stop: 86, rew: 89, ff: 90, next: 87, prev: 88,
  red: 183, green: 184, yellow: 185, blue: 186, search: 84, del: 67, enter: 66, exit: 4, captions: 175,
  d0: 7, d1: 8, d2: 9, d3: 10, d4: 11, d5: 12, d6: 13, d7: 14, d8: 15, d9: 16,
};
const ATV_APPS = {
  youtube: 'https://www.youtube.com', netflix: 'https://www.netflix.com/title',
  prime: 'https://app.primevideo.com', disney: 'https://www.disneyplus.com',
  spotify: 'spotify://', vidio: 'market://launch?id=com.vidio.android.tv',
  wetv: 'market://launch?id=com.tencent.qqlivei18n', playstore: 'market://launch?id=com.android.vending',
};

export function androidTvDriver(tv) {
  const offs = [];
  return {
    type: 'androidtv',
    supports: { keyboard: true, apps: true, mouse: false, url: true, volumeLevel: true },
    has: k => ATV_KEYS[k] != null,
    async connect(h) {
      offs.push(bridge.on('atvState', e => { if (e.state === 'disconnected') h.onDisconnect?.(e.reason); }));
      offs.push(bridge.on('atvVolume', e => h.onVolume?.(e)));
      try {
        await bridge.call('atvConnect', { host: tv.host });
      } catch (e) {
        // Not paired yet (or certificate unknown): run the code pairing, then connect again.
        await bridge.call('atvStartPairing', { host: tv.host, name: APP_NAME });
        const code = await h.askCode();
        try { await bridge.call('atvFinishPairing', { code }); } catch (err) { await bridge.call('atvCancelPairing'); throw err; }
        await sleep(400);
        await bridge.call('atvConnect', { host: tv.host });
      }
    },
    async disconnect() { offs.splice(0).forEach(f => f()); await bridge.call('atvDisconnect'); },
    async key(k, { phase } = {}) {
      const dir = phase === 'down' ? 1 : phase === 'up' ? 2 : 3;
      await bridge.call('atvKey', { code: ATV_KEYS[k], dir });
    },
    async typeDiff(prev, next) {
      const { del, add } = diff(prev, next);
      for (let i = 0; i < del; i++) await bridge.call('atvKey', { code: 67, dir: 3 });
      if (add) await bridge.call('atvText', { text: add });
    },
    async enter() { await bridge.call('atvKey', { code: 66, dir: 3 }); },
    apps: Object.keys(ATV_APPS),
    async launch(id) { await bridge.call('atvLaunch', { link: ATV_APPS[id] }); },
    async openUrl(url) { await bridge.call('atvLaunch', { link: url }); },
    async youtubeSearch(q) { await bridge.call('atvLaunch', { link: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) }); },
    async capture() { return bridge.call('adbScreenshot', { host: tv.host }); },
  };
}

// ------------------------------------------------------------- Samsung Tizen
const SS_KEYS = {
  power: 'KEY_POWER', up: 'KEY_UP', down: 'KEY_DOWN', left: 'KEY_LEFT', right: 'KEY_RIGHT', ok: 'KEY_ENTER',
  back: 'KEY_RETURN', home: 'KEY_HOME', menu: 'KEY_MENU', settings: 'KEY_MENU', volup: 'KEY_VOLUP', voldown: 'KEY_VOLDOWN',
  mute: 'KEY_MUTE', chup: 'KEY_CHUP', chdown: 'KEY_CHDOWN', input: 'KEY_SOURCE', info: 'KEY_INFO', guide: 'KEY_GUIDE',
  playpause: 'KEY_PLAY', play: 'KEY_PLAY', pause: 'KEY_PAUSE', stop: 'KEY_STOP', rew: 'KEY_REWIND', ff: 'KEY_FF',
  red: 'KEY_RED', green: 'KEY_GREEN', yellow: 'KEY_YELLOW', blue: 'KEY_CYAN', exit: 'KEY_EXIT', enter: 'KEY_ENTER',
  del: 'KEY_DELETE', captions: 'KEY_CAPTION',
  d0: 'KEY_0', d1: 'KEY_1', d2: 'KEY_2', d3: 'KEY_3', d4: 'KEY_4', d5: 'KEY_5', d6: 'KEY_6', d7: 'KEY_7', d8: 'KEY_8', d9: 'KEY_9',
};
const SS_APPS = { youtube: '111299001912', netflix: '3201907018807', prime: '3201910019365', disney: '3201901017640', spotify: '3201606009684' };

export function samsungDriver(tv) {
  const id = 'samsung';
  const offs = [];
  let typeTimer = null;
  const send = obj => bridge.call('wsSend', { id, text: JSON.stringify(obj) });
  const remote = (Cmd, DataOfCmd, extra = {}) => send({ method: 'ms.remote.control', params: { Cmd, DataOfCmd, Option: 'false', TypeOfRemote: 'SendRemoteKey', ...extra } });
  return {
    type: 'samsung',
    supports: { keyboard: true, apps: true, mouse: true, url: true, volumeLevel: false },
    has: k => SS_KEYS[k] != null,
    async connect(h) {
      const name = b64(APP_NAME);
      const open = async (url) => {
        let resolveC, rejectC;
        const ready = new Promise((res, rej) => { resolveC = res; rejectC = rej; });
        const off = bridge.on('wsMessage', e => {
          if (e.id !== id) return;
          let m; try { m = JSON.parse(e.text); } catch { return; }
          if (m.event === 'ms.channel.connect') { if (m.data?.token) h.saveCreds?.({ token: m.data.token }); resolveC(); }
          else if (m.event === 'ms.channel.unauthorized') rejectC(new Error('DENIED'));
          else if (m.event === 'ms.channel.timeOut') rejectC(new Error('TIMEOUT'));
        });
        offs.push(off);
        await bridge.call('wsOpen', { id, url });
        h.onPrompt?.('samsung');
        const t = setTimeout(() => rejectC(new Error('TIMEOUT')), 40000);
        try { await ready; } finally { clearTimeout(t); }
      };
      const tokenQ = tv.token ? '&token=' + encodeURIComponent(tv.token) : '';
      try {
        await open(`wss://${tv.host}:8002/api/v2/channels/samsung.remote.control?name=${name}${tokenQ}`);
      } catch (e) {
        if (e.message === 'DENIED') throw e;
        await open(`ws://${tv.host}:8001/api/v2/channels/samsung.remote.control?name=${name}`);
      }
      offs.push(bridge.on('wsClose', e => { if (e.id === id) h.onDisconnect?.(e.reason); }));
      try {
        const r = await bridge.call('http', { url: `http://${tv.host}:8001/api/v2/`, timeout: 2500 });
        const d = JSON.parse(r.body).device || {};
        if (d.wifiMac) h.saveCreds?.({ mac: d.wifiMac });
      } catch { /* optional */ }
    },
    async disconnect() { offs.splice(0).forEach(f => f()); await bridge.call('wsClose', { id }); },
    async key(k, { phase } = {}) {
      const cmd = phase === 'down' ? 'Press' : phase === 'up' ? 'Release' : 'Click';
      await remote(cmd, SS_KEYS[k]);
    },
    async typeDiff(_prev, next) {
      clearTimeout(typeTimer);
      typeTimer = setTimeout(() => {
        send({ method: 'ms.remote.control', params: { Cmd: b64(next), DataOfCmd: 'base64', TypeOfRemote: 'SendInputString' } });
      }, 250);
    },
    async enter() {
      await send({ method: 'ms.remote.control', params: { Cmd: '', DataOfCmd: '', TypeOfRemote: 'SendInputEnd' } });
    },
    apps: Object.keys(SS_APPS),
    async launch(app) {
      await send({ method: 'ms.channel.emit', params: { event: 'ed.apps.launch', to: 'host', data: { appId: SS_APPS[app], action_type: 'DEEP_LINK' } } });
    },
    async openUrl(url) {
      await send({ method: 'ms.channel.emit', params: { event: 'ed.apps.launch', to: 'host', data: { appId: 'org.tizen.browser', action_type: 'NATIVE_LAUNCH', metaTag: url } } });
    },
    async youtubeSearch(q) { await this.openUrl('https://www.youtube.com/results?search_query=' + encodeURIComponent(q)); },
    mouse: {
      move: (dx, dy) => send({ method: 'ms.remote.control', params: { Cmd: 'Move', Position: { x: Math.round(dx), y: Math.round(dy), Time: String(Date.now()) }, TypeOfRemote: 'ProcessMouseDevice' } }),
      click: () => send({ method: 'ms.remote.control', params: { Cmd: 'LeftClick', TypeOfRemote: 'ProcessMouseDevice' } }),
      scroll: () => {},
    },
  };
}

// ------------------------------------------------------------- LG webOS
const LG_BUTTONS = {
  up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', ok: 'ENTER', back: 'BACK', home: 'HOME', menu: 'MENU', settings: 'MENU',
  volup: 'VOLUMEUP', voldown: 'VOLUMEDOWN', mute: 'MUTE', chup: 'CHANNELUP', chdown: 'CHANNELDOWN', info: 'INFO', guide: 'GUIDE',
  playpause: 'PLAY', play: 'PLAY', pause: 'PAUSE', stop: 'STOP', rew: 'REWIND', ff: 'FASTFORWARD',
  red: 'RED', green: 'GREEN', yellow: 'YELLOW', blue: 'BLUE', exit: 'EXIT', enter: 'ENTER', captions: 'CC',
  d0: '0', d1: '1', d2: '2', d3: '3', d4: '4', d5: '5', d6: '6', d7: '7', d8: '8', d9: '9',
};
const LG_APPS = { youtube: 'youtube.leanback.v4', netflix: 'netflix', prime: 'amazon', disney: 'com.disney.disneyplus-prod', spotify: 'spotify-beehive', vidio: 'com.vidio.app' };

export function lgDriver(tv) {
  const id = 'lg', pid = 'lgptr';
  const offs = [];
  const pending = new Map();
  let seq = 0, pointerReady = null;
  const req = (uri, payload = {}) => new Promise((res, rej) => {
    const mid = 'r' + (++seq);
    pending.set(mid, { res, rej });
    bridge.call('wsSend', { id, text: JSON.stringify({ type: 'request', id: mid, uri, payload }) }).catch(rej);
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error('TIMEOUT')); } }, 6000);
  });
  const pointer = () => {
    if (!pointerReady) {
      pointerReady = req('ssap://com.webos.service.networkinput/getPointerInputSocket')
        .then(p => bridge.call('wsOpen', { id: pid, url: p.socketPath }))
        .catch(e => { pointerReady = null; throw e; });
    }
    return pointerReady;
  };
  const line = async (txt) => { await pointer(); await bridge.call('wsSend', { id: pid, text: txt }); };
  let h = {};
  return {
    type: 'lg',
    supports: { keyboard: true, apps: true, mouse: true, url: true, volumeLevel: true },
    has: k => LG_BUTTONS[k] != null || k === 'power' || k === 'input',
    async connect(hooks) {
      h = hooks;
      offs.push(bridge.on('wsMessage', e => {
        if (e.id !== id) return;
        let m; try { m = JSON.parse(e.text); } catch { return; }
        if (m.id === 'vol' && m.payload) {
          const v = m.payload.volumeStatus || m.payload;
          if (v.volume != null) h.onVolume?.({ level: v.volume, max: 100, muted: !!(v.muteStatus ?? v.muted) });
          return;
        }
        const p = pending.get(m.id);
        if (!p) return;
        if (m.type === 'error') { pending.delete(m.id); p.rej(new Error(m.error || 'LG_ERROR')); }
        else if (m.type === 'registered') { pending.delete(m.id); p.res(m.payload); }
        else if (m.type === 'response') {
          if (m.payload?.pairingType === 'PROMPT') { h.onPrompt?.('lg'); return; }
          pending.delete(m.id); p.res(m.payload || {});
        }
      }));
      try { await bridge.call('wsOpen', { id, url: `ws://${tv.host}:3000` }); }
      catch { await bridge.call('wsOpen', { id, url: `wss://${tv.host}:3001` }); }
      const reg = await new Promise((res, rej) => {
        pending.set('reg0', { res, rej });
        const payload = { forcePairing: false, pairingType: 'PROMPT', manifest: lgManifest };
        if (tv.clientKey) payload['client-key'] = tv.clientKey;
        bridge.call('wsSend', { id, text: JSON.stringify({ type: 'register', id: 'reg0', payload }) }).catch(rej);
        setTimeout(() => { if (pending.has('reg0')) { pending.delete('reg0'); rej(new Error('TIMEOUT')); } }, 45000);
      });
      if (reg['client-key']) h.saveCreds?.({ clientKey: reg['client-key'] });
      offs.push(bridge.on('wsClose', e => { if (e.id === id) h.onDisconnect?.(e.reason); else if (e.id === pid) pointerReady = null; }));
      bridge.call('wsSend', { id, text: JSON.stringify({ type: 'subscribe', id: 'vol', uri: 'ssap://audio/getVolume' }) }).catch(() => {});
      pointer().catch(() => {});
    },
    async disconnect() {
      offs.splice(0).forEach(f => f());
      pointerReady = null;
      await bridge.call('wsClose', { id: pid });
      await bridge.call('wsClose', { id });
    },
    async key(k) {
      if (k === 'power') return req('ssap://system/turnOff');
      if (k === 'input') return req('ssap://system.launcher/launch', { id: 'com.webos.app.inputpicker' });
      await line(`type:button\nname:${LG_BUTTONS[k]}\n\n`);
    },
    async typeDiff(prev, next) {
      const { del, add } = diff(prev, next);
      if (del) await req('ssap://com.webos.service.ime/deleteCharacters', { count: del });
      if (add) await req('ssap://com.webos.service.ime/insertText', { text: add, replace: 0 });
    },
    async enter() { await req('ssap://com.webos.service.ime/sendEnterKey'); },
    apps: Object.keys(LG_APPS),
    async launch(app) { await req('ssap://system.launcher/launch', { id: LG_APPS[app] }); },
    async openUrl(url) { await req('ssap://system.launcher/open', { target: url }); },
    async youtubeSearch(q) {
      await req('ssap://system.launcher/launch', { id: LG_APPS.youtube, contentId: '', params: { contentTarget: 'https://www.youtube.com/tv#/search?q=' + encodeURIComponent(q) } });
    },
    async capture() {
      const p = await req('ssap://tv/executeOneShot');
      if (!p.imageUri) throw new Error('NO_IMAGE');
      return bridge.call('fetchToFile', { url: p.imageUri });
    },
    mouse: {
      move: (dx, dy) => line(`type:move\ndx:${Math.round(dx)}\ndy:${Math.round(dy)}\ndown:0\n\n`),
      click: () => line('type:click\n\n'),
      scroll: (dy) => line(`type:scroll\ndx:0\ndy:${Math.round(dy)}\n\n`),
    },
  };
}

// ------------------------------------------------------------- Roku
const ROKU_KEYS = {
  power: 'Power', up: 'Up', down: 'Down', left: 'Left', right: 'Right', ok: 'Select', back: 'Back', home: 'Home',
  menu: 'Info', settings: 'Info', info: 'Info', volup: 'VolumeUp', voldown: 'VolumeDown', mute: 'VolumeMute',
  chup: 'ChannelUp', chdown: 'ChannelDown', input: 'InputHDMI1', playpause: 'Play', play: 'Play', pause: 'Play',
  rew: 'Rev', ff: 'Fwd', search: 'Search', del: 'Backspace', enter: 'Enter', exit: 'Home', stop: 'Back',
  d0: 'Lit_0', d1: 'Lit_1', d2: 'Lit_2', d3: 'Lit_3', d4: 'Lit_4', d5: 'Lit_5', d6: 'Lit_6', d7: 'Lit_7', d8: 'Lit_8', d9: 'Lit_9',
};
const ROKU_APPS = { youtube: '837', netflix: '12', prime: '13', disney: '291097', spotify: '22297' };

export function rokuDriver(tv) {
  const base = `http://${tv.host}:8060`;
  const post = path => bridge.call('http', { method: 'POST', url: base + path, timeout: 3000 });
  return {
    type: 'roku',
    supports: { keyboard: true, apps: true, mouse: false, url: false, volumeLevel: false },
    has: k => ROKU_KEYS[k] != null,
    async connect(h) {
      const r = await bridge.call('http', { url: base + '/query/device-info', timeout: 3500 });
      if (r.status !== 200) throw new Error('ROKU_' + r.status);
      const mac = /<wifi-mac>([^<]+)</.exec(r.body)?.[1] || /<ethernet-mac>([^<]+)</.exec(r.body)?.[1];
      if (mac) h.saveCreds?.({ mac });
    },
    async disconnect() {},
    async key(k, { phase } = {}) {
      const verb = phase === 'down' ? 'keydown' : phase === 'up' ? 'keyup' : 'keypress';
      await post(`/${verb}/${ROKU_KEYS[k]}`);
    },
    async typeDiff(prev, next) {
      const { del, add } = diff(prev, next);
      for (let i = 0; i < del; i++) await post('/keypress/Backspace');
      for (const ch of add) await post('/keypress/Lit_' + encodeURIComponent(ch));
    },
    async enter() { await post('/keypress/Enter'); },
    apps: Object.keys(ROKU_APPS),
    async launch(app) { await post('/launch/' + ROKU_APPS[app]); },
    async youtubeSearch(q) { await post(`/search/browse?keyword=${encodeURIComponent(q)}&provider-id=837&launch=true`); },
  };
}
