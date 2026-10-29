// Ludo Real developer portal (api.ludoreal.in).
const root = document.getElementById('root');
const TOKEN = 'lr_dev_token';
const BASE = location.hostname.endsWith('ludoreal.in') ? 'https://api.ludoreal.in' : location.origin;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('en-IN');
const when = s => s ? new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const S = b => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
const ic = {
  dice: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4.5" fill="#fff"/><circle cx="8" cy="8" r="1.6" fill="#1d2140"/><circle cx="16" cy="16" r="1.6" fill="#1d2140"/><circle cx="12" cy="12" r="1.6" fill="#e03131"/><circle cx="16" cy="8" r="1.6" fill="#1d2140"/><circle cx="8" cy="16" r="1.6" fill="#1d2140"/></svg>`,
  check: S('<path d="M20 6L9 17l-5-5"/>'), x: S('<path d="M18 6L6 18M6 6l12 12"/>'),
  bolt: S('<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>'), shield: S('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  hook: S('<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/>'),
  chart: S('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'), users: S('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>'),
  phone: S('<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>'),
};
const brand = `<a class="brand" href="#"><span class="brand-ico">${ic.dice}</span>Ludo Real <em>API</em></a>`;
let meta = null;

// ---------- helpers ----------
async function api(path, { method = 'GET', body } = {}) {
  const t = localStorage.getItem(TOKEN);
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && t) { localStorage.removeItem(TOKEN); location.hash = ''; render(); throw new Error('Please log in again'); }
  if (!res.ok) throw new Error(data.error?.message || data.error || `Request failed (${res.status})`);
  return data;
}
function toast(msg, bad = false) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const el = document.createElement('div'); el.className = `toast ${bad ? 'bad' : ''}`; el.textContent = msg; box.append(el);
  setTimeout(() => el.remove(), 3500);
}
async function busy(btn, fn) {
  btn.disabled = true; btn.classList.add('busy');
  try { return await fn(); } catch (err) { toast(err.message, true); } finally { btn.disabled = false; btn.classList.remove('busy'); }
}
async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Copy failed', true); } }

function nav() {
  const t = localStorage.getItem(TOKEN);
  return `<header class="nav"><div class="wrap">${brand}<nav class="nav-links">
    <a href="#docs">Docs</a><a href="#pricing">Pricing</a><a href="https://ludoreal.in" target="_blank" rel="noopener">Ludo Real app</a>
    ${t ? '<a class="btn sm" href="#dashboard">Dashboard</a>' : '<button class="btn ghost sm" data-auth="login">Log in</button><button class="btn sm" data-auth="signup">Get API key</button>'}
  </nav></div></header>`;
}
function bindAuthButtons() { $$('[data-auth]').forEach(b => b.onclick = () => authModal(b.dataset.auth)); }

// ---------- auth ----------
function authModal(mode) {
  const w = document.createElement('div');
  w.className = 'modal-wrap';
  w.innerHTML = `<form class="modal" id="af"><button type="button" class="x" data-x aria-label="Close">${ic.x}</button>
    <h2>${mode === 'signup' ? 'Create developer account' : 'Log in'}</h2>
    ${mode === 'signup' ? '<div class="field"><label>Your name</label><input class="input" name="name" required maxlength="60"></div><div class="field"><label>Company / app (optional)</label><input class="input" name="company" maxlength="80"></div>' : ''}
    <div class="field"><label>Email</label><input class="input" name="email" type="email" required autocomplete="email"></div>
    <div class="field"><label>Password</label><input class="input" name="password" type="password" minlength="8" required autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"></div>
    ${mode === 'signup' ? `<p class="small muted">By signing up you agree to the <a href="https://ludoreal.in/terms.html" target="_blank">API Terms</a>. The API may not be used for gambling or anything illegal where you operate.</p>` : ''}
    <button class="btn" style="width:100%">${mode === 'signup' ? 'Create account' : 'Log in'}</button>
    <p class="switch-auth">${mode === 'signup' ? 'Have an account? <a href="#" data-sw="login">Log in</a>' : 'New here? <a href="#" data-sw="signup">Create an account</a>'}</p></form>`;
  document.body.append(w);
  const close = () => w.remove();
  w.addEventListener('click', e => { if (e.target === w || e.target.closest('[data-x]')) close(); });
  $('[data-sw]', w).onclick = e => { e.preventDefault(); close(); authModal(e.target.dataset.sw); };
  $('#af', w).onsubmit = e => {
    e.preventDefault();
    busy(e.submitter, async () => {
      const r = await api(`/api/dev/${mode}`, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      localStorage.setItem(TOKEN, r.token); close();
      location.hash = mode === 'signup' ? '#keys' : '#dashboard'; render();
    });
  };
}

// ---------- public landing + docs ----------
function planCards(current) {
  const keys = meta.endpoints.filter(e => !e.always);
  return `<div class="plans">${meta.plans.map((p, i) => `<div class="card plan ${i === 1 ? 'featured' : ''}">
    <h3>${esc(p.name)}</h3><div class="price">${esc(p.price || '—')}</div><p class="muted small" style="margin:0">${esc(p.description || '')}</p>
    <ul><li>${ic.check}<b>${fmt(p.credits)}</b>&nbsp;credits / month</li><li>${ic.check}${fmt(p.ratePerMin)} requests / minute</li>
      ${keys.map(e => `<li class="${p.endpoints.includes(e.key) ? '' : 'off'}">${p.endpoints.includes(e.key) ? ic.check : ic.x}${esc(e.title)}</li>`).join('')}</ul>
    ${current === undefined ? `<button class="btn ${i === 1 ? '' : 'ghost'}" data-auth="signup">Start with ${esc(p.name)}</button>`
      : current?.id === p.id ? '<span class="btn ghost" style="pointer-events:none">Current plan</span>'
      : `<button class="btn ghost" data-plan="${p.id}">Request ${esc(p.name)}</button>`}</div>`).join('')}</div>`;
}

const sample = `<span class="c"># 1. Create a room</span>
curl -X POST ${BASE}/v1/rooms \\
  -H <span class="s">"X-API-Key: lr_live_..."</span> \\
  -d <span class="s">'{"players":2,"mode":"classic"}'</span>

<span class="c"># → players join in the Ludo Real app with the code</span>
{ <span class="k">"roomCode"</span>: <span class="s">"48210936"</span>, <span class="k">"status"</span>: <span class="s">"waiting"</span>, <span class="k">"joined"</span>: <span class="n">0</span> }

<span class="c"># 2. Read the result when the game ends</span>
curl ${BASE}/v1/rooms/48210936/result -H <span class="s">"X-API-Key: ..."</span>
{ <span class="k">"finished"</span>: <span class="n">true</span>, <span class="k">"result"</span>: { <span class="k">"winner"</span>: { <span class="k">"name"</span>: <span class="s">"Aarav"</span> } } }`;

function docsHtml() {
  const costs = Object.fromEntries(meta.endpoints.map(e => [e.key, e.cost]));
  const ep = (key, method, path, title, body) => `<h3 id="d-${key}"><span class="m ${method}">${method}</span><code>${path}</code><span class="cost">${costs[key] ?? 0} credit${costs[key] === 1 ? '' : 's'}</span></h3><p>${title}</p>${body || ''}`;
  return `<div class="docs"><nav class="docs-nav">
      <a href="#d-start">Getting started</a><a href="#d-auth">Authentication</a><a href="#d-flow">How players join</a><a href="#d-rooms.create">Create room</a><a href="#d-rooms.get">Get room</a>
      <a href="#d-rooms.progress">Live progress</a><a href="#d-rooms.result">Result</a><a href="#d-rooms.start">Start room</a><a href="#d-rooms.cancel">Cancel room</a><a href="#d-rooms.list">List rooms</a>
      <a href="#d-account">Account</a><a href="#d-webhooks">Webhooks</a><a href="#d-errors">Errors &amp; limits</a></nav>
    <div class="doc">
      <h2 id="d-start">Getting started</h2>
      <p>The Ludo Real Room API lets your server create Ludo rooms, follow the game live and get the verified winner. Your players play in the free <b>Ludo Real</b> Android app. The dice are rolled on our server, so results can't be faked from a phone.</p>
      <p>Base URL: <code>${BASE}/v1</code>. Send JSON, receive JSON. Each successful request uses credits from your plan (shown next to each endpoint). Failed requests are free.</p>
      <h2 id="d-auth">Authentication</h2>
      <p>Create a key in <b>Dashboard → API keys</b> and send it in the <code>X-API-Key</code> header. Keep keys on your server; never put them in an app or website.</p>
      <pre>curl ${BASE}/v1/account -H "X-API-Key: lr_live_xxxxxxxxxxxxxxxx"</pre>
      <h2 id="d-flow">How players join</h2>
      <ol><li>Your server calls <code>POST /v1/rooms</code> and gets an 8-digit <code>roomCode</code>.</li>
        <li>You show the code to your players. They open the Ludo Real app → <b>Play with Friends → Join Room</b> and enter it.</li>
        <li>The game starts automatically when every seat is filled (or call <code>/start</code> once at least 2 have joined).</li>
        <li>Get the winner from <code>/result</code>, or receive the <code>game.finished</code> webhook.</li></ol>
      <p>Rooms that don't start within 30 minutes expire.</p>
      ${ep('rooms.create', 'POST', '/v1/rooms', 'Create a room. Players join it with the returned code.', `
      <table><tr><th>Field</th><th>Type</th><th>Description</th></tr>
        <tr><td><code>players</code></td><td>2–4</td><td>Seats in the room. Default 2.</td></tr>
        <tr><td><code>mode</code></td><td>string</td><td><code>classic</code> (all 4 gotis home), <code>1goti</code>, <code>2goti</code> or <code>3goti</code> (first to bring that many home wins).</td></tr>
        <tr><td><code>cut</code></td><td>boolean</td><td><code>false</code> for a no-cut game. Default true.</td></tr>
        <tr><td><code>timerMinutes</code></td><td>0 or 3–60</td><td>Timer game: when time is up, the player who moved furthest wins. 0 = off.</td></tr>
        <tr><td><code>metadata</code></td><td>object</td><td>Your own data (e.g. your match ID), returned with the room and in webhooks. Max 1000 chars.</td></tr></table>
      <pre>curl -X POST ${BASE}/v1/rooms -H "X-API-Key: $KEY" -H "Content-Type: application/json" \\
  -d '{"players":4,"mode":"2goti","cut":true,"metadata":{"matchId":"M-1029"}}'

{
  "roomCode": "48210936", "roomId": 512, "status": "waiting", "mode": "2goti", "cut": true,
  "timerMinutes": null, "maxPlayers": 4, "joined": 0, "players": [],
  "metadata": { "matchId": "M-1029" }, "expiresAt": "2026-10-29T15:30:00.000Z", "result": null
}</pre>`)}
      ${ep('rooms.get', 'GET', '/v1/rooms/{code}', 'Room status and who has joined. <code>status</code> is <code>waiting</code>, <code>playing</code>, <code>over</code>, <code>cancelled</code> or <code>expired</code>.', `
      <pre>{ "roomCode": "48210936", "status": "playing", "maxPlayers": 2, "joined": 2,
  "players": [ { "name": "Aarav", "playerId": 1042, "color": "red" }, { "name": "Riya", "playerId": 877, "color": "yellow" } ] }</pre>`)}
      ${ep('rooms.progress', 'GET', '/v1/rooms/{code}/progress', 'Live game state while it runs: whose turn, dice, and every goti (<code>base</code>, a step 0–55, or <code>home</code>).', `
      <pre>{ "roomCode": "48210936", "status": "playing", "progress": { "phase": "roll", "turn": "yellow", "dice": 6, "endsAt": null,
  "players": [ { "name": "Aarav", "color": "red", "gotis": [12, "base", "home", 40], "home": 1, "score": 66, "left": false } ] } }</pre>`)}
      ${ep('rooms.result', 'GET', '/v1/rooms/{code}/result', 'Winner and full ranking once the game is over. <code>reason</code> is <code>finished</code>, <code>timer</code> or <code>others_left</code>.', `
      <pre>{ "roomCode": "48210936", "status": "over", "finished": true, "result": {
  "winner": { "name": "Riya", "color": "yellow", "playerId": 877 },
  "ranking": [ { "position": 1, "name": "Riya", "color": "yellow", "playerId": 877, "home": 2, "left": false },
               { "position": 2, "name": "Aarav", "color": "red", "playerId": 1042, "home": 1, "left": false } ],
  "reason": "finished" } }</pre>`)}
      ${ep('rooms.start', 'POST', '/v1/rooms/{code}/start', 'Start before every seat is filled (needs at least 2 players).')}
      ${ep('rooms.cancel', 'POST', '/v1/rooms/{code}/cancel', 'Cancel a waiting or running room.')}
      ${ep('rooms.list', 'GET', '/v1/rooms?limit=50', 'Your most recent rooms (max 100).')}
      ${ep('account', 'GET', '/v1/account', 'Your plan, credits left and limits. Always allowed.')}
      <h2 id="d-webhooks">Webhooks</h2>
      <p>Set a webhook URL in <b>Dashboard → Webhooks</b>. We POST JSON for <code>room.player_joined</code>, <code>game.started</code>, <code>game.finished</code>, <code>room.cancelled</code> and <code>room.expired</code>, with up to 3 tries.</p>
      <p>Check the <code>X-LudoReal-Signature</code> header: it's <code>sha256=</code> + HMAC-SHA256 of the raw body with your webhook secret.</p>
      <pre>// Node.js
const sig = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(req.headers['x-ludoreal-signature']))) return res.sendStatus(401);</pre>
      <h2 id="d-errors">Errors &amp; limits</h2>
      <pre>{ "error": { "code": "insufficient_credits", "message": "This request needs 5 credits; you have 2" } }</pre>
      <table><tr><th>HTTP</th><th>code</th><th>Meaning</th></tr>
        <tr><td>400</td><td>bad_request</td><td>Invalid input</td></tr><tr><td>401</td><td>unauthorized</td><td>Missing, wrong or revoked key</td></tr>
        <tr><td>402</td><td>insufficient_credits</td><td>Not enough credits left this month</td></tr><tr><td>403</td><td>endpoint_not_in_plan</td><td>Your plan doesn't include this endpoint</td></tr>
        <tr><td>404</td><td>not_found</td><td>Room not found (rooms are private to your account)</td></tr><tr><td>429</td><td>rate_limited</td><td>Too many requests this minute (see <code>Retry-After</code>)</td></tr></table>
      <p>Plan credits refill on the 1st of every month. Extra credits added by support never expire.</p>
    </div></div>`;
}

function landing() {
  root.innerHTML = `${nav()}
  <section class="hero"><div class="wrap">
    <div><span class="eyebrow">${ic.bolt} Ludo Real Room API</span>
      <h1>Ludo rooms for your app, <em>results you can trust</em></h1>
      <p class="lead">Create Ludo rooms from your server, let players join in the Ludo Real app, and get live progress and the verified winner by API or webhook.</p>
      <div class="ctas"><button class="btn" data-auth="signup">Get your free API key</button><a class="btn ghost" href="#docs">Read the docs</a></div></div>
    <div class="code-card"><div class="bar"><i></i><i></i><i></i></div><pre>${sample}</pre></div>
  </div></section>
  <section><div class="wrap"><div class="sec-title"><h2>How it works</h2><p>Four steps from code to winner</p></div>
    <div class="steps">
      <div class="card step"><h3>Create a room</h3><p>One API call returns an 8-digit room code.</p></div>
      <div class="card step"><h3>Players join</h3><p>They enter the code in the free Ludo Real app.</p></div>
      <div class="card step"><h3>Watch live</h3><p>Follow every move, turn and goti with the progress endpoint.</p></div>
      <div class="card step"><h3>Get the winner</h3><p>Read the result or get a signed webhook the moment it ends.</p></div></div></div></section>
  <section style="padding-top:0"><div class="wrap"><div class="feat">
    <div class="card"><span class="ico">${ic.shield}</span><h3>Fair by design</h3><p>Dice are rolled on our server. Nobody can change the result from their phone.</p></div>
    <div class="card"><span class="ico">${ic.users}</span><h3>Every game type</h3><p>2–4 players, Classic, 1/2/3 goti, cut or no-cut, and timer games.</p></div>
    <div class="card"><span class="ico">${ic.hook}</span><h3>Signed webhooks</h3><p>Joined, started, finished, cancelled and expired events, signed with HMAC.</p></div></div></div></section>
  <section id="pricing"><div class="wrap"><div class="sec-title"><h2>Pricing</h2><p>Start free. Upgrade when you need more.</p></div>${planCards()}</div></section>
  <section id="docs" style="border-top:1px solid var(--line)"><div class="wrap"><div class="sec-title"><h2>Documentation</h2></div>${docsHtml()}</div></section>
  <footer><div class="wrap"><span>© ${new Date().getFullYear()} Ludo Real</span><span><a href="https://ludoreal.in/terms.html">Terms</a><a href="https://ludoreal.in/privacy.html">Privacy</a>${meta.contact ? `<a href="mailto:${esc(meta.contact)}">Contact</a>` : ''}</span></div></footer>`;
  bindAuthButtons();
  const target = location.hash.slice(1);
  if (target && target !== 'dashboard') document.getElementById(target)?.scrollIntoView();
}

// ---------- dashboard ----------
const PAGES = [['dashboard', 'Overview'], ['keys', 'API keys'], ['rooms', 'Rooms'], ['logs', 'Request log'], ['plans', 'Plans'], ['webhooks', 'Webhooks'], ['account', 'Account'], ['docs', 'Docs']];
function appShell(page, html) {
  root.innerHTML = `${nav()}<div class="app"><aside class="side">${PAGES.map(([k, l]) => `<a href="#${k}" class="${k === page ? 'on' : ''}">${l}</a>`).join('')}
    <a href="#" id="logout" style="margin-top:12px">Log out</a></aside><main class="main">${html}</main></div>`;
  $('#logout').onclick = e => { e.preventDefault(); localStorage.removeItem(TOKEN); location.hash = ''; render(); };
}

async function overview() {
  appShell('dashboard', '<p class="muted">Loading…</p>');
  const d = await api('/api/dev/me');
  const v = d.dev, p = v.plan;
  const used = Math.max(0, (p?.credits || 0) - v.credits);
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10));
  const max = Math.max(1, ...d.usage.map(u => u.calls));
  appShell('dashboard', `
    <div class="head"><div><h1>Hi ${esc(v.name.split(' ')[0])}</h1><p class="muted" style="margin:2px 0 0">${esc(v.email)}${v.company ? ` · ${esc(v.company)}` : ''}</p></div><a class="btn" href="#keys">Create API key</a></div>
    <div class="kpis">
      <div class="card kpi"><span>Plan</span><b>${esc(p?.name || 'None')}</b><span>${fmt(p?.ratePerMin)} req/min${v.requestedPlan ? ` · requested ${esc(v.requestedPlan.name)}` : ''}</span></div>
      <div class="card kpi"><span>Credits left this month</span><b>${fmt(v.credits)}</b><span>of ${fmt(p?.credits)} · refills on the 1st</span><div class="meter"><i style="width:${p?.credits ? Math.min(100, used / p.credits * 100) : 0}%"></i></div></div>
      <div class="card kpi"><span>Extra credits</span><b>${fmt(v.bonusCredits)}</b><span>never expire</span></div>
      <div class="card kpi"><span>Rooms</span><b>${fmt(d.rooms.reduce((a, r) => a + r.n, 0))}</b><span>${d.rooms.map(r => `${r.n} ${r.status}`).join(' · ') || 'none yet'}</span></div>
    </div>
    <div class="two">
      <div class="card"><h3 style="margin-bottom:10px">Requests · last 14 days</h3>
        <div class="bars">${days.map(day => { const u = d.usage.find(x => x.day === day); const n = u?.calls || 0; return `<div><b>${n || ''}</b><span class="track"><i style="height:${n / max * 100}%"></i></span><small>${day.slice(8)}</small></div>`; }).join('')}</div></div>
      <div class="card"><h3 style="margin-bottom:10px">This month by endpoint</h3>
        ${d.byEndpoint.length ? d.byEndpoint.map(e => `<div class="list-row"><code>${esc(e.endpoint)}</code><span>${fmt(e.calls)} calls · ${fmt(e.credits)} credits</span></div>`).join('') : '<p class="muted">No requests yet. Create a key and call <code>/v1/account</code>.</p>'}</div>
    </div>`);
}

async function keys(newKey) {
  appShell('keys', '<p class="muted">Loading…</p>');
  const list = await api('/api/dev/keys');
  appShell('keys', `
    <div class="head"><h1>API keys</h1></div>
    ${newKey ? `<div class="newkey"><b>Your new key. Copy it now; you won't see it again.</b><code>${esc(newKey)}</code><button class="btn green sm" id="cp">Copy key</button></div>` : ''}
    <form class="card row" id="kf" style="margin-bottom:16px"><div class="field"><label>Key name</label><input class="input" name="name" placeholder="e.g. Production server" maxlength="40"></div><button class="btn">Create key</button></form>
    <div class="card table-wrap" style="padding:4px">${list.length ? `<table class="t"><thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Last used</th><th></th></tr></thead><tbody>
      ${list.map(k => `<tr><td><b>${esc(k.name)}</b></td><td><code>${esc(k.prefix)}…</code></td><td class="muted">${when(k.created_at)}</td><td class="muted">${when(k.last_used)}</td>
        <td>${k.revoked ? '<span class="tag r">Revoked</span>' : `<button class="btn red sm" data-revoke="${k.id}">Revoke</button>`}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">No keys yet.</p>'}</div>`);
  $('#cp')?.addEventListener('click', () => copy(newKey));
  $('#kf').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => { const r = await api('/api/dev/keys', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); keys(r.key); }); };
  $$('[data-revoke]').forEach(b => b.onclick = () => { if (confirm('Revoke this key? Apps using it will stop working.')) busy(b, async () => { await api(`/api/dev/keys/${b.dataset.revoke}`, { method: 'DELETE' }); toast('Key revoked'); keys(); }); });
}

async function roomsPage() {
  appShell('rooms', '<p class="muted">Loading…</p>');
  const list = await api('/api/dev/rooms');
  const st = { waiting: 'y', playing: 'b', over: 'g', cancelled: 'r', expired: 'r' };
  appShell('rooms', `<div class="head"><h1>Rooms</h1><span class="muted">Your 30 most recent rooms</span></div>
    <div class="card table-wrap" style="padding:4px">${list.length ? `<table class="t"><thead><tr><th>Code</th><th>Status</th><th>Mode</th><th>Players</th><th>Winner</th><th>Created</th></tr></thead><tbody>
      ${list.map(r => `<tr><td><code>${esc(r.roomCode)}</code></td><td><span class="tag ${st[r.status] || ''}">${esc(r.status)}</span></td><td>${esc(r.mode)}${r.cut === false ? ' · no cut' : ''}</td>
        <td>${r.joined}/${r.maxPlayers} ${r.players.map(p => esc(p.name)).join(', ')}</td><td>${r.result ? esc(r.result.winner.name) : '—'}</td><td class="muted">${when(r.createdAt)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">No rooms yet. Create one with <code>POST /v1/rooms</code>.</p>'}</div>`);
}

async function logs() {
  appShell('logs', '<p class="muted">Loading…</p>');
  const list = await api('/api/dev/logs');
  appShell('logs', `<div class="head"><h1>Request log</h1><span class="muted">Last 100 requests</span></div>
    <div class="card table-wrap" style="padding:4px">${list.length ? `<table class="t"><thead><tr><th>Time</th><th>Endpoint</th><th>Status</th><th>Credits</th><th>Time taken</th></tr></thead><tbody>
      ${list.map(l => `<tr><td class="muted">${when(l.created_at)}</td><td><code>${esc(l.endpoint)}</code></td><td><span class="tag ${l.status < 400 ? 'g' : 'r'}">${l.status}</span></td><td>${l.cost}</td><td class="muted">${l.ms ?? '—'} ms</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">No requests yet.</p>'}</div>`);
}

async function plansPage() {
  appShell('plans', '<p class="muted">Loading…</p>');
  const d = await api('/api/dev/me');
  appShell('plans', `<div class="head"><h1>Plans</h1></div>
    ${d.dev.requestedPlan ? `<div class="newkey" style="background:rgba(255,212,59,.08);border-color:rgba(255,212,59,.4)">You requested <b>${esc(d.dev.requestedPlan.name)}</b>. We'll switch your plan once it's approved.${meta.contact ? ` Questions? <a href="mailto:${esc(meta.contact)}">${esc(meta.contact)}</a>` : ''}</div>` : ''}
    ${planCards(d.dev.plan)}`);
  $$('[data-plan]').forEach(b => b.onclick = () => busy(b, async () => { await api('/api/dev/plan-request', { method: 'POST', body: { planId: +b.dataset.plan } }); toast('Request sent. We will review it soon.'); plansPage(); }));
}

async function webhooks() {
  appShell('webhooks', '<p class="muted">Loading…</p>');
  const d = await api('/api/dev/me');
  appShell('webhooks', `<div class="head"><h1>Webhooks</h1></div>
    <form class="card" id="wf" style="margin-bottom:16px"><div class="row"><div class="field"><label>Webhook URL (https)</label><input class="input" name="webhookUrl" placeholder="https://yourserver.com/ludo/webhook" value="${esc(d.dev.webhookUrl || '')}"></div>
      <button class="btn">Save</button><button type="button" class="btn ghost" id="test">Send test</button></div></form>
    <div class="card"><h3 style="margin-bottom:8px">Signing secret</h3><p class="muted small" style="margin:0 0 8px">Use it to check the <code>X-LudoReal-Signature</code> header. See the docs.</p>
      <div class="row"><code style="flex:1;padding:10px;word-break:break-all" id="sec">${esc(d.webhookSecret)}</code><button class="btn ghost sm" id="cps">Copy</button><button class="btn red sm" id="rot">Rotate</button></div></div>`);
  $('#wf').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => { await api('/api/dev/me', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) }); toast('Webhook saved'); }); };
  $('#test').onclick = e => busy(e.currentTarget, async () => { const r = await api('/api/dev/webhook/test', { method: 'POST' }); r.ok ? toast(`Delivered (HTTP ${r.status})`) : toast(`Failed: ${r.error || `HTTP ${r.status}`}`, true); });
  $('#cps').onclick = () => copy($('#sec').textContent);
  $('#rot').onclick = e => { if (confirm('Rotate the secret? Update your server with the new one.')) busy(e.currentTarget, async () => { const r = await api('/api/dev/webhook/rotate', { method: 'POST' }); $('#sec').textContent = r.webhookSecret; toast('Secret rotated'); }); };
}

async function account() {
  appShell('account', '<p class="muted">Loading…</p>');
  const { dev } = await api('/api/dev/me');
  appShell('account', `<div class="head"><h1>Account</h1></div>
    <form class="card" id="pf" style="margin-bottom:16px;max-width:560px"><div class="field"><label>Name</label><input class="input" name="name" value="${esc(dev.name)}" maxlength="60"></div>
      <div class="field"><label>Company / app</label><input class="input" name="company" value="${esc(dev.company || '')}" maxlength="80"></div>
      <div class="field"><label>Email</label><input class="input" value="${esc(dev.email)}" disabled></div><button class="btn">Save</button></form>
    <form class="card" id="pw" style="max-width:560px"><h3 style="margin-bottom:12px">Change password</h3>
      <div class="field"><label>Current password</label><input class="input" type="password" name="currentPassword" required autocomplete="current-password"></div>
      <div class="field"><label>New password</label><input class="input" type="password" name="newPassword" minlength="8" required autocomplete="new-password"></div><button class="btn">Change password</button></form>`);
  $('#pf').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => { await api('/api/dev/me', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) }); toast('Saved'); }); };
  $('#pw').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => { await api('/api/dev/me', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast('Password changed'); }); };
}

// ---------- router ----------
async function render() {
  try { meta ||= await api('/api/dev/meta'); } catch (err) { root.innerHTML = `${nav()}<p class="empty">${esc(err.message)}</p>`; return; }
  const page = location.hash.slice(1);
  const loggedIn = !!localStorage.getItem(TOKEN);
  try {
    if (!loggedIn || !page || ['pricing'].includes(page) || page.startsWith('d-') || page.includes('.')) return landing();
    if (page === 'keys') await keys();
    else if (page === 'rooms') await roomsPage();
    else if (page === 'logs') await logs();
    else if (page === 'plans') await plansPage();
    else if (page === 'webhooks') await webhooks();
    else if (page === 'account') await account();
    else if (page === 'docs') { appShell('docs', docsHtml()); }
    else await overview();
  } catch (err) { toast(err.message, true); }
}
window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (p.startsWith('d-') || p.includes('.')) return; render(); });
render();
