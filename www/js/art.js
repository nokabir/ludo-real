// Artwork for Ludo Real (inline SVG, no image files).

const PAWN = (x, y, s, c1, c2) => `<g transform="translate(${x} ${y}) scale(${s})">
  <ellipse cx="0" cy="44" rx="20" ry="5" fill="#000" opacity=".3"/>
  <path d="M-17 42 C-17 30 -10 24 -7 14 L7 14 C10 24 17 30 17 42 Z" fill="${c1}" stroke="#fff" stroke-width="2.5"/>
  <circle cx="0" cy="4" r="12" fill="${c1}" stroke="#fff" stroke-width="2.5"/>
  <circle cx="-4" cy="0" r="4" fill="#fff" opacity=".55"/><path d="M-12 38 C-10 30 -6 26 -4 18" stroke="${c2}" stroke-width="3" fill="none" opacity=".5"/></g>`;

const DIE = (x, y, s, rot) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
  <rect x="-22" y="-22" width="44" height="44" rx="10" fill="#fff" stroke="#c9cee3" stroke-width="2"/>
  <circle cx="-10" cy="-10" r="4.2" fill="#1d2140"/><circle cx="10" cy="10" r="4.2" fill="#1d2140"/><circle cx="0" cy="0" r="4.2" fill="#e03131"/>
  <circle cx="10" cy="-10" r="4.2" fill="#1d2140"/><circle cx="-10" cy="10" r="4.2" fill="#1d2140"/></g>`;

export const logo = `
<svg viewBox="0 0 320 230" class="logo" role="img" aria-label="Ludo Real">
  <defs>
    <linearGradient id="lgY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a0"/><stop offset=".5" stop-color="#ffd43b"/><stop offset="1" stop-color="#f08c00"/></linearGradient>
    <linearGradient id="lgBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9b6ff"/><stop offset="1" stop-color="#5f57d8"/></linearGradient>
  </defs>
  <ellipse cx="160" cy="196" rx="128" ry="24" fill="url(#lgBase)" stroke="#fff" stroke-width="5"/>
  <g transform="translate(160 186) scale(1 .3) rotate(45)">
    <rect x="-70" y="-70" width="140" height="140" fill="#fff"/><rect x="-70" y="-70" width="56" height="56" fill="#f03e3e"/><rect x="14" y="-70" width="56" height="56" fill="#2fb344"/>
    <rect x="-70" y="14" width="56" height="56" fill="#228be6"/><rect x="14" y="14" width="56" height="56" fill="#fab005"/>
  </g>
  ${PAWN(84, 42, 1.05, '#2fb344', '#1b6e2a')}${DIE(140, 50, 1.35, -14)}${PAWN(196, 26, 1.1, '#fab005', '#b07a00')}${PAWN(232, 46, .95, '#f03e3e', '#a61e1e')}${PAWN(212, 64, .85, '#228be6', '#145a99')}
  <text x="160" y="150" text-anchor="middle" font-family="Lilita One, Baloo 2, sans-serif" font-size="88" fill="url(#lgY)" stroke="#5c2d00" stroke-width="7" paint-order="stroke" letter-spacing="2">LUDO</text>
  <g transform="translate(222 158) rotate(-6)">
    <rect x="-46" y="-20" width="92" height="40" rx="20" fill="#1d1b3a" stroke="#fff" stroke-width="4"/>
    <text x="0" y="12" text-anchor="middle" font-family="Lilita One, Baloo 2, sans-serif" font-size="30" fill="#fff">REAL</text>
  </g>
</svg>`;

// Eight simple avatars: background, skin tone and hair vary.
const AV = [
  ['#ff6b6b', '#f1c27d', '#3b2314', 'short'], ['#4dabf7', '#e0ac69', '#111', 'spiky'], ['#51cf66', '#c68642', '#2b1b0e', 'long'],
  ['#fcc419', '#ffdbac', '#a0522d', 'bun'], ['#b197fc', '#8d5524', '#111', 'cap'], ['#ff922b', '#f1c27d', '#5c3a1a', 'beard'],
  ['#20c997', '#e0ac69', '#1a1a1a', 'long'], ['#f06595', '#ffdbac', '#3b2314', 'short'],
];
export function avatarSvg(i = 0) {
  const [bg, skin, hair, style] = AV[((i % 8) + 8) % 8];
  const hairs = {
    short: `<path d="M30 40 C30 22 70 22 70 40 C64 32 36 32 30 40Z" fill="${hair}"/>`,
    spiky: `<path d="M29 42 L33 24 L40 32 L45 20 L51 31 L57 20 L62 32 L68 24 L71 42 C62 33 38 33 29 42Z" fill="${hair}"/>`,
    long: `<path d="M27 70 C24 40 32 22 50 22 C68 22 76 40 73 70 L66 70 C68 48 64 36 50 36 C36 36 32 48 34 70Z" fill="${hair}"/>`,
    bun: `<circle cx="50" cy="19" r="9" fill="${hair}"/><path d="M30 42 C30 24 70 24 70 42 C64 33 36 33 30 42Z" fill="${hair}"/>`,
    cap: `<path d="M28 40 C28 20 72 20 72 40 Z" fill="#228be6"/><rect x="50" y="36" width="30" height="6" rx="3" fill="#145a99"/>`,
    beard: `<path d="M30 40 C30 22 70 22 70 40 C64 32 36 32 30 40Z" fill="${hair}"/><path d="M33 52 C34 72 66 72 67 52 C62 64 38 64 33 52Z" fill="${hair}"/>`,
  }[style];
  return `<svg viewBox="0 0 100 100" class="avatar-svg" aria-hidden="true">
    <rect width="100" height="100" rx="22" fill="${bg}"/>
    <path d="M18 100 C20 78 34 72 50 72 C66 72 80 78 82 100Z" fill="#fff" opacity=".9"/>
    <circle cx="50" cy="46" r="21" fill="${skin}"/>
    ${hairs}
    <circle cx="42" cy="47" r="2.6" fill="#1d2140"/><circle cx="58" cy="47" r="2.6" fill="#1d2140"/>
    <path d="M43 56 Q50 62 57 56" stroke="#7a3e00" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  </svg>`;
}
export const avatarHtml = (u, cls = '') => u?.photo
  ? `<img class="avatar-img ${cls}" src="${u.photo}" alt="" referrerpolicy="no-referrer">`
  : `<span class="avatar-wrap ${cls}">${avatarSvg(u?.avatar || 0)}</span>`;

// Mode card pictures.
export const modeArt = {
  table: `<svg viewBox="0 0 120 100" aria-hidden="true"><ellipse cx="60" cy="56" rx="38" ry="30" fill="#ffd8a8" stroke="#c76b00" stroke-width="4"/>
    <ellipse cx="60" cy="52" rx="30" ry="22" fill="#fff4e6"/>${DIE(60, 52, .55, 12)}
    ${PAWN(22, 32, .55, '#f03e3e', '#a61e1e')}${PAWN(98, 32, .55, '#228be6', '#145a99')}${PAWN(24, 66, .55, '#2fb344', '#1b6e2a')}${PAWN(96, 66, .55, '#fab005', '#b07a00')}</svg>`,
  timer: `<svg viewBox="0 0 120 100" aria-hidden="true"><rect x="54" y="6" width="12" height="10" rx="3" fill="#495057"/><rect x="48" y="2" width="24" height="7" rx="3" fill="#868e96"/>
    <circle cx="60" cy="56" r="36" fill="#fff" stroke="#f08c00" stroke-width="7"/><circle cx="60" cy="56" r="28" fill="#fff4e6"/>
    <path d="M60 56 V34 M60 56 L76 64" stroke="#e03131" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="56" r="5" fill="#1d2140"/>${DIE(100, 80, .5, 14)}</svg>`,
  friends: `<svg viewBox="0 0 120 100" aria-hidden="true"><g transform="translate(60 52)">
    <rect x="-38" y="-38" width="76" height="76" rx="8" fill="#fff" stroke="#343a40" stroke-width="3"/>
    <rect x="-34" y="-34" width="28" height="28" rx="4" fill="#f03e3e"/><rect x="6" y="-34" width="28" height="28" rx="4" fill="#2fb344"/>
    <rect x="-34" y="6" width="28" height="28" rx="4" fill="#228be6"/><rect x="6" y="6" width="28" height="28" rx="4" fill="#fab005"/>
    <circle cx="-20" cy="-20" r="7" fill="#fff"/><circle cx="20" cy="-20" r="7" fill="#fff"/><circle cx="-20" cy="20" r="7" fill="#fff"/><circle cx="20" cy="20" r="7" fill="#fff"/>
    <path d="M-6 -6 H6 V6 H-6Z" fill="#ffd43b"/></g></svg>`,
  pass: `<svg viewBox="0 0 120 100" aria-hidden="true">${PAWN(36, 18, .75, '#f03e3e', '#a61e1e')}${PAWN(84, 18, .75, '#fab005', '#b07a00')}${PAWN(36, 56, .75, '#2fb344', '#1b6e2a')}${PAWN(84, 56, .75, '#228be6', '#145a99')}</svg>`,
  computer: `<svg viewBox="0 0 120 100" aria-hidden="true"><rect x="28" y="24" width="64" height="52" rx="14" fill="#e7f5ff" stroke="#1c7ed6" stroke-width="4"/>
    <circle cx="47" cy="48" r="8" fill="#1c7ed6"/><circle cx="73" cy="48" r="8" fill="#1c7ed6"/><rect x="46" y="62" width="28" height="5" rx="2.5" fill="#1c7ed6"/>
    <path d="M60 24 V12" stroke="#1c7ed6" stroke-width="4"/><circle cx="60" cy="10" r="5" fill="#ff6b6b"/>${DIE(98, 80, .45, -12)}</svg>`,
};

const S = (body, fill = false) => `<svg viewBox="0 0 24 24" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${body}</svg>`;
export const ico = {
  coin: `<svg viewBox="0 0 24 24" class="coin-ico" aria-hidden="true"><ellipse cx="12" cy="7" rx="8" ry="3.5" fill="#ffd43b" stroke="#e67700" stroke-width="1.2"/><path d="M4 7v4c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5V7" fill="#fab005" stroke="#e67700" stroke-width="1.2"/><path d="M4 11v4c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-4" fill="#f59f00" stroke="#e67700" stroke-width="1.2"/></svg>`,
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  back: S('<path d="M15 5l-7 7 7 7"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  menu: S('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  info: S('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  trophy: S('<path d="M6 3h12v2h3v3a4 4 0 0 1-4 4h-.3A6 6 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A6 6 0 0 1 7.3 12H7a4 4 0 0 1-4-4V5h3V3z"/>', true),
  settings: S('<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  wallet: S('<path d="M5 4h12a2 2 0 0 1 2 2v1H6a1 1 0 0 0 0 2h14a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zm11 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>', true),
  podium: S('<path d="M9 9h6v12H9zM2 13h7v8H2zM15 15h7v6h-7z"/><path d="M12 2l1.2 2.5 2.8.4-2 1.9.5 2.7L12 8.2 9.5 9.5l.5-2.7-2-1.9 2.8-.4z"/>', true),
  bell: S('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  history: S('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
  whatsapp: S('<path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8a5 5 0 0 1-2.7-2.7l.8-1-1-2z"/>'),
  telegram: S('<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/><path d="M9 13l9-7"/>'),
  share: S('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  sound: S('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  mute: S('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>'),
  vibrate: S('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 8v8M21 8v8"/>'),
  chat: S('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/><circle cx="9" cy="12" r=".6" fill="currentColor"/><circle cx="12" cy="12" r=".6" fill="currentColor"/><circle cx="15" cy="12" r=".6" fill="currentColor"/>'),
  user: S('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  gift: S('<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8C9 8 7 6.5 8 4.8S11 5 12 8zm0 0c3 0 5-1.5 4-3.2S13 5 12 8z"/>'),
  copy: S('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  google: `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`,
  guest: S('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M17 3l1 2 2 .3-1.5 1.4.4 2L17 7.8 15.1 8.7l.4-2L14 5.3l2-.3z" fill="currentColor"/>'),
  wheel: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#ffd43b" stroke="#c76b00" stroke-width="3"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<path d="M24 24 L${24 + 19 * Math.cos(i * Math.PI / 4)} ${24 + 19 * Math.sin(i * Math.PI / 4)} A19 19 0 0 1 ${24 + 19 * Math.cos((i + 1) * Math.PI / 4)} ${24 + 19 * Math.sin((i + 1) * Math.PI / 4)} Z" fill="${['#ff6b6b', '#4dabf7', '#51cf66', '#b197fc', '#ff922b', '#20c997', '#f06595', '#fcc419'][i]}"/>`).join('')}
    <circle cx="24" cy="24" r="5" fill="#fff" stroke="#c76b00" stroke-width="2"/></svg>`,
};
