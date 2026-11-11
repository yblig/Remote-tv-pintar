import { useState } from 'react';
import { Play, Clapperboard, Film, Sparkles, Music2, ShoppingBag, Tv2, Search, Link2, Send, Popcorn } from 'lucide-react';
import { useStore } from '../store.js';
import { tv } from '../tv.js';
import { fx } from '../sfx.js';

export const APPS = {
  youtube: { name: 'YouTube', icon: Play, c1: '#ff4b4b', c2: '#b8141f' },
  netflix: { name: 'Netflix', icon: Clapperboard, c1: '#3a0b10', c2: '#0b0b0d', fg: '#ff3b47' },
  vidio: { name: 'Vidio', icon: Tv2, c1: '#ff5c7a', c2: '#d6153f' },
  disney: { name: 'Disney+', icon: Sparkles, c1: '#2c63d8', c2: '#0b1a4a' },
  prime: { name: 'Prime Video', icon: Film, c1: '#2aa6e0', c2: '#0f3d6a' },
  spotify: { name: 'Spotify', icon: Music2, c1: '#33d36b', c2: '#11823b' },
  wetv: { name: 'WeTV', icon: Popcorn, c1: '#ff9a3c', c2: '#e2541b' },
  playstore: { name: 'Play Store', icon: ShoppingBag, c1: '#4ec3ff', c2: '#2d6fe0' },
};

export default function Apps() {
  const d = tv.driver;
  const [q, setQ] = useState('');
  const [url, setUrl] = useState('');
  if (!d?.supports.apps) {
    return (
      <div className="scroll pad page-in center" style={{ flexDirection: 'column', textAlign: 'center', gap: 10 }}>
        <div className="li-icon" style={{ width: 70, height: 70, borderRadius: 22 }}><Tv2 size={32} /></div>
        <h3 style={{ margin: '8px 0 0' }}>Butuh koneksi Wi-Fi</h3>
        <p className="subtitle" style={{ maxWidth: 300 }}>Membuka aplikasi di TV hanya bisa untuk Smart TV yang terhubung lewat Wi-Fi.</p>
      </div>
    );
  }
  const list = d.apps.filter(a => APPS[a]);
  const search = () => {
    if (!q.trim()) { fx.error(); return; }
    tv.run(x => x.youtubeSearch(q.trim()), 'Mencari "' + q.trim() + '" di YouTube TV');
    useStore.getState().addHistory(q.trim());
  };
  const sendUrl = () => {
    let u = url.trim();
    if (!u) { fx.error(); return; }
    if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
    tv.run(x => x.openUrl(u), 'Link dikirim ke TV');
  };
  return (
    <div className="scroll pad page-in" style={{ paddingTop: 6, paddingBottom: 20 }}>
      <div className="app-grid">
        {list.map((id, i) => {
          const a = APPS[id], I = a.icon;
          return (
            <button key={id} className="app-tile pop-in" style={{ animationDelay: i * 0.04 + 's' }}
              onClick={() => { fx.press('ok'); tv.run(x => x.launch(id), 'Membuka ' + a.name); }}>
              <span className="app-ico" style={{ background: `linear-gradient(150deg, ${a.c1}, ${a.c2})`, color: a.fg || '#fff' }}><I size={28} strokeWidth={2.4} fill={id === 'youtube' ? '#fff' : 'none'} /></span>
              <span className="app-name">{a.name}</span>
            </button>
          );
        })}
      </div>

      {d.youtubeSearch && (
        <>
          <div className="section-label">Cari di YouTube TV</div>
          <div className="row" style={{ gap: 8 }}>
            <div className="grow" style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: 14, top: 17, color: 'var(--faint)' }} />
              <input className="field" style={{ paddingLeft: 42 }} placeholder="Judul video, lagu, channel…" value={q}
                onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
            </div>
            <button className="btn primary" style={{ width: 56, padding: 0 }} onClick={search}><Search size={20} /></button>
          </div>
        </>
      )}

      {d.supports.url && (
        <>
          <div className="section-label">Kirim link ke TV</div>
          <div className="row" style={{ gap: 8 }}>
            <div className="grow" style={{ position: 'relative' }}>
              <Link2 size={18} style={{ position: 'absolute', left: 14, top: 17, color: 'var(--faint)' }} />
              <input className="field" style={{ paddingLeft: 42 }} inputMode="url" placeholder="youtube.com/watch?v=… atau situs" value={url}
                onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendUrl()} />
            </div>
            <button className="btn primary" style={{ width: 56, padding: 0 }} onClick={sendUrl}><Send size={19} /></button>
          </div>
          <p className="subtitle" style={{ fontSize: 12.5, margin: '8px 4px 0' }}>Link YouTube terbuka di aplikasi YouTube TV; link lain di browser TV.</p>
        </>
      )}
    </div>
  );
}
