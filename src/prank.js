// "Jahil" (prank) features on Android TV via the ADB channel:
// push an image that pops up instantly, dismiss it, and make the TV speak /
// play your recorded voice. Android-TV only (needs the debugging channel).
import { bridge } from './bridge.js';
import { useStore } from './store.js';
import { fx } from './sfx.js';

const IMG = '/data/local/tmp/rtp_scare.jpg';
const AUD = '/data/local/tmp/rtp_voice';

const host = () => useStore.getState().activeTv()?.host;
const stripB64 = d => d.includes(',') ? d.slice(d.indexOf(',') + 1) : d;
const failed = out => /error|unable to resolve|does not exist|not found|exception/i.test(out || '');

export function prankSupported() {
  const d = useStore.getState().activeTv();
  // The ADB push/launch path only exists on Android TV / Google TV.
  return d?.type === 'androidtv';
}

async function shell(cmd) { return (await bridge.call('adbShell', { host: host(), cmd })).out || ''; }

// Pushes the image to the TV ahead of time so it can appear with no loading.
export async function prepareImage(dataUrl) {
  await bridge.call('adbPush', { host: host(), path: IMG, data: stripB64(dataUrl) });
}

const VIEW_IMG = [
  `am start -a android.intent.action.VIEW -d file://${IMG} -t image/jpeg --activity-clear-task -f 0x14000000`,
  `am start -a android.intent.action.VIEW -d file://${IMG} -t image/* -f 0x10000000`,
  `am start -n com.google.android.apps.photos/.home.HomeActivity -a android.intent.action.VIEW -d file://${IMG} -t image/jpeg`,
  `am start -n com.estrongs.android.pop/.view.FileExplorerActivity -d file://${IMG} -t image/jpeg`,
];

// Launches the image fullscreen. Returns { ok, log } so the UI can show what the TV said.
export async function showImage() {
  let log = '';
  for (const cmd of VIEW_IMG) {
    let out;
    try { out = await shell(cmd); } catch (e) { log += '• ' + String(e?.message || e) + '\n'; continue; }
    log += '• ' + cmd.split(' ').slice(0, 6).join(' ') + ' → ' + out.trim().replace(/\n/g, ' ').slice(0, 90) + '\n';
    if (!failed(out)) return { ok: true, log };
  }
  return { ok: false, log };
}

export async function hideImage() {
  try { await shell('input keyevent KEYCODE_HOME'); } catch { /* ignore */ }
}

const VIEW_AUD = ext => [
  `am start -a android.intent.action.VIEW -d file://${AUD}.${ext} -t audio/* -f 0x10000000`,
  `am start -a android.intent.action.VIEW -d file://${AUD}.${ext} -t audio/mpeg`,
];

export async function playAudio(base64, ext = 'm4a') {
  await bridge.call('adbPush', { host: host(), path: `${AUD}.${ext}`, data: stripB64(base64) });
  let log = '';
  for (const cmd of VIEW_AUD(ext)) {
    let out;
    try { out = await shell(cmd); } catch (e) { log += String(e?.message || e) + '\n'; continue; }
    log += out.trim().slice(0, 80) + '\n';
    if (!failed(out)) return { ok: true, log };
  }
  return { ok: false, log };
}

// Text → the phone's TTS engine → WAV → played on the TV.
export async function speak(text, lang = 'id') {
  const r = await bridge.call('ttsToFile', { text, lang });
  if (r.empty || !r.data) { fx.confirm(); useStore.getState().showToast('Diputar di TV (simulasi)'); return { ok: true, log: 'sim' }; }
  return playAudio(r.data, r.ext || 'wav');
}
