import { useEffect, useRef, useState } from 'react';
import { native } from '../lib/native.js';
import { useStore } from '../store.js';
import { fx } from '../sfx.js';
import { tv } from '../tv.js';
import { Tv, MonitorSmartphone, Radio, Wifi, AlertCircle, CheckCircle2, Projector } from 'lucide-react';

export function Sheet({ open, onClose, children, className = '' }) {
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) { setShown(true); setClosing(false); fx.whoosh(); }
    else if (shown) { setClosing(true); const t = setTimeout(() => { setShown(false); setClosing(false); }, 220); return () => clearTimeout(t); }
  }, [open]); // eslint-disable-line
  useEffect(() => {
    if (!open) return;
    return native.onBack(() => { onClose?.(); return true; });
  }, [open, onClose]);
  if (!shown) return null;
  return (
    <>
      <div className={'backdrop' + (closing ? ' closing' : '')} onClick={() => { fx.back(); onClose?.(); }} />
      <div className={'sheet ' + className + (closing ? ' closing' : '')} role="dialog">
        <div className="grabber" />
        {children}
      </div>
    </>
  );
}

export function Toast() {
  const toast = useStore(s => s.toast);
  if (!toast) return null;
  return (
    <div key={toast.id} className={'toast ' + toast.kind}>
      {toast.kind === 'error' ? <AlertCircle size={18} color="var(--danger)" /> : <CheckCircle2 size={18} color="var(--success)" />}
      <span>{toast.text}</span>
    </div>
  );
}

export function Switch({ on, onChange }) {
  return <button className={'switch' + (on ? ' on' : '')} onClick={() => { fx.toggle(); onChange(!on); }} aria-pressed={on} />;
}

// A remote key. Holding repeats (volume, arrows, channel) when `repeat` is set.
export function Key({ k, children, label, repeat = false, className = '', style, onPress }) {
  const timer = useRef(null);
  const [held, setHeld] = useState(false);
  const supported = onPress || tv.has(k);
  const stop = () => { clearTimeout(timer.current); clearInterval(timer.current); timer.current = null; setHeld(false); };
  useEffect(() => stop, []);
  const down = (e) => {
    e.preventDefault();
    if (!supported) { fx.error(); useStore.getState().showToast('Tombol ini tidak tersedia untuk TV ini', 'error'); return; }
    setHeld(true);
    if (onPress) onPress(); else tv.press(k);
    if (repeat && !onPress) {
      timer.current = setTimeout(() => {
        timer.current = setInterval(() => tv.press(k), 140);
      }, 420);
    }
  };
  return (
    <button
      className={'key ' + className + (held ? ' held' : '') + (supported ? '' : ' disabled')}
      style={style}
      onPointerDown={down}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={e => e.preventDefault()}
      aria-label={label || k}
    >
      {children}
    </button>
  );
}

export const TYPE_ICON = { androidtv: MonitorSmartphone, samsung: Tv, lg: Tv, roku: Wifi, ir: Radio };

export function TypeIcon({ type, projector, size = 22 }) {
  const I = projector ? Projector : (TYPE_ICON[type] || Tv);
  return <I size={size} strokeWidth={2.2} />;
}

// Custom remote glyph for the tab bar.
export function RemoteGlyph({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6.5" y="2" width="11" height="20" rx="4" />
      <circle cx="12" cy="8.5" r="2.6" />
      <path d="M10 14.5h.01M14 14.5h.01M10 18h.01M14 18h.01" strokeWidth="2.6" />
    </svg>
  );
}
