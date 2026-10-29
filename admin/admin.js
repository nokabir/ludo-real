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
        <div class="side-foot"><a class="btn ghost sm" href="/privacy.html" target="_blank">Privacy policy</a><button class="btn ghost sm" id="logout">${ic.logout} Log out</button></div>
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
      <div class="field"><label>Share / app link</label><input class="input" name="share" value="${esc(v.share)}"><span class="hint">Used by Share and Refer &amp; Earn. Your Play Store link.</span></div>
      <button class="btn">Save settings</button>
    </form>`);
  $('#sf').onsubmit = e => {
    e.preventDefault();
    busy(e.submitter, async () => { await api('/api/admin/settings', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('Settings saved'); });
  };
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
    else await dashboard();
  } catch (err) { if (localStorage.getItem(TOKEN)) toast(err.message, true); }
}
window.addEventListener('hashchange', route);
route();
