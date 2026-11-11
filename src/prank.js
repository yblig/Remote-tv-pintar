// "Jahil" (prank) features on Android TV. Because most Android TVs have no app
// that can open an image or play audio from an intent, the phone installs a tiny
// companion app (com.yblig.rtpcast) over the same ADB channel; that app shows the
// image fullscreen and plays audio / speaks text on the TV itself.
import { bridge } from './bridge.js';
import { useStore } from './store.js';

const IMG = '/data/local/tmp/rtp_scare.jpg';
const AUD = '/data/local/tmp/rtp_voice';
const ACT = 'com.yblig.rtpcast/.CastActivity';
const SVC = 'com.yblig.rtpcast/.CastService';

const host = () => useStore.getState().activeTv()?.host;
const stripB64 = d => d.includes(',') ? d.slice(d.indexOf(',') + 1) : d;
const failed = out => /error|unable to resolve|does not exist|not found|no activity|exception|denied/i.test(out || '');
const esc = t => "'" + String(t).replace(/'/g, "'\\''").replace(/\n/g, ' ') + "'";

export function prankSupported() {
  return useStore.getState().activeTv()?.type === 'androidtv';
}

async function shell(cmd) { return (await bridge.call('adbShell', { host: host(), cmd })).out || ''; }

let ensured = false;
async function ensureHelper() {
  if (ensured) return;
  await bridge.call('castEnsure', { host: host() }); // installs the companion app once
  ensured = true;
}

// Pushes the image to the TV ahead of time so it appears instantly on KAGETKAN.
export async function prepareImage(dataUrl) {
  await ensureHelper();
  await bridge.call('adbPush', { host: host(), path: IMG, data: stripB64(dataUrl) });
}

export async function showImage() {
  await ensureHelper();
  const out = await shell(`am start -n ${ACT} --es img ${IMG} -f 0x14000000`);
  return { ok: !failed(out), log: out.trim() };
}

export async function hideImage() {
  try { await shell(`am start -n ${ACT} --es action close`); } catch { /* ignore */ }
  try { await shell('input keyevent KEYCODE_HOME'); } catch { /* ignore */ }
}

async function startService(args) {
  await ensureHelper();
  let out = await shell(`am start-foreground-service -n ${SVC} ${args}`);
  if (failed(out)) out += '\n' + await shell(`am startservice -n ${SVC} ${args}`);
  return { ok: !failed(out), log: out.trim() };
}

// Record-your-voice: push the clip, then the companion app plays it on the TV.
export async function playAudio(base64, ext = 'm4a') {
  await ensureHelper();
  await bridge.call('adbPush', { host: host(), path: `${AUD}.${ext}`, data: stripB64(base64) });
  return startService(`--es audio ${AUD}.${ext}`);
}

// Type-to-speak: the TV's own text-to-speech says it (no screen takeover).
export async function speak(text, lang = 'id') {
  if (!text.trim()) return { ok: false, log: 'empty' };
  return startService(`--es say ${esc(text)} --es lang ${lang}`);
}
