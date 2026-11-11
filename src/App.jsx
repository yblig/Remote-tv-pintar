import { useEffect, useRef } from 'react';
import { Keyboard as KbIcon, LayoutGrid, Eye, Ellipsis, Power, ChevronDown, RefreshCw } from 'lucide-react';
import { useStore } from './store.js';
import { tv, tvLabel } from './tv.js';
import { fx } from './sfx.js';
import { bridge } from './bridge.js';
import { native } from './lib/native.js';
import { Toast, TypeIcon, RemoteGlyph } from './components/ui.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Connect from './screens/Connect.jsx';
import PairingLayer from './screens/PairingLayer.jsx';
import Remote from './screens/Remote.jsx';
import Projector from './screens/Projector.jsx';
import Keyboard from './screens/Keyboard.jsx';
import Apps from './screens/Apps.jsx';
import Screen from './screens/Screen.jsx';
import More from './screens/More.jsx';

// The Remote tab shows a projector-tuned layout when the active device is a projector.
function RemoteTab() {
  const projector = useStore(s => s.tvs.find(t => t.id === s.activeTvId)?.projector);
  return projector ? <Projector /> : <Remote />;
}

const TABS = [
  ['remote', 'Remote', RemoteGlyph, RemoteTab],
  ['keyboard', 'Keyboard', KbIcon, Keyboard],
  ['apps', 'Aplikasi', LayoutGrid, Apps],
  ['screen', 'Layar', Eye, Screen],
  ['more', 'Lainnya', Ellipsis, More],
];

function useTheme() {
  const theme = useStore(s => s.theme);
  const accent = useStore(s => s.accent);
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0b0e17' : '#eef1f8');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [theme]);
  useEffect(() => { document.documentElement.style.setProperty('--accent', accent); }, [accent]);
}

// Global behaviours while connected: phone volume keys, shake-to-mute, sleep timer.
function useConnectedExtras(connected) {
  const volumeKeys = useStore(s => s.volumeKeys);
  const shake = useStore(s => s.shake);
  useEffect(() => {
    bridge.call('setVolumeKeys', { enabled: connected && volumeKeys }).catch(() => {});
    if (!connected || !volumeKeys) return;
    return bridge.on('hwKey', e => tv.press(e.key === 'volup' ? 'volup' : 'voldown'));
  }, [connected, volumeKeys]);
  useEffect(() => {
    if (!connected || !shake) return;
    let last = 0, peaks = [];
    const onMotion = e => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
      const now = Date.now();
      if (m > 24) {
        peaks = peaks.filter(t => now - t < 700);
        peaks.push(now);
        if (peaks.length >= 3 && now - last > 1800) {
          last = now; peaks = [];
          tv.press('mute');
          useStore.getState().showToast('Senyap (kocok HP)');
        }
      }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [connected, shake]);
  useEffect(() => {
    const t = setInterval(() => {
      const s = useStore.getState();
      if (s.sleepEnd && Date.now() >= s.sleepEnd) {
        s.set({ sleepEnd: null });
        tv.press('power', { silent: true });
        s.showToast('Timer tidur: TV dimatikan');
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);
}

function TvBar() {
  const status = useStore(s => s.status);
  const volume = useStore(s => s.volume);
  const t = useStore(s => s.tvs.find(x => x.id === s.activeTvId));
  const lost = status === 'lost';
  return (
    <>
      <div className="tvbar">
        <button className="tvchip" onClick={() => { if (lost) { fx.tap(); tv.reconnect(); } else { fx.tap(); useStore.getState().set({ tab: 'more' }); } }}>
          <div className="li-icon" style={{ width: 40, height: 40, borderRadius: 13 }}><TypeIcon type={t?.type} projector={t?.projector} size={20} /></div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="li-title" style={{ fontSize: 15 }}>{t?.name || 'TV'}</div>
            <div className="row" style={{ gap: 7, marginTop: 3 }}>
              <span className={'dot' + (lost ? ' warn' : '')} />
              <span className="li-sub" style={{ margin: 0 }}>{lost ? 'Terputus · ketuk untuk sambung ulang' : 'Terhubung · ' + tvLabel(t)}</span>
            </div>
          </div>
          {lost ? <RefreshCw size={18} color="var(--warn)" /> : <ChevronDown size={18} color="var(--faint)" />}
        </button>
        <button className="power-btn" onClick={() => tv.press('power')} aria-label="Power"><Power size={24} strokeWidth={2.8} /></button>
      </div>
      {volume && (
        <div className="row pad" style={{ gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--faint)', width: 30 }}>VOL</span>
          <div className="volbar grow" style={{ margin: 0 }}><div style={{ width: (volume.muted ? 0 : Math.min(100, (volume.level / (volume.max || 100)) * 100)) + '%' }} /></div>
          <span style={{ fontSize: 12, fontWeight: 800, width: 30, textAlign: 'right' }}>{volume.muted ? '🔇' : volume.level}</span>
        </div>
      )}
    </>
  );
}

function Main() {
  const tab = useStore(s => s.tab);
  const Cur = (TABS.find(t => t[0] === tab) || TABS[0])[3];
  useEffect(() => native.onBack(() => {
    if (useStore.getState().tab !== 'remote') { fx.back(); useStore.getState().set({ tab: 'remote' }); return true; }
    return false;
  }), []);
  return (
    <div className="screen">
      <TvBar />
      <div className="screen" key={tab}><Cur /></div>
      <nav className="tabbar">
        {TABS.map(([id, label, I]) => (
          <button key={id} className={'tab' + (tab === id ? ' on' : '')} onClick={() => { if (tab !== id) { fx.select(); useStore.getState().set({ tab: id }); } }}>
            <span className="tab-ico"><I size={21} /></span>{label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  useTheme();
  const onboarded = useStore(s => s.onboarded);
  const status = useStore(s => s.status);
  const connected = status === 'connected' || status === 'lost';
  useConnectedExtras(status === 'connected');
  const shown = useRef(false);
  useEffect(() => { if (!shown.current) { shown.current = true; native.hideSplash(); } }, []);
  return (
    <>
      <div className="app-bg" />
      {!onboarded ? <Onboarding /> : connected ? <Main /> : <Connect />}
      <PairingLayer />
      <Toast />
    </>
  );
}
