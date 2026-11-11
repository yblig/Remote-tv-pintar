import { useEffect, useRef, useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { useStore } from '../store.js';
import { tv } from '../tv.js';
import { fx } from '../sfx.js';
import { Sheet } from '../components/ui.jsx';
import { TvArt, Waves } from '../components/art.jsx';

function CodeScreen() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Plus Jakarta Sans' }}>
      <div style={{ color: '#fff', fontSize: 10, fontWeight: 700, opacity: .8 }}>Kode penyambungan</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {'A1B2C3'.split('').map((c, i) => (
          <span key={i} style={{ width: 20, height: 26, borderRadius: 5, background: 'rgba(255,255,255,.95)', color: '#151a2c', fontWeight: 800, fontSize: 13, display: 'grid', placeItems: 'center' }}>{c}</span>
        ))}
      </div>
    </div>
  );
}

function PromptScreen() {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontFamily: 'Plus Jakarta Sans' }}>
      <div style={{ background: 'rgba(255,255,255,.96)', color: '#151a2c', borderRadius: 10, padding: '10px 14px', width: 150, textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 800 }}>Izinkan "Remote TV Pintar"?</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <span style={{ flex: 1, borderRadius: 6, background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '5px 0', animation: 'blink 1.2s infinite' }}>Izinkan</span>
          <span style={{ flex: 1, borderRadius: 6, background: '#e4e8f3', fontSize: 10, fontWeight: 700, padding: '5px 0' }}>Tolak</span>
        </div>
      </div>
    </div>
  );
}

function CodeEntry({ pairing }) {
  const [code, setCode] = useState('');
  const [shake, setShake] = useState(false);
  const input = useRef(null);
  useEffect(() => { const t = setTimeout(() => input.current?.focus(), 350); return () => clearTimeout(t); }, []);
  const submit = () => {
    if (code.length !== 6) { fx.error(); setShake(true); setTimeout(() => setShake(false), 400); return; }
    fx.confirm();
    useStore.getState().set({ pairing: null });
    pairing.submit(code);
  };
  return (
    <>
      <div className="center" style={{ marginBottom: 8 }}><TvArt width={190} screen={<CodeScreen />} /></div>
      <h2 style={{ textAlign: 'center' }}>Masukkan kode dari TV</h2>
      <p className="lead" style={{ textAlign: 'center' }}>Kode 6 karakter sedang tampil di layar <b>{pairing.tvName}</b>.</p>
      <div style={{ position: 'relative', animation: shake ? 'shake .4s' : 'none' }} onClick={() => input.current?.focus()}>
        <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              width: 46, height: 58, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800,
              background: 'var(--surface2)', border: '2px solid ' + (i === code.length ? 'var(--accent)' : 'var(--line)'), transition: 'border-color .15s',
            }}>{code[i] || ''}</div>
          ))}
        </div>
        <input ref={input} value={code} maxLength={6} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          onChange={e => { const v = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6); if (v.length > code.length) fx.type(); setCode(v); }}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          style={{ position: 'absolute', inset: 0, opacity: 0 }} />
      </div>
      <div className="row" style={{ gap: 10, marginTop: 22 }}>
        <button className="btn grow" onClick={() => { fx.back(); tv.cancelConnect(); }}><X size={18} /> Batal</button>
        <button className="btn primary grow" onClick={submit}><KeyRound size={18} /> Sambungkan</button>
      </div>
    </>
  );
}

export default function PairingLayer() {
  const status = useStore(s => s.status);
  const pairing = useStore(s => s.pairing);
  const activeTvId = useStore(s => s.activeTvId);
  const tvs = useStore(s => s.tvs);
  const name = tvs.find(t => t.id === activeTvId)?.name || 'TV';
  const open = status === 'connecting';
  return (
    <Sheet open={open} onClose={() => tv.cancelConnect()}>
      {pairing?.kind === 'code' ? <CodeEntry key="code" pairing={pairing} /> : pairing?.kind === 'prompt' ? (
        <div key="prompt" className="page-in">
          <div className="center" style={{ position: 'relative', marginBottom: 6 }}>
            <div style={{ position: 'absolute' }}><Waves size={210} /></div>
            <TvArt width={200} screen={<PromptScreen />} />
          </div>
          <h2 style={{ textAlign: 'center' }}>Izinkan di TV</h2>
          <p className="lead" style={{ textAlign: 'center' }}>Ambil remote TV dan pilih <b>Izinkan / Allow</b> pada pesan yang muncul di <b>{name}</b>. Hanya perlu sekali.</p>
          <button className="btn block" onClick={() => { fx.back(); tv.cancelConnect(); }}><X size={18} /> Batal</button>
        </div>
      ) : (
        <div key="wait" className="center page-in" style={{ flexDirection: 'column', padding: '10px 0 4px' }}>
          <div className="center" style={{ position: 'relative', width: 120, height: 120 }}>
            <div style={{ position: 'absolute' }}><Waves size={120} /></div>
            <span className="spinner" style={{ width: 44, height: 44, borderWidth: 4, color: 'var(--accent)' }} />
          </div>
          <h2 style={{ marginTop: 16 }}>Menghubungkan…</h2>
          <p className="lead" style={{ textAlign: 'center' }}>{name}</p>
          <button className="btn block" onClick={() => { fx.back(); tv.cancelConnect(); }}><X size={18} /> Batal</button>
        </div>
      )}
    </Sheet>
  );
}
