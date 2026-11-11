// Hand-drawn SVG illustrations used across onboarding, pairing and empty states.

export function TvArt({ width = 220, screen = null, glow = true }) {
  return (
    <svg width={width} viewBox="0 0 240 170" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="tvBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4260" /><stop offset="1" stopColor="#1b2033" />
        </linearGradient>
        <linearGradient id="tvScreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, var(--accent) 55%, #0b0e17)" />
          <stop offset="1" stopColor="#0d1222" />
        </linearGradient>
        <radialGradient id="tvGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--accent)" stopOpacity=".55" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {glow && <ellipse cx="120" cy="78" rx="130" ry="80" fill="url(#tvGlow)" />}
      <ellipse cx="120" cy="164" rx="70" ry="6" fill="#000" opacity=".3" />
      <path d="M98 140 L88 160 M142 140 L152 160" stroke="#2a3148" strokeWidth="8" strokeLinecap="round" />
      <rect x="10" y="8" width="220" height="134" rx="14" fill="url(#tvBody)" stroke="#4a5376" strokeWidth="2" />
      <rect x="20" y="18" width="200" height="114" rx="8" fill="url(#tvScreen)" />
      <path d="M20 26 Q20 18 28 18 L120 18 L60 132 L28 132 Q20 132 20 124Z" fill="#fff" opacity=".05" />
      <circle cx="120" cy="137" r="2" fill="var(--accent)" />
      <foreignObject x="20" y="18" width="200" height="114">{screen}</foreignObject>
    </svg>
  );
}

export function PhoneArt({ width = 90, children }) {
  return (
    <svg width={width} viewBox="0 0 90 170">
      <defs>
        <linearGradient id="phBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a5376" /><stop offset="1" stopColor="#1d2336" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="82" height="162" rx="16" fill="url(#phBody)" stroke="#5a6488" strokeWidth="2" />
      <rect x="10" y="12" width="70" height="146" rx="11" fill="#0f1320" />
      {children}
    </svg>
  );
}

// Phone mini-remote drawing (onboarding slide 1).
export function MiniRemote() {
  return (
    <g>
      <circle cx="45" cy="70" r="24" fill="#1d2336" stroke="var(--accent)" strokeWidth="2.5" />
      <circle cx="45" cy="70" r="9" fill="var(--accent)" />
      <path d="M45 50 l-4 5 h8z M45 90 l-4 -5 h8z M25 70 l5 -4 v8z M65 70 l-5 -4 v8z" fill="#9aa3bd" />
      <rect x="20" y="104" width="14" height="24" rx="7" fill="#262d44" />
      <rect x="56" y="104" width="14" height="24" rx="7" fill="#262d44" />
      <circle cx="45" cy="112" r="5" fill="#262d44" />
      <circle cx="45" cy="30" r="7" fill="#ff5c6c" />
    </g>
  );
}

export function Waves({ size = 120 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--accent)',
          animation: `ping 2.4s ${i * 0.8}s cubic-bezier(.2,.6,.4,1) infinite`,
        }} />
      ))}
    </div>
  );
}
