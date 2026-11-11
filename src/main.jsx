import { createRoot } from 'react-dom/client';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './theme.css';
import { storage } from './lib/storage.js';
import { native } from './lib/native.js';

async function boot() {
  await storage.init();
  await native.init();
  const [{ default: App }, { loadSfx }, { useStore }] = await Promise.all([
    import('./App.jsx'), import('./sfx.js'), import('./store.js'),
  ]);
  native.toast = (msg) => useStore.getState().showToast(msg === 'Press back again to exit' ? 'Tekan kembali sekali lagi untuk keluar' : msg);
  loadSfx();
  createRoot(document.getElementById('app')).render(<App />);
  if (new URLSearchParams(location.search).has('reset')) { localStorage.clear(); }
  window.__store = useStore;
}
boot();
