// Ludo board, tokens, dice and player panels. Rendering + animation only;
// whoever creates the view (online or practice controller) decides the moves.
import * as L from './engine.js';

const HEX = { red: '#f03e3e', green: '#2fb344', yellow: '#fab005', blue: '#228be6' };
const LIGHT = { red: '#ff8787', green: '#69db7c', yellow: '#ffe066', blue: '#74c0fc' };
const DARK = { red: '#a61e1e', green: '#1b6e2a', yellow: '#b07a00', blue: '#145a99' };
const CORNERS = ['bl', 'tl', 'tr', 'br'];                        // canonical: red, green, yellow, blue
const BASE_ORIGIN = { red: [0, 9], green: [0, 0], yellow: [9, 0], blue: [9, 9] };

// ---------- board drawing (canonical orientation, 15x15 units) ----------
function star(cx, cy, r, fill) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(3)},${(cy + rr * Math.sin(a)).toFixed(3)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

function arrow(cx, cy, dir, fill) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return `<path d="M0 -.28 L.24 .02 H.09 V.28 H-.09 V.02 H-.24 Z" fill="${fill}" transform="translate(${cx} ${cy}) rotate(${rot})"/>`;
}

export function boardSvg(rotation = 0) {
  let s = `<svg viewBox="0 0 15 15" class="lb-svg" aria-hidden="true"><defs>`;
  for (const c of L.COLORS) {
    s += `<linearGradient id="lbBase-${c}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${LIGHT[c]}"/><stop offset="1" stop-color="${HEX[c]}"/></linearGradient>`;
    s += `<linearGradient id="lbCell-${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${LIGHT[c]}"/><stop offset="1" stop-color="${HEX[c]}"/></linearGradient>`;
  }
  s += `<radialGradient id="lbCenter" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e9ecf5"/></radialGradient></defs>`;
  s += `<g transform="rotate(${-90 * rotation} 7.5 7.5)">`;
  s += `<rect width="15" height="15" fill="#fff"/>`;

  // path cells
  const coloured = new Map();
  for (const c of L.COLORS) {
    coloured.set(L.TRACK[L.START[c]].join(), c);
    for (const cell of L.HOME_COLUMN[c]) coloured.set(cell.join(), c);
  }
  const inBase = (x, y) => (x < 6 || x > 8) && (y < 6 || y > 8);
  const inCenter = (x, y) => x >= 6 && x <= 8 && y >= 6 && y <= 8;
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
    if (inBase(x, y) || inCenter(x, y)) continue;
    const c = coloured.get(`${x},${y}`);
    s += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c ? `url(#lbCell-${c})` : '#fff'}" stroke="#cdd3e6" stroke-width=".035"/>`;
  }
  for (const i of L.STARS) { const [x, y] = L.TRACK[i]; s += star(x + .5, y + .5, .36, '#c5cbe0'); }
  for (const c of L.COLORS) { const [x, y] = L.TRACK[L.START[c]]; s += star(x + .5, y + .5, .34, 'rgba(255,255,255,.9)'); }
  // entry arrows on the square before each home column
  s += arrow(7.5, 14.5, 'up', HEX.red) + arrow(.5, 7.5, 'right', HEX.green) + arrow(7.5, .5, 'down', HEX.yellow) + arrow(14.5, 7.5, 'left', HEX.blue);

  // bases
  for (const c of L.COLORS) {
    const [bx, by] = BASE_ORIGIN[c];
    s += `<rect x="${bx}" y="${by}" width="6" height="6" fill="url(#lbBase-${c})"/>`;
    s += `<rect x="${bx + .1}" y="${by + .1}" width="5.8" height="5.8" rx=".35" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".06"/>`;
    s += `<rect x="${bx + .9}" y="${by + .9}" width="4.2" height="4.2" rx=".55" fill="#fff"/>`;
    s += `<rect x="${bx + .9}" y="${by + .9}" width="4.2" height="4.2" rx=".55" fill="none" stroke="${DARK[c]}" stroke-opacity=".25" stroke-width=".08"/>`;
    for (const [px, py] of L.BASE_SPOTS[c]) {
      s += `<circle cx="${px}" cy="${py}" r=".52" fill="${HEX[c]}" opacity=".18"/><circle cx="${px}" cy="${py}" r=".52" fill="none" stroke="${HEX[c]}" stroke-width=".07"/>`;
    }
  }

  // centre home
  s += `<polygon points="6,9 9,9 7.5,7.5" fill="url(#lbBase-red)"/><polygon points="6,6 6,9 7.5,7.5" fill="url(#lbBase-green)"/>`;
  s += `<polygon points="6,6 9,6 7.5,7.5" fill="url(#lbBase-yellow)"/><polygon points="9,6 9,9 7.5,7.5" fill="url(#lbBase-blue)"/>`;
  s += `<path d="M6 6 L9 9 M9 6 L6 9" stroke="rgba(255,255,255,.55)" stroke-width=".05"/>`;
  s += `<circle cx="7.5" cy="7.5" r=".42" fill="url(#lbCenter)" stroke="rgba(0,0,0,.08)" stroke-width=".04"/>`;
  s += star(7.5, 7.5, .26, '#fab005');
  s += `<rect width="15" height="15" fill="none" stroke="#b9c0d8" stroke-width=".08"/>`;
  return s + `</g></svg>`;
}

// Glossy pawn ("goti").
function pawnSvg(color) {
  return `<svg viewBox="0 0 40 54" aria-hidden="true">
    <ellipse cx="20" cy="49" rx="14" ry="4" fill="#000" opacity=".35"/>
    <path d="M7 45 C7 35 13 31 15 25 L25 25 C27 31 33 35 33 45 C33 49 7 49 7 45Z" fill="url(#pw-${color})" stroke="#fff" stroke-width="2"/>
    <ellipse cx="20" cy="25.5" rx="8" ry="2.6" fill="${DARK[color]}" opacity=".5"/>
    <circle cx="20" cy="16" r="11" fill="url(#pw-${color})" stroke="#fff" stroke-width="2"/>
    <ellipse cx="16" cy="11.5" rx="4.2" ry="3" fill="#fff" opacity=".65"/>
  </svg>`;
}

const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
export function diceFace(n) {
  if (!n) return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="4" y="4" width="92" height="92" rx="22" fill="url(#dieFace)"/></svg>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="4" y="4" width="92" height="92" rx="22" fill="url(#dieFace)"/>
    ${PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.5" fill="${n === 1 ? '#e03131' : '#1d2140'}"/>`).join('')}</svg>`;
}

// ---------- sounds (tiny WebAudio blips, no files) ----------
let audio = null;
let muted = (() => { try { return localStorage.getItem('ludo_muted') === '1'; } catch { return false; } })();
function tone(freq, dur = .08, type = 'sine', gain = .08, when = 0) {
  if (muted) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime + when, o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur);
  } catch { /* audio not available */ }
}
const diceSound = new Audio(new URL('../sounds/dice.mp3', import.meta.url).href);
diceSound.preload = 'auto';

export const sfx = {
  roll() {
    if (muted) return;
    try {
      diceSound.currentTime = 0;
      diceSound.play().catch(() => {});
    } catch { /* audio not available */ }
  },
  step() { tone(620, .05, 'triangle', .05); },
  capture() { tone(160, .25, 'sawtooth', .07); tone(90, .3, 'sine', .08, .05); },
  home() { [660, 880, 1100].forEach((f, i) => tone(f, .14, 'triangle', .06, i * .09)); },
  turn() { tone(880, .1, 'sine', .06); tone(1320, .12, 'sine', .05, .1); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'triangle', .07, i * .14)); },
};
export const isMuted = () => muted;
export function setMuted(v) { muted = v; try { localStorage.setItem('ludo_muted', v ? '1' : '0'); } catch { /* ignore */ } }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- the view ----------
export class LudoView {
  // opts: { me: colour the board turns towards, controls(color) -> may this device act for that colour,
  //         avatarFor(color) -> html, onRoll(), onMove(token) }
  constructor(root, state, opts) {
    this.root = root;
    this.opts = opts;
    this.me = opts.me;
    this.controls = opts.controls || (c => c === this.me);
    this.rot = this.me ? L.COLORS.indexOf(this.me) : 0;
    this.state = structuredClone(state);
    this.busy = false;
    this.clockOffset = 0;
    this.render();
  }

  // Board coordinates (cell centre, 0..15) -> rotated position in %.
  pos([cx, cy]) {
    let u = cx + .5, v = cy + .5;
    for (let k = 0; k < this.rot; k++) [u, v] = [v, 15 - u];
    return [u / 15 * 100, v / 15 * 100];
  }

  // The board turns counter-clockwise by `rot` quarter turns, so each panel moves the same way:
  // the viewer's colour always lands bottom-left.
  corner(color) {
    return CORNERS[(L.COLORS.indexOf(color) - this.rot + 4) % 4];
  }

  render() {
    const st = this.state;
    const panels = L.COLORS.map(c => {
      const seat = st.seats.find(s => s.color === c);
      const corner = this.corner(c);
      if (!seat) return `<div class="lg-panel empty ${corner}"></div>`;
      return `<div class="lg-panel ${corner}" data-color="${c}" style="--c:${HEX[c]};--cl:${LIGHT[c]}">
        <div class="lg-avatar"><svg class="lg-timer" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20"/></svg>
          ${this.opts.avatarFor ? this.opts.avatarFor(c) : `<span>${esc(seat.name.slice(0, 1).toUpperCase())}</span>`}<i class="lg-bubble"></i></div>
        <div class="lg-meta"><b>${esc(seat.name)}${c === this.me && !this.opts.local ? ' <em>(You)</em>' : ''}</b><small class="lg-sub"></small></div>
        <button class="lg-dice" data-dice="${c}" aria-label="Dice">${diceFace(0)}</button>
      </div>`;
    }).join('');

    const tokens = st.seats.map(s => st.tokens[s.color].map((p, i) =>
      `<button class="lg-token" data-color="${s.color}" data-token="${i}" aria-label="${s.color} goti ${i + 1}">${pawnSvg(s.color)}</button>`).join('')).join('');

    this.root.innerHTML = `
      <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
        ${L.COLORS.map(c => `<radialGradient id="pw-${c}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${LIGHT[c]}"/><stop offset=".55" stop-color="${HEX[c]}"/><stop offset="1" stop-color="${DARK[c]}"/></radialGradient>`).join('')}
        <linearGradient id="dieFace" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe3f2"/></linearGradient>
      </defs></svg>
      <div class="lg-wrap">
        ${panels}
        <div class="lg-board-frame"><div class="lg-board">${boardSvg(this.rot)}<div class="lg-tokens">${tokens}</div></div></div>
        <div class="lg-status" aria-live="polite"></div>
      </div>`;

    this.root.querySelectorAll('.lg-dice').forEach(b => b.onclick = () => {
      if (this.controls(b.dataset.dice) && this.canRoll(b.dataset.dice)) this.opts.onRoll?.();
    });
    this.root.querySelectorAll('.lg-token').forEach(b => b.onclick = () => {
      if (b.classList.contains('movable')) this.opts.onMove?.(+b.dataset.token);
    });
    this.placeAll();
    this.decorate();
    clearInterval(this.ticker);
    this.ticker = setInterval(() => this.tick(), 200);
  }

  canRoll(color) {
    const st = this.state, cur = st.seats[st.turn]?.color;
    return !this.busy && st.phase === 'roll' && !st.winner && cur === color && this.controls(cur);
  }

  // Short chat bubble over a player's avatar.
  showChat(color, text) {
    const b = this.root.querySelector(`.lg-panel[data-color="${color}"] .lg-bubble`);
    if (!b) return;
    b.textContent = text;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 2600);
  }

  tokenEl(color, i) { return this.root.querySelector(`.lg-token[data-color="${color}"][data-token="${i}"]`); }

  // Put every token where the state says, spreading tokens that share a square.
  placeAll() {
    const st = this.state, groups = new Map();
    for (const s of st.seats) st.tokens[s.color].forEach((p, i) => {
      const cell = L.cellOf(s.color, p, i);
      const key = p < 0 ? `b${s.color}${i}` : p === L.HOME ? `h${s.color}` : cell.join();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ color: s.color, i, cell });
    });
    for (const list of groups.values()) {
      list.forEach(({ color, i, cell }, k) => {
        const el = this.tokenEl(color, i);
        if (!el) return;
        const [x, y] = this.pos(cell);
        const n = list.length;
        const off = n > 1 ? (k - (n - 1) / 2) * (n > 2 ? 1.6 : 2.2) : 0;
        el.style.left = `calc(${x}% + ${off}%)`;
        el.style.top = `${y}%`;
        el.style.setProperty('--s', n > 1 ? (n > 2 ? .62 : .75) : 1);
        el.style.zIndex = String(Math.round(y * 10) + k);
        el.classList.toggle('out', !!st.seats.find(s => s.color === color)?.out);
      });
    }
  }

  // Highlights, dice faces, status text.
  decorate() {
    const st = this.state, cur = st.seats[st.turn];
    const mine = !!cur && this.controls(cur.color);
    this.root.querySelectorAll('.lg-panel[data-color]').forEach(p => {
      const c = p.dataset.color, seat = st.seats.find(s => s.color === c);
      p.classList.toggle('active', !st.winner && cur?.color === c);
      p.classList.toggle('out', !!seat?.out);
      const done = st.tokens[c].filter(x => x === L.HOME).length;
      p.querySelector('.lg-sub').textContent = seat?.out ? 'Left the game' : `${done}/4 home${seat?.missed ? ` · missed ${seat.missed}` : ''}`;
      const dice = p.querySelector('.lg-dice');
      if (!dice.classList.contains('rolling')) dice.innerHTML = diceFace(cur?.color === c && st.dice ? st.dice : 0);
      dice.classList.toggle('ready', this.canRoll(c));
    });
    const movable = mine && st.phase === 'move' && !this.busy ? (st.last?.moves || L.legalMoves(st, cur.color, st.dice)) : [];
    this.root.querySelectorAll('.lg-token').forEach(t => t.classList.toggle('movable', t.dataset.color === cur?.color && movable.includes(+t.dataset.token)));

    const status = this.root.querySelector('.lg-status');
    const who = this.opts.local ? `<b>${esc(cur?.name)}</b>` : '<b>Your turn</b>';
    if (st.winner) status.textContent = '';
    else if (mine && st.phase === 'roll') status.innerHTML = `${who} · tap the dice`;
    else if (mine && st.phase === 'move') status.innerHTML = movable.length > 1 ? '<b>Pick a goti</b> to move' : 'Moving…';
    else if (st.phase === 'pass' && st.last?.note === 'three-sixes') status.textContent = 'Three sixes! Turn lost.';
    else if (st.phase === 'pass') status.textContent = `${cur?.name} has no move`;
    else status.textContent = `${cur?.name}'s turn`;
  }

  tick() {
    const st = this.state;
    this.root.querySelectorAll('.lg-panel[data-color]').forEach(p => {
      const ring = p.querySelector('.lg-timer circle');
      const active = p.classList.contains('active') && st.deadline;
      if (!active) { ring.style.strokeDashoffset = '0'; p.classList.remove('hurry'); return; }
      const left = Math.max(0, st.deadline - (Date.now() - this.clockOffset));
      const frac = left / (st.turnSeconds * 1000);
      ring.style.strokeDashoffset = String(126 * (1 - frac));
      p.classList.toggle('hurry', left < 6000);
    });
  }

  async animateRoll(color, value) {
    const dice = this.root.querySelector(`.lg-dice[data-dice="${color}"]`);
    if (!dice) return;
    sfx.roll();
    dice.classList.add('rolling');
    for (let i = 0; i < 8; i++) { dice.innerHTML = diceFace(1 + Math.floor(Math.random() * 6)); await sleep(60); }
    dice.innerHTML = diceFace(value);
    dice.classList.remove('rolling');
    dice.classList.add('landed');
    setTimeout(() => dice.classList.remove('landed'), 400);
  }

  async animateMove({ color, token, from, to, captured }) {
    const el = this.tokenEl(color, token);
    if (!el) return;
    el.classList.add('walking');
    const steps = from < 0 ? [0] : Array.from({ length: to - from }, (_, k) => from + k + 1);
    for (const p of steps) {
      const [x, y] = this.pos(L.cellOf(color, p, token));
      el.style.left = `${x}%`; el.style.top = `${y}%`; el.style.setProperty('--s', 1);
      el.style.zIndex = '999';
      el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop');
      sfx.step();
      await sleep(150);
    }
    el.classList.remove('walking', 'hop');
    if (captured?.length) {
      sfx.capture();
      for (const c of captured) {
        const e = this.tokenEl(c.color, c.token);
        if (!e) continue;
        e.classList.add('captured');
        const [x, y] = this.pos(L.cellOf(c.color, -1, c.token));
        e.style.left = `${x}%`; e.style.top = `${y}%`;
      }
      await sleep(520);
      this.root.querySelectorAll('.captured').forEach(e => e.classList.remove('captured'));
    }
    if (to === L.HOME) sfx.home();
  }

  // Apply a new state, animating what changed since the current one.
  async update(next) {
    if (next.now) this.clockOffset = Date.now() - next.now;
    const prev = this.state;
    const turnChanged = prev.turn !== next.turn || prev.phase !== next.phase;
    const last = next.last;
    if (last && next.seq !== prev.seq) {
      this.busy = true;
      this.decorate();
      if (last.type === 'roll' && next.seq === prev.seq + 1) await this.animateRoll(last.color, last.value);
      if (last.type === 'move' && next.seq === prev.seq + 1) {
        this.state = { ...prev, dice: last.dice };
        await this.animateMove(last);
      }
      this.busy = false;
    }
    this.state = structuredClone(next);
    this.placeAll();
    this.decorate();
    if (turnChanged && !next.winner && next.phase === 'roll' && next.seats[next.turn]?.color === this.me) { sfx.turn(); this.opts.onMyTurn?.(); }
  }

  destroy() { clearInterval(this.ticker); }
}
