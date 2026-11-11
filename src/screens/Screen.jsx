import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Eye, Pause, Play, Maximize2, X, Cast, ShieldCheck, Smartphone, Tv, RefreshCw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ArrowLeft, Home, RotateCw } from 'lucide-react';
import { useStore } from '../store.js';
import { tv } from '../tv.js';
import { fx } from '../sfx.js';
import { bridge } from '../bridge.js';
import { native } from '../lib/native.js';
import { Key } from '../components/ui.jsx';
import { Clipboard } from '@capacitor/clipboard';

const srcOf = r => r.dataUrl || ((bridge.isNative ? Capacitor.convertFileSrc(r.path) : r.path) + '?t=' + r.time);

const RATES = [[2000, '2 dtk'], [5000, '5 dtk'], [10000, '10 dtk']];

function timeAgo(t, now) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  return s < 2 ? 'baru saja' : s + ' dtk lalu';
}

function Watch() {
  const d = tv.driver;
  const type = d?.type;
  const can = !!d?.capture;
  const [state, setState] = useState('idle'); // idle | starting | prompt | live | paused | error
  const [shot, setShot] = useState(null);
  const [err, setErr] = useState('');
  const [rate, setRate] = useState(5000);
  const [full, setFull] = useState(false);
  const [rot, setRot] = useState(true);
  const [now, setNow] = useState(Date.now());
  const run = useRef({ on: false, timer: null });

  useEffect(() => bridge.on('adbPrompt', () => { fx.notify(); setState('prompt'); }), []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => () => { run.current.on = false; clearTimeout(run.current.timer); }, []);
  useEffect(() => { if (!full) return; return native.onBack(() => { setFull(false); return true; }); }, [full]);

  const rateRef = useRef(rate);
  rateRef.current = rate;

  const start = () => {
    fx.confirm();
    setErr('');
    setState('starting');
    run.current.on = true;
    clearTimeout(run.current.timer);
    (async () => {
      if (!run.current.on) return;
      try {
        const r = await d.capture();
        const src = srcOf(r);
        setShot({ src, time: r.time });
        setState('live');
        const tick = async () => {
          if (!run.current.on) return;
          try {
            const x = await d.capture();
            if (!run.current.on) return;
            setShot({ src: srcOf(x), time: x.time });
          } catch (e) { run.current.on = false; fx.error(); setErr(String(e?.message || e)); setState('error'); return; }
          run.current.timer = setTimeout(tick, rateRef.current);
        };
        run.current.timer = setTimeout(tick, rateRef.current);
      } catch (e) {
        run.current.on = false;
        fx.error();
        setErr(String(e?.message || e));
        setState('error');
      }
    })();
  };
  const pause = () => { fx.tap(); run.current.on = false; clearTimeout(run.current.timer); setState('paused'); };

  if (!can) {
    return (
      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="li-icon"><Eye size={22} /></div>
          <div className="grow"><b>Lihat layar TV</b><div className="li-sub" style={{ whiteSpace: 'normal' }}>Belum didukung untuk {type === 'ir' ? 'mode infra merah' : 'TV ini'}</div></div>
        </div>
        <p className="subtitle" style={{ fontSize: 13, lineHeight: 1.55 }}>
          Fitur memantau layar tersedia untuk <b>Android TV / Google TV</b> (Xiaomi, TCL, Sharp, Sony, Coocaa…) dan sebagian <b>LG webOS</b>.
          Samsung & Roku tidak mengizinkan aplikasi lain mengambil gambar layarnya.
        </p>
      </div>
    );
  }

  const adbGuide = type === 'androidtv';
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="li-icon" style={{ width: 40, height: 40, borderRadius: 13 }}><Eye size={20} /></div>
        <div className="grow"><b style={{ fontSize: 16 }}>Lihat layar TV</b>
          <div className="li-sub">{state === 'live' ? 'Memantau · ' + (shot ? timeAgo(shot.time, now) : '') : state === 'paused' ? 'Dijeda' : 'Tanpa share screen — untuk mengawasi'}</div>
        </div>
        {(state === 'live' || state === 'paused') && <span className="badge accent" style={state === 'live' ? { animation: 'blink 1.6s infinite' } : {}}>{state === 'live' ? '● LIVE' : 'JEDA'}</span>}
      </div>

      <div className="shot" onClick={() => { if (shot) { fx.whoosh(); setFull(true); } }}>
        {shot ? <img src={shot.src} alt="Layar TV" /> : (
          <div className="center" style={{ flexDirection: 'column', gap: 10, color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
            {state === 'starting' ? <><span className="spinner" style={{ color: 'var(--accent)' }} />Mengambil gambar layar…</> :
              state === 'prompt' ? <><ShieldCheck size={30} color="var(--accent)" /><b style={{ color: 'var(--text)' }}>Pilih "Izinkan" di TV</b>Centang "Selalu izinkan dari komputer ini" agar tidak ditanya lagi.</> :
                <><Tv size={34} />Ketuk Mulai untuk melihat layar TV di sini</>}
          </div>
        )}
        {shot && <span className="shot-zoom"><Maximize2 size={16} /></span>}
      </div>

      {state === 'error' && (
        <div className="card" style={{ padding: 12, marginTop: 12, background: 'color-mix(in srgb, var(--danger) 10%, var(--surface))', boxShadow: 'none' }}>
          <b style={{ fontSize: 14 }}>Belum bisa mengambil layar TV</b>
          {adbGuide ? (
            <ol style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
              <li>Di TV buka <b>Setelan › Preferensi Perangkat › Tentang</b>, ketuk <b>Build</b> 7× sampai jadi pengembang.</li>
              <li>Buka <b>Opsi Pengembang</b>, nyalakan <b>USB debugging</b> (atau <b>Network/ADB debugging</b>).</li>
              <li>Ketuk <b>Coba lagi</b>, lalu pilih <b>Izinkan</b> di TV.</li>
            </ol>
          ) : (
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>Model LG ini tidak mengizinkan tangkapan layar dari aplikasi.</p>
          )}
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.45, color: 'var(--faint)', maxHeight: 96, overflowY: 'auto', wordBreak: 'break-all', userSelect: 'text', WebkitUserSelect: 'text', background: 'var(--surface2)', borderRadius: 10, padding: 8 }}>{err}</div>
          <button className="chip" style={{ marginTop: 8 }} onClick={() => { fx.tap(); Clipboard.write({ string: err }).then(() => useStore.getState().showToast('Detail error disalin')).catch(() => {}); }}>Salin detail error</button>
        </div>
      )}

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        {state === 'live' || state === 'starting' || state === 'prompt'
          ? <button className="btn grow" onClick={pause}><Pause size={18} /> Jeda</button>
          : <button className="btn primary grow" onClick={start}>{state === 'error' ? <RefreshCw size={18} /> : <Play size={18} />} {state === 'error' ? 'Coba lagi' : state === 'paused' ? 'Lanjut' : 'Mulai pantau'}</button>}
        <div className="seg" style={{ height: 52 }}>
          {RATES.map(([ms, l]) => <button key={ms} className={'seg-btn' + (rate === ms ? ' on' : '')} style={{ padding: '0 9px', whiteSpace: 'nowrap' }} onClick={() => { fx.select(); setRate(ms); }}>{l}</button>)}
        </div>
      </div>
      <p className="subtitle" style={{ fontSize: 11.5, margin: '10px 2px 0', lineHeight: 1.5 }}>
        Video berhak cipta (Netflix, Disney+, dll.) bisa tampil hitam karena proteksi dari aplikasinya.
      </p>

      {full && shot && (
        <div className="fullshot" onClick={() => { fx.back(); setFull(false); }}>
          <img src={shot.src} alt="Layar TV" style={rot ? { transform: 'rotate(90deg)', width: '100vh', maxWidth: 'none', height: '100vw' } : {}} />
          <div className="fullshot-bar" onClick={e => e.stopPropagation()}>
            <button className="icon-btn" onClick={() => { fx.tap(); setRot(!rot); }}><RotateCw size={19} /></button>
            <span className="badge accent">{state === 'live' ? '● LIVE · ' : ''}{timeAgo(shot.time, now)}</span>
            <button className="icon-btn" onClick={() => { fx.back(); setFull(false); }}><X size={19} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function Share() {
  const open = async () => {
    fx.tap();
    try { await bridge.call('castSettings'); }
    catch { fx.error(); useStore.getState().showToast('Buka panel cepat HP lalu pilih Cast / Smart View', 'error'); }
  };
  return (
    <div className="card" style={{ padding: 14, marginTop: 14 }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="li-icon" style={{ width: 40, height: 40, borderRadius: 13 }}><Cast size={20} /></div>
        <div className="grow"><b style={{ fontSize: 16 }}>Bagikan layar HP ke TV</b><div className="li-sub">Cast · Smart View · Screen Mirroring</div></div>
      </div>
      <div className="row" style={{ gap: 10, margin: '6px 0 14px', justifyContent: 'center', color: 'var(--accent)' }}>
        <Smartphone size={34} />
        <span className="cast-dots"><i /><i /><i /></span>
        <Tv size={40} />
      </div>
      <ol style={{ margin: '0 0 14px', paddingLeft: 18, color: 'var(--muted)', fontSize: 13, lineHeight: 1.65 }}>
        <li>Pastikan HP & TV di Wi-Fi yang sama.</li>
        <li>Ketuk tombol di bawah, lalu pilih nama TV-mu.</li>
        <li>Seluruh layar HP (foto, video, game) tampil di TV.</li>
      </ol>
      <button className="btn primary block" onClick={open}><Cast size={18} /> Mulai bagikan layar</button>
    </div>
  );
}

export default function Screen() {
  return (
    <div className="scroll pad page-in" style={{ paddingTop: 6, paddingBottom: 20 }}>
      <Watch />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 12 }}>
        <Key k="back" className="small-key"><ArrowLeft size={20} /></Key>
        <Key k="left" repeat className="small-key"><ChevronLeft size={20} /></Key>
        <Key k="up" repeat className="small-key"><ChevronUp size={20} /></Key>
        <Key k="ok" className="small-key" style={{ fontWeight: 800 }}>OK</Key>
        <Key k="down" repeat className="small-key"><ChevronDown size={20} /></Key>
        <Key k="right" repeat className="small-key"><ChevronRight size={20} /></Key>
        <Key k="home" className="small-key"><Home size={20} /></Key>
      </div>
      <Share />
    </div>
  );
}
