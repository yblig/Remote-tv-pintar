// Preset "scare" images drawn as SVG and rasterised to a JPEG data URL in the
// webview, plus a helper to downscale a picture the user picks from the gallery.

const face = (bg, skin, extra) => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
<rect width="1280" height="720" fill="${bg}"/>${extra}</svg>`;

export const SCARES = [
  {
    id: 'grin', name: 'Seringai', bg: '#0a0a0a',
    svg: face('#0a0a0a', '#d8d2c0', `
      <ellipse cx="640" cy="360" rx="250" ry="330" fill="#cfc8b2"/>
      <ellipse cx="540" cy="300" rx="70" ry="95" fill="#fff"/><ellipse cx="740" cy="300" rx="70" ry="95" fill="#fff"/>
      <circle cx="540" cy="312" r="34" fill="#111"/><circle cx="740" cy="312" r="34" fill="#111"/>
      <circle cx="528" cy="300" r="9" fill="#fff"/><circle cx="728" cy="300" r="9" fill="#fff"/>
      <path d="M470 470 Q640 640 810 470 Q760 520 640 525 Q520 520 470 470Z" fill="#111"/>
      <g stroke="#cfc8b2" stroke-width="7">
        <line x1="520" y1="472" x2="525" y2="520"/><line x1="560" y1="486" x2="565" y2="524"/>
        <line x1="600" y1="492" x2="603" y2="526"/><line x1="680" y1="492" x2="677" y2="526"/>
        <line x1="720" y1="486" x2="715" y2="524"/><line x1="760" y1="472" x2="755" y2="520"/></g>
      <path d="M470 230 Q540 200 600 235 M680 235 Q740 200 810 230" stroke="#111" stroke-width="10" fill="none"/>
      <path d="M640 360 l-26 70 h52 Z" fill="#b8b099"/>`),
  },
  {
    id: 'eyes', name: 'Mata merah', bg: '#000',
    svg: face('#000', '', `
      <radialGradient id="r" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#3a0000"/><stop offset="1" stop-color="#000"/></radialGradient>
      <rect width="1280" height="720" fill="url(#r)"/>
      <g><ellipse cx="470" cy="360" rx="120" ry="60" fill="#ff1818"/><ellipse cx="810" cy="360" rx="120" ry="60" fill="#ff1818"/>
      <circle cx="470" cy="360" r="34" fill="#000"/><circle cx="810" cy="360" r="34" fill="#000"/>
      <ellipse cx="470" cy="360" rx="120" ry="60" fill="none" stroke="#ff5a5a" stroke-width="4"/>
      <ellipse cx="810" cy="360" rx="120" ry="60" fill="none" stroke="#ff5a5a" stroke-width="4"/></g>
      <path d="M430 520 Q640 470 850 520" stroke="#6a0000" stroke-width="10" fill="none"/>`),
  },
  {
    id: 'boo', name: 'BOO!', bg: '#c1121f',
    svg: face('#c1121f', '', `
      <text x="640" y="300" font-family="Arial Black, sans-serif" font-size="260" font-weight="900" fill="#fff" text-anchor="middle">BOO!</text>
      <text x="640" y="470" font-family="Arial, sans-serif" font-size="90" font-weight="800" fill="#ffd400" text-anchor="middle">😈 KENA KAMU!</text>`),
  },
];

export function svgToJpeg(svg, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 1280; c.height = 720;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function fileToJpeg(file, maxW = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = e => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
