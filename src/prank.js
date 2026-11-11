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

let helper = { ok: false, reason: null, log: '', free: '' };
async function ensureHelper() {
  if (helper.ok) return helper;
  const r = await bridge.call('castEnsure', { host: host() }); // installs the companion app once
  helper = { ok: !!r.installed, reason: r.reason, log: r.log || '', free: r.free || '' };
  return helper;
}

function spaceMsg(h) {
  if (h.reason === 'NO_SPACE') return 'Penyimpanan TV penuh — kosongkan sedikit ruang di TV (Setelan → Aplikasi → hapus aplikasi tak terpakai atau Hapus cache), lalu coba lagi.' + (h.free ? '\nSisa /data: ' + h.free : '');
  return (h.log || 'Gagal memasang komponen di TV.');
}

// Pushes the image to the TV ahead of time so it appears instantly on KAGETKAN.
export async function prepareImage(dataUrl) {
  const h = await ensureHelper();
  if (!h.ok) return { ok: false, needSpace: h.reason === 'NO_SPACE', log: spaceMsg(h) };
  await bridge.call('adbPush', { host: host(), path: IMG, data: stripB64(dataUrl) });
  return { ok: true };
}

export async function showImage() {
  const h = await ensureHelper();
  if (!h.ok) return { ok: false, needSpace: h.reason === 'NO_SPACE', log: spaceMsg(h) };
  const out = await shell(`am start -n ${ACT} --es img ${IMG} -f 0x14000000`);
  return { ok: !failed(out), log: out.trim() };
}

export async function hideImage() {
  try { await shell(`am start -n ${ACT} --es action close`); } catch { /* ignore */ }
  try { await shell('input keyevent KEYCODE_HOME'); } catch { /* ignore */ }
}

async function startService(args) {
  let out = await shell(`am start-foreground-service -n ${SVC} ${args}`);
  if (failed(out)) out += '\n' + await shell(`am startservice -n ${SVC} ${args}`);
  return { ok: !failed(out), log: out.trim() };
}

// Plays a WAV directly through the TV's ALSA output with no app install — a fallback
// for when the TV storage is full. Not all TVs ship tinyplay.
async function tinyplayWav(b64) {
  const path = `${AUD}.wav`;
  await bridge.call('adbPush', { host: host(), path, data: stripB64(b64) });
  const out = await shell(`tinyplay ${path} 2>&1; echo rc=$?`);
  const ok = !/not found|no such|error|rc=[1-9]/i.test(out);
  return { ok, log: 'tinyplay → ' + out.trim() };
}

// Record-your-voice: push the clip, then the companion app plays it on the TV.
export async function playAudio(base64, ext = 'm4a') {
  const h = await ensureHelper();
  if (!h.ok) return { ok: false, needSpace: h.reason === 'NO_SPACE', log: 'Butuh komponen di TV untuk memutar rekaman. ' + spaceMsg(h) };
  await bridge.call('adbPush', { host: host(), path: `${AUD}.${ext}`, data: stripB64(base64) });
  return startService(`--es audio ${AUD}.${ext}`);
}

// Type-to-speak. Prefer the companion app (TV's own TTS); if it can't be installed
// (e.g. storage full), fall back to synthesising on the phone and playing via tinyplay.
export async function speak(text, lang = 'id') {
  if (!text.trim()) return { ok: false, log: 'empty' };
  const h = await ensureHelper();
  if (h.ok) return startService(`--es say ${esc(text)} --es lang ${lang}`);
  const t = await bridge.call('ttsToFile', { text, lang });
  if (t.empty || !t.data) return { ok: true, log: 'sim' };
  const r = await tinyplayWav(t.data);
  if (r.ok) return r;
  return { ok: false, needSpace: h.reason === 'NO_SPACE', log: spaceMsg(h) + '\n(Jalur tanpa-pasang juga gagal: ' + r.log + ')' };
}
