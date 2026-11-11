import { useEffect, useRef, useState } from 'react';
import { Search, Plus, Radio, ChevronRight, Trash2, Power, Wifi, Info, Zap, Check, X, RotateCcw, Projector } from 'lucide-react';
import { useStore } from '../store.js';
import { bridge } from '../bridge.js';
import { tv, TYPE_LABEL, tvLabel } from '../tv.js';
import { fx } from '../sfx.js';
import { Sheet, TypeIcon, Switch } from '../components/ui.jsx';
import { IR_BRANDS, irSend } from '../protocols/ir.js';

const isProjectorName = n => /freestyle|projector|proyektor|lsp|the premiere/i.test(n || '');

let autoTried = false;

function Radar({ scanning, count }) {
  return (
    <div className="center" style={{ position: 'relative', width: 190, height: 190, margin: '6px auto 0' }}>
      {[0.42, 0.7, 1].map(s => (
        <span key={s} style={{ position: 'absolute', width: 190 * s, height: 190 * s, borderRadius: '50%', border: '1.5px solid color-mix(in srgb, var(--accent) 28%, transparent)' }} />
      ))}
      {scanning && (
        <>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', animation: 'sweep 1.6s linear infinite',
            background: 'conic-gradient(from 0deg, transparent 0deg, transparent 290deg, color-mix(in srgb, var(--accent) 55%, transparent) 360deg)' }} />
          {[0, 1].map(i => <span key={i} style={{ position: 'absolute', inset: 30, borderRadius: '50%', border: '2px solid var(--accent)', animation: `ping 2s ${i}s ease-out infinite` }} />)}
        </>
      )}
      {Array.from({ length: Math.min(count, 5) }).map((_, i) => {
        const a = (i * 137 + 40) * Math.PI / 180, r = 58 + (i % 2) * 24;
        return <span key={i} className="pop-in" style={{ position: 'absolute', width: 12, height: 12, borderRadius: '50%', background: 'var(--success)',
          boxShadow: '0 0 12px var(--success)', transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)` }} />;
      })}
      <div className="center" style={{ position: 'relative', width: 74, height: 74, borderRadius: 24, color: '#fff',
        background: 'linear-gradient(160deg, color-mix(in srgb, var(--accent) 80%, #fff), var(--accent) 55%, color-mix(in srgb, var(--accent) 70%, #000))',
        boxShadow: '0 10px 30px color-mix(in srgb, var(--accent) 50%, transparent), inset 0 1px 0 rgba(255,255,255,.4)' }}>
        <Wifi size={34} strokeWidth={2.4} />
      </div>
    </div>
  );
}

export default function Connect() {
  const tvs = useStore(s => s.tvs);
  const status = useStore(s => s.status);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState(null);
  const [manual, setManual] = useState(false);
  const [proj, setProj] = useState(false);
  const [irOpen, setIrOpen] = useState(false);
  const [hasIr, setHasIr] = useState(null);
  const [menuTv, setMenuTv] = useState(null);

  useEffect(() => {
    bridge.call('info').then(i => setHasIr(!!i.hasIr)).catch(() => setHasIr(false));
    const s = useStore.getState();
    if (!autoTried && s.autoReconnect && s.lastTvId) {
      autoTried = true;
      const t = s.tvs.find(x => x.id === s.lastTvId);
      if (t) tv.connect(t);
    }
    autoTried = true;
  }, []);

  const scan = async () => {
    if (scanning) return;
    fx.scan();
    setScanning(true);
    setFound([]);
    try {
      const { devices } = await bridge.call('discover', { timeout: 5000 });
      setFound(devices);
      if (devices.length) fx.found(); else fx.error();
    } catch {
      setFound([]);
      fx.error();
    }
    setScanning(false);
  };

  const connectTo = (d) => {
    fx.tap();
    const saved = useStore.getState().tvs.find(t => t.id === d.type + ':' + d.host);
    const proj = d.type === 'samsung' && isProjectorName(d.name) ? { projector: true } : {};
    tv.connect(saved || { id: d.type + ':' + d.host, ...d, ...proj });
  };

  const savedIds = new Set(tvs.map(t => t.id));
  const fresh = (found || []).filter(d => !savedIds.has(d.type + ':' + d.host));

  return (
    <div className="screen">
      <div className="topbar">
        <div className="grow">
          <h1 className="title">Hubungkan TV</h1>
          <p className="subtitle">Remote aktif setelah HP terhubung ke TV</p>
        </div>
      </div>
      <div className="scroll pad" style={{ paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
        <div className="card" style={{ padding: '18px 18px 20px', textAlign: 'center' }}>
          <Radar scanning={scanning} count={found?.length || 0} />
          <h3 style={{ margin: '14px 0 4px', fontSize: 17 }}>
            {scanning ? 'Mencari TV di Wi-Fi…' : found ? (found.length ? `${found.length} TV ditemukan` : 'Belum ada TV ditemukan') : 'Cari TV di jaringan Wi-Fi'}
          </h3>
          <p className="subtitle" style={{ margin: '0 0 16px', fontSize: 13 }}>
            {found && !found.length && !scanning ? 'Pastikan TV menyala & satu Wi-Fi dengan HP, atau tambah manual.' : 'HP dan TV harus terhubung ke Wi-Fi yang sama'}
          </p>
          <button className="btn primary block" onClick={scan} disabled={scanning}>
            {scanning ? <span className="spinner" /> : <Search size={19} />} {scanning ? 'Memindai…' : found ? 'Pindai ulang' : 'Pindai TV'}
          </button>
        </div>

        {fresh.length > 0 && <div className="section-label">Ditemukan</div>}
        {fresh.map((d, i) => (
          <button key={d.host} className="list-item pop-in" style={{ animationDelay: i * 0.07 + 's' }} onClick={() => connectTo(d)}>
            <div className="li-icon"><TypeIcon type={d.type} projector={d.type === 'samsung' && isProjectorName(d.name)} /></div>
            <div className="grow">
              <div className="li-title">{d.name}</div>
              <div className="li-sub">{(d.type === 'samsung' && isProjectorName(d.name)) ? 'Samsung Freestyle (proyektor)' : TYPE_LABEL[d.type]} · {d.host}</div>
            </div>
            <span className="badge accent">Hubungkan</span>
          </button>
        ))}

        {tvs.length > 0 && <div className="section-label">TV tersimpan</div>}
        {tvs.map(t => (
          <div key={t.id} className="list-item" style={{ padding: 10, paddingLeft: 14 }}>
            <button className="row grow" style={{ textAlign: 'left', gap: 14 }} onClick={() => connectTo(t)}>
              <div className="li-icon"><TypeIcon type={t.type} projector={t.projector} /></div>
              <div className="grow">
                <div className="li-title">{t.name}</div>
                <div className="li-sub">{tvLabel(t)}{t.host ? ' · ' + t.host : ''}</div>
              </div>
            </button>
            <button className="icon-btn" onClick={() => { fx.tap(); setMenuTv(t); }} aria-label="Opsi"><ChevronRight size={20} /></button>
          </div>
        ))}

        <div className="section-label">Cara lain</div>
        <button className="list-item" onClick={() => { fx.tap(); setProj(true); }}>
          <div className="li-icon" style={{ background: 'color-mix(in srgb, var(--accent) 16%, var(--surface2))' }}><Projector size={22} /></div>
          <div className="grow"><div className="li-title">Proyektor Samsung (Freestyle / LS3)</div><div className="li-sub">Mode proyektor dengan pintasan fokus & keystone</div></div>
          <ChevronRight size={20} color="var(--faint)" />
        </button>
        <button className="list-item" onClick={() => { fx.tap(); setManual(true); }}>
          <div className="li-icon"><Plus size={22} /></div>
          <div className="grow"><div className="li-title">Tambah manual (alamat IP)</div><div className="li-sub">Lihat IP di Pengaturan › Jaringan pada TV</div></div>
          <ChevronRight size={20} color="var(--faint)" />
        </button>
        <button className="list-item" onClick={() => { if (hasIr === false) { fx.error(); useStore.getState().showToast('HP ini tidak punya pemancar infra merah', 'error'); return; } fx.tap(); setIrOpen(true); }}
          style={{ opacity: hasIr === false ? 0.55 : 1 }}>
          <div className="li-icon"><Radio size={22} /></div>
          <div className="grow"><div className="li-title">TV biasa (infra merah)</div>
            <div className="li-sub">{hasIr === false ? 'HP ini tidak punya pemancar IR' : 'Untuk HP dengan IR blaster (Xiaomi, Redmi, POCO…)'}</div></div>
          <ChevronRight size={20} color="var(--faint)" />
        </button>

        <div className="row" style={{ gap: 10, marginTop: 20, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5, alignItems: 'flex-start' }}>
          <Info size={16} style={{ flex: 'none', marginTop: 2 }} />
          <span>Android TV/Google TV akan menampilkan kode 6 digit. Samsung & LG akan meminta izin di layar TV — pilih <b>Izinkan</b> dengan remote TV.</span>
        </div>
      </div>

      <ManualSheet open={manual} onClose={() => setManual(false)} />
      <ManualSheet open={proj} onClose={() => setProj(false)} projector />
      <IrWizard open={irOpen} onClose={() => setIrOpen(false)} />
      <Sheet open={!!menuTv} onClose={() => setMenuTv(null)}>
        {menuTv && (
          <>
            <h2>{menuTv.name}</h2>
            <p className="lead">{tvLabel(menuTv)}{menuTv.host ? ' · ' + menuTv.host : ''}</p>
            <button className="btn primary block" onClick={() => { const t = menuTv; setMenuTv(null); connectTo(t); }}><Zap size={18} /> Hubungkan</button>
            {menuTv.type === 'samsung' && (
              <div className="list-item" style={{ marginTop: 10, padding: '12px 14px' }}>
                <div className="li-icon" style={{ width: 40, height: 40, borderRadius: 13 }}><Projector size={19} /></div>
                <div className="grow"><div className="li-title" style={{ fontSize: 14.5 }}>Mode proyektor</div><div className="li-sub">Untuk Samsung Freestyle / LS3</div></div>
                <Switch on={!!menuTv.projector} onChange={v => { useStore.getState().upsertTv({ id: menuTv.id, projector: v }); setMenuTv({ ...menuTv, projector: v }); }} />
              </div>
            )}
            {menuTv.mac && (
              <button className="btn block" style={{ marginTop: 10 }} onClick={async () => {
                const t = menuTv; setMenuTv(null);
                try { await bridge.call('wol', { mac: t.mac, host: t.host }); fx.confirm(); useStore.getState().showToast('Sinyal menyalakan TV terkirim… menghubungkan'); setTimeout(() => tv.connect(t), 7000); }
                catch { fx.error(); useStore.getState().showToast('Gagal mengirim Wake-on-LAN', 'error'); }
              }}><Power size={18} /> Nyalakan via Wi-Fi (Wake-on-LAN)</button>
            )}
            <button className="btn danger block" style={{ marginTop: 10 }} onClick={() => { fx.back(); useStore.getState().removeTv(menuTv.id); setMenuTv(null); }}><Trash2 size={18} /> Hapus TV ini</button>
          </>
        )}
      </Sheet>
      {status === 'connecting' && null}
    </div>
  );
}

const TYPES = [['androidtv', 'Android / Google TV'], ['samsung', 'Samsung'], ['lg', 'LG webOS'], ['roku', 'Roku']];

function ManualSheet({ open, onClose, projector = false }) {
  const [type, setType] = useState('androidtv');
  const [ip, setIp] = useState('192.168.1.');
  const [name, setName] = useState('');
  const valid = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip.trim());
  const go = () => {
    if (!valid) { fx.error(); return; }
    onClose();
    const host = ip.trim();
    const t = projector ? 'samsung' : type;
    tv.connect({ id: t + ':' + host, type: t, host, name: name.trim() || (projector ? 'Proyektor Samsung' : TYPE_LABEL[t]), ...(projector ? { projector: true } : {}) });
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <h2>{projector ? 'Proyektor Samsung (Freestyle / LS3)' : 'Tambah TV manual'}</h2>
      <p className="lead">{projector
        ? 'The Freestyle pakai jaringan seperti TV Samsung. Masukkan alamat IP proyektor (di proyektor: Menu → Settings → General & Privacy → Network → Network Status).'
        : 'Pilih jenis TV lalu masukkan alamat IP-nya.'}</p>
      {!projector && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {TYPES.map(([id, label]) => (
            <button key={id} className="btn small" onClick={() => { fx.select(); setType(id); }}
              style={type === id ? { background: 'color-mix(in srgb, var(--accent) 20%, transparent)', borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}>
              <TypeIcon type={id} size={17} /> {label}
            </button>
          ))}
        </div>
      )}
      <input className="field" inputMode="decimal" placeholder="Alamat IP, mis. 192.168.1.20" value={ip} onChange={e => setIp(e.target.value)} />
      <input className="field" style={{ marginTop: 10 }} placeholder={projector ? 'Nama (opsional), mis. Proyektor Kamar' : 'Nama (opsional), mis. TV Ruang Tamu'} value={name} onChange={e => setName(e.target.value)} />
      <button className="btn primary block" style={{ marginTop: 16 }} disabled={!valid} onClick={go}>{projector ? <Projector size={18} /> : <Zap size={18} />} Hubungkan</button>
    </Sheet>
  );
}

function IrWizard({ open, onClose }) {
  const [step, setStep] = useState('brand'); // brand | test | auto
  const [brand, setBrand] = useState(null);
  const [autoIdx, setAutoIdx] = useState(0);
  const [sent, setSent] = useState(false);
  const busy = useRef(false);
  useEffect(() => { if (open) { setStep('brand'); setBrand(null); setAutoIdx(0); setSent(false); } }, [open]);

  const fire = async (b, key) => {
    if (busy.current) return;
    busy.current = true;
    fx.press(key);
    try { await irSend(b, key); setSent(true); } catch { fx.error(); useStore.getState().showToast('Gagal memancarkan infra merah', 'error'); }
    setTimeout(() => { busy.current = false; }, 250);
  };
  const save = (b) => {
    const br = IR_BRANDS.find(x => x.id === b);
    onClose();
    tv.connect({ id: 'ir:' + b, type: 'ir', brand: b, name: 'TV ' + br.name + ' (IR)' });
  };

  return (
    <Sheet open={open} onClose={onClose}>
      {step === 'brand' && (
        <>
          <h2>Pilih merek TV</h2>
          <p className="lead">Arahkan ujung atas HP ke TV. Kita akan uji tombolnya dulu sebelum tersimpan.</p>
          <button className="list-item" style={{ marginBottom: 12 }} onClick={() => { fx.tap(); setAutoIdx(0); setSent(false); setStep('auto'); }}>
            <div className="li-icon"><Search size={22} /></div>
            <div className="grow"><div className="li-title">Cari otomatis</div><div className="li-sub">Coba semua merek satu per satu</div></div>
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {IR_BRANDS.map(b => (
              <button key={b.id} className="btn" style={{ height: 56, fontSize: 14 }} onClick={() => { fx.select(); setBrand(b.id); setSent(false); setStep('test'); }}>{b.name}</button>
            ))}
          </div>
        </>
      )}
      {step === 'test' && brand && (
        <>
          <h2>Uji remote {IR_BRANDS.find(b => b.id === brand).name}</h2>
          <p className="lead">Tekan tombol di bawah sambil mengarahkan HP ke TV. Apakah TV merespons?</p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn grow" style={{ height: 64 }} onClick={() => fire(brand, 'power')}><Power size={20} color="var(--danger)" /> Power</button>
            <button className="btn grow" style={{ height: 64 }} onClick={() => fire(brand, 'volup')}>Volume +</button>
            <button className="btn grow" style={{ height: 64 }} onClick={() => fire(brand, 'mute')}>Mute</button>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn grow" onClick={() => { fx.back(); setStep('brand'); }}><X size={18} /> Tidak</button>
            <button className="btn primary grow" disabled={!sent} onClick={() => save(brand)}><Check size={18} /> Berhasil, simpan</button>
          </div>
        </>
      )}
      {step === 'auto' && (
        <>
          <h2>Cari merek otomatis</h2>
          <p className="lead">Tekan <b>Kirim</b>. Jika TV mati/menyala, ketuk <b>Berhasil</b>. Jika tidak, ketuk <b>Coba berikutnya</b>.</p>
          <div className="card center" style={{ padding: 18, flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            <span className="badge accent">Percobaan {autoIdx + 1} dari {IR_BRANDS.length}</span>
            <b style={{ fontSize: 22 }}>{IR_BRANDS[autoIdx].name}</b>
            <button className="btn primary" style={{ marginTop: 8 }} onClick={() => fire(IR_BRANDS[autoIdx].id, 'power')}><Power size={18} /> Kirim sinyal Power</button>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn grow" onClick={() => {
              fx.tap(); setSent(false);
              if (autoIdx < IR_BRANDS.length - 1) setAutoIdx(autoIdx + 1);
              else { setAutoIdx(0); useStore.getState().showToast('Semua merek sudah dicoba. Ulang dari awal.', 'error'); }
            }}>{autoIdx < IR_BRANDS.length - 1 ? 'Coba berikutnya' : <><RotateCcw size={17} /> Ulang</>}</button>
            <button className="btn primary grow" disabled={!sent} onClick={() => save(IR_BRANDS[autoIdx].id)}><Check size={18} /> Berhasil</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
