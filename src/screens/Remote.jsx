import { useRef, useState, useEffect, useSyncExternalStore } from 'react';
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ArrowLeft, Home, Menu, Plus, Minus, VolumeX,
  Play, Rewind, FastForward, Square, Settings, LogIn, Grid3x3, Info, BookOpen, Captions, LogOut, Hand, Gamepad2,
  Eye, Maximize2, X, Loader,
} from 'lucide-react';
import { useStore } from '../store.js';
import { tv } from '../tv.js';
import { fx } from '../sfx.js';
import { Key, Sheet } from '../components/ui.jsx';
import { screenview } from '../screenview.js';

// Compact live TV preview shown above the remote so you can see what you're doing.
function RemotePreview() {
  useSyncExternalStore(cb => screenview.subscribe(cb), () => screenview._gen + ':' + screenview.state + ':' + (screenview.frame?.time || 0));
  const show = useStore(s => s.remotePreview);
  const supported = screenview.supported();
  useEffect(() => { if (show && supported && screenview.state === 'off' && !screenview.frame) screenview.start(); }, [show, supported]);
  if (!supported) return null;
  const { state, frame } = screenview;
  if (!show) {
    return (
      <button className="prev-open" onClick={() => { fx.tap(); useStore.getState().set({ remotePreview: true }); screenview.start(); }}>
        <Eye size={16} /> Tampilkan layar TV di sini
      </button>
    );
  }
  return (
    <div className="prev-wrap">
      <div className="prev-shot" onClick={() => { fx.select(); useStore.getState().set({ tab: 'screen' }); }}>
        {frame ? <img src={frame.src} alt="Layar TV" /> : (
          <div className="center" style={{ height: '100%', gap: 8, color: 'var(--muted)', fontSize: 12 }}>
            {state === 'error' ? 'Gagal — ketuk Layar untuk atur' : <><span className="spinner" style={{ width: 16, height: 16, color: 'var(--accent)' }} /> Memuat layar TV…</>}
          </div>
        )}
        {frame && <span className="prev-badge">● LIVE</span>}
        {frame && <span className="shot-zoom" style={{ width: 26, height: 26 }}><Maximize2 size={13} /></span>}
      </div>
      <button className="prev-x" onClick={e => { e.stopPropagation(); fx.back(); useStore.getState().set({ remotePreview: false }); screenview.stop(); }} aria-label="Tutup preview"><X size={15} /></button>
    </div>
  );
}

function Dpad() {
  const [active, setActive] = useState(null);
  const arrow = (k, Icon, style) => (
    <Key k={k} repeat className="dpad-arrow" style={style} label={k}>
      <span onPointerDown={() => setActive(k)} onPointerUp={() => setActive(null)} onPointerLeave={() => setActive(null)}
        style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><Icon size={30} strokeWidth={2.6} /></span>
    </Key>
  );
  const rot = { up: 0, right: 90, down: 180, left: 270 }[active];
  return (
    <div className="dpad">
      <div className="dpad-ring" />
      {active && <div className="dpad-glow" style={{ transform: `rotate(${rot}deg)` }} />}
      {arrow('up', ChevronUp, { top: 0, left: '50%', transform: 'translateX(-50%)' })}
      {arrow('down', ChevronDown, { bottom: 0, left: '50%', transform: 'translateX(-50%)' })}
      {arrow('left', ChevronLeft, { left: 0, top: '50%', transform: 'translateY(-50%)' })}
      {arrow('right', ChevronRight, { right: 0, top: '50%', transform: 'translateY(-50%)' })}
      <Key k="ok" className="dpad-ok" label="OK"><span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '.04em' }}>OK</span></Key>
    </div>
  );
}

function Touchpad() {
  const st = useRef(null);
  const [dots, setDots] = useState([]);
  const [hint, setHint] = useState(null);
  const mouse = tv.driver?.mouse;
  const mouseMode = useStore(s => s.remoteMode) === 'mouse' && !!mouse;
  const ripple = (x, y) => {
    const id = Math.random();
    setDots(d => [...d.slice(-4), { id, x, y }]);
    setTimeout(() => setDots(d => d.filter(p => p.id !== id)), 600);
  };
  const flash = (k) => { setHint(k); clearTimeout(st.current?.ht); if (st.current) st.current.ht = setTimeout(() => setHint(null), 350); };
  const down = e => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    st.current = { x: e.clientX, y: e.clientY, ax: 0, ay: 0, t: Date.now(), moved: false, lx: e.clientX, ly: e.clientY, last: 0, r };
    ripple(e.clientX - r.left, e.clientY - r.top);
  };
  const move = e => {
    const s = st.current; if (!s) return;
    const dx = e.clientX - s.lx, dy = e.clientY - s.ly;
    s.lx = e.clientX; s.ly = e.clientY;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) s.moved = true;
    if (mouseMode) {
      s.ax += dx * 1.6; s.ay += dy * 1.6;
      const now = Date.now();
      if (now - s.last > 30) { mouse.move(s.ax, s.ay).catch(() => {}); s.ax = 0; s.ay = 0; s.last = now; }
      return;
    }
    s.ax += dx; s.ay += dy;
    const TH = 42;
    if (Math.abs(s.ax) > TH || Math.abs(s.ay) > TH) {
      const k = Math.abs(s.ax) > Math.abs(s.ay) ? (s.ax > 0 ? 'right' : 'left') : (s.ay > 0 ? 'down' : 'up');
      s.ax = 0; s.ay = 0;
      tv.press(k); flash(k);
    }
  };
  const up = e => {
    const s = st.current; st.current = null;
    if (!s) return;
    if (!s.moved && Date.now() - s.t < 300) {
      if (mouseMode) { fx.press('ok'); mouse.click().catch(() => {}); } else { tv.press('ok'); }
      flash('ok');
    }
  };
  const arrows = { up: '↑', down: '↓', left: '←', right: '→', ok: 'OK' };
  return (
    <div className="touchpad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { st.current = null; }}>
      <div className="tp-grid" />
      {dots.map(d => <span key={d.id} className="tp-ripple" style={{ left: d.x, top: d.y }} />)}
      <div className="tp-label">
        {hint ? <b key={hint + Math.random()} className="pop-in" style={{ fontSize: 34, color: 'var(--accent)' }}>{arrows[hint]}</b> : (
          <>
            <Hand size={26} />
            <span>{mouseMode ? 'Geser = gerakkan kursor · Ketuk = klik' : 'Geser untuk arah · Ketuk untuk OK'}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function Remote() {
  const mode = useStore(s => s.remoteMode);
  const [pad, setPad] = useState(false);
  const hasMouse = !!tv.driver?.mouse;
  const modes = [['dpad', 'D-pad', Gamepad2], ['swipe', 'Geser', Hand], ...(hasMouse ? [['mouse', 'Kursor', Hand]] : [])];
  const setMode = m => { fx.select(); useStore.getState().set({ remoteMode: m }); };
  const cur = modes.find(m => m[0] === mode) ? mode : 'dpad';
  return (
    <div className="scroll page-in" style={{ padding: '6px 18px 18px' }}>
      <RemotePreview />
      <div className="row" style={{ gap: 10, marginBottom: 14 }}>
        <Key k="input" label="Input" className="small-key" style={{ width: 58, flex: 'none' }}><LogIn size={19} /><span className="lbl">Input</span></Key>
        <div className="seg grow">
          {modes.map(([id, label]) => (
            <button key={id} className={'seg-btn' + (cur === id ? ' on' : '')} onClick={() => setMode(id)}>{label}</button>
          ))}
        </div>
        <Key k="numpad" label="Angka" className="small-key" style={{ width: 58, flex: 'none' }} onPress={() => { fx.tap(); setPad(true); }}><Grid3x3 size={19} /><span className="lbl">123</span></Key>
      </div>

      <div className="center" style={{ minHeight: 270 }}>
        {cur === 'dpad' ? <Dpad /> : <Touchpad key={cur} />}
      </div>

      <div className="row" style={{ gap: 12, marginTop: 16 }}>
        <Key k="back" className="grow"><ArrowLeft size={22} /><span className="lbl">Kembali</span></Key>
        <Key k="home" className="grow"><Home size={22} /><span className="lbl">Beranda</span></Key>
        <Key k="menu" className="grow"><Menu size={22} /><span className="lbl">Menu</span></Key>
      </div>

      <div className="row" style={{ gap: 12, marginTop: 14, alignItems: 'stretch' }}>
        <div className="pill">
          <Key k="volup" repeat className="pill-key"><Plus size={24} strokeWidth={2.6} /></Key>
          <span className="pill-lbl">VOL</span>
          <Key k="voldown" repeat className="pill-key"><Minus size={24} strokeWidth={2.6} /></Key>
        </div>
        <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Key k="mute" className="grow"><VolumeX size={22} /><span className="lbl">Senyap</span></Key>
          <Key k="playpause" className="grow"><Play size={22} /><span className="lbl">Putar/Jeda</span></Key>
        </div>
        <div className="pill">
          <Key k="chup" repeat className="pill-key"><ChevronUp size={26} strokeWidth={2.6} /></Key>
          <span className="pill-lbl">CH</span>
          <Key k="chdown" repeat className="pill-key"><ChevronDown size={26} strokeWidth={2.6} /></Key>
        </div>
      </div>

      <div className="row" style={{ gap: 10, marginTop: 14 }}>
        <Key k="rew" repeat className="grow small-key"><Rewind size={19} /></Key>
        <Key k="stop" className="grow small-key"><Square size={17} /></Key>
        <Key k="ff" repeat className="grow small-key"><FastForward size={19} /></Key>
        <Key k="settings" className="grow small-key"><Settings size={19} /></Key>
      </div>

      <Sheet open={pad} onClose={() => setPad(false)}>
        <h2>Angka & tombol khusus</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => <Key key={n} k={'d' + n} style={{ height: 58, fontSize: 22, fontWeight: 800 }}>{n}</Key>)}
          <Key k="exit" style={{ height: 58 }}><LogOut size={20} /></Key>
          <Key k="d0" style={{ height: 58, fontSize: 22, fontWeight: 800 }}>0</Key>
          <Key k="ok" style={{ height: 58, fontWeight: 800 }}>OK</Key>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          {[['red', '#ff5c6c'], ['green', '#3ddc97'], ['yellow', '#f5d33d'], ['blue', '#4a8dff']].map(([k, c]) => (
            <Key key={k} k={k} className="grow" style={{ height: 46 }}><span style={{ width: 26, height: 8, borderRadius: 8, background: c, boxShadow: `0 0 12px ${c}` }} /></Key>
          ))}
        </div>
        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          <Key k="info" className="grow" style={{ height: 52 }}><Info size={19} /><span className="lbl">Info</span></Key>
          <Key k="guide" className="grow" style={{ height: 52 }}><BookOpen size={19} /><span className="lbl">Guide</span></Key>
          <Key k="captions" className="grow" style={{ height: 52 }}><Captions size={19} /><span className="lbl">Subtitle</span></Key>
        </div>
      </Sheet>
    </div>
  );
}
