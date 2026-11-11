import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import {
  Eye, Pause, Play, Maximize2, X, Cast, ShieldCheck, Smartphone, Tv, RefreshCw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ArrowLeft, Home, RotateCw, Ghost, Image as ImageIcon, Upload, Zap, EyeOff, Mic, Volume2, Send, Loader,
} from 'lucide-react';
import { useStore } from '../store.js';
import { tv } from '../tv.js';
import { fx } from '../sfx.js';
import { bridge } from '../bridge.js';
import { native } from '../lib/native.js';
import { Key } from '../components/ui.jsx';
import { screenview } from '../screenview.js';
import { SCARES, svgToJpeg, fileToJpeg } from '../scare.js';
import { prankSupported, prepareImage, showImage, hideImage, playAudio, speak, SCARE_SOUNDS, soundUrl } from '../prank.js';

let previewAudio = null;

const RATES = [[2000, '2 dtk'], [5000, '5 dtk'], [10000, '10 dtk']];
const timeAgo = (t, now) => { const s = Math.max(0, Math.round((now - t) / 1000)); return s < 2 ? 'baru saja' : s + ' dtk lalu'; };

// Subscribe the component to the shared capture singleton.
function useScreenview() {
  return useSyncExternalStore(cb => screenview.subscribe(cb), () => screenview._gen + ':' + screenview.state + ':' + (screenview.frame?.time || 0));
}

function ErrorCard({ err, type }) {
  return (
    <div className="card" style={{ padding: 12, marginTop: 12, background: 'color-mix(in srgb, var(--danger) 10%, var(--surface))', boxShadow: 'none' }}>
      <b style={{ fontSize: 14 }}>Belum bisa mengambil layar TV</b>
      {type === 'androidtv' ? (
        <ol style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
          <li>Di TV: <b>Setelan › Preferensi Perangkat › Tentang</b>, ketuk <b>Build</b> 7×.</li>
          <li>Buka <b>Opsi Pengembang</b>, nyalakan <b>USB debugging</b> (atau <b>Network/ADB debugging</b>).</li>
          <li>Ketuk <b>Coba lagi</b>, lalu <b>Izinkan</b> di TV.</li>
        </ol>
      ) : <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13 }}>Model ini tidak mengizinkan tangkapan layar dari aplikasi.</p>}
      <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.45, color: 'var(--faint)', maxHeight: 96, overflowY: 'auto', wordBreak: 'break-all', userSelect: 'text', WebkitUserSelect: 'text', background: 'var(--surface2)', borderRadius: 10, padding: 8 }}>{err}</div>
      <button className="chip" style={{ marginTop: 8 }} onClick={() => { fx.tap(); Clipboard.write({ string: err }).then(() => useStore.getState().showToast('Detail error disalin')).catch(() => {}); }}>Salin detail error</button>
    </div>
  );
}

function Watch() {
  useScreenview();
  const d = tv.driver;
  const type = d?.type;
  const [full, setFull] = useState(false);
  const [rot, setRot] = useState(true);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!full) return; return native.onBack(() => { setFull(false); return true; }); }, [full]);

  const { state, frame, err, rate } = screenview;
  if (!screenview.supported()) {
    return (
      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="li-icon"><Eye size={22} /></div>
          <div className="grow"><b>Lihat layar TV</b><div className="li-sub" style={{ whiteSpace: 'normal' }}>Belum didukung untuk {type === 'ir' ? 'mode infra merah' : 'TV ini'}</div></div>
        </div>
        <p className="subtitle" style={{ fontSize: 13, lineHeight: 1.55 }}>
          Tersedia untuk <b>Android TV / Google TV</b> (Xiaomi, TCL, Sharp, Sony, Coocaa…) dan sebagian <b>LG webOS</b>.
          Samsung & Roku tidak mengizinkan aplikasi lain mengambil gambar layarnya.
        </p>
      </div>
    );
  }
  const live = state === 'live';
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="li-icon" style={{ width: 40, height: 40, borderRadius: 13 }}><Eye size={20} /></div>
        <div className="grow"><b style={{ fontSize: 16 }}>Lihat layar TV</b>
          <div className="li-sub">{live ? 'Memantau · ' + (frame ? timeAgo(frame.time, now) : '') : 'Tanpa share screen — untuk mengawasi'}</div>
        </div>
        {live && <span className="badge accent" style={{ animation: 'blink 1.6s infinite' }}>● LIVE</span>}
      </div>

      <div className="shot" onClick={() => { if (frame) { fx.whoosh(); setFull(true); } }}>
        {frame ? <img src={frame.src} alt="Layar TV" /> : (
          <div className="center" style={{ flexDirection: 'column', gap: 10, color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
            {state === 'starting' ? <><span className="spinner" style={{ color: 'var(--accent)' }} />Mengambil gambar layar…</> :
              state === 'prompt' ? <><ShieldCheck size={30} color="var(--accent)" /><b style={{ color: 'var(--text)' }}>Pilih "Izinkan" di TV</b>Centang "Selalu izinkan dari perangkat ini".</> :
                <><Tv size={34} />Ketuk Mulai untuk melihat layar TV di sini</>}
          </div>
        )}
        {frame && <span className="shot-zoom"><Maximize2 size={16} /></span>}
      </div>

      {state === 'error' && <ErrorCard err={err} type={type} />}

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        {state === 'live' || state === 'starting' || state === 'prompt'
          ? <button className="btn grow" onClick={() => { fx.tap(); screenview.stop(); }}><Pause size={18} /> Jeda</button>
          : <button className="btn primary grow" onClick={() => { fx.confirm(); screenview.start(); }}>{state === 'error' ? <RefreshCw size={18} /> : <Play size={18} />} {state === 'error' ? 'Coba lagi' : frame ? 'Lanjut' : 'Mulai pantau'}</button>}
        <div className="seg" style={{ height: 52 }}>
          {RATES.map(([ms, l]) => <button key={ms} className={'seg-btn' + (rate === ms ? ' on' : '')} style={{ padding: '0 9px', whiteSpace: 'nowrap' }} onClick={() => { fx.select(); screenview.setRate(ms); }}>{l}</button>)}
        </div>
      </div>
      <p className="subtitle" style={{ fontSize: 11.5, margin: '10px 2px 0', lineHeight: 1.5 }}>Video berhak cipta (Netflix, dll.) bisa tampil hitam karena proteksi aplikasinya.</p>

      {full && frame && (
        <div className="fullshot" onClick={() => { fx.back(); setFull(false); }}>
          <img src={frame.src} alt="Layar TV" style={rot ? { transform: 'rotate(90deg)', width: '100vh', maxWidth: 'none', height: '100vw' } : {}} />
          <div className="fullshot-bar" onClick={e => e.stopPropagation()}>
            <button className="icon-btn" onClick={() => { fx.tap(); setRot(!rot); }}><RotateCw size={19} /></button>
            <span className="badge accent">{live ? '● LIVE · ' : ''}{timeAgo(frame.time, now)}</span>
            <button className="icon-btn" onClick={() => { fx.back(); setFull(false); }}><X size={19} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function Prank() {
  const [pick, setPick] = useState(SCARES[0].id);
  const [sound, setSound] = useState('jerit');
  const [customImg, setCustomImg] = useState(null); // {thumb, jpeg}
  const [prepared, setPrepared] = useState(null);    // "imgKey|soundId" currently pushed to TV
  const [busy, setBusy] = useState('');
  const [log, setLog] = useState('');
  const [text, setText] = useState('Hai, aku lagi ngeliatin kamu loh 👀');
  const [rec, setRec] = useState(false);
  const file = useRef(null);
  const recStart = useRef(0);
  const preview = (id) => {
    if (id === 'none') return;
    try { previewAudio?.pause(); previewAudio = new Audio(soundUrl(id)); previewAudio.play().catch(() => {}); } catch { /* */ }
  };

  if (!prankSupported()) {
    return (
      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <div className="row" style={{ gap: 12, marginBottom: 6 }}><div className="li-icon"><Ghost size={22} /></div>
          <div className="grow"><b>Jahilin TV</b><div className="li-sub" style={{ whiteSpace: 'normal' }}>Hanya untuk Android TV / Google TV</div></div></div>
        <p className="subtitle" style={{ fontSize: 13, lineHeight: 1.55 }}>Kirim gambar kejutan & suara ke TV butuh Android TV / Google TV (dengan debugging menyala, sama seperti fitur lihat layar).</p>
      </div>
    );
  }

  const curJpeg = async () => customImg ? customImg.jpeg : svgToJpeg(SCARES.find(s => s.id === pick).svg);
  const curKey = (customImg ? 'custom' : pick) + '|' + sound;
  const hasSound = sound !== 'none';

  const prepare = async () => {
    fx.tap(); setBusy('prepare'); setLog('');
    try {
      const r = await prepareImage(await curJpeg(), sound);
      if (r.ok) { setPrepared(curKey); fx.confirm(); useStore.getState().showToast(hasSound ? 'Gambar + suara siap — tinggal KAGETKAN' : 'Gambar siap di TV — tinggal KAGETKAN'); }
      else { fx.error(); setLog(r.log); useStore.getState().showToast(r.needSpace ? 'Penyimpanan TV penuh — lihat detail' : 'Gagal menyiapkan — lihat detail', 'error'); }
    } catch (e) { fx.error(); setLog(String(e?.message || e)); useStore.getState().showToast('Gagal menyiapkan gambar', 'error'); }
    setBusy('');
  };
  const scare = async () => {
    fx.press('power'); setBusy('show');
    try {
      if (prepared !== curKey) { const p = await prepareImage(await curJpeg(), sound); if (!p.ok) { setLog(p.log); fx.error(); useStore.getState().showToast(p.needSpace ? 'Penyimpanan TV penuh — lihat detail' : 'Gagal — lihat detail', 'error'); setBusy(''); return; } setPrepared(curKey); }
      const r = await showImage(hasSound);
      if (r.ok) { setLog(''); fx.notify(); useStore.getState().showToast('KAGET! 👻'); } else { setLog(r.log); fx.error(); useStore.getState().showToast(r.needSpace ? 'Penyimpanan TV penuh — lihat detail' : 'Gagal menampilkan — lihat detail', 'error'); }
    } catch (e) { fx.error(); setLog(String(e?.message || e)); }
    setBusy('');
  };
  const onFile = async e => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const jpeg = await fileToJpeg(f); setCustomImg({ thumb: jpeg, jpeg }); setPrepared(null); fx.select(); }
    catch { fx.error(); useStore.getState().showToast('Gagal membaca gambar', 'error'); }
    e.target.value = '';
  };

  const sayText = async () => {
    if (!text.trim()) { fx.error(); return; }
    fx.tap(); setBusy('tts');
    try { const r = await speak(text.trim()); if (r.ok) { fx.confirm(); useStore.getState().showToast('TV sedang bicara 🔊'); } else { fx.error(); setLog(r.log); useStore.getState().showToast(r.needSpace ? 'Penyimpanan TV penuh — lihat detail' : 'TV tak bisa memutar suara — lihat detail', 'error'); } }
    catch (e) { fx.error(); setLog(String(e?.message || e)); useStore.getState().showToast('Gagal: ' + String(e?.message || e).slice(0, 40), 'error'); }
    setBusy('');
  };

  const startRec = async e => {
    e.preventDefault();
    try {
      const { VoiceRecorder } = await import('capacitor-voice-recorder');
      const p = await VoiceRecorder.requestAudioRecordingPermission();
      if (!p.value) { fx.error(); useStore.getState().showToast('Izinkan akses mikrofon dulu', 'error'); return; }
      await VoiceRecorder.startRecording();
      recStart.current = Date.now(); setRec(true); fx.notify();
    } catch (err) { fx.error(); useStore.getState().showToast('Mikrofon tidak tersedia', 'error'); }
  };
  const stopRec = async () => {
    if (!rec) return;
    setRec(false);
    if (Date.now() - recStart.current < 400) { useStore.getState().showToast('Tahan lebih lama untuk merekam'); try { const { VoiceRecorder } = await import('capacitor-voice-recorder'); await VoiceRecorder.stopRecording(); } catch { /* */ } return; }
    setBusy('voice');
    try {
      const { VoiceRecorder } = await import('capacitor-voice-recorder');
      const r = await VoiceRecorder.stopRecording();
      const b64 = r.value?.recordDataBase64;
      const ext = (r.value?.mimeType || '').includes('mpeg') ? 'mp3' : (r.value?.mimeType || '').includes('wav') ? 'wav' : 'm4a';
      if (!b64) throw new Error('Rekaman kosong');
      const res = await playAudio(b64, ext);
      if (res.ok) { fx.confirm(); useStore.getState().showToast('Suaramu diputar di TV 🔊'); } else { fx.error(); setLog(res.log); useStore.getState().showToast(res.needSpace ? 'Penyimpanan TV penuh — lihat detail' : 'TV tak bisa memutar audio — lihat detail', 'error'); }
    } catch (e) { fx.error(); setLog(String(e?.message || e)); useStore.getState().showToast('Gagal memutar rekaman', 'error'); }
    setBusy('');
  };

  return (
    <div className="card jahil" style={{ padding: 14, marginTop: 14 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="li-icon" style={{ width: 40, height: 40, borderRadius: 13, background: 'color-mix(in srgb, var(--danger) 18%, var(--surface2))', color: 'var(--danger)' }}><Ghost size={20} /></div>
        <div className="grow"><b style={{ fontSize: 16 }}>Jahilin TV 👻</b><div className="li-sub">Gambar kejutan & suara ke layar TV</div></div>
      </div>

      <div className="section-label" style={{ marginTop: 0 }}><ImageIcon size={13} /> Gambar kejutan</div>
      <div className="scare-row">
        {SCARES.map(s => (
          <button key={s.id} className={'scare-tile' + (!customImg && pick === s.id ? ' on' : '')} onClick={() => { fx.select(); setCustomImg(null); setPick(s.id); setPrepared(null); }}>
            <span className="scare-emoji" style={{ background: s.bg }}>{s.id === 'grin' ? '😬' : s.id === 'eyes' ? '👁️' : '😈'}</span>
            <span>{s.name}</span>
          </button>
        ))}
        <button className={'scare-tile' + (customImg ? ' on' : '')} onClick={() => { fx.tap(); file.current?.click(); }}>
          <span className="scare-emoji" style={{ background: customImg ? 'transparent' : 'var(--surface3)', overflow: 'hidden', padding: 0 }}>
            {customImg ? <img src={customImg.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Upload size={22} />}
          </span>
          <span>{customImg ? 'Galeri' : 'Dari galeri'}</span>
        </button>
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={onFile} />

      <div className="section-label" style={{ marginTop: 16 }}><Volume2 size={13} /> Suara kejutan (bareng gambar)</div>
      <div className="chips">
        {SCARE_SOUNDS.map(s => (
          <button key={s.id} className={'chip' + (sound === s.id ? ' chip-on' : '')} onClick={() => { fx.select(); setSound(s.id); setPrepared(null); preview(s.id); }}>
            {s.emoji} {s.name}
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 14 }}>
        <button className="btn grow" onClick={prepare} disabled={!!busy}>
          {busy === 'prepare' ? <span className="spinner" /> : prepared === curKey ? <ShieldCheck size={18} color="var(--success)" /> : <Upload size={18} />} {prepared === curKey ? 'Siap di TV' : 'Siapkan'}
        </button>
        <button className="btn danger grow scare-btn" style={{ flex: 1.3 }} onClick={scare} disabled={busy === 'show'}>
          {busy === 'show' ? <span className="spinner" /> : <Zap size={19} />} KAGETKAN!
        </button>
      </div>
      <button className="chip" style={{ marginTop: 8 }} onClick={async () => { fx.back(); await hideImage(); screenview.start(); }}><EyeOff size={15} /> Sembunyikan di TV</button>
      <p className="subtitle" style={{ fontSize: 11.5, margin: '8px 2px 0', lineHeight: 1.5 }}>Tip: tekan <b>Siapkan</b> dulu — gambar & suara dimuat ke TV supaya meledak <b>barengan</b> tanpa loading saat <b>KAGETKAN</b>.</p>

      <div className="section-label"><Volume2 size={13} /> Ngomong lewat TV</div>
      <div className="row" style={{ gap: 8 }}>
        <input className="field grow" value={text} onChange={e => setText(e.target.value)} placeholder="Ketik kalimat untuk diucapkan TV…" onKeyDown={e => e.key === 'Enter' && sayText()} />
        <button className="btn primary" style={{ width: 54, padding: 0 }} onClick={sayText} disabled={!!busy}>{busy === 'tts' ? <span className="spinner" /> : <Send size={19} />}</button>
      </div>
      <button className={'rec-btn' + (rec ? ' on' : '')} onPointerDown={startRec} onPointerUp={stopRec} onPointerLeave={stopRec} onContextMenu={e => e.preventDefault()}>
        {busy === 'voice' ? <><span className="spinner" /> Mengirim ke TV…</> : rec ? <><span className="rec-dot" /> Rekam… lepas untuk putar di TV</> : <><Mic size={20} /> Tahan untuk rekam suaramu</>}
      </button>

      {log && <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.5, color: 'var(--faint)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', userSelect: 'text', WebkitUserSelect: 'text', background: 'var(--surface2)', borderRadius: 10, padding: 8, maxHeight: 120, overflowY: 'auto' }}>{log}
        <button className="chip" style={{ marginTop: 8 }} onClick={() => { fx.tap(); Clipboard.write({ string: log }); useStore.getState().showToast('Detail disalin'); }}>Salin detail</button>
      </div>}
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
      <Prank />
      <Share />
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
        <Smartphone size={34} /><span className="cast-dots"><i /><i /><i /></span><Tv size={40} />
      </div>
      <ol style={{ margin: '0 0 14px', paddingLeft: 18, color: 'var(--muted)', fontSize: 13, lineHeight: 1.65 }}>
        <li>Pastikan HP & TV di Wi-Fi yang sama.</li>
        <li>Ketuk tombol di bawah, lalu pilih nama TV-mu.</li>
        <li>Seluruh layar HP tampil di TV.</li>
      </ol>
      <button className="btn primary block" onClick={open}><Cast size={18} /> Mulai bagikan layar</button>
    </div>
  );
}
