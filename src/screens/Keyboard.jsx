import { useEffect, useRef, useState } from 'react';
import { Mic, ClipboardPaste, Eraser, CornerDownLeft, Star, History, Plus, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Send, Zap } from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';
import { useStore } from '../store.js';
import { tv } from '../tv.js';
import { fx } from '../sfx.js';
import { bridge } from '../bridge.js';
import { Key, Switch } from '../components/ui.jsx';

// Sends edits to the TV one at a time, in order.
let queue = Promise.resolve();
const enqueue = fn => { queue = queue.then(fn).catch(e => tv.fail(e)); return queue; };

export default function Keyboard() {
  const favTexts = useStore(s => s.favTexts);
  const history = useStore(s => s.history);
  const [text, setText] = useState('');
  const [live, setLive] = useState(true);
  const [listening, setListening] = useState(false);
  const sent = useRef('');
  const area = useRef(null);
  const d = tv.driver;
  const can = !!d?.supports.keyboard;

  useEffect(() => { sent.current = ''; }, [d]);

  const pushToTv = (next) => {
    if (!can) return;
    const prev = sent.current;
    sent.current = next;
    enqueue(() => d.typeDiff(prev, next));
  };

  const onChange = (v) => {
    if (v.length !== text.length) fx.type();
    setText(v);
    if (live) pushToTv(v);
  };
  const setAll = (v) => { setText(v); pushToTv(v); };

  const submit = () => {
    if (!can) return;
    if (!live) pushToTv(text);
    fx.confirm();
    enqueue(() => d.enter());
    useStore.getState().addHistory(text);
  };
  const clear = () => { fx.back(); setAll(''); };
  const paste = async () => {
    try {
      const r = await Clipboard.read();
      const v = (r.value || '').trim();
      if (!v) throw new Error('empty');
      fx.tap();
      setAll(text + v);
    } catch { fx.error(); useStore.getState().showToast('Clipboard kosong', 'error'); }
  };
  const voice = async () => {
    fx.tap();
    setListening(true);
    try {
      const { text: said } = await bridge.call('speech', { lang: 'id-ID', prompt: 'Ucapkan teks untuk TV' });
      if (said) { fx.confirm(); setAll((text ? text + ' ' : '') + said); }
    } catch (e) {
      if (!String(e?.message).includes('CANCEL')) { fx.error(); useStore.getState().showToast('Input suara tidak tersedia di HP ini', 'error'); }
    }
    setListening(false);
  };
  const addFav = () => {
    const t = text.trim();
    if (!t) { fx.error(); useStore.getState().showToast('Ketik teks dulu untuk disimpan', 'error'); return; }
    fx.confirm();
    useStore.getState().set({ favTexts: [t, ...favTexts.filter(f => f !== t)].slice(0, 20) });
    useStore.getState().showToast('Disimpan ke teks favorit');
  };
  const removeFav = f => { fx.back(); useStore.getState().set({ favTexts: favTexts.filter(x => x !== f) }); };

  if (!can) {
    return (
      <div className="scroll pad page-in center" style={{ flexDirection: 'column', textAlign: 'center', gap: 10 }}>
        <div className="li-icon" style={{ width: 70, height: 70, borderRadius: 22 }}><Zap size={32} /></div>
        <h3 style={{ margin: '8px 0 0' }}>Keyboard butuh koneksi Wi-Fi</h3>
        <p className="subtitle" style={{ maxWidth: 300 }}>Mode infra merah tidak bisa mengirim teks. Hubungkan Android TV, Google TV, Samsung, LG atau Roku lewat Wi-Fi.</p>
      </div>
    );
  }

  return (
    <div className="scroll pad page-in" style={{ paddingTop: 6, paddingBottom: 20 }}>
      <div className="card" style={{ padding: 14 }}>
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="badge accent">{live ? 'LANGSUNG' : 'KIRIM SEKALIGUS'}</span>
          <span className="grow" />
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Ketik langsung</span>
          <Switch on={live} onChange={v => { setLive(v); if (v) pushToTv(text); }} />
        </div>
        <textarea ref={area} className="field" rows={3} placeholder="Ketik di sini — teks muncul di kolom yang aktif di TV…" value={text}
          onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          style={{ fontSize: 17, minHeight: 98 }} />
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className={'icon-btn' + (listening ? ' listening' : '')} onClick={voice} aria-label="Suara"
            style={listening ? { background: 'var(--danger)', color: '#fff', borderColor: 'transparent', animation: 'blink 1s infinite' } : {}}><Mic size={20} /></button>
          <button className="icon-btn" onClick={paste} aria-label="Tempel"><ClipboardPaste size={20} /></button>
          <button className="icon-btn" onClick={clear} aria-label="Hapus"><Eraser size={20} /></button>
          <button className="icon-btn" onClick={addFav} aria-label="Simpan favorit"><Star size={20} /></button>
          <button className="btn primary grow small" style={{ height: 44 }} onClick={submit}>
            {live ? <CornerDownLeft size={18} /> : <Send size={18} />} {live ? 'Enter' : 'Kirim'}
          </button>
        </div>
      </div>

      <p className="subtitle" style={{ fontSize: 12.5, margin: '10px 4px 0', lineHeight: 1.5 }}>
        Tips: pilih dulu kolom teks di TV (mis. pencarian YouTube), lalu ketik di sini.
      </p>

      <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'center' }}>
        <Key k="left" repeat className="small-key"><ChevronLeft size={22} /></Key>
        <Key k="up" repeat className="small-key"><ChevronUp size={22} /></Key>
        <Key k="ok" className="small-key" style={{ fontWeight: 800 }}>OK</Key>
        <Key k="down" repeat className="small-key"><ChevronDown size={22} /></Key>
        <Key k="right" repeat className="small-key"><ChevronRight size={22} /></Key>
      </div>

      <div className="section-label row"><Star size={13} /> Teks favorit</div>
      <div className="chips">
        <button className="chip" onClick={addFav} style={{ color: 'var(--accent)' }}><Plus size={15} /> Simpan teks ini</button>
        {favTexts.map(f => (
          <span key={f} className="chip" style={{ paddingRight: 6 }}>
            <button onClick={() => { fx.tap(); setAll(text + f); }}>{f}</button>
            <button onClick={() => removeFav(f)} style={{ color: 'var(--faint)', display: 'grid', placeItems: 'center', width: 24, height: 24 }}><X size={14} /></button>
          </span>
        ))}
      </div>

      <div className="section-label row"><History size={13} /> Riwayat ketikan</div>
      {history.length === 0 && <p className="subtitle" style={{ fontSize: 13, margin: '0 4px' }}>Teks yang kamu kirim dengan Enter akan muncul di sini.</p>}
      {history.slice(0, 8).map(h => (
        <button key={h} className="list-item" style={{ padding: '10px 14px' }} onClick={() => { fx.tap(); setAll(h); }}>
          <History size={17} color="var(--faint)" />
          <span className="grow li-title" style={{ fontWeight: 600, fontSize: 14.5 }}>{h}</span>
          <span className="badge">Pakai</span>
        </button>
      ))}
      {history.length > 0 && (
        <button className="chip" style={{ margin: '12px auto 0', display: 'flex' }} onClick={() => { fx.back(); useStore.getState().set({ history: [] }); }}>Hapus riwayat</button>
      )}
    </div>
  );
}
