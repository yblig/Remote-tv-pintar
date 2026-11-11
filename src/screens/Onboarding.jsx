import { useState } from 'react';
import { ArrowRight, Keyboard, Wifi, Radio, Sparkles } from 'lucide-react';
import { useStore } from '../store.js';
import { fx } from '../sfx.js';
import { TvArt, PhoneArt, MiniRemote } from '../components/art.jsx';

const SLIDES = [
  {
    title: 'HP-mu jadi remote TV',
    text: 'Arah, OK, volume, channel, power — semua dari HP, lengkap dengan getar & suara klik.',
    art: () => (
      <div className="row" style={{ gap: 0, alignItems: 'flex-end' }}>
        <TvArt width={210} screen={<ScreenGrid />} />
        <div style={{ marginLeft: -40, animation: 'float 3s ease-in-out infinite' }}><PhoneArt width={84}><MiniRemote /></PhoneArt></div>
      </div>
    ),
  },
  {
    title: 'Ketik langsung ke TV',
    text: 'Cari film, isi login, atau ketik pakai suara. Teksnya langsung muncul di layar TV.',
    art: () => <TvArt width={250} screen={<TypingScreen />} />,
  },
  {
    title: 'Hubungkan dulu, lalu kontrol',
    text: 'Android TV, Google TV, Samsung, LG, Roku lewat Wi-Fi — atau TV biasa lewat infra merah.',
    art: () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, width: 260 }}>
        {[[Wifi, 'Wi-Fi'], [Radio, 'Infra merah'], [Keyboard, 'Keyboard'], [Sparkles, '30 fitur']].map(([I, t], i) => (
          <div key={t} className="card pop-in center" style={{ height: 96, flexDirection: 'column', gap: 8, animationDelay: i * 0.08 + 's' }}>
            <div className="li-icon"><I size={22} /></div>
            <b style={{ fontSize: 13 }}>{t}</b>
          </div>
        ))}
      </div>
    ),
  },
];

function ScreenGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, padding: 12, height: '100%' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ borderRadius: 6, background: i === 1 ? 'var(--accent)' : 'rgba(255,255,255,.12)', outline: i === 1 ? '2px solid #fff' : 'none' }} />
      ))}
    </div>
  );
}

function TypingScreen() {
  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'Plus Jakarta Sans' }}>
      <div style={{ background: 'rgba(255,255,255,.95)', borderRadius: 99, height: 26, display: 'flex', alignItems: 'center', padding: '0 12px', color: '#151a2c', fontSize: 12, fontWeight: 700 }}>
        🔍 film komedi<span style={{ width: 2, height: 14, background: 'var(--accent)', marginLeft: 2, animation: 'blink 1s infinite' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, flex: 1 }}>
        {[0, 1, 2, 3, 4, 5].map(i => <div key={i} style={{ borderRadius: 6, background: 'rgba(255,255,255,.12)' }} />)}
      </div>
    </div>
  );
}

export default function Onboarding() {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const next = () => {
    if (i < SLIDES.length - 1) { fx.select(); setI(i + 1); }
    else { fx.confirm(); useStore.getState().set({ onboarded: true }); }
  };
  return (
    <div className="screen" style={{ paddingTop: 'calc(var(--safe-top) + 12px)', paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}>
      <div className="row pad" style={{ justifyContent: 'flex-end', height: 44 }}>
        {i < SLIDES.length - 1 && <button className="chip" onClick={() => { fx.tap(); setI(SLIDES.length - 1); }}>Lewati</button>}
      </div>
      <div key={i} className="grow center page-in" style={{ flexDirection: 'column', padding: '0 24px' }}>
        <div className="center" style={{ minHeight: 230 }}>{s.art()}</div>
        <h1 className="title" style={{ fontSize: 28, textAlign: 'center', marginTop: 34 }}>{s.title}</h1>
        <p className="subtitle" style={{ textAlign: 'center', fontSize: 15.5, lineHeight: 1.55, maxWidth: 330 }}>{s.text}</p>
      </div>
      <div className="pad">
        <div className="row center" style={{ gap: 8, marginBottom: 22 }}>
          {SLIDES.map((_, j) => (
            <span key={j} style={{ height: 8, width: j === i ? 26 : 8, borderRadius: 9, background: j === i ? 'var(--accent)' : 'var(--surface3)', transition: 'all .3s' }} />
          ))}
        </div>
        <button className="btn primary block" onClick={next}>
          {i < SLIDES.length - 1 ? 'Lanjut' : 'Hubungkan TV'} <ArrowRight size={19} />
        </button>
      </div>
    </div>
  );
}
