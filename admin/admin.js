// Ludo Real admin panel (ludoreal.in).
const root = document.getElementById('root');
const TOKEN = 'lr_admin_token';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('en-IN');
const when = s => s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const ago = s => {
  if (!s) return 'never';
  const m = Math.round((Date.now() - new Date(s.replace(' ', 'T') + 'Z')) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
const COLORS = { red: '#f03e3e', green: '#2fb344', yellow: '#fab005', blue: '#228be6' };
const AV_BG = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#b197fc', '#ff922b', '#20c997', '#f06595'];
const KIND = { table: 'Table', timer: 'Timer', friends: 'Friends' };

const S = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ic = {
  dash: S('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  users: S('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>'),
  game: S('<rect x="2" y="7" width="20" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="17.5" cy="13.8" r=".9" fill="currentColor"/>'),
  trophy: S('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a4 4 0 0 1-3 3.9M7 5H4v2a4 4 0 0 0 3 3.9"/>'),
  gear: S('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  coin: S('<ellipse cx="12" cy="7" rx="8" ry="3"/><path d="M4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5"/>'),
  logout: S('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  x: S('<path d="M18 6L6 18M6 6l12 12"/>'),
  menu: S('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  live: S('<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5"/>'),
  dice: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4.5" fill="#fff"/><circle cx="8" cy="8" r="1.6" fill="#1d2140"/><circle cx="16" cy="16" r="1.6" fill="#1d2140"/><circle cx="12" cy="12" r="1.6" fill="#e03131"/><circle cx="16" cy="8" r="1.6" fill="#1d2140"/><circle cx="8" cy="16" r="1.6" fill="#1d2140"/></svg>`,
};
const brand = `<div class="brand"><span class="brand-ico">${ic.dice}</span><div>Ludo Real<br><small>Admin panel</small></div></div>`;
const av = u => u?.photo ? `<span class="av"><img src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer"></span>`
  : `<span class="av" style="background:${AV_BG[(u?.avatar || 0) % 8]}">${esc((u?.name || '?')[0].toUpperCase())}</span>`;

// ---------- api / ui helpers ----------
async function api(path, { method = 'GET', body } = {}) {
  const t = localStorage.getItem(TOKEN);
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && t) { localStorage.removeItem(TOKEN); login(); throw new Error('Session expired, please log in again'); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
function toast(msg, bad = false) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const el = document.createElement('div');
  el.className = `toast ${bad ? 'bad' : ''}`; el.textContent = msg; box.append(el);
  setTimeout(() => el.remove(), 3200);
}
async function busy(btn, fn) {
  btn.disabled = true; btn.classList.add('busy');
  try { return await fn(); } catch (err) { toast(err.message, true); } finally { btn.disabled = false; btn.classList.remove('busy'); }
}
function modal(title, html) {
  const w = document.createElement('div');
  w.className = 'modal-wrap';
  w.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h3>${esc(title)}</h3><button class="x" data-x aria-label="Close">${ic.x}</button></div><div class="modal-body">${html}</div></div>`;
  const close = () => w.remove();
  w.addEventListener('click', e => { if (e.target === w || e.target.closest('[data-x]')) close(); });
  document.body.append(w);
  return { el: w, close };
}

// ---------- login ----------
function login() {
  clearInterval(liveTimer);
  root.innerHTML = `<div class="login"><form class="login-card" id="lf">${brand}
    <div class="field"><label>Username</label><input class="input" name="username" autocomplete="username" required></div>
    <div class="field"><label>Password</label><input class="input" name="password" type="password" autocomplete="current-password" required></div>
    <button class="btn" style="width:100%">Log in</button></form></div>`;
  $('#lf').onsubmit = e => {
    e.preventDefault();
    busy(e.submitter, async () => {
      const r = await api('/api/admin/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      localStorage.setItem(TOKEN, r.token);
      location.hash = '#dashboard'; route();
    });
  };
}

// ---------- shell ----------
let liveCount = 0, liveTimer = null;
function shell(page, html) {
  const link = (id, icon, label, extra = '') => `<a href="#${id}" class="${page === id ? 'on' : ''}">${ic[icon]}${label}${extra}</a>`;
  root.innerHTML = `
    <div class="topbar">${brand}<button class="x" id="menu" aria-label="Menu">${ic.menu}</button></div>
    <div class="layout">
      <aside class="side" id="side">${brand}
        <nav class="nav">
          ${link('dashboard', 'dash', 'Dashboard')}
          ${link('players', 'users', 'Players')}
          ${link('games', 'game', 'Games', liveCount ? `<span class="pill">${liveCount} live</span>` : '')}
          ${link('leaderboard', 'trophy', 'Leaderboard')}
          ${link('settings', 'gear', 'App settings')}
        </nav>
        <nav class="nav"><small class="muted" style="padding:0 12px;font-weight:700;letter-spacing:.06em">DEVELOPER API</small>
          ${link('api', 'users', 'Developers')}
          ${link('plans', 'coin', 'Plans &amp; pricing')}
          ${link('apilogs', 'live', 'API log')}
        </nav>
        <div class="side-foot"><a class="btn ghost sm" href="/" target="_blank">Open website</a><button class="btn ghost sm" id="logout">${ic.logout} Log out</button></div>
      </aside>
      <main class="main">${html}</main>
    </div>`;
  $('#logout').onclick = () => { localStorage.removeItem(TOKEN); login(); };
  $('#menu').onclick = () => $('#side').classList.toggle('open');
  $$('.nav a').forEach(a => a.addEventListener('click', () => $('#side').classList.remove('open')));
}

// ---------- dashboard ----------
async function dashboard() {
  shell('dashboard', '<p class="muted">Loading…</p>');
  const s = await api('/api/admin/stats');
  liveCount = s.live.playing + s.live.waiting;
  const kpi = (icon, cls, value, label) => `<div class="card kpi"><span class="ki ${cls}">${ic[icon]}</span><div><b>${value}</b><span>${label}</span></div></div>`;
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5); return d.toISOString().slice(0, 10); });
  const max = Math.max(1, ...s.daily.map(d => d.n));
  shell('dashboard', `
    <div class="head"><div><h1>Dashboard</h1><p class="muted" style="margin:2px 0 0">Ludo Real at a glance</p></div><button class="btn ghost" id="refresh">Refresh</button></div>
    <div class="kpis">
      ${kpi('users', 'c1', fmt(s.users), `Players · +${fmt(s.usersToday)} today`)}
      ${kpi('live', 'c2', fmt(s.live.playing), `Games live · ${fmt(s.live.waiting)} waiting`)}
      ${kpi('users', 'c3', fmt(s.activeToday), 'Active in last 24h')}
      ${kpi('game', 'c2', fmt(s.gamesToday), `Games today · ${fmt(s.gamesTotal)} total`)}
      ${kpi('coin', 'c1', fmt(s.coinsTotal), 'Coins held by players')}
      ${kpi('trophy', 'c1', fmt(s.coinsWonToday), `Coins won today · ${fmt(s.spinsToday)} spins`)}
      ${kpi('users', 'c3', `${fmt(s.google)} / ${fmt(s.guests)}`, 'Google / Guest accounts')}
      ${kpi('x', 'c4', fmt(s.banned), 'Blocked players')}
    </div>
    <div class="two">
      <div class="card"><div class="sec"><h3>New players · last 14 days</h3></div>
        <div class="bars">${days.map(d => { const n = s.daily.find(x => x.d === d)?.n || 0; return `<div><b>${n || ''}</b><span class="track"><i style="height:${(n / max) * 100}%"></i></span><small>${d.slice(8)}</small></div>`; }).join('')}</div></div>
      <div class="card"><div class="sec"><h3>Newest players</h3><a class="btn ghost sm" href="#players">All</a></div>
        ${s.newest.length ? s.newest.map(u => `<div class="list-row click" data-user="${u.id}"><span class="who">${av(u)}<span>${esc(u.name)}<small>${u.provider === 'google.com' ? 'Google' : 'Guest'} · ${ago(u.createdAt)}</small></span></span><b>${fmt(u.coins)}</b></div>`).join('') : '<p class="empty">No players yet.</p>'}
        ${s.byKind.length ? `<p class="muted small" style="margin:12px 0 0">Last 7 days: ${s.byKind.map(k => `${KIND[k.kind] || k.kind} ${fmt(k.n)}`).join(' · ')} games</p>` : ''}
      </div>
    </div>`);
  $('#refresh').onclick = dashboard;
  $$('[data-user]').forEach(r => r.onclick = () => playerModal(+r.dataset.user, dashboard));
}

// ---------- players ----------
const pState = { q: '', sort: 'new', filter: '' };
async function players() {
  shell('players', `
    <div class="head"><h1>Players</h1><span class="muted" id="count"></span></div>
    <div class="toolbar">
      <input class="input" id="q" placeholder="Search name, ID or referral code" value="${esc(pState.q)}">
      <div class="chips" id="filter">${[['', 'All'], ['google', 'Google'], ['guest', 'Guest'], ['banned', 'Blocked']].map(([k, l]) => `<button data-f="${k}" class="${pState.filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="chips" id="sort">${[['new', 'Newest'], ['coins', 'Most coins'], ['won', 'Most wins']].map(([k, l]) => `<button data-s="${k}" class="${pState.sort === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    <div class="card table-wrap" style="padding:4px" id="list"><p class="empty">Loading…</p></div>`);
  let t;
  const load = async () => {
    const rows = await api(`/api/admin/users?q=${encodeURIComponent(pState.q)}&sort=${pState.sort}&filter=${pState.filter}`);
    $('#count').textContent = `${rows.length}${rows.length === 200 ? '+' : ''} shown`;
    $('#list').innerHTML = rows.length ? `<table><thead><tr><th>Player</th><th>Login</th><th>Coins</th><th>Played / Won</th><th>Last seen</th><th>Joined</th><th>Status</th></tr></thead><tbody>
      ${rows.map(u => `<tr class="click" data-user="${u.id}"><td><div class="who">${av(u)}<div><b>${esc(u.name)}</b><div class="muted small">#${u.id} · ${esc(u.refCode)}</div></div></div></td>
        <td>${u.provider === 'google.com' ? '<span class="tag b">Google</span>' : '<span class="tag">Guest</span>'}</td><td><b>${fmt(u.coins)}</b></td>
        <td>${fmt(u.played)} / ${fmt(u.won)}</td><td class="muted">${ago(u.lastSeen)}</td><td class="muted">${when(u.createdAt)}</td>
        <td>${u.banned ? '<span class="tag r">Blocked</span>' : '<span class="tag g">Active</span>'}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">No players found.</p>';
    $$('[data-user]').forEach(r => r.onclick = () => playerModal(+r.dataset.user, load));
  };
  $('#q').oninput = e => { clearTimeout(t); t = setTimeout(() => { pState.q = e.target.value; load(); }, 250); };
  $$('[data-f]').forEach(b => b.onclick = () => { pState.filter = b.dataset.f; players(); });
  $$('[data-s]').forEach(b => b.onclick = () => { pState.sort = b.dataset.s; players(); });
  load().catch(err => toast(err.message, true));
}

async function playerModal(id, reload) {
  const d = await api(`/api/admin/users/${id}`);
  const u = d.user;
  const m = modal(u.name, `
    <div class="prof">${av(u)}<div><h2>${esc(u.name)}</h2><p class="muted small" style="margin:2px 0 0">#${u.id} · ${u.provider === 'google.com' ? 'Google' : 'Guest'} · joined ${when(u.createdAt)} · seen ${ago(u.lastSeen)}</p>
      <p class="muted small" style="margin:2px 0 0">Referral code ${esc(u.refCode)} · invited ${fmt(d.referrals)}${d.referredBy ? ` · joined via ${esc(d.referredBy)}` : ''}</p></div></div>
    <div class="stat-row"><div><b>${fmt(u.coins)}</b><span>Coins</span></div><div><b>${fmt(u.played)}</b><span>Played</span></div><div><b>${fmt(u.won)}</b><span>Won</span></div>
      <div><b>${u.played ? Math.round(u.won / u.played * 100) : 0}%</b><span>Win rate</span></div></div>
    <form id="coinsF" class="card" style="margin-bottom:14px"><div class="sec"><h3>Give or take coins</h3></div>
      <div class="row"><div class="field"><label>Amount (use minus to take)</label><input class="input" name="coinsDelta" type="number" step="1" placeholder="e.g. 500 or -200" required></div>
        <div class="field"><label>Reason</label><input class="input" name="note" maxlength="80" placeholder="e.g. Contest prize"></div></div>
      <button class="btn green">Apply</button></form>
    <form id="nameF" class="row" style="margin-bottom:14px"><div class="field"><label>Display name</label><input class="input" name="name" value="${esc(u.name)}" maxlength="16"></div><button class="btn ghost" style="margin-bottom:14px">Rename</button></form>
    <div style="margin-bottom:18px">${u.banned ? '<button class="btn green" id="ban" data-v="0">Unblock player</button>' : '<button class="btn red" id="ban" data-v="1">Block player</button>'}
      <span class="muted small" style="margin-left:8px">Blocked players can't sign in or play.</span></div>
    <div class="two"><div><h3 style="margin-bottom:8px">Recent games</h3>${d.games.length ? d.games.map(g => `<div class="list-row"><span>${KIND[g.kind]} · ${g.players}P · entry ${fmt(g.entry)}<small>${when(g.finished_at)} · winner ${esc(g.winner_name)}</small></span><span class="${g.won ? 'plus' : 'minus'}">${g.won ? `+${fmt(g.prize)}` : `-${fmt(g.entry)}`}</span></div>`).join('') : '<p class="muted small">No games yet.</p>'}</div>
      <div><h3 style="margin-bottom:8px">Coin history</h3>${d.transactions.length ? d.transactions.map(t => `<div class="list-row"><span>${esc(t.note || t.type)}<small>${when(t.created_at)}</small></span><span class="${t.amount >= 0 ? 'plus' : 'minus'}">${t.amount >= 0 ? '+' : ''}${fmt(t.amount)}</span></div>`).join('') : '<p class="muted small">No activity.</p>'}</div></div>`);
  const save = (btn, body, msg) => busy(btn, async () => { await api(`/api/admin/users/${id}`, { method: 'PATCH', body }); toast(msg); m.close(); reload?.(); playerModal(id, reload); });
  $('#coinsF', m.el).onsubmit = e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); save(e.submitter, f, `${Number(f.coinsDelta) > 0 ? 'Added' : 'Removed'} ${fmt(Math.abs(f.coinsDelta))} coins`); };
  $('#nameF', m.el).onsubmit = e => { e.preventDefault(); save(e.submitter, { name: new FormData(e.target).get('name') }, 'Name updated'); };
  $('#ban', m.el).onclick = e => {
    const block = e.currentTarget.dataset.v === '1';
    if (block && !confirm(`Block ${u.name}? They will be removed from any game they are in.`)) return;
    save(e.currentTarget, { banned: block }, block ? 'Player blocked' : 'Player unblocked');
  };
}

// ---------- games ----------
let gKind = '';
async function games() {
  shell('games', `
    <div class="head"><div><h1>Games</h1><p class="muted" style="margin:2px 0 0">Live games refresh every 5 seconds</p></div></div>
    <div class="card" style="margin-bottom:16px"><div class="sec"><h3>Live now</h3></div><div id="live" class="grid"><p class="muted">Loading…</p></div></div>
    <div class="sec"><h3>Recent games</h3><div class="chips">${[['', 'All'], ['table', 'Table'], ['timer', 'Timer'], ['friends', 'Friends']].map(([k, l]) => `<button data-k="${k}" class="${gKind === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="card table-wrap" style="padding:4px" id="past"><p class="empty">Loading…</p></div>`);
  $$('[data-k]').forEach(b => b.onclick = () => { gKind = b.dataset.k; games(); });
  const loadLive = async () => {
    if (!$('#live')) return clearInterval(liveTimer);
    const rows = await api('/api/admin/games/live');
    liveCount = rows.length;
    $('#live').innerHTML = rows.length ? rows.map(r => `<div class="card live-card" style="background:var(--card2)">
      <div class="sec" style="margin:0"><div><b>#${r.id} · ${KIND[r.kind]}</b> <span class="tag ${r.status === 'playing' ? 'g' : 'y'}">${r.status}</span>
        ${r.botsFilled ? '<span class="tag">with computer</span>' : ''}${r.code ? ` <span class="tag b">code ${esc(r.code)}</span>` : ''}</div>
        <button class="btn red sm" data-cancel="${r.id}">Cancel &amp; refund</button></div>
      <div class="muted small">Entry ${fmt(r.entry)} · prize ${fmt(r.prize)} · ${r.winTokens === 4 ? 'Classic' : `${r.winTokens} goti`} · ${r.cut ? 'cut' : 'no cut'}${r.turn ? ` · turn: ${esc(r.turn)}` : ''}</div>
      <div class="seat-row">${r.seats.map(s => `<span class="seat"><span class="dot" style="background:${COLORS[s.color] || '#868e96'}">${r.progress && s.color ? r.progress[s.color] : ''}</span>${esc(s.name)}${s.bot ? ' 🤖' : ''}</span>`).join('')}</div></div>`).join('')
      : '<p class="muted">No games running right now.</p>';
    $$('[data-cancel]').forEach(b => b.onclick = e => {
      if (!confirm('Cancel this game and refund every player\'s entry?')) return;
      busy(e.currentTarget, async () => { await api(`/api/admin/games/${b.dataset.cancel}/cancel`, { method: 'POST' }); toast('Game cancelled and refunded'); loadLive(); });
    });
  };
  clearInterval(liveTimer);
  loadLive().catch(err => toast(err.message, true));
  liveTimer = setInterval(() => loadLive().catch(() => {}), 5000);
  const rows = await api(`/api/admin/games${gKind ? `?kind=${gKind}` : ''}`);
  $('#past').innerHTML = rows.length ? `<table><thead><tr><th>Game</th><th>Players</th><th>Entry</th><th>Prize</th><th>Winner</th><th>Finished</th></tr></thead><tbody>
    ${rows.map(g => `<tr><td><b>#${g.id}</b> ${KIND[g.kind]} ${g.status === 'cancelled' ? '<span class="tag r">cancelled</span>' : ''}</td>
      <td>${g.seats.map(s => `${esc(s.name)}${s.bot ? ' 🤖' : ''}`).join(', ')}</td><td>${fmt(g.entry)}</td><td>${fmt(g.prize)}</td>
      <td>${g.winner_name ? `${esc(g.winner_name)}${g.winner_id ? '' : ' 🤖'}` : '—'}</td><td class="muted">${when(g.finished_at)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">No finished games yet.</p>';
}

// ---------- leaderboard ----------
let lbPeriod = 'current';
async function leaderboard() {
  shell('leaderboard', `<div class="head"><h1>Leaderboard</h1><div class="chips">${[['current', 'This month'], ['last', 'Last month']].map(([k, l]) => `<button data-p="${k}" class="${lbPeriod === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="card table-wrap" style="padding:4px" id="lb"><p class="empty">Loading…</p></div>`);
  $$('[data-p]').forEach(b => b.onclick = () => { lbPeriod = b.dataset.p; leaderboard(); });
  const rows = await api(`/api/admin/leaderboard?period=${lbPeriod}`);
  $('#lb').innerHTML = rows.length ? `<table><thead><tr><th>#</th><th>Player</th><th>Wins</th><th>Coins won</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr class="click" data-user="${r.id}"><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td><div class="who">${av(r)}<b>${esc(r.name)}</b></div></td><td>${fmt(r.wins)}</td><td><b>${fmt(r.coins)}</b></td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">No winners in this period yet.</p>';
  $$('[data-user]').forEach(r => r.onclick = () => playerModal(+r.dataset.user, leaderboard));
}

// ---------- app settings ----------
async function settings() {
  shell('settings', '<p class="muted">Loading…</p>');
  const { values: v } = await api('/api/admin/settings');
  shell('settings', `
    <div class="head"><div><h1>App settings</h1><p class="muted" style="margin:2px 0 0">Changes reach the app the next time players open it.</p></div></div>
    <form class="card" id="sf" style="max-width:820px">
      <div class="field"><label>Notice (shown under the bell in the app)</label><textarea class="input" name="notice" maxlength="500">${esc(v.notice)}</textarea></div>
      <div class="settings-grid">
        <div class="field"><label>Welcome coins for new players</label><input class="input" name="welcomeCoins" type="number" min="0" value="${esc(v.welcomeCoins)}"></div>
        <div class="field"><label>Refer &amp; Earn coins (each player)</label><input class="input" name="referralCoins" type="number" min="0" value="${esc(v.referralCoins)}"></div>
        <div class="field"><label>WhatsApp link</label><input class="input" name="whatsapp" placeholder="https://chat.whatsapp.com/…" value="${esc(v.whatsapp)}"><span class="hint">Leave empty to hide the button.</span></div>
        <div class="field"><label>Telegram link</label><input class="input" name="telegram" placeholder="https://t.me/…" value="${esc(v.telegram)}"><span class="hint">Leave empty to hide the button.</span></div>
        <div class="field"><label>YouTube link</label><input class="input" name="youtube" placeholder="https://youtube.com/…" value="${esc(v.youtube)}"></div>
        <div class="field"><label>Contact email (Settings → Contact Us)</label><input class="input" name="contact" type="email" placeholder="support@ludoreal.in" value="${esc(v.contact)}"></div>
      </div>
      <div class="field"><label>Google Play link (landing page download button)</label><input class="input" name="playStoreUrl" placeholder="https://play.google.com/store/apps/details?id=…" value="${esc(v.playStoreUrl)}"><span class="hint">Leave empty to show “Coming soon” on ludoreal.in.</span></div>
      <div class="field"><label>Share / app link</label><input class="input" name="share" value="${esc(v.share)}"><span class="hint">Used by Share and Refer &amp; Earn. Your Play Store link.</span></div>
      <div class="sec" style="margin:22px 0 10px;padding-top:16px;border-top:1px solid var(--line)"><h3>Ads (AdMob)</h3>
        <label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="hidden" name="adsEnabled" value="0"><input type="checkbox" name="adsEnabled" value="1" ${v.adsEnabled === '1' ? 'checked' : ''} style="width:18px;height:18px;accent-color:#fab005"> Show ads in the app</label></div>
      <p class="hint" style="margin:-4px 0 14px">The ad unit IDs come from your AdMob account (Apps → Ad units). Values starting with <code>ca-app-pub-3940256099942544</code> are Google's test ads: replace them before publishing. Changes reach players the next time they open the app.</p>
      <div class="settings-grid">
        <div class="field"><label>Banner ad unit ID</label><input class="input" name="admobBanner" placeholder="ca-app-pub-…/…" value="${esc(v.admobBanner)}"><span class="hint">Shown at the bottom of the screens. Empty = no banner.</span></div>
        <div class="field"><label>Interstitial ad unit ID</label><input class="input" name="admobInterstitial" placeholder="ca-app-pub-…/…" value="${esc(v.admobInterstitial)}"><span class="hint">Full-screen ad after games. Empty = none.</span></div>
        <div class="field"><label>Rewarded ad unit ID</label><input class="input" name="admobRewarded" placeholder="ca-app-pub-…/…" value="${esc(v.admobRewarded)}"><span class="hint">"Watch a video for coins". Empty = hidden.</span></div>
        <div class="field"><label>Full-screen ad after every … games</label><input class="input" name="interstitialEvery" type="number" min="0" value="${esc(v.interstitialEvery)}"><span class="hint">0 = never.</span></div>
        <div class="field"><label>Coins per rewarded video</label><input class="input" name="rewardCoins" type="number" min="0" value="${esc(v.rewardCoins)}"></div>
        <div class="field"><label>Rewarded videos per player per day</label><input class="input" name="rewardDailyLimit" type="number" min="0" value="${esc(v.rewardDailyLimit)}"></div>
      </div>
      <button class="btn">Save settings</button>
    </form>`);
  $('#sf').onsubmit = e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    body.adsEnabled = new FormData(e.target).getAll('adsEnabled').includes('1') ? '1' : '0';   // checkbox + hidden fallback
    busy(e.submitter, async () => { await api('/api/admin/settings', { method: 'PUT', body }); toast('Settings saved'); });
  };
}


// ---------- developer API: developers ----------
let devFilter = '';
async function apiDevelopers() {
  shell('api', '<p class="muted">Loading…</p>');
  const [o, list] = await Promise.all([api('/api/admin/api/overview'), api(`/api/admin/api/developers?filter=${devFilter}`)]);
  const kpi = (icon, cls, value, label) => `<div class="card kpi"><span class="ki ${cls}">${ic[icon]}</span><div><b>${value}</b><span>${label}</span></div></div>`;
  shell('api', `
    <div class="head"><div><h1>Developer API</h1><p class="muted" style="margin:2px 0 0">Developers use <a href="https://api.ludoreal.in" target="_blank" style="color:var(--yellow)">api.ludoreal.in</a></p></div>
      <div class="chips">${[['', 'All'], ['pending', `Plan requests (${o.pendingRequests})`], ['suspended', 'Suspended']].map(([k, l]) => `<button data-df="${k}" class="${devFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="kpis">
      ${kpi('users', 'c1', fmt(o.developers), `Developers · +${fmt(o.newThisWeek)} this week`)}
      ${kpi('live', 'c2', fmt(o.callsToday), `API calls today · ${fmt(o.errorsToday)} errors`)}
      ${kpi('coin', 'c1', fmt(o.creditsToday), 'Credits used today')}
      ${kpi('game', 'c3', fmt(o.roomsToday), 'API rooms created today')}
    </div>
    <div class="card table-wrap" style="padding:4px">${list.length ? `<table><thead><tr><th>Developer</th><th>Plan</th><th>Credits left</th><th>Calls this month</th><th>Joined</th><th>Status</th></tr></thead><tbody>
      ${list.map(d => `<tr class="click" data-dev="${d.id}"><td><b>${esc(d.name)}</b><div class="muted small">${esc(d.email)}${d.company ? ` · ${esc(d.company)}` : ''}</div></td>
        <td>${esc(d.plan || '—')}${d.requested ? ` <span class="tag y">wants ${esc(d.requested)}</span>` : ''}</td><td>${fmt(d.credits)}${d.bonusCredits ? ` <span class="muted small">+${fmt(d.bonusCredits)} extra</span>` : ''}</td>
        <td>${fmt(d.callsMonth)}</td><td class="muted">${when(d.createdAt)}</td><td>${d.status === 'active' ? '<span class="tag g">Active</span>' : '<span class="tag r">Suspended</span>'}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">No developers here yet.</p>'}</div>`);
  $$('[data-df]').forEach(b => b.onclick = () => { devFilter = b.dataset.df; apiDevelopers(); });
  $$('[data-dev]').forEach(r => r.onclick = () => devModal(+r.dataset.dev, apiDevelopers));
}

async function devModal(id, reload) {
  const [d, { plans }] = await Promise.all([api(`/api/admin/api/developers/${id}`), api('/api/admin/api/plans')]);
  const v = d.dev;
  const m = modal(v.name, `
    <p class="muted small" style="margin:-4px 0 12px">${esc(v.email)}${v.company ? ` · ${esc(v.company)}` : ''} · joined ${when(v.createdAt)}</p>
    ${v.requestedPlan ? `<div class="card" style="margin-bottom:14px;border-color:var(--yellow)"><b>Requested plan: ${esc(v.requestedPlan.name)}</b> (${esc(v.requestedPlan.price || '')})
      <div class="row" style="margin-top:10px"><button class="btn green sm" id="approve">Approve</button><button class="btn ghost sm" id="reject">Reject</button></div></div>` : ''}
    <div class="stat-row"><div><b>${esc(v.plan?.name || '—')}</b><span>Plan</span></div><div><b>${fmt(v.credits)}</b><span>Plan credits left</span></div>
      <div><b>${fmt(v.bonusCredits)}</b><span>Extra credits</span></div><div><b>${fmt(d.keys.filter(k => !k.revoked).length)}</b><span>Active keys</span></div></div>
    <form id="planF" class="row" style="margin-bottom:6px"><div class="field"><label>Change plan</label><select class="input" name="planId">${plans.map(p => `<option value="${p.id}" ${p.id === v.plan?.id ? 'selected' : ''}>${esc(p.name)} · ${fmt(p.credits)} credits${p.active ? '' : ' (hidden)'}</option>`).join('')}</select></div>
      <button class="btn sm" style="margin-bottom:14px">Set plan</button></form>
    <p class="hint" style="margin:-6px 0 14px">Setting a plan refills its monthly credits now.</p>
    <form id="credF" class="row"><div class="field"><label>Add extra credits (minus to remove)</label><input class="input" name="addCredits" type="number" step="1" placeholder="e.g. 5000" required></div><button class="btn green sm" style="margin-bottom:14px">Apply</button></form>
    <div class="row" style="margin-bottom:16px">${v.status === 'active' ? '<button class="btn red sm" id="susp">Suspend developer</button>' : '<button class="btn green sm" id="unsusp">Reactivate developer</button>'}
      <button class="btn ghost sm" id="pw">Set new password</button></div>
    <div class="two"><div><h3 style="margin-bottom:8px">API keys</h3>${d.keys.length ? d.keys.map(k => `<div class="list-row"><span><code>${esc(k.prefix)}…</code> ${esc(k.name)}<small>used ${when(k.last_used)}</small></span>${k.revoked ? '<span class="tag r">revoked</span>' : '<span class="tag g">active</span>'}</div>`).join('') : '<p class="muted small">No keys.</p>'}
      <h3 style="margin:14px 0 8px">Rooms</h3><p class="muted small">${d.rooms.map(r => `${r.n} ${r.status}`).join(' · ') || 'None yet'}</p></div>
      <div><h3 style="margin-bottom:8px">Recent requests</h3>${d.logs.length ? d.logs.slice(0, 15).map(l => `<div class="list-row"><span><code>${esc(l.endpoint)}</code><small>${when(l.created_at)} · ${esc(l.ip || '')}</small></span><span><span class="tag ${l.status < 400 ? 'g' : 'r'}">${l.status}</span> ${l.cost}</span></div>`).join('') : '<p class="muted small">No requests yet.</p>'}</div></div>`);
  const save = (btn, body, msg) => busy(btn, async () => { await api(`/api/admin/api/developers/${id}`, { method: 'PATCH', body }); toast(msg); m.close(); reload?.(); devModal(id, reload); });
  $('#approve', m.el)?.addEventListener('click', e => save(e.currentTarget, { approveRequest: true }, 'Plan approved'));
  $('#reject', m.el)?.addEventListener('click', e => save(e.currentTarget, { rejectRequest: true }, 'Request rejected'));
  $('#planF', m.el).onsubmit = e => { e.preventDefault(); save(e.submitter, { planId: +new FormData(e.target).get('planId') }, 'Plan updated'); };
  $('#credF', m.el).onsubmit = e => { e.preventDefault(); save(e.submitter, { addCredits: new FormData(e.target).get('addCredits') }, 'Credits updated'); };
  $('#susp', m.el)?.addEventListener('click', e => { if (confirm('Suspend this developer? Their API keys stop working.')) save(e.currentTarget, { status: 'suspended' }, 'Developer suspended'); });
  $('#unsusp', m.el)?.addEventListener('click', e => save(e.currentTarget, { status: 'active' }, 'Developer reactivated'));
  $('#pw', m.el).onclick = e => { const p = prompt('New password for this developer (min 8 characters):'); if (p) save(e.currentTarget, { newPassword: p }, 'Password changed'); };
}

// ---------- developer API: plans and costs ----------
async function apiPlans() {
  shell('plans', '<p class="muted">Loading…</p>');
  const [{ plans, endpoints }, costs] = await Promise.all([api('/api/admin/api/plans'), api('/api/admin/api/costs')]);
  shell('plans', `
    <div class="head"><div><h1>Plans &amp; pricing</h1><p class="muted" style="margin:2px 0 0">What developers see on api.ludoreal.in</p></div><button class="btn" id="newPlan">New plan</button></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));margin-bottom:22px">
      ${plans.map(p => `<div class="card" style="${p.active ? '' : 'opacity:.6'}"><div class="sec" style="margin-bottom:6px"><h3>${esc(p.name)}</h3><span>${p.isDefault ? '<span class="tag y">default</span>' : ''} ${p.active ? '' : '<span class="tag">hidden</span>'}</span></div>
        <div style="font-size:22px;font-weight:800;color:var(--yellow)">${esc(p.price || '—')}</div>
        <p class="muted small" style="margin:4px 0 8px">${fmt(p.credits)} credits / month · ${fmt(p.ratePerMin)} req/min · ${fmt(p.developers)} developer${p.developers === 1 ? '' : 's'}</p>
        <div class="seat-row" style="margin-bottom:12px">${endpoints.filter(e => !e.always).map(e => `<span class="tag ${p.endpoints.includes(e.key) ? 'g' : ''}" style="${p.endpoints.includes(e.key) ? '' : 'opacity:.45;text-decoration:line-through'}">${esc(e.key)}</span>`).join('')}</div>
        <button class="btn ghost sm" data-edit="${p.id}">Edit plan</button></div>`).join('')}
    </div>
    <form class="card" id="costF" style="max-width:820px"><div class="sec"><h3>Credits per request</h3><span class="muted small">Charged only when a request succeeds</span></div>
      <table><thead><tr><th>Endpoint</th><th>What it does</th><th style="width:130px">Credits</th></tr></thead><tbody>
        ${costs.map(c => `<tr><td><code>${esc(c.method)} ${esc(c.path)}</code></td><td class="muted">${esc(c.title)}</td><td><input class="input" type="number" min="0" step="1" name="${esc(c.key)}" value="${c.cost}"></td></tr>`).join('')}</tbody></table>
      <button class="btn" style="margin-top:12px">Save credit costs</button></form>`);
  $('#newPlan').onclick = () => planModal(null, endpoints);
  $$('[data-edit]').forEach(b => b.onclick = () => planModal(plans.find(p => p.id === +b.dataset.edit), endpoints));
  $('#costF').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => { await api('/api/admin/api/costs', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('Credit costs saved'); }); };
}

function planModal(p, endpoints) {
  const m = modal(p ? `Edit ${p.name}` : 'New plan', `<form id="pf">
    <div class="row"><div class="field"><label>Name</label><input class="input" name="name" required maxlength="30" value="${esc(p?.name || '')}"></div>
      <div class="field"><label>Price shown to developers</label><input class="input" name="price" maxlength="40" placeholder="₹999 / month" value="${esc(p?.price || '')}"></div></div>
    <div class="row"><div class="field"><label>Credits per month</label><input class="input" name="credits" type="number" min="0" required value="${p?.credits ?? 1000}"></div>
      <div class="field"><label>Requests per minute</label><input class="input" name="ratePerMin" type="number" min="1" required value="${p?.ratePerMin ?? 60}"></div>
      <div class="field"><label>Order</label><input class="input" name="sort" type="number" value="${p?.sort ?? 0}"></div></div>
    <div class="field"><label>Description</label><input class="input" name="description" maxlength="200" value="${esc(p?.description || '')}"></div>
    <div class="field"><label>Endpoints allowed in this plan</label><div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
      ${endpoints.map(e => `<label class="card" style="padding:10px;display:flex;gap:10px;align-items:center;cursor:${e.always ? 'default' : 'pointer'}">
        <input type="checkbox" name="ep" value="${esc(e.key)}" ${e.always || p?.endpoints.includes(e.key) || (!p && e.key !== 'rooms.cancel') ? 'checked' : ''} ${e.always ? 'disabled' : ''} style="width:18px;height:18px;accent-color:#fab005">
        <span><code>${esc(e.method)} ${esc(e.path)}</code><br><span class="muted small">${esc(e.title)}${e.always ? ' (always allowed)' : ''}</span></span></label>`).join('')}</div></div>
    <div class="row" style="margin-bottom:14px"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="active" ${p?.active === false ? '' : 'checked'} style="width:18px;height:18px;accent-color:#fab005"> Show on pricing page</label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="isDefault" ${p?.isDefault ? 'checked' : ''} style="width:18px;height:18px;accent-color:#fab005"> Give to new developers</label></div>
    <button class="btn" style="width:100%">${p ? 'Save plan' : 'Create plan'}</button></form>`);
  $('#pf', m.el).onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = { name: f.get('name'), price: f.get('price'), credits: f.get('credits'), ratePerMin: f.get('ratePerMin'), sort: f.get('sort'), description: f.get('description'),
      endpoints: [...f.getAll('ep'), ...endpoints.filter(x => x.always).map(x => x.key)], active: f.get('active') === 'on', isDefault: f.get('isDefault') === 'on' };
    busy(e.submitter, async () => { await api(p ? `/api/admin/api/plans/${p.id}` : '/api/admin/api/plans', { method: p ? 'PUT' : 'POST', body }); toast(p ? 'Plan saved' : 'Plan created'); m.close(); apiPlans(); });
  };
}

// ---------- developer API: request log ----------
async function apiLogs() {
  shell('apilogs', '<p class="muted">Loading…</p>');
  const list = await api('/api/admin/api/logs');
  shell('apilogs', `<div class="head"><h1>API request log</h1><span class="muted">Last 200 requests from all developers</span></div>
    <div class="card table-wrap" style="padding:4px">${list.length ? `<table><thead><tr><th>Time</th><th>Developer</th><th>Endpoint</th><th>Status</th><th>Credits</th><th>ms</th><th>IP</th></tr></thead><tbody>
      ${list.map(l => `<tr class="click" data-dev="${l.dev_id}"><td class="muted">${when(l.created_at)}</td><td>${esc(l.email || l.dev_id)}</td><td><code>${esc(l.endpoint)}</code></td>
        <td><span class="tag ${l.status < 400 ? 'g' : 'r'}">${l.status}</span></td><td>${l.cost}</td><td class="muted">${l.ms ?? '—'}</td><td class="muted">${esc(l.ip || '')}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">No API requests yet.</p>'}</div>`);
  $$('[data-dev]').forEach(r => r.onclick = () => devModal(+r.dataset.dev, apiLogs));
}

// ---------- router ----------
async function route() {
  if (!localStorage.getItem(TOKEN)) return login();
  clearInterval(liveTimer);
  const page = location.hash.slice(1) || 'dashboard';
  try {
    if (page === 'players') await players();
    else if (page === 'games') await games();
    else if (page === 'leaderboard') await leaderboard();
    else if (page === 'settings') await settings();
    else if (page === 'api') await apiDevelopers();
    else if (page === 'plans') await apiPlans();
    else if (page === 'apilogs') await apiLogs();
    else await dashboard();
  } catch (err) { if (localStorage.getItem(TOKEN)) toast(err.message, true); }
}
window.addEventListener('hashchange', route);
route();
