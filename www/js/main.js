import { api, getToken, setToken, setUnauthorizedHandler, streamUrl } from './api.js';
import * as N from './native.js';
import { logo, avatarSvg, avatarHtml, modeArt, ico } from './art.js';
import { LudoView, sfx, isMuted, setMuted } from './board-ui.js';
import * as L from './engine.js';
import { startLocal } from './local.js';

const app = document.getElementById('app');
let me = null, config = null, cleanup = null;

// ---------- small helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => n >= 1e5 ? `${+(n / 1e3).toFixed(n >= 1e6 ? 0 : 1)}K` : Number(n || 0).toLocaleString('en-IN');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const COLORS = { red: '#f03e3e', green: '#2fb344', yellow: '#fab005', blue: '#228be6' };
const pref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

function toast(msg, bad = false) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const el = document.createElement('div');
  el.className = `toast ${bad ? 'bad' : ''}`;
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}

function modal(title, html, { onClose, cls = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="panel modal ${cls}" role="dialog" aria-modal="true">
    <div class="panel-title">${esc(title)}</div>
    <button class="x-btn" data-close aria-label="Close">${ico.close}</button>
    <div class="modal-body">${html}</div></div>`;
  const close = () => { wrap.remove(); N.onBack(prevBack); onClose?.(); };
  const prevBack = currentBack;
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  document.body.append(wrap);
  N.onBack(() => { close(); return true; });
  return { el: wrap, close };
}

let currentBack = null;
function setBack(fn) { currentBack = fn; N.onBack(fn); }

async function busy(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true; btn.classList.add('busy');
  try { return await fn(); } catch (err) { toast(err.message, true); } finally { btn.disabled = false; btn.classList.remove('busy'); }
}

// keep = redraw inside the same game (don't close its live connection)
function screen(html, cls = '', keep = false) {
  if (!keep) { cleanup?.(); cleanup = null; }
  document.querySelectorAll('.modal-wrap').forEach(m => m.remove());
  app.className = `screen ${cls}`;
  app.innerHTML = html;
  window.scrollTo(0, 0);
  N.showBanner(!!me && !['splash', 'signin-screen'].includes(cls));
}

const meAvatar = (cls = '') => avatarHtml(me, cls);
const coinBox = () => `<button class="coin-box" id="coinBox">${ico.coin}<b id="coinCount">${fmt(me.coins)}</b><span class="coin-plus">${ico.plus}</span></button>`;
function refreshCoins() { const c = $('#coinCount'); if (c) c.textContent = fmt(me.coins); }
async function reloadMe() { const r = await api('/api/me'); me = r.user; refreshCoins(); return r; }

// ---------- boot: splash -> loading -> sign-in or menu ----------
async function boot() {
  setUnauthorizedHandler(() => { setToken(null); signInScreen(); });
  screen(`<div class="center-col">${logo}</div>`, 'splash');
  await sleep(900);
  screen(`<div class="center-col">${logo}<div class="dice-loader"><span></span><span></span></div><p class="loading-txt">Loading</p></div>`, 'splash');
  try { config = await api('/api/config'); } catch (err) { return offline(err); }
  if (!getToken()) return signInScreen();
  try { const r = await api('/api/me'); me = r.user; menuScreen(r.current); } catch { signInScreen(); }
}

function offline(err) {
  screen(`<div class="center-col">${logo}<p class="loading-txt">${esc(err.message)}</p><button class="btn-green" id="retry">Try again</button></div>`, 'splash');
  $('#retry').onclick = boot;
}

// ---------- sign in ----------
function signInScreen() {
  screen(`
    <div class="center-col signin">
      ${logo}
      <p class="tagline">Sign in to get <b>${fmt(1000)} free coins</b></p>
      <button class="btn-signin" id="google">${ico.google}<span>Continue with Google</span></button>
      <button class="btn-signin" id="guest">${ico.guest}<span>Play as Guest</span></button>
      <label class="check"><input type="checkbox" id="agree"><span>I have read and agree to the <a href="#" data-link="privacy">Privacy Policy</a> and <a href="#" data-link="privacy">Terms</a>. Coins are for fun only and have no money value.</span></label>
    </div>`, 'signin-screen');
  const agree = $('#agree');
  const sync = () => $$('.btn-signin').forEach(b => b.classList.toggle('dim', !agree.checked));
  agree.onchange = sync; sync();
  $$('[data-link]').forEach(a => a.onclick = e => { e.preventDefault(); N.openUrl(linkUrl(config.links.privacy)); });
  const go = async (btn, signIn) => {
    if (!agree.checked) return toast('Please accept the Privacy Policy first', true);
    await busy(btn, async () => {
      const r = await signIn();
      setToken(r.token); me = r.user;
      menuScreen(null);
    });
  };
  const google = async () => api('/api/auth/firebase', { method: 'POST', body: { idToken: await N.signInWithGoogle() } });
  // Guest: our own server account tied to a secret kept on this phone (no Firebase needed).
  const guest = () => api('/api/auth/guest', { method: 'POST', body: { secret: guestSecret() } });
  $('#google').onclick = e => go(e.currentTarget, google);
  $('#guest').onclick = e => go(e.currentTarget, guest);
  setBack(null);
}

function guestSecret() {
  let s = pref('lr_guest_secret', null);
  if (!s) {
    const b = crypto.getRandomValues(new Uint8Array(32));
    s = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    setPref('lr_guest_secret', s);
  }
  return s;
}

function deviceId() {
  let id = pref('lr_device', null);
  if (!id) { id = crypto.randomUUID(); setPref('lr_device', id); }
  return id;
}
const linkUrl = u => (u?.startsWith('/') ? (N.API_URL || location.origin) + u : u);

// ---------- main menu ----------
function menuScreen(current) {
  const L1 = config.links;
  N.initAds(config.ads).then(() => N.showBanner(true));
  screen(`
    <header class="top-bar">
      <button class="me-chip" id="profile">${meAvatar('sm')}<b>${esc(me.name)}</b></button>
      ${coinBox()}
    </header>
    <div class="menu-side left">
      ${L1.whatsapp ? `<button class="side-btn" data-url="${esc(L1.whatsapp)}">${ico.whatsapp}<span>WhatsApp</span></button>` : ''}
      ${L1.telegram ? `<button class="side-btn" data-url="${esc(L1.telegram)}">${ico.telegram}<span>Telegram</span></button>` : ''}
      <button class="wheel-btn ${me.spinAt ? '' : 'ready'}" id="spin" aria-label="Daily spin">${ico.wheel}<span>${me.spinAt ? 'Spin' : 'FREE'}</span></button>
    </div>
    <div class="menu-side right">
      <button class="side-btn" id="notice">${ico.bell}<span>Notice</span></button>
      <button class="side-btn" id="history">${ico.history}<span>History</span></button>
    </div>
    <div class="menu-logo">${logo}</div>
    ${current ? `<button class="resume-bar" id="resume">${ico.trophy}<span>You have a game in progress</span><b>Resume</b></button>` : ''}
    <div class="modes">
      <button class="mode y" data-mode="table"><div class="mode-art">${modeArt.table}</div><b>Play With Table</b><small>Win big coins</small></button>
      <button class="mode t" data-mode="timer"><div class="mode-art">${modeArt.timer}</div><b>Play with Timer</b><small>10 minute games</small></button>
      <button class="mode p" data-mode="friends"><div class="mode-art">${modeArt.friends}</div><b>Play with Friends</b><small>Private room code</small></button>
      <button class="mode o" data-mode="pass"><div class="mode-art">${modeArt.pass}</div><b>Pass &amp; Play</b><small>One phone, 2–4 players</small></button>
    </div>
    <div class="pill-row">
      <button class="pill" data-mode="computer">${modeArt.computer}<span>vs Computer</span></button>
      <button class="pill" id="refer">${ico.share}<span>Refer &amp; Earn</span></button>
    </div>
    <nav class="arc-nav">
      <button id="leader" aria-label="Leaderboard">${ico.podium}</button>
      <button id="settings" class="mid" aria-label="Settings">${ico.settings}</button>
      <button id="wallet" aria-label="Coins">${ico.wallet}</button>
    </nav>`, 'menu');

  $$('[data-url]').forEach(b => b.onclick = () => N.openUrl(b.dataset.url));
  $$('[data-mode]').forEach(b => b.onclick = () => {
    const m = b.dataset.mode;
    if (m === 'table' || m === 'timer') selectScreen(m);
    else if (m === 'friends') friendsScreen();
    else if (m === 'pass') localSetup('pass');
    else localSetup('computer');
  });
  $('#resume')?.addEventListener('click', () => onlineGame(current.id));
  $('#coinBox').onclick = () => coinsScreen();
  $('#wallet').onclick = () => coinsScreen();
  $('#refer').onclick = () => coinsScreen('refer');
  $('#spin').onclick = spinModal;
  $('#notice').onclick = () => modal('Notice', `<p class="notice">${esc(config.notice)}</p>`);
  $('#history').onclick = historyModal;
  $('#leader').onclick = leaderboardModal;
  $('#settings').onclick = settingsModal;
  $('#profile').onclick = profileModal;
  setBack(null);
}

// ---------- select colour + table ----------
function selectScreen(kind, players = Number(pref('lr_players', 2))) {
  const color = pref('lr_color', 'red');
  const tables = config.tables;
  screen(`
    <header class="sub-bar"><button class="round-btn" id="back">${ico.back}</button><h1>${kind === 'timer' ? 'Play with Timer' : 'Play With Table'}</h1>${coinBox()}</header>
    <section class="panel">
      <div class="panel-head">Select your color</div>
      <div class="color-pick">${Object.keys(COLORS).map(c => `<button class="cp ${c === color ? 'on' : ''}" data-color="${c}" style="--c:${COLORS[c]}" aria-label="${c}">
        <svg viewBox="0 0 40 54"><path d="M7 45 C7 35 13 31 15 25 L25 25 C27 31 33 35 33 45 C33 49 7 49 7 45Z" fill="${COLORS[c]}"/><circle cx="20" cy="16" r="11" fill="${COLORS[c]}"/><ellipse cx="16" cy="12" rx="4" ry="3" fill="#fff" opacity=".5"/></svg><i></i></button>`).join('')}</div>
      <div class="seg2">${[2, 4].map(n => `<button data-players="${n}" class="${n === players ? 'on' : ''}">${n} Players</button>`).join('')}</div>
    </section>
    <section class="panel">
      <div class="panel-head">Select game</div>
      ${kind === 'timer' ? '<p class="hint-c">10 minutes. When time is up, the player who moved furthest wins.</p>' : ''}
      <div class="table-grid">${tables.map(t => {
        const prize = players === 2 ? t.prize2 : t.prize4;
        return `<button class="table-tile ${me.coins < t.entry ? 'locked' : ''}" data-entry="${t.entry}">
          <div class="tt-top">${ico.coin}<b>Win</b></div><div class="tt-prize">${fmt(prize)}</div><small>Entry ${fmt(t.entry)}</small></button>`;
      }).join('')}</div>
    </section>`, 'select');
  $('#back').onclick = () => menuScreen();
  $('#coinBox').onclick = () => coinsScreen();
  $$('.cp').forEach(b => b.onclick = () => { setPref('lr_color', b.dataset.color); $$('.cp').forEach(x => x.classList.toggle('on', x === b)); });
  $$('[data-players]').forEach(b => b.onclick = () => { setPref('lr_players', b.dataset.players); selectScreen(kind, +b.dataset.players); });
  $$('.table-tile').forEach(b => b.onclick = () => {
    if (b.classList.contains('locked')) return toast(N.rewardedAvailable() ? 'Not enough coins. Watch a video or spin the wheel in My Coins!' : 'Not enough coins. Spin the wheel for free coins!', true);
    busy(b, async () => {
      const room = await api('/api/match/table', { method: 'POST', body: { kind, players, entry: +b.dataset.entry, color: pref('lr_color', 'red') } });
      await reloadMe();
      onlineGame(room.id);
    });
  });
  setBack(() => { menuScreen(); return true; });
}

// ---------- friends: create / join ----------
function friendsScreen(tab = 'create') {
  const color = pref('lr_color', 'red');
  screen(`
    <header class="sub-bar"><button class="round-btn" id="back">${ico.back}</button><h1>Play with Friends</h1>${coinBox()}</header>
    <div class="seg2 big">${['create', 'join'].map(t => `<button data-tab="${t}" class="${t === tab ? 'on' : ''}">${t === 'create' ? 'Create Room' : 'Join Room'}</button>`).join('')}</div>
    ${tab === 'create' ? `
    <section class="panel">
      <div class="field"><label>Players</label><div class="seg3" data-name="players">${[2, 3, 4].map(n => `<button data-v="${n}" class="${n === 4 ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="field"><label>Win when</label><div class="seg3" data-name="winTokens">${[[4, 'Classic (4 gotis)'], [1, '1 Goti'], [2, '2 Goti'], [3, '3 Goti']].map(([v, l]) => `<button data-v="${v}" class="${v === 4 ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="field"><label>Cutting</label><div class="seg3" data-name="cut">${[['true', 'Cut allowed'], ['false', 'No cut']].map(([v, l]) => `<button data-v="${v}" class="${v === 'true' ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="field"><label>Entry (coins)</label><div class="seg3 wrap" data-name="entry">${[0, ...config.tables.slice(0, 6).map(t => t.entry)].map(v => `<button data-v="${v}" class="${v === 0 ? 'on' : ''}">${v ? fmt(v) : 'Free'}</button>`).join('')}</div></div>
      <button class="btn-green wide" id="create">Create Room</button>
    </section>` : `
    <section class="panel">
      <div class="panel-head">Enter room code</div>
      <input class="code-input" id="code" inputmode="numeric" maxlength="8" placeholder="Room code" autocomplete="off">
      <button class="btn-green wide" id="join">Join Room</button>
    </section>`}
    <p class="hint-c">Your colour: <b style="color:${COLORS[color]}">${color}</b> (change it in Play With Table)</p>`, 'select');
  $('#back').onclick = () => menuScreen();
  $('#coinBox').onclick = () => coinsScreen();
  $$('[data-tab]').forEach(b => b.onclick = () => friendsScreen(b.dataset.tab));
  $$('.seg3').forEach(g => $$('button', g).forEach(b => b.onclick = () => $$('button', g).forEach(x => x.classList.toggle('on', x === b))));
  const val = n => $(`.seg3[data-name="${n}"] .on`)?.dataset.v;
  $('#create')?.addEventListener('click', e => busy(e.currentTarget, async () => {
    const room = await api('/api/match/friends/create', { method: 'POST', body: { players: +val('players'), winTokens: +val('winTokens'), cut: val('cut') === 'true', entry: +val('entry'), color } });
    await reloadMe();
    onlineGame(room.id);
  }));
  $('#join')?.addEventListener('click', e => busy(e.currentTarget, async () => {
    const code = $('#code').value.trim();
    if (!/^\d{6}(\d{2})?$/.test(code)) throw new Error('Enter the 6 or 8-digit room code');
    const room = await api('/api/match/friends/join', { method: 'POST', body: { code, color } });
    await reloadMe();
    onlineGame(room.id);
  }));
  setBack(() => { menuScreen(); return true; });
}

// ---------- online game (lobby + board in one stream) ----------
function onlineGame(roomId) {
  screen('<div class="center-col"><div class="dice-loader"><span></span><span></span></div><p class="loading-txt">Connecting…</p></div>', 'game');
  let view = null, room = null, es = null, closed = false, ended = false, countdown = null;
  const queue = [];
  let pumping = false;
  const myColor = () => room?.seats.find(s => s.userId === me.id)?.color;
  const auto = { on: false };

  const leave = async () => {
    const playing = room?.status === 'playing';
    if (playing && !confirm('Leave the game? You will lose your entry coins.')) return;
    try { await api(`/api/match/${roomId}/leave`, { method: 'POST' }); } catch (err) { if (!playing) toast(err.message, true); }
    await reloadMe().catch(() => {});
    menuScreen();
  };

  function lobby(r) {
    clearInterval(countdown);
    const friends = r.kind === 'friends' || r.kind === 'api';
    const apiRoom = r.kind === 'api';
    const host = r.hostId === me.id;
    screen(`
      <header class="sub-bar"><button class="round-btn" id="leave">${ico.back}</button><h1>${apiRoom ? 'Room' : friends ? 'Friends Room' : 'Finding players'}</h1><span class="prize-chip">${ico.trophy}${fmt(r.prize)}</span></header>
      ${friends ? `<section class="panel code-panel"><div class="panel-head">Room code</div><div class="room-code">${esc(r.code)}</div>
        <div class="row-c"><button class="btn-yellow" id="copy">${ico.copy} Copy</button><button class="btn-yellow" id="shareCode">${ico.share} Share</button></div>
        <p class="hint-c">${r.winTokens === 4 ? 'Classic' : `${r.winTokens} Goti`} · ${r.cut ? 'Cut allowed' : 'No cut'} · Entry ${r.entry ? fmt(r.entry) : 'Free'}</p></section>` : ''}
      <section class="panel"><div class="panel-head">Players ${r.seats.length}/${r.players}</div>
        <div class="seat-grid">${Array.from({ length: r.players }, (_, i) => {
          const s = r.seats[i];
          return s ? `<div class="seat-card">${avatarHtml(s)}<b>${esc(s.name)}</b>${s.userId === r.hostId && friends ? '<small>Host</small>' : ''}</div>`
            : `<div class="seat-card empty"><span class="spinner"></span><b>Waiting…</b></div>`;
        }).join('')}</div>
        ${!friends ? `<p class="hint-c" id="fillNote">Searching for players… <b id="cd"></b></p>` : ''}
        ${friends && host ? `<button class="btn-green wide" id="start" ${r.seats.length < 2 ? 'disabled' : ''}>Start Game</button>` : ''}
        ${apiRoom ? '<p class="hint-c">The game starts when every player has joined.</p>' : friends && !host ? '<p class="hint-c">Waiting for the host to start…</p>' : ''}
      </section>`, 'select', true);
    $('#leave').onclick = leave;
    setBack(() => { leave(); return true; });
    $('#copy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(r.code); toast('Code copied'); } catch { toast(`Code: ${r.code}`); } });
    $('#shareCode')?.addEventListener('click', () => N.share('Ludo Real', `Join my Ludo Real game! Room code: ${r.code}`, linkUrl(config.links.share)));
    $('#start')?.addEventListener('click', e => busy(e.currentTarget, () => api(`/api/match/${roomId}/start`, { method: 'POST' })));
    if (!friends && r.fillAt) {
      const tick = () => { const s = Math.max(0, Math.ceil((r.fillAt - Date.now()) / 1000)); const el = $('#cd'); if (el) el.textContent = `${s}s`; };
      tick(); countdown = setInterval(tick, 500);
    }
  }

  function board(r, g) {
    clearInterval(countdown);
    const chatOn = pref('lr_chat', '1') === '1';
    screen(`
      <header class="game-bar">
        <button class="sq-btn" id="gmenu" aria-label="Menu">${ico.menu}</button>
        <button class="sq-btn" id="ginfo" aria-label="Rules">${ico.info}</button>
        ${g.endsAt ? '<span class="timer-chip" id="clock">10:00</span>' : ''}
        <span class="prize-chip">${ico.trophy}${fmt(r.prize)} win</span>
      </header>
      <div id="board"></div>
      <div class="game-tools">
        ${chatOn ? `<button class="sq-btn chat-btn" id="chat" aria-label="Chat">${ico.chat}</button>` : ''}
        <label class="auto-toggle"><input type="checkbox" id="auto"><span class="sw"></span><span>Auto Mode</span></label>
      </div>`, 'game', true);
    view = new LudoView($('#board'), g, {
      me: myColor(),
      avatarFor: c => { const s = r.seats.find(x => x.color === c); return s ? avatarHtml(s) : ''; },
      onRoll: () => act('roll'),
      onMove: t => act('move', { token: t }),
      onMyTurn: () => N.vibrate(40),
    });
    $('#gmenu').onclick = () => gameMenu(leave);
    $('#ginfo').onclick = () => rulesModal(g);
    $('#chat')?.addEventListener('click', () => chatPicker(text => api(`/api/match/${roomId}/chat`, { method: 'POST', body: { text } }).catch(err => toast(err.message, true))));
    $('#auto').onchange = e => { auto.on = e.target.checked; autoPlay(); };
    setBack(() => { gameMenu(leave); return true; });
    if (g.endsAt) {
      const tick = () => {
        const left = Math.max(0, g.endsAt - (Date.now() - (view?.clockOffset || 0)));
        const el = $('#clock'); if (!el) return;
        el.textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
        el.classList.toggle('hurry', left < 60000);
      };
      tick(); countdown = setInterval(tick, 500);
    }
  }

  const act = (path, body) => api(`/api/match/${roomId}/${path}`, { method: 'POST', body }).catch(err => toast(err.message, true));

  // Auto mode: roll and pick the best move for me.
  function autoPlay() {
    if (!auto.on || !view || view.busy) return;
    const st = view.state, cur = st.seats[st.turn];
    if (st.winner || cur?.color !== myColor()) return;
    if (st.phase === 'roll') act('roll');
    else if (st.phase === 'move') {
      const moves = st.last?.moves || L.legalMoves(st, cur.color, st.dice);
      if (moves.length > 1) act('move', { token: L.bestMove(st, cur.color, st.dice, moves) });
    }
  }

  async function pump() {
    if (pumping) return;
    pumping = true;
    while (queue.length && !closed) {
      const msg = queue.length > 4 ? queue.splice(0, queue.length).pop() : queue.shift();
      room = msg.room;
      if (msg.cancelled || room.status === 'cancelled') { toast('Room closed. Coins refunded.'); await reloadMe().catch(() => {}); return menuScreen(); }
      if (room.status === 'waiting') { lobby(room); continue; }
      if (!msg.game) continue;
      if (!view) { board(room, msg.game); sfx.turn(); }
      else await view.update({ ...msg.game, now: msg.now });
      autoPlay();
      if (room.status === 'over' && room.result && !ended) { ended = true; await sleep(700); resultModal(room); }
    }
    pumping = false;
  }

  es = new EventSource(streamUrl(roomId));
  es.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'chat') { if (pref('lr_chat', '1') === '1') view?.showChat(msg.color, msg.text); return; }
    queue.push(msg); pump();
  };
  es.onerror = () => { if (!closed && es.readyState === 2) { toast('Connection lost', true); menuScreen(); } };
  cleanup = () => { closed = true; es?.close(); view?.destroy(); clearInterval(countdown); };

  function resultModal(r) {
    const won = r.result.winnerColor === myColor();
    if (won) { sfx.win(); N.vibrate(120); }
    reloadMe().catch(() => {});
    const m = modal(won ? 'You Won!' : 'Game Over', `
      <div class="result">
        <div class="crown">${ico.trophy}</div>
        <h2>${won ? 'Congratulations!' : `${esc(r.result.winnerName)} won`}</h2>
        ${won && r.result.prize ? `<p class="won-coins">${ico.coin}<b>+${fmt(r.result.prize)}</b></p>` : '<p class="hint-c">Better luck next time!</p>'}
        <div class="row-c"><button class="btn-green" id="again">Play Again</button><button class="btn-yellow" id="home">Home</button></div>
      </div>`, { onClose: () => menuScreen() });
    $('#home', m.el).onclick = async () => { await N.maybeInterstitial(); m.close(); };
    $('#again', m.el).onclick = async () => { m.el.remove(); await N.maybeInterstitial(); ['friends', 'api'].includes(r.kind) ? friendsScreen() : selectScreen(r.kind, r.players); };
  }
}

function gameMenu(onLeave) {
  const m = modal('Menu', `
    <div class="set-row"><span>Sound</span><button class="tog-btn" id="snd">${isMuted() ? ico.mute : ico.sound}</button></div>
    <div class="set-row"><span>Vibration</span><button class="tog-btn ${N.vibrationEnabled() ? '' : 'off'}" id="vib">${ico.vibrate}</button></div>
    <button class="btn-red wide" id="quit">Leave Game</button>`);
  $('#snd', m.el).onclick = e => { setMuted(!isMuted()); e.currentTarget.innerHTML = isMuted() ? ico.mute : ico.sound; };
  $('#vib', m.el).onclick = e => { N.setVibration(!N.vibrationEnabled()); e.currentTarget.classList.toggle('off', !N.vibrationEnabled()); };
  $('#quit', m.el).onclick = () => { m.el.remove(); onLeave(); };
}

function rulesModal(g) {
  modal('How to play', `<ul class="rules">
    <li>Roll a <b>6</b> to bring a goti out.</li>
    <li>A 6, cutting a goti, or reaching home gives you <b>another turn</b>. Three 6s in a row loses the turn.</li>
    <li>${g.cut === false ? 'This is a <b>No cut</b> game: gotis can’t be cut.' : 'Land on an opponent to <b>cut</b> it back home. Stars and start squares are safe.'}</li>
    <li>You need the <b>exact number</b> to reach home.</li>
    <li>Win: ${g.winTokens < 4 ? `first to bring <b>${g.winTokens} goti${g.winTokens > 1 ? 's' : ''}</b> home` : 'first to bring <b>all 4 gotis</b> home'}${g.endsAt ? ', or the furthest ahead when the timer ends' : ''}.</li>
    <li>${g.turnSeconds}s per turn. Miss 3 turns and you’re out.</li></ul>`);
}

const CHAT = ['👍', '😂', '😡', '😎', '🙏', '🔥', '😭', '🎉', 'Hurry up!', 'Well played!', 'Good luck!', 'Oops!'];
function chatPicker(send) {
  const m = modal('Quick chat', `<div class="chat-grid">${CHAT.map(c => `<button data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>`, { cls: 'small' });
  $$('[data-c]', m.el).forEach(b => b.onclick = () => { send(b.dataset.c); m.close(); });
}

// ---------- local games: vs Computer / Pass & Play ----------
function localSetup(kind) {
  const isPass = kind === 'pass';
  const m = modal(isPass ? 'Pass & Play' : 'vs Computer', `
    <div class="field"><label>Players</label><div class="seg3" data-name="n">${[2, 3, 4].map(n => `<button data-v="${n}" class="${n === (isPass ? 2 : 4) ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    <div class="field"><label>Win when</label><div class="seg3" data-name="w">${[[4, 'Classic'], [1, '1 Goti'], [2, '2 Goti'], [3, '3 Goti']].map(([v, l]) => `<button data-v="${v}" class="${v === 4 ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="field"><label>Cutting</label><div class="seg3" data-name="c">${[['1', 'Cut allowed'], ['0', 'No cut']].map(([v, l]) => `<button data-v="${v}" class="${v === '1' ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <button class="btn-green wide" id="go">Start</button>`);
  $$('.seg3', m.el).forEach(g => $$('button', g).forEach(b => b.onclick = () => $$('button', g).forEach(x => x.classList.toggle('on', x === b))));
  $('#go', m.el).onclick = () => {
    const v = n => $(`.seg3[data-name="${n}"] .on`, m.el).dataset.v;
    const n = +v('n');
    const seats = isPass
      ? Array.from({ length: n }, (_, i) => ({ name: i === 0 ? me.name : `Player ${i + 1}`, avatarHtml: i === 0 ? meAvatar() : `<span class="avatar-wrap">${avatarSvg(i + 2)}</span>` }))
      : [{ name: me.name, avatarHtml: meAvatar() }, ...Array.from({ length: n - 1 }, (_, i) => ({ name: `Computer ${i + 1}`, bot: true, avatarHtml: `<span class="avatar-wrap">${avatarSvg(i + 4)}</span>` }))];
    m.el.remove();
    localGame(seats, { winTokens: +v('w'), cut: v('c') === '1', title: isPass ? 'Pass & Play' : 'vs Computer' });
  };
}

function localGame(seats, opts) {
  const auto = { on: false };
  screen(`
    <header class="game-bar">
      <button class="sq-btn" id="gmenu" aria-label="Menu">${ico.menu}</button>
      <button class="sq-btn" id="ginfo" aria-label="Rules">${ico.info}</button>
      <span class="prize-chip">${esc(opts.title)}</span>
    </header>
    <div id="board"></div>
    <div class="game-tools">${seats.some(s => s.bot) ? '<label class="auto-toggle"><input type="checkbox" id="auto"><span class="sw"></span><span>Auto Mode</span></label>' : ''}</div>`, 'game');
  const game = startLocal($('#board'), seats, {
    winTokens: opts.winTokens, cut: opts.cut, auto: () => auto.on,
    onOver: ({ winnerName, iWon }) => {
      if (iWon) sfx.win();
      const m = modal(iWon ? 'You Won!' : 'Game Over', `<div class="result"><div class="crown">${ico.trophy}</div><h2>${iWon ? 'Congratulations!' : `${esc(winnerName)} won`}</h2>
        <div class="row-c"><button class="btn-green" id="again">Play Again</button><button class="btn-yellow" id="home">Home</button></div></div>`, { onClose: () => menuScreen() });
      $('#home', m.el).onclick = async () => { await N.maybeInterstitial(); m.close(); };
      $('#again', m.el).onclick = async () => { m.el.remove(); await N.maybeInterstitial(); localGame(seats, opts); };
    },
  });
  cleanup = () => game.stop();
  const quit = () => { if (confirm('Leave this game?')) menuScreen(); };
  $('#gmenu').onclick = () => gameMenu(() => menuScreen());
  $('#ginfo').onclick = () => rulesModal({ winTokens: opts.winTokens, cut: opts.cut, turnSeconds: '∞' });
  $('#auto')?.addEventListener('change', e => { auto.on = e.target.checked; game.kick(); });
  setBack(() => { quit(); return true; });
}

// ---------- coins, spin, referral ----------
async function coinsScreen(focus) {
  const txs = await api('/api/coins').catch(() => []);
  screen(`
    <header class="sub-bar"><button class="round-btn" id="back">${ico.back}</button><h1>My Coins</h1></header>
    <section class="panel balance"><div class="bal-ico">${ico.coin}</div><div><small>Balance</small><b>${fmt(me.coins)}</b></div>
      <p class="hint-c">Coins are just for fun. They can't be bought, sold or withdrawn.</p></section>
    <section class="panel"><div class="panel-head">Free coins</div>
      <div class="earn-row"><div>${ico.wheel}</div><div><b>Daily spin</b><small>Win up to ${fmt(Math.max(...config.spinPrizes))} coins</small></div><button class="btn-green" id="spin">${me.spinAt ? 'Later' : 'Spin'}</button></div>
      ${N.rewardedAvailable() ? `<div class="earn-row"><div class="ref-ico">${ico.gift}</div><div><b>Watch a video</b><small>Get ${fmt(config.ads.rewardCoins)} coins</small></div><button class="btn-green" id="watchAd">Watch</button></div>` : ''}
      <div class="earn-row" id="referRow"><div class="ref-ico">${ico.share}</div><div><b>Refer &amp; Earn</b><small>You and your friend get ${fmt(config.referralCoins ?? 500)} coins</small></div><button class="btn-green" id="shareRef">Share</button></div>
      <div class="ref-code">Your code <b>${esc(me.refCode)}</b><button class="tiny-btn" id="copyRef">${ico.copy}</button></div>
      ${me.referred ? '' : `<div class="ref-enter"><input id="refIn" maxlength="6" placeholder="Friend's code" autocapitalize="characters"><button class="btn-yellow" id="useRef">Apply</button></div>`}
    </section>
    <section class="panel"><div class="panel-head">History</div>
      ${txs.length ? txs.map(t => `<div class="tx"><span>${esc(t.note || t.type)}<small>${new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</small></span><b class="${t.amount >= 0 ? 'plus' : 'minus'}">${t.amount >= 0 ? '+' : ''}${fmt(t.amount)}</b></div>`).join('') : '<p class="hint-c">No coin activity yet.</p>'}
    </section>`, 'select');
  $('#back').onclick = () => menuScreen();
  $('#spin').onclick = spinModal;
  $('#watchAd')?.addEventListener('click', e => busy(e.currentTarget, async () => {
    const watched = await N.showRewarded().catch(() => { throw new Error('No video available right now. Try again later.'); });
    if (!watched) return toast('Watch the whole video to get the coins', true);
    const r = await api('/api/reward/ad', { method: 'POST' });
    me = r.user; toast(`+${fmt(r.coins)} coins!`); coinsScreen();
  }));
  const shareRef = () => N.share('Ludo Real', `Play Ludo Real with me! Use my code ${me.refCode} to get ${fmt(config.referralCoins ?? 500)} free coins.`, linkUrl(config.links.share));
  $('#shareRef').onclick = shareRef;
  $('#copyRef').onclick = async () => { try { await navigator.clipboard.writeText(me.refCode); toast('Code copied'); } catch { toast(me.refCode); } };
  $('#useRef')?.addEventListener('click', e => busy(e.currentTarget, async () => {
    const r = await api('/api/referral', { method: 'POST', body: { code: $('#refIn').value } });
    me = r.user; toast(`+${r.coins} coins!`); coinsScreen();
  }));
  if (focus === 'refer') $('#referRow').scrollIntoView({ block: 'center' });
  setBack(() => { menuScreen(); return true; });
}

function spinModal() {
  const prizes = config.spinPrizes, seg = 360 / prizes.length;
  const colors = ['#ff6b6b', '#4dabf7', '#51cf66', '#b197fc', '#ff922b', '#20c997', '#f06595', '#fcc419'];
  const wheel = `<svg viewBox="-110 -110 220 220" class="wheel"><g id="wheelG">${prizes.map((p, i) => {
    const a0 = (i * seg - 90 - seg / 2) * Math.PI / 180, a1 = ((i + 1) * seg - 90 - seg / 2) * Math.PI / 180, mid = (i * seg - 90) * Math.PI / 180;
    return `<path d="M0 0 L${100 * Math.cos(a0)} ${100 * Math.sin(a0)} A100 100 0 0 1 ${100 * Math.cos(a1)} ${100 * Math.sin(a1)}Z" fill="${colors[i]}" stroke="#fff" stroke-width="2"/>
      <text x="${66 * Math.cos(mid)}" y="${66 * Math.sin(mid)}" transform="rotate(${i * seg} ${66 * Math.cos(mid)} ${66 * Math.sin(mid)})" text-anchor="middle" dominant-baseline="middle" font-family="Lilita One, sans-serif" font-size="17" fill="#fff" stroke="#00000055" stroke-width="3" paint-order="stroke">${fmt(p)}</text>`;
  }).join('')}</g><circle r="104" fill="none" stroke="#ffd43b" stroke-width="8"/><circle r="16" fill="#fff" stroke="#c76b00" stroke-width="4"/><path d="M-12 -118 L12 -118 L0 -92Z" fill="#e03131" stroke="#fff" stroke-width="3"/></svg>`;
  const waitMs = me.spinAt ? me.spinAt - Date.now() : 0;
  const m = modal('Daily Spin', `<div class="spin-box">${wheel}
    ${waitMs > 0 ? `<p class="hint-c">Next free spin in <b>${Math.floor(waitMs / 3600e3)}h ${Math.floor(waitMs / 60e3) % 60}m</b></p>` : '<button class="btn-green wide" id="doSpin">SPIN</button>'}</div>`);
  $('#doSpin', m.el)?.addEventListener('click', e => busy(e.currentTarget, async () => {
    const r = await api('/api/spin', { method: 'POST' });
    const g = $('#wheelG', m.el);
    sfx.roll();
    g.style.transition = 'transform 4s cubic-bezier(.17,.67,.12,.99)';
    g.style.transform = `rotate(${360 * 6 - r.index * seg}deg)`;
    await sleep(4100);
    me = r.user; refreshCoins(); sfx.home();
    $('.spin-box', m.el).insertAdjacentHTML('beforeend', `<p class="won-coins">${ico.coin}<b>+${fmt(r.coins)}</b></p>`);
    e.target.remove();
    $('.wheel-btn')?.classList.remove('ready');
  }));
}

// ---------- leaderboard, history, settings, profile ----------
async function leaderboardModal(period = 'current') {
  document.querySelectorAll('.modal-wrap').forEach(x => x.remove());
  const m = modal('LeaderBoard', `<div class="seg2">${[['last', 'Last Month'], ['current', 'Current Month']].map(([k, l]) => `<button data-p="${k}" class="${k === period ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="lb-head"><span>Rank</span><span>Name</span><span>Coins won</span></div><div id="lb"><div class="dice-loader small"><span></span><span></span></div></div>`, { cls: 'tall' });
  $$('[data-p]', m.el).forEach(b => b.onclick = () => leaderboardModal(b.dataset.p));
  try {
    const { rows } = await api(`/api/leaderboard?period=${period}`);
    $('#lb', m.el).innerHTML = rows.length ? rows.map((r, i) => `<div class="lb-row ${i < 3 ? 'top' : ''} ${r.id === me.id ? 'me' : ''}">
      <span class="rank">${i < 3 ? `<i class="ribbon">${i + 1}</i>` : i + 1}</span>${avatarHtml(r, 'xs')}<b>${esc(r.name)}</b><span>${fmt(r.coins)}</span></div>`).join('')
      : '<p class="hint-c">No winners yet this month. Be the first!</p>';
  } catch (err) { $('#lb', m.el).innerHTML = `<p class="hint-c">${esc(err.message)}</p>`; }
}

async function historyModal() {
  const m = modal('Game History', '<div id="hist"><div class="dice-loader small"><span></span><span></span></div></div>', { cls: 'tall' });
  try {
    const rows = await api('/api/history');
    $('#hist', m.el).innerHTML = rows.length ? rows.map(h => `<div class="tx"><span>${h.kind === 'friends' ? 'Friends room' : h.kind === 'timer' ? 'Timer table' : 'Table'} · ${h.players} players
      <small>Winner: ${esc(h.winner_name)}</small></span><b class="${h.won ? 'plus' : 'minus'}">${h.won ? `+${fmt(h.prize)}` : `-${fmt(h.entry)}`}</b></div>`).join('') : '<p class="hint-c">No games played yet.</p>';
  } catch (err) { $('#hist', m.el).innerHTML = `<p class="hint-c">${esc(err.message)}</p>`; }
}

function settingsModal() {
  const L1 = config.links;
  const m = modal('Settings', `
    <div class="set-row"><span>Sound</span><span class="row-c"><button class="tog-btn ${isMuted() ? 'off' : ''}" id="sOn">${ico.sound}</button><button class="tog-btn ${isMuted() ? '' : 'off'}" id="sOff">${ico.mute}</button></span></div>
    <div class="set-row"><span>Vibration</span><button class="tog-btn ${N.vibrationEnabled() ? '' : 'off'}" id="vib">${ico.vibrate}</button></div>
    <div class="set-row"><span>Game Chat</span><button class="tog-btn ${pref('lr_chat', '1') === '1' ? '' : 'off'}" id="chatT">${ico.chat}</button></div>
    <div class="set-row"><span>Share</span><button class="tog-btn" id="shareApp">${ico.share}</button></div>
    <div class="set-row"><span>Edit Profile</span><button class="view-btn" id="prof">Edit</button></div>
    <div class="set-row"><span>Privacy Policy</span><button class="view-btn" id="priv">View</button></div>
    ${L1.contact ? `<div class="set-row"><span>Contact Us</span><button class="view-btn" id="contact">View</button></div>` : ''}
    <div class="set-row"><span>Log Out</span><button class="view-btn" id="logout">Log Out</button></div>
    <p class="hint-c small">Signed in ${me.provider === 'google.com' ? 'with Google' : 'as guest'} · v1.0</p>`, { cls: 'tall' });
  const snd = muted => { setMuted(muted); $('#sOn', m.el).classList.toggle('off', muted); $('#sOff', m.el).classList.toggle('off', !muted); };
  $('#sOn', m.el).onclick = () => snd(false);
  $('#sOff', m.el).onclick = () => snd(true);
  $('#vib', m.el).onclick = e => { N.setVibration(!N.vibrationEnabled()); e.currentTarget.classList.toggle('off', !N.vibrationEnabled()); N.vibrate(60); };
  $('#chatT', m.el).onclick = e => { const on = pref('lr_chat', '1') !== '1'; setPref('lr_chat', on ? '1' : '0'); e.currentTarget.classList.toggle('off', !on); };
  $('#shareApp', m.el).onclick = () => N.share('Ludo Real', 'Play Ludo Real with me!', linkUrl(L1.share));
  $('#prof', m.el).onclick = () => { m.el.remove(); profileModal(); };
  $('#priv', m.el).onclick = () => N.openUrl(linkUrl(L1.privacy));
  $('#contact', m.el)?.addEventListener('click', () => N.openUrl(`mailto:${L1.contact}`));
  $('#logout', m.el).onclick = async () => {
    if (me.provider !== 'google.com' && !confirm('You are playing as a guest. Your progress is saved on this phone only: tap "Play as Guest" to come back. If you uninstall the app or clear its data, it’s lost. Log out?')) return;
    await N.signOutNative(); setToken(null); m.el.remove(); signInScreen();
  };
}

function profileModal() {
  let pick = me.avatar;
  const m = modal('Profile', `
    <div class="prof-top">${meAvatar('lg')}<div><b>${esc(me.name)}</b><small>Played ${me.played} · Won ${me.won}</small></div></div>
    <div class="field"><label>Name</label><input class="text-in" id="nm" maxlength="16" value="${esc(me.name)}"></div>
    ${me.photo ? '' : `<div class="field"><label>Avatar</label><div class="av-grid">${Array.from({ length: 8 }, (_, i) => `<button data-av="${i}" class="${i === me.avatar ? 'on' : ''}">${avatarSvg(i)}</button>`).join('')}</div></div>`}
    <button class="btn-green wide" id="save">Save</button>`);
  $$('[data-av]', m.el).forEach(b => b.onclick = () => { pick = +b.dataset.av; $$('[data-av]', m.el).forEach(x => x.classList.toggle('on', x === b)); });
  $('#save', m.el).onclick = e => busy(e.currentTarget, async () => {
    const r = await api('/api/me', { method: 'PATCH', body: { name: $('#nm', m.el).value, avatar: pick } });
    me = r.user; m.el.remove(); toast('Profile saved'); menuScreen();
  });
}

boot();
