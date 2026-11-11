// Connection manager: one active TV driver, pairing prompts, key sending with feedback.
import { useStore } from './store.js';
import { androidTvDriver, samsungDriver, lgDriver, rokuDriver } from './protocols/network.js';
import { irDriver } from './protocols/ir.js';
import { bridge } from './bridge.js';
import { fx } from './sfx.js';

const S = () => useStore.getState();
let driver = null;
let connectingId = 0;

const makers = { androidtv: androidTvDriver, samsung: samsungDriver, lg: lgDriver, roku: rokuDriver, ir: irDriver };

export function tvLabel(t) { return t?.projector ? 'Samsung Freestyle (proyektor)' : (TYPE_LABEL[t?.type] || 'TV'); }

export const TYPE_LABEL = {
  androidtv: 'Android TV / Google TV', samsung: 'Samsung Smart TV', lg: 'LG webOS', roku: 'Roku TV', ir: 'Infra merah',
};

export function errorText(e) {
  const m = String(e?.message || e || '');
  if (m.includes('WRONG_CODE') || m.includes('BAD_CODE')) return 'Kode salah. Cek lagi kode di layar TV.';
  if (m.includes('DENIED')) return 'Akses ditolak di TV. Coba lagi dan pilih "Izinkan".';
  if (m.includes('NO_IR')) return 'HP ini tidak punya pemancar infra merah.';
  if (m.includes('TIMEOUT')) return 'TV tidak merespons. Pastikan TV menyala & satu Wi-Fi.';
  if (m.includes('CANCEL')) return 'Dibatalkan.';
  if (/refused|unreachable|timed out|failed to connect|EHOSTUNREACH|ECONNREFUSED|No route/i.test(m)) return 'TV tidak terjangkau. Pastikan TV menyala & satu Wi-Fi dengan HP.';
  return 'Gagal terhubung: ' + m.slice(0, 80);
}

export const tv = {
  get driver() { return driver; },

  async connect(t) {
    const my = ++connectingId;
    if (driver) { try { await driver.disconnect(); } catch { /* ignore */ } driver = null; }
    const wasSaved = !!S().tvs.find(x => x.id === t.id)?.lastUsed;
    S().upsertTv(t);
    S().set({ status: 'connecting', activeTvId: t.id, volume: null, pairing: null });
    const d = makers[t.type](t);
    const hooks = {
      askCode: () => new Promise((resolve, reject) => {
        fx.notify();
        S().set({ pairing: { kind: 'code', tvName: t.name, submit: resolve, cancel: () => reject(new Error('CANCEL')) } });
      }),
      onPrompt: (brand) => { fx.notify(); S().set({ pairing: { kind: 'prompt', brand, tvName: t.name } }); },
      saveCreds: (c) => S().upsertTv({ id: t.id, ...c }),
      onVolume: (v) => S().set({ volume: v }),
      onDisconnect: () => {
        if (driver !== d) return;
        S().set({ status: 'lost' });
        if (S().autoReconnect) setTimeout(() => { if (driver === d && S().status === 'lost') tv.reconnect(); }, 1500);
      },
    };
    try {
      await d.connect(hooks);
      if (my !== connectingId) { d.disconnect().catch(() => {}); return false; }
      driver = d;
      S().upsertTv({ id: t.id, lastUsed: Date.now() });
      S().set({ status: 'connected', lastTvId: t.id, pairing: null, tab: S().tab || 'remote' });
      fx.connected();
      return true;
    } catch (e) {
      d.disconnect().catch(() => {});
      if (!wasSaved) S().removeTv(t.id);
      if (my !== connectingId) return false;
      S().set({ status: 'idle', pairing: null, activeTvId: null });
      fx.error();
      S().showToast(errorText(e), 'error');
      return false;
    }
  },

  async reconnect() {
    const t = S().activeTv();
    if (t) return this.connect(t);
    return false;
  },

  async disconnect() {
    connectingId++;
    const d = driver;
    driver = null;
    S().set({ status: 'idle', activeTvId: null, volume: null, pairing: null });
    if (d) try { await d.disconnect(); } catch { /* ignore */ }
  },

  cancelConnect() {
    const p = S().pairing;
    connectingId++;
    p?.cancel?.();
    bridge.call('atvCancelPairing').catch(() => {});
    S().set({ status: 'idle', pairing: null, activeTvId: null });
  },

  has(key) { return !!driver?.has(key); },

  async press(key, opts = {}) {
    if (!driver) return;
    if (!opts.silent) fx.press(key);
    try {
      await driver.key(key, opts);
    } catch (e) {
      if (!opts.silent) this.fail(e);
    }
  },

  async run(fn, okMsg) {
    if (!driver) return;
    try { await fn(driver); if (okMsg) { fx.confirm(); S().showToast(okMsg); } }
    catch (e) { this.fail(e); }
  },

  fail(e) {
    const m = String(e?.message || e);
    if (/NOT_CONNECTED|closed|reset|broken pipe/i.test(m)) S().set({ status: 'lost' });
    fx.error();
    S().showToast(m.includes('UNSUPPORTED') ? 'Tombol ini tidak tersedia untuk TV ini' : 'Perintah gagal terkirim', 'error');
  },
};
