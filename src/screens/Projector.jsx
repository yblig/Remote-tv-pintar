import { useState } from 'react';
import {
  Power, ArrowLeft, Home, Menu, Plus, Minus, VolumeX, Play, Rewind, FastForward, Square,
  MonitorPlay, Focus, Crop, SlidersHorizontal, Sun, Maximize, Info, ChevronRight, RotateCw, Projector as ProjectorIcon,
} from 'lucide-react';
import { tv } from '../tv.js';
import { fx } from '../sfx.js';
import { useStore } from '../store.js';
import { Key, Sheet } from '../components/ui.jsx';
import { Dpad } from './Remote.jsx';

// Opens the on-screen menu on the Freestyle, then tells the user where to go. The
// projector's focus/keystone/screen-size live in that menu — we can't drive the exact
// path reliably across firmware, so we open it and guide rather than fake a macro.
function openMenu(tipKey) {
  tv.press('settings'); // KEY_MENU on Tizen
}

const GUIDES = {
  focus: {
    icon: Focus, title: 'Fokus & Keystone',
    lead: 'The Freestyle (LS3) fokus & keystone otomatis setiap kali kamu menggeser atau memiringkannya — coba geser sedikit lalu diamkan.',
    steps: ['Kalau mau atur manual, tekan "Buka menu proyektor" di bawah.', 'Masuk ke Settings (Pengaturan) → General & Privacy → (atau menu Gambar).', 'Pilih Keystone untuk meluruskan bentuk, atau Focus untuk ketajaman.'],
  },
  size: {
    icon: Crop, title: 'Ukuran & posisi layar',
    lead: 'Atur besar gambar dengan menggeser jarak proyektor ke dinding; sisanya lewat menu.',
    steps: ['Tekan "Buka menu proyektor".', 'Settings → General & Privacy → Screen Adjustment / Keystone.', 'Gunakan D-pad untuk menyetel sudut-sudutnya.'],
  },
  picture: {
    icon: Sun, title: 'Mode gambar & kecerahan',
    lead: 'Pilih mode gambar (Dynamic/Standard/Movie) dan atur kecerahan di menu gambar.',
    steps: ['Tekan "Buka menu proyektor".', 'Settings → Picture → Picture Mode / Brightness.', 'Untuk ruang gelap pilih Movie; ruang terang pilih Dynamic.'],
  },
};

export default function Projector() {
  const [guide, setGuide] = useState(null);
  const vol = useStore(s => s.volume);
  const quick = [
    { k: 'focus', icon: Focus, label: 'Fokus/Keystone' },
    { k: 'size', icon: Crop, label: 'Ukuran layar' },
    { k: 'picture', icon: Sun, label: 'Mode gambar' },
  ];
  return (
    <div className="scroll page-in" style={{ padding: '6px 18px 18px' }}>
      <div className="proj-banner">
        <ProjectorIcon size={20} />
        <div className="grow"><b style={{ fontSize: 14 }}>Mode Proyektor</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>Samsung Freestyle / LS3</div></div>
      </div>

      <div className="row" style={{ gap: 10, marginBottom: 14 }}>
        <Key k="input" label="Sumber" className="proj-top"><MonitorPlay size={19} /><span className="lbl">Sumber</span></Key>
        <Key k="settings" label="Menu" className="proj-top"><Menu size={19} /><span className="lbl">Menu</span></Key>
        <Key k="home" label="Beranda" className="proj-top"><Home size={19} /><span className="lbl">Beranda</span></Key>
      </div>

      <div className="center" style={{ minHeight: 268 }}><Dpad /></div>

      <div className="row" style={{ gap: 12, marginTop: 16 }}>
        <Key k="back" className="grow"><ArrowLeft size={22} /><span className="lbl">Kembali</span></Key>
        <Key k="playpause" className="grow"><Play size={22} /><span className="lbl">Putar/Jeda</span></Key>
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
          <div className="row" style={{ gap: 12, flex: 1 }}>
            <Key k="rew" repeat className="grow"><Rewind size={20} /></Key>
            <Key k="stop" className="grow"><Square size={17} /></Key>
            <Key k="ff" repeat className="grow"><FastForward size={20} /></Key>
          </div>
        </div>
      </div>

      <div className="section-label row" style={{ marginTop: 20 }}><SlidersHorizontal size={13} /> Kontrol proyektor</div>
      {quick.map(q => (
        <button key={q.k} className="list-item" onClick={() => { fx.tap(); setGuide(q.k); }}>
          <div className="li-icon"><q.icon size={21} /></div>
          <div className="grow"><div className="li-title">{q.label}</div><div className="li-sub">{GUIDES[q.k].lead.slice(0, 46)}…</div></div>
          <ChevronRight size={20} color="var(--faint)" />
        </button>
      ))}

      <div className="row" style={{ gap: 10, marginTop: 14, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5, alignItems: 'flex-start' }}>
        <Info size={16} style={{ flex: 'none', marginTop: 2 }} />
        <span>Fokus & keystone otomatis bekerja saat proyektor digeser. Keyboard & peluncur aplikasi ada di tab Keyboard dan Aplikasi.</span>
      </div>

      <Sheet open={!!guide} onClose={() => setGuide(null)}>
        {guide && (() => { const g = GUIDES[guide]; const I = g.icon; return (
          <>
            <div className="row" style={{ gap: 12, marginBottom: 8 }}>
              <div className="li-icon" style={{ background: 'color-mix(in srgb, var(--accent) 16%, var(--surface2))' }}><I size={22} /></div>
              <h2 style={{ margin: 0 }}>{g.title}</h2>
            </div>
            <p className="lead">{g.lead}</p>
            <ol style={{ margin: '0 0 16px', paddingLeft: 20, color: 'var(--text)', fontSize: 14, lineHeight: 1.7 }}>
              {g.steps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
            </ol>
            <button className="btn primary block" onClick={() => { fx.confirm(); openMenu(guide); useStore.getState().showToast('Menu dibuka di proyektor'); setGuide(null); }}>
              <Menu size={18} /> Buka menu proyektor
            </button>
          </>
        ); })()}
      </Sheet>
    </div>
  );
}
