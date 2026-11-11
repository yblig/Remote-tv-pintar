import { useEffect, useState } from 'react';
import {
  Workflow, Timer, Hash, Power, Settings2, Sparkles, Repeat, ChevronRight, Plus, Trash2, Play, X, Moon, Sun, MonitorSmartphone,
  Volume2, Vibrate, Smartphone, RefreshCcw, Film, VolumeX, Volume1, Zap, Check, LogOut,
} from 'lucide-react';
import { useStore } from '../store.js';
import { tv, TYPE_LABEL } from '../tv.js';
import { fx } from '../sfx.js';
import { bridge } from '../bridge.js';
import { Sheet, Switch } from '../components/ui.jsx';
import { APPS } from './Apps.jsx';
import { FEATURES } from '../features.js';
import { SCARES, svgToJpeg } from '../scare.js';
import { prankSupported, prepareImage, showImage, hideImage, playSound, speak, SCARE_SOUNDS } from '../prank.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const MACRO_ICONS = { film: Film, 'volume-x': VolumeX, 'volume-1': Volume1, zap: Zap };
const KEY_NAMES = {
  power: 'Power', home: 'Beranda', back: 'Kembali', ok: 'OK', up: '↑', down: '↓', left: '←', right: '→', volup: 'Vol +', voldown: 'Vol −',
  mute: 'Senyap', chup: 'CH +', chdown: 'CH −', input: 'Input', playpause: 'Putar/Jeda', menu: 'Menu',
};
const soundName = id => SCARE_SOUNDS.find(s => s.id === id)?.name || id;

function stepLabel(s) {
  if (s.key) return KEY_NAMES[s.key] || s.key;
  if (s.wait) return 'Tunggu ' + s.wait / 1000 + ' dtk';
  if (s.app) return '▶ ' + (APPS[s.app]?.name || s.app);
  if (s.scare) return '😱 Kejutan' + (s.sound && s.sound !== 'none' ? ' + ' + soundName(s.sound) : '');
  if (s.sound) return '🔊 ' + soundName(s.sound);
  if (s.speak != null) return '🗣️ "' + String(s.speak).slice(0, 14) + '"';
  if (s.hideScare) return '🙈 Sembunyikan';
  return '?';
}

export async function runMacro(m) {
  const d = tv.driver;
  if (!d) return;
  fx.confirm();
  useStore.getState().showToast('Menjalankan "' + m.name + '"');
  const canPrank = prankSupported();
  for (const s of m.steps) {
    if (tv.driver !== d) return;
    if (s.wait) await sleep(s.wait);
    else if (s.key) { await tv.press(s.key, { silent: true }); await sleep(350); }
    else if (s.app && d.launch) { await d.launch(s.app).catch(() => {}); await sleep(500); }
    else if (s.scare) {
      if (!canPrank) { useStore.getState().showToast('Langkah kejutan butuh Android TV', 'error'); continue; }
      const svg = SCARES.find(x => x.id === (s.img || 'grin'))?.svg || SCARES[0].svg;
      const p = await prepareImage(await svgToJpeg(svg), s.sound || 'none');
      if (p.ok) await showImage(s.sound && s.sound !== 'none');
      else { useStore.getState().showToast(p.needSpace ? 'Penyimpanan TV penuh' : 'Gagal menampilkan', 'error'); }
      await sleep(400);
    }
    else if (s.sound) { if (canPrank) await playSound(s.sound); await sleep(300); }
    else if (s.speak != null) { if (canPrank) await speak(String(s.speak)); await sleep(400); }
    else if (s.hideScare) { if (canPrank) await hideImage(); await sleep(200); }
  }
}

function Row({ icon: I, title, sub, onClick, right }) {
  return (
    <button className="list-item" onClick={() => { fx.tap(); onClick(); }}>
      <div className="li-icon"><I size={22} /></div>
      <div className="grow"><div className="li-title">{title}</div>{sub && <div className="li-sub">{sub}</div>}</div>
      {right || <ChevronRight size={20} color="var(--faint)" />}
    </button>
  );
}

export default function More() {
  const [open, setOpen] = useState(null);
  const sleepEnd = useStore(s => s.sleepEnd);
  const [, tick] = useState(0);
  useEffect(() => { if (!sleepEnd) return; const t = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t); }, [sleepEnd]);
  const t = useStore.getState().activeTv();
  const left = sleepEnd ? Math.max(0, sleepEnd - Date.now()) : 0;
  const close = () => setOpen(null);
  return (
    <div className="scroll pad page-in" style={{ paddingTop: 6, paddingBottom: 20 }}>
      <div className="section-label" style={{ marginTop: 6 }}>Otomasi</div>
      <Row icon={Workflow} title="Makro" sub="Jalankan beberapa tombol sekaligus" onClick={() => setOpen('macro')} />
      <Row icon={Timer} title="Timer tidur" sub={sleepEnd ? `TV mati dalam ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}` : 'Matikan TV otomatis'} onClick={() => setOpen('sleep')}
        right={sleepEnd ? <span className="badge accent">Aktif</span> : null} />
      <Row icon={Hash} title="Channel favorit" sub="Pindah channel sekali ketuk" onClick={() => setOpen('channels')} />
      <div className="section-label">TV</div>
      <Row icon={Power} title="Nyalakan via Wi-Fi" sub="Wake-on-LAN untuk TV yang mendukung" onClick={() => setOpen('wol')} />
      <Row icon={Repeat} title="Ganti TV" sub={t ? `${t.name} · ${TYPE_LABEL[t.type]}` : ''} onClick={() => { fx.back(); tv.disconnect(); }} right={<LogOut size={19} color="var(--faint)" />} />
      <div className="section-label">Aplikasi</div>
      <Row icon={Settings2} title="Pengaturan" sub="Tema, suara, getar, tombol volume HP" onClick={() => setOpen('settings')} />
      <Row icon={Sparkles} title={`Semua fitur (${FEATURES.length})`} sub="Lihat apa saja yang bisa dilakukan" onClick={() => setOpen('features')} />
      <p className="subtitle" style={{ textAlign: 'center', fontSize: 12, marginTop: 22 }}>Remote TV Pintar v1.0</p>

      <Sheet open={open === 'macro'} onClose={close}><Macros onDone={close} /></Sheet>
      <Sheet open={open === 'sleep'} onClose={close}><SleepTimer onDone={close} /></Sheet>
      <Sheet open={open === 'channels'} onClose={close}><Channels onDone={close} /></Sheet>
      <Sheet open={open === 'wol'} onClose={close}><Wol /></Sheet>
      <Sheet open={open === 'settings'} onClose={close}><Settings /></Sheet>
      <Sheet open={open === 'features'} onClose={close}><Features /></Sheet>
    </div>
  );
}

function Macros({ onDone }) {
  const macros = useStore(s => s.macros);
  const [edit, setEdit] = useState(null);
  const d = tv.driver;
  if (edit) {
    const add = s => { fx.tap(); setEdit({ ...edit, steps: [...edit.steps, s] }); };
    const save = () => {
      if (!edit.name.trim() || !edit.steps.length) { fx.error(); return; }
      fx.confirm();
      useStore.getState().set({ macros: [...macros.filter(m => m.id !== edit.id), { ...edit, name: edit.name.trim() }] });
      setEdit(null);
    };
    return (
      <>
        <h2>{macros.some(m => m.id === edit.id) ? 'Ubah makro' : 'Makro baru'}</h2>
        <input className="field" placeholder="Nama makro, mis. Nonton Malam" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} style={{ marginTop: 8 }} />
        <div className="section-label">Langkah ({edit.steps.length})</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 36 }}>
          {edit.steps.length === 0 && <span className="subtitle" style={{ fontSize: 13, margin: 0 }}>Tambah tombol dari daftar di bawah.</span>}
          {edit.steps.map((s, i) => (
            <span key={i} className="chip" style={{ background: 'color-mix(in srgb, var(--accent) 16%, var(--surface2))' }}>
              {i + 1}. {stepLabel(s)}
              <button onClick={() => { fx.back(); setEdit({ ...edit, steps: edit.steps.filter((_, j) => j !== i) }); }} style={{ display: 'grid', placeItems: 'center' }}><X size={13} /></button>
            </span>
          ))}
        </div>
        <div className="section-label">Tambah tombol</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.keys(KEY_NAMES).filter(k => tv.has(k)).map(k => <button key={k} className="chip" onClick={() => add({ key: k })}>{KEY_NAMES[k]}</button>)}
          <button className="chip" onClick={() => add({ wait: 1000 })}>⏱ Tunggu 1 dtk</button>
          {(d?.apps || []).filter(a => APPS[a]).map(a => <button key={a} className="chip" onClick={() => add({ app: a })}>▶ {APPS[a].name}</button>)}
        </div>
        {prankSupported() && (
          <>
            <div className="section-label">Jahil (gambar + suara)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SCARES.map(sc => (
                <button key={sc.id} className="chip" onClick={() => add({ scare: true, img: sc.id, sound: 'jerit' })}>😱 {sc.name} + jerit</button>
              ))}
              {SCARE_SOUNDS.filter(s => s.id !== 'none').map(s => (
                <button key={s.id} className="chip" onClick={() => add({ sound: s.id })}>{s.emoji} {s.name}</button>
              ))}
              <button className="chip" onClick={() => { const t = prompt('Teks untuk diucapkan TV:'); if (t) add({ speak: t }); }}>🗣️ Ucapkan…</button>
              <button className="chip" onClick={() => add({ hideScare: true })}>🙈 Sembunyikan</button>
            </div>
          </>
        )}
        <div className="row" style={{ gap: 10, marginTop: 20 }}>
          <button className="btn grow" onClick={() => { fx.back(); setEdit(null); }}>Batal</button>
          <button className="btn primary grow" onClick={save}><Check size={18} /> Simpan</button>
        </div>
      </>
    );
  }
  return (
    <>
      <h2>Makro</h2>
      <p className="lead">Satu ketukan untuk menjalankan beberapa perintah berurutan.</p>
      {macros.map(m => {
        const I = MACRO_ICONS[m.icon] || Zap;
        return (
          <div key={m.id} className="list-item" style={{ padding: 10, paddingLeft: 12 }}>
            <button className="row grow" style={{ gap: 12, textAlign: 'left' }} onClick={() => { onDone(); runMacro(m); }}>
              <div className="li-icon" style={{ width: 42, height: 42 }}><I size={20} /></div>
              <div className="grow"><div className="li-title">{m.name}</div><div className="li-sub">{m.steps.length} langkah</div></div>
              <Play size={18} color="var(--accent)" />
            </button>
            <button className="icon-btn" style={{ marginLeft: 6 }} onClick={() => { fx.tap(); setEdit(m); }}><Settings2 size={17} /></button>
            <button className="icon-btn" style={{ marginLeft: 6 }} onClick={() => { fx.back(); useStore.getState().set({ macros: macros.filter(x => x.id !== m.id) }); }}><Trash2 size={17} /></button>
          </div>
        );
      })}
      <button className="btn primary block" style={{ marginTop: 14 }} onClick={() => { fx.tap(); setEdit({ id: 'm' + Date.now(), name: '', icon: 'zap', steps: [] }); }}><Plus size={18} /> Buat makro</button>
    </>
  );
}

function SleepTimer({ onDone }) {
  const sleepEnd = useStore(s => s.sleepEnd);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t); }, []);
  const set = min => { fx.confirm(); useStore.getState().set({ sleepEnd: Date.now() + min * 60000, sleepTotal: min * 60000 }); useStore.getState().showToast(`TV akan mati dalam ${min} menit`); onDone(); };
  if (sleepEnd) {
    const left = Math.max(0, sleepEnd - Date.now());
    const total = useStore.getState().sleepTotal || left;
    const pct = left / total;
    const R = 70, C = 2 * Math.PI * R;
    return (
      <>
        <h2>Timer tidur</h2>
        <div className="center" style={{ position: 'relative', margin: '14px 0' }}>
          <svg width="170" height="170" viewBox="0 0 170 170">
            <circle cx="85" cy="85" r={R} fill="none" stroke="var(--surface3)" strokeWidth="10" />
            <circle cx="85" cy="85" r={R} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 85 85)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <div style={{ position: 'absolute', textAlign: 'center' }}>
            <div style={{ fontSize: 34, fontWeight: 800 }}>{Math.floor(left / 60000)}:{String(Math.floor(left / 1000) % 60).padStart(2, '0')}</div>
            <div className="li-sub">sampai TV mati</div>
          </div>
        </div>
        <p className="lead" style={{ textAlign: 'center' }}>Biarkan aplikasi ini tetap terbuka agar timer berjalan.</p>
        <button className="btn danger block" onClick={() => { fx.back(); useStore.getState().set({ sleepEnd: null }); }}><X size={18} /> Batalkan timer</button>
      </>
    );
  }
  return (
    <>
      <h2>Timer tidur</h2>
      <p className="lead">TV dimatikan otomatis setelah waktu habis — pas untuk menonton sebelum tidur.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[15, 30, 45, 60, 90, 120].map(m => (
          <button key={m} className="btn" style={{ height: 64, flexDirection: 'column', gap: 0 }} onClick={() => set(m)}>
            <b style={{ fontSize: 20 }}>{m}</b><span style={{ fontSize: 11, color: 'var(--muted)' }}>menit</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Channels({ onDone }) {
  const channels = useStore(s => s.channels);
  const [name, setName] = useState('');
  const [num, setNum] = useState('');
  const go = async c => {
    onDone();
    fx.confirm();
    useStore.getState().showToast('Pindah ke ' + c.name + ' (' + c.number + ')');
    for (const ch of c.number) { await tv.press('d' + ch, { silent: true }); await sleep(320); }
  };
  const add = () => {
    if (!name.trim() || !/^\d{1,4}$/.test(num)) { fx.error(); return; }
    fx.confirm();
    useStore.getState().set({ channels: [...channels, { id: 'c' + Date.now(), name: name.trim(), number: num }] });
    setName(''); setNum('');
  };
  return (
    <>
      <h2>Channel favorit</h2>
      <p className="lead">Ketuk untuk langsung pindah ke nomor channel.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {channels.map(c => (
          <div key={c.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'none' }}>
            <button className="grow" style={{ textAlign: 'left' }} onClick={() => go(c)}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{c.number}</div>
              <div className="li-title" style={{ fontSize: 14 }}>{c.name}</div>
            </button>
            <button onClick={() => { fx.back(); useStore.getState().set({ channels: channels.filter(x => x.id !== c.id) }); }} style={{ color: 'var(--faint)' }}><Trash2 size={17} /></button>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 14 }}>
        <input className="field grow" placeholder="Nama, mis. Trans7" value={name} onChange={e => setName(e.target.value)} />
        <input className="field" style={{ width: 84 }} inputMode="numeric" placeholder="No." value={num} onChange={e => setNum(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <button className="btn primary" style={{ width: 52, padding: 0 }} onClick={add}><Plus size={20} /></button>
      </div>
    </>
  );
}

function Wol() {
  const t = useStore.getState().activeTv();
  const [mac, setMac] = useState(t?.mac || '');
  const send = async () => {
    try {
      await bridge.call('wol', { mac, host: t?.host });
      fx.confirm();
      if (t) useStore.getState().upsertTv({ id: t.id, mac });
      useStore.getState().showToast('Sinyal menyalakan TV terkirim');
    } catch { fx.error(); useStore.getState().showToast('Alamat MAC tidak valid', 'error'); }
  };
  return (
    <>
      <h2>Nyalakan via Wi-Fi</h2>
      <p className="lead">Kirim "Wake-on-LAN" untuk menyalakan TV dari mode siaga. Aktifkan juga opsi <b>Nyalakan dengan Wi-Fi / Mobile</b> di setelan TV.</p>
      <input className="field" placeholder="Alamat MAC TV, mis. A4:5E:60:12:34:56" value={mac} onChange={e => setMac(e.target.value)} autoCapitalize="characters" />
      <p className="subtitle" style={{ fontSize: 12.5 }}>{t?.mac ? 'MAC terdeteksi otomatis dari TV.' : 'Lihat di TV: Setelan › Jaringan › Info Jaringan.'}</p>
      <button className="btn primary block" style={{ marginTop: 8 }} onClick={send}><Power size={18} /> Nyalakan TV</button>
    </>
  );
}

const ACCENTS = ['#6c7bff', '#3dd6c6', '#ff7a59', '#f5b83d', '#ff5fa2', '#8bd450'];

function Settings() {
  const s = useStore();
  const set = p => useStore.getState().set(p);
  const Toggle = ({ icon: I, title, sub, k }) => (
    <div className="list-item" style={{ padding: '12px 14px' }}>
      <div className="li-icon" style={{ width: 40, height: 40, borderRadius: 13 }}><I size={19} /></div>
      <div className="grow"><div className="li-title" style={{ fontSize: 14.5 }}>{title}</div>{sub && <div className="li-sub">{sub}</div>}</div>
      <Switch on={s[k]} onChange={v => set({ [k]: v })} />
    </div>
  );
  return (
    <>
      <h2>Pengaturan</h2>
      <div className="section-label" style={{ marginTop: 10 }}>Tema</div>
      <div className="seg" style={{ height: 50 }}>
        {[['dark', 'Gelap', Moon], ['light', 'Terang', Sun], ['system', 'Sistem', MonitorSmartphone]].map(([id, l, I]) => (
          <button key={id} className={'seg-btn' + (s.theme === id ? ' on' : '')} onClick={() => { fx.select(); set({ theme: id }); }}>
            <span className="row center" style={{ gap: 6 }}><I size={15} />{l}</span>
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 12, marginTop: 14, justifyContent: 'space-between' }}>
        {ACCENTS.map(c => (
          <button key={c} onClick={() => { fx.select(); set({ accent: c }); }} aria-label={c}
            style={{ width: 42, height: 42, borderRadius: '50%', background: c, boxShadow: s.accent === c ? `0 0 0 3px var(--bg2), 0 0 0 5px ${c}` : 'none', display: 'grid', placeItems: 'center', color: '#fff', transition: 'box-shadow .2s' }}>
            {s.accent === c && <Check size={20} strokeWidth={3} />}
          </button>
        ))}
      </div>
      <div className="section-label">Umpan balik</div>
      <Toggle icon={Volume2} title="Suara klik" k="sound" />
      <Toggle icon={Vibrate} title="Getar" k="haptics" />
      <div className="section-label">Kontrol</div>
      <Toggle icon={Smartphone} title="Tombol volume HP" sub="Atur volume TV dengan tombol samping HP" k="volumeKeys" />
      <Toggle icon={VolumeX} title="Kocok HP untuk senyap" sub="Goyangkan HP 2× dengan cepat" k="shake" />
      <Toggle icon={RefreshCcw} title="Sambung ulang otomatis" sub="Ke TV terakhir saat aplikasi dibuka" k="autoReconnect" />
    </>
  );
}

function Features() {
  return (
    <>
      <h2>Semua fitur</h2>
      <p className="lead">{FEATURES.length} fitur di Remote TV Pintar.</p>
      {FEATURES.map((f, i) => (
        <div key={f.t} className="row" style={{ gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
          <span className="badge accent" style={{ minWidth: 30, textAlign: 'center' }}>{i + 1}</span>
          <div className="grow"><div style={{ fontWeight: 700, fontSize: 14.5 }}>{f.t}</div><div className="li-sub" style={{ whiteSpace: 'normal' }}>{f.d}</div></div>
        </div>
      ))}
    </>
  );
}
