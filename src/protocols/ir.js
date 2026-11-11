// Infrared encoders (ConsumerIrManager patterns in microseconds) and code sets
// for TVs without network control. Codes are the logical (LSB-first) values.
import { bridge } from '../bridge.js';

const bitsLSB = (v, n) => Array.from({ length: n }, (_, i) => (v >> i) & 1);
const bitsMSB = (v, n) => Array.from({ length: n }, (_, i) => (v >> (n - 1 - i)) & 1);
const rev8 = v => parseInt(v.toString(2).padStart(8, '0').split('').reverse().join(''), 2);

function pulseDistance(header, bits, mark, zero, one) {
  const p = [...header];
  bits.forEach(b => p.push(mark, b ? one : zero));
  p.push(mark);
  return p;
}

const enc = {
  nec(addr, cmd) {
    const bytes = [addr & 0xff, (~addr) & 0xff, cmd & 0xff, (~cmd) & 0xff];
    const p = pulseDistance([9000, 4500], bytes.flatMap(b => bitsLSB(b, 8)), 560, 560, 1690);
    return { freq: 38000, pattern: p };
  },
  samsung(addr, cmd) {
    const bytes = [addr, addr, cmd, (~cmd) & 0xff];
    return { freq: 38000, pattern: pulseDistance([4500, 4500], bytes.flatMap(b => bitsLSB(b, 8)), 560, 560, 1690) };
  },
  sony(addr, cmd) {
    const frame = [2400, 600];
    [...bitsLSB(cmd, 7), ...bitsLSB(addr, 5)].forEach(b => frame.push(b ? 1200 : 600, 600));
    const used = frame.reduce((a, b) => a + b, 0);
    frame[frame.length - 1] = 600 + Math.max(10000, 45000 - used);
    return { freq: 40000, pattern: [...frame, ...frame, ...frame.slice(0, -1)] };
  },
  panasonic(_addr, cmd) {
    const r = rev8(cmd);
    const bytes = [0x40, 0x04, 0x01, 0x00, r, 0x01 ^ 0x00 ^ r];
    return { freq: 37000, pattern: pulseDistance([3456, 1728], bytes.flatMap(b => bitsMSB(b, 8)), 432, 432, 1296) };
  },
  sharp(addr, cmd) {
    const frame = (c, exp, chk) => pulseDistance([], [...bitsLSB(addr, 5), ...bitsLSB(c, 8), exp, chk], 320, 680, 1680);
    const a = frame(cmd, 1, 0), b = frame((~cmd) & 0xff, 0, 1);
    return { freq: 38000, pattern: [...a, 40000, ...b] };
  },
  rc5(addr, cmd) {
    enc._t = !enc._t;
    const bits = [1, cmd < 64 ? 1 : 0, enc._t ? 1 : 0, ...bitsMSB(addr, 5), ...bitsMSB(cmd & 63, 6)];
    const halves = bits.flatMap(b => (b ? [0, 1] : [1, 0]));
    const p = [];
    let level = halves[0], dur = 0;
    halves.forEach(h => { if (h === level) dur += 889; else { p.push([level, dur]); level = h; dur = 889; } });
    p.push([level, dur]);
    const out = p.filter((x, i) => !(i === 0 && x[0] === 0)).map(x => x[1]);
    return { freq: 36000, pattern: out };
  },
};

const digits = (arr) => Object.fromEntries(arr.map((c, i) => ['d' + i, c]));

export const IR_BRANDS = [
  { id: 'samsung', name: 'Samsung', proto: 'samsung', addr: 0x07, keys: {
    power: 0x02, volup: 0x07, voldown: 0x0b, mute: 0x0f, chup: 0x12, chdown: 0x10, input: 0x01, menu: 0x1a,
    up: 0x60, down: 0x61, left: 0x65, right: 0x62, ok: 0x68, back: 0x58, exit: 0x2d, home: 0x79, info: 0x1f,
    guide: 0x4f, play: 0x47, pause: 0x4a, playpause: 0x47, stop: 0x46, rew: 0x45, ff: 0x48,
    red: 0x6c, green: 0x14, yellow: 0x15, blue: 0x16,
    ...digits([0x11, 0x04, 0x05, 0x06, 0x08, 0x09, 0x0a, 0x0c, 0x0d, 0x0e]) } },
  { id: 'lg', name: 'LG', proto: 'nec', addr: 0x04, keys: {
    power: 0x08, volup: 0x02, voldown: 0x03, mute: 0x09, chup: 0x00, chdown: 0x01, input: 0x0b, menu: 0x43,
    up: 0x40, down: 0x41, left: 0x07, right: 0x06, ok: 0x44, back: 0x28, exit: 0x5b, home: 0x7c, info: 0xaa,
    guide: 0xab, play: 0xb0, pause: 0xba, playpause: 0xb0, stop: 0xb1, rew: 0x8f, ff: 0x8e,
    red: 0x72, green: 0x71, yellow: 0x63, blue: 0x61,
    ...digits([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19]) } },
  { id: 'sony', name: 'Sony', proto: 'sony', addr: 0x01, keys: {
    power: 21, volup: 18, voldown: 19, mute: 20, chup: 16, chdown: 17, input: 37, home: 96, menu: 96,
    up: 116, down: 117, left: 52, right: 51, ok: 101, info: 58,
    ...digits([9, 0, 1, 2, 3, 4, 5, 6, 7, 8]) } },
  { id: 'panasonic', name: 'Panasonic', proto: 'panasonic', addr: 0, keys: {
    power: 0x3d, volup: 0x20, voldown: 0x21, mute: 0x32, chup: 0x34, chdown: 0x35, input: 0x05, menu: 0x52,
    up: 0x4a, down: 0x4b, left: 0x4e, right: 0x4f, ok: 0x49, back: 0xd4, exit: 0xd3,
    ...digits([0x19, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18]) } },
  { id: 'sharp', name: 'Sharp', proto: 'sharp', addr: 0x01, keys: {
    power: 0x16, volup: 0x14, voldown: 0x15, mute: 0x17, chup: 0x11, chdown: 0x12, input: 0x13,
    ...digits([0x0a, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]) } },
  { id: 'toshiba', name: 'Toshiba', proto: 'nec', addr: 0x40, keys: {
    power: 0x12, volup: 0x1a, voldown: 0x1e, mute: 0x10, chup: 0x1b, chdown: 0x1f, input: 0x0f,
    ...digits([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]) } },
  { id: 'philips', name: 'Philips', proto: 'rc5', addr: 0x00, keys: {
    power: 12, mute: 13, volup: 16, voldown: 17, chup: 32, chdown: 33,
    ...digits([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) } },
];

export const irBrand = id => IR_BRANDS.find(b => b.id === id);

export function irFrame(brandId, key) {
  const b = irBrand(brandId);
  const code = b?.keys[key];
  if (code == null) return null;
  return enc[b.proto](b.addr, code);
}

export async function irSend(brandId, key) {
  const f = irFrame(brandId, key);
  if (!f) throw new Error('UNSUPPORTED');
  await bridge.call('irTransmit', f);
}

export function irDriver(tv) {
  return {
    type: 'ir',
    supports: { keyboard: false, apps: false, mouse: false, url: false, volumeLevel: false },
    has: key => irBrand(tv.brand)?.keys[key] != null || ['playpause', 'enter'].includes(key),
    async connect() { const { hasIr } = await bridge.call('info'); if (!hasIr) throw new Error('NO_IR'); },
    async disconnect() {},
    async key(k) {
      const map = { enter: 'ok', settings: 'menu' };
      await irSend(tv.brand, irBrand(tv.brand).keys[k] != null ? k : (map[k] || k));
    },
  };
}
