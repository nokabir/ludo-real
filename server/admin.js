// Admin API for the ludoreal.in panel.
import express from 'express';
import { db, tx, addCoins, getUser, getSettings, saveSettings, SETTING_DEFAULTS } from './db.js';
import { AppError, signAdminToken, requireAdmin, safeEqual } from './auth.js';
import * as R from './rooms.js';
import { ENDPOINTS, getCosts, publicPlan, devSummary } from './devapi.js';
import { hashPassword as hashDevPassword } from './auth.js';

export const adminApi = express.Router();

// ---------- login (with a simple per-IP lockout) ----------
const attempts = new Map();   // ip -> { n, until }
adminApi.post('/login', (req, res) => {
  const ip = req.headers['x-real-ip'] || req.ip;
  const a = attempts.get(ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) throw new AppError('Too many attempts. Try again in 15 minutes.', 429);
  const U = process.env.ADMIN_USERNAME, P = process.env.ADMIN_PASSWORD;
  if (!U || !P) throw new AppError('Admin login is not configured on the server', 503);
  const { username = '', password = '' } = req.body || {};
  if (!safeEqual(username, U) || !safeEqual(password, P)) {
    a.n++;
    if (a.n >= 8) { a.until = Date.now() + 15 * 60e3; a.n = 0; }
    attempts.set(ip, a);
    throw new AppError('Wrong username or password', 401);
  }
  attempts.delete(ip);
  res.json({ token: signAdminToken() });
});

adminApi.use(requireAdmin);

const q1 = (sql, ...p) => db.prepare(sql).get(...p);
const adminUser = u => ({
  id: u.id, name: u.name, avatar: u.avatar, photo: u.photo, provider: u.provider, coins: u.coins,
  played: u.played, won: u.won, refCode: u.ref_code, banned: !!u.banned, createdAt: u.created_at, lastSeen: u.last_seen,
});

// ---------- dashboard ----------
adminApi.get('/stats', (req, res) => {
  const live = R.stats();
  res.json({
    users: q1('SELECT COUNT(*) n FROM users').n,
    usersToday: q1("SELECT COUNT(*) n FROM users WHERE date(created_at) = date('now')").n,
    google: q1("SELECT COUNT(*) n FROM users WHERE provider = 'google.com'").n,
    guests: q1("SELECT COUNT(*) n FROM users WHERE provider = 'anonymous'").n,
    activeToday: q1("SELECT COUNT(*) n FROM users WHERE last_seen >= datetime('now', '-1 day')").n,
    banned: q1('SELECT COUNT(*) n FROM users WHERE banned = 1').n,
    gamesToday: q1("SELECT COUNT(*) n FROM matches WHERE status = 'over' AND date(finished_at) = date('now')").n,
    gamesTotal: q1("SELECT COUNT(*) n FROM matches WHERE status = 'over'").n,
    coinsTotal: q1('SELECT COALESCE(SUM(coins), 0) n FROM users').n,
    coinsWonToday: q1("SELECT COALESCE(SUM(amount), 0) n FROM coin_tx WHERE type = 'win' AND date(created_at) = date('now')").n,
    spinsToday: q1("SELECT COUNT(*) n FROM coin_tx WHERE type = 'spin' AND date(created_at) = date('now')").n,
    live,
    byKind: db.prepare("SELECT kind, COUNT(*) n FROM matches WHERE status = 'over' AND finished_at >= datetime('now', '-7 day') GROUP BY kind").all(),
    daily: db.prepare(`SELECT date(created_at) d, COUNT(*) n FROM users WHERE created_at >= date('now', '-13 day') GROUP BY d ORDER BY d`).all(),
    newest: db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 6').all().map(adminUser),
  });
});

// ---------- players ----------
adminApi.get('/users', (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const sort = { coins: 'coins DESC', won: 'won DESC', new: 'id DESC' }[req.query.sort] || 'id DESC';
  const filter = req.query.filter === 'banned' ? 'AND banned = 1' : req.query.filter === 'google' ? "AND provider = 'google.com'" : req.query.filter === 'guest' ? "AND provider = 'anonymous'" : '';
  const rows = db.prepare(`SELECT * FROM users WHERE (name LIKE ? OR ref_code LIKE ? OR CAST(id AS TEXT) = ?) ${filter} ORDER BY ${sort} LIMIT 200`)
    .all(q, q, String(req.query.q || '').trim());
  res.json(rows.map(adminUser));
});

adminApi.get('/users/:id', (req, res) => {
  const u = getUser(+req.params.id);
  if (!u) throw new AppError('Player not found', 404);
  const tx50 = db.prepare('SELECT amount, type, note, created_at FROM coin_tx WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(u.id);
  const games = db.prepare(`SELECT id, kind, players, entry, prize, winner_id, winner_name, finished_at FROM matches
                            WHERE status = 'over' AND seats LIKE ? ORDER BY id DESC LIMIT 20`).all(`%"userId":${u.id},%`);
  const referredBy = u.referred_by ? getUser(u.referred_by)?.name : null;
  const referrals = q1('SELECT COUNT(*) n FROM users WHERE referred_by = ?', u.id).n;
  res.json({ user: adminUser(u), transactions: tx50, games: games.map(g => ({ ...g, won: g.winner_id === u.id })), referredBy, referrals });
});

adminApi.patch('/users/:id', (req, res) => {
  const id = +req.params.id;
  const u = getUser(id);
  if (!u) throw new AppError('Player not found', 404);
  const { name, banned, coinsDelta, note } = req.body || {};
  tx(() => {
    if (name !== undefined) {
      const n = String(name).trim().replace(/\s+/g, ' ');
      if (n.length < 3 || n.length > 16) throw new AppError('Name must be 3 to 16 characters');
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(n, id);
    }
    if (coinsDelta !== undefined && coinsDelta !== '' && Number(coinsDelta) !== 0) {
      const d = Math.trunc(Number(coinsDelta));
      if (!Number.isFinite(d) || Math.abs(d) > 10_000_000) throw new AppError('Enter a valid coin amount');
      if (u.coins + d < 0) throw new AppError(`Player only has ${u.coins} coins`);
      addCoins(id, d, 'admin', String(note || '').trim().slice(0, 80) || (d > 0 ? 'Added by admin' : 'Removed by admin'));
    }
    if (banned !== undefined) db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned ? 1 : 0, id);
  });
  if (banned) { try { R.kickUser(id); } catch { /* not in a game */ } }
  res.json(adminUser(getUser(id)));
});

// ---------- games ----------
adminApi.get('/games/live', (req, res) => res.json(R.liveRooms()));

adminApi.post('/games/:id/cancel', (req, res) => { R.adminCancel(+req.params.id); res.json({ ok: true }); });

adminApi.get('/games', (req, res) => {
  const kind = ['table', 'timer', 'friends'].includes(req.query.kind) ? req.query.kind : null;
  const rows = db.prepare(`SELECT * FROM matches WHERE status IN ('over', 'cancelled') ${kind ? 'AND kind = ?' : ''} ORDER BY id DESC LIMIT 100`)
    .all(...(kind ? [kind] : []));
  res.json(rows.map(m => ({ ...m, seats: JSON.parse(m.seats) })));
});

// ---------- leaderboard ----------
adminApi.get('/leaderboard', (req, res) => {
  const last = req.query.period === 'last';
  const range = last ? ["date('now','start of month','-1 month')", "date('now','start of month')"] : ["date('now','start of month')", "date('now','start of month','+1 month')"];
  res.json(db.prepare(`SELECT u.id, u.name, u.avatar, u.photo, SUM(t.amount) AS coins, COUNT(*) AS wins FROM coin_tx t JOIN users u ON u.id = t.user_id
                       WHERE t.type = 'win' AND t.created_at >= ${range[0]} AND t.created_at < ${range[1]} GROUP BY u.id ORDER BY coins DESC LIMIT 100`).all());
});

// ---------- app settings ----------
adminApi.get('/settings', (req, res) => res.json({ values: getSettings(), defaults: SETTING_DEFAULTS }));

adminApi.put('/settings', (req, res) => {
  const v = req.body || {};
  const clean = {};
  for (const k of Object.keys(SETTING_DEFAULTS)) if (k !== 'apiCosts' && v[k] !== undefined) clean[k] = String(v[k]).trim();
  for (const k of ['welcomeCoins', 'referralCoins']) {
    if (clean[k] !== undefined && !(Number(clean[k]) >= 0 && Number(clean[k]) <= 1_000_000)) throw new AppError(`${k} must be between 0 and 1,000,000`);
  }
  for (const k of ['whatsapp', 'telegram', 'youtube', 'share', 'playStoreUrl']) {
    if (clean[k] && !/^https?:\/\//i.test(clean[k])) throw new AppError(`${k} link must start with https://`);
  }
  if (clean.contact && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean.contact)) throw new AppError('Enter a valid contact email');
  if (clean.notice !== undefined && clean.notice.length > 500) throw new AppError('Notice is too long (max 500 characters)');
  saveSettings(clean);
  res.json({ values: getSettings() });
});

// ---------- developer API ----------
adminApi.get('/api/overview', (req, res) => {
  res.json({
    developers: q1('SELECT COUNT(*) n FROM developers').n,
    newThisWeek: q1("SELECT COUNT(*) n FROM developers WHERE created_at >= datetime('now', '-7 day')").n,
    pendingRequests: q1('SELECT COUNT(*) n FROM developers WHERE requested_plan IS NOT NULL').n,
    callsToday: q1("SELECT COUNT(*) n FROM api_logs WHERE date(created_at) = date('now')").n,
    creditsToday: q1("SELECT COALESCE(SUM(cost), 0) n FROM api_logs WHERE date(created_at) = date('now')").n,
    errorsToday: q1("SELECT COUNT(*) n FROM api_logs WHERE date(created_at) = date('now') AND status >= 400").n,
    roomsToday: q1("SELECT COUNT(*) n FROM matches WHERE kind = 'api' AND date(created_at) = date('now')").n,
    byEndpoint: db.prepare("SELECT endpoint, COUNT(*) calls, COALESCE(SUM(cost), 0) credits FROM api_logs WHERE created_at >= datetime('now', '-7 day') GROUP BY endpoint ORDER BY calls DESC").all(),
  });
});

adminApi.get('/api/developers', (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const filter = req.query.filter === 'pending' ? 'AND d.requested_plan IS NOT NULL' : req.query.filter === 'suspended' ? "AND d.status = 'suspended'" : '';
  const rows = db.prepare(`SELECT d.*, p.name plan_name, rp.name requested_name,
      (SELECT COUNT(*) FROM api_logs l WHERE l.dev_id = d.id AND l.created_at >= date('now', 'start of month')) calls_month
    FROM developers d LEFT JOIN plans p ON p.id = d.plan_id LEFT JOIN plans rp ON rp.id = d.requested_plan
    WHERE (d.email LIKE ? OR d.name LIKE ? OR COALESCE(d.company, '') LIKE ?) ${filter}
    ORDER BY (d.requested_plan IS NOT NULL) DESC, d.id DESC LIMIT 200`).all(q, q, q);
  res.json(rows.map(d => ({
    id: d.id, email: d.email, name: d.name, company: d.company, status: d.status, plan: d.plan_name, planId: d.plan_id,
    credits: d.credits, bonusCredits: d.bonus_credits, requested: d.requested_name, requestedId: d.requested_plan,
    callsMonth: d.calls_month, createdAt: d.created_at,
  })));
});

adminApi.get('/api/developers/:id', (req, res) => {
  const dev = db.prepare('SELECT * FROM developers WHERE id = ?').get(+req.params.id);
  if (!dev) throw new AppError('Developer not found', 404);
  res.json({
    dev: devSummary(dev),
    keys: db.prepare('SELECT id, name, prefix, last_used, revoked, created_at FROM api_keys WHERE dev_id = ? ORDER BY id DESC').all(dev.id),
    logs: db.prepare('SELECT endpoint, status, cost, ms, ip, created_at FROM api_logs WHERE dev_id = ? ORDER BY id DESC LIMIT 50').all(dev.id),
    rooms: db.prepare("SELECT status, COUNT(*) n FROM matches WHERE api_dev_id = ? AND kind = 'api' GROUP BY status").all(dev.id),
  });
});

adminApi.patch('/api/developers/:id', (req, res) => {
  const id = +req.params.id;
  const dev = db.prepare('SELECT * FROM developers WHERE id = ?').get(id);
  if (!dev) throw new AppError('Developer not found', 404);
  const { planId, addCredits, status, approveRequest, rejectRequest, newPassword, resetCredits } = req.body || {};
  tx(() => {
    const setPlan = pid => {
      const p = db.prepare('SELECT * FROM plans WHERE id = ?').get(pid);
      if (!p) throw new AppError('Plan not found');
      db.prepare("UPDATE developers SET plan_id = ?, credits = ?, period = strftime('%Y-%m', 'now'), requested_plan = NULL, requested_at = NULL WHERE id = ?").run(p.id, p.credits, id);
    };
    if (approveRequest && dev.requested_plan) setPlan(dev.requested_plan);
    if (rejectRequest) db.prepare('UPDATE developers SET requested_plan = NULL, requested_at = NULL WHERE id = ?').run(id);
    if (planId) setPlan(+planId);
    if (resetCredits) {
      const p = db.prepare('SELECT credits FROM plans WHERE id = (SELECT plan_id FROM developers WHERE id = ?)').get(id);
      db.prepare('UPDATE developers SET credits = ? WHERE id = ?').run(p?.credits || 0, id);
    }
    if (addCredits !== undefined && addCredits !== '' && Number(addCredits) !== 0) {
      const n = Math.trunc(Number(addCredits));
      if (!Number.isFinite(n) || Math.abs(n) > 100_000_000) throw new AppError('Enter a valid credit amount');
      db.prepare('UPDATE developers SET bonus_credits = MAX(0, bonus_credits + ?) WHERE id = ?').run(n, id);
    }
    if (status !== undefined) {
      if (!['active', 'suspended'].includes(status)) throw new AppError('Unknown status');
      db.prepare('UPDATE developers SET status = ? WHERE id = ?').run(status, id);
    }
    if (newPassword) {
      if (String(newPassword).length < 8) throw new AppError('Password must be at least 8 characters');
      db.prepare('UPDATE developers SET password_hash = ? WHERE id = ?').run(hashDevPassword(newPassword), id);
    }
  });
  res.json(devSummary(db.prepare('SELECT * FROM developers WHERE id = ?').get(id)));
});

adminApi.get('/api/plans', (req, res) => {
  res.json({
    plans: db.prepare('SELECT p.*, (SELECT COUNT(*) FROM developers d WHERE d.plan_id = p.id) devs FROM plans p ORDER BY sort, id').all()
      .map(p => ({ ...publicPlan(p), developers: p.devs })),
    endpoints: ENDPOINTS.map(e => ({ key: e.key, method: e.method, path: e.path, title: e.title, always: !!e.always })),
  });
});

function planFields(b) {
  const name = String(b.name || '').trim();
  if (name.length < 2 || name.length > 30) throw new AppError('Plan name must be 2 to 30 characters');
  const credits = Math.trunc(Number(b.credits)), rate = Math.trunc(Number(b.ratePerMin));
  if (!(credits >= 0 && credits <= 1e9)) throw new AppError('Monthly credits must be 0 or more');
  if (!(rate >= 1 && rate <= 10000)) throw new AppError('Rate limit must be 1 to 10,000 per minute');
  const valid = new Set(ENDPOINTS.map(e => e.key));
  const endpoints = [...new Set((Array.isArray(b.endpoints) ? b.endpoints : []).filter(k => valid.has(k)))];
  return [name, String(b.price || '').trim().slice(0, 40), credits, rate, JSON.stringify(endpoints),
    String(b.description || '').trim().slice(0, 200) || null, b.active === false || b.active === 'false' ? 0 : 1,
    b.isDefault ? 1 : 0, Math.trunc(Number(b.sort) || 0)];
}

adminApi.post('/api/plans', (req, res) => {
  const f = planFields(req.body || {});
  const r = tx(() => {
    if (f[7]) db.prepare('UPDATE plans SET is_default = 0').run();
    return db.prepare('INSERT INTO plans (name, price, credits, rate_per_min, endpoints, description, active, is_default, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(...f);
  });
  res.json(publicPlan(db.prepare('SELECT * FROM plans WHERE id = ?').get(r.lastInsertRowid)));
});

adminApi.put('/api/plans/:id', (req, res) => {
  const id = +req.params.id;
  if (!db.prepare('SELECT 1 FROM plans WHERE id = ?').get(id)) throw new AppError('Plan not found', 404);
  const f = planFields(req.body || {});
  tx(() => {
    if (f[7]) db.prepare('UPDATE plans SET is_default = 0').run();
    db.prepare('UPDATE plans SET name = ?, price = ?, credits = ?, rate_per_min = ?, endpoints = ?, description = ?, active = ?, is_default = ?, sort = ? WHERE id = ?').run(...f, id);
  });
  res.json(publicPlan(db.prepare('SELECT * FROM plans WHERE id = ?').get(id)));
});

adminApi.get('/api/costs', (req, res) => {
  const costs = getCosts();
  res.json(ENDPOINTS.map(e => ({ key: e.key, method: e.method, path: e.path, title: e.title, cost: costs[e.key], defaultCost: e.defaultCost })));
});

adminApi.put('/api/costs', (req, res) => {
  const out = {};
  for (const e of ENDPOINTS) {
    const v = req.body?.[e.key];
    if (v === undefined || v === '') continue;
    const n = Math.trunc(Number(v));
    if (!(n >= 0 && n <= 1_000_000)) throw new AppError(`Cost for ${e.key} must be 0 or more`);
    out[e.key] = n;
  }
  let saved = {};
  try { saved = JSON.parse(getSettings().apiCosts || '{}'); } catch { /* ignore */ }
  saveSettings({ apiCosts: JSON.stringify({ ...saved, ...out }) });
  res.json(getCosts());
});

adminApi.get('/api/logs', (req, res) => {
  const dev = req.query.dev ? +req.query.dev : null;
  res.json(db.prepare(`SELECT l.*, d.email FROM api_logs l LEFT JOIN developers d ON d.id = l.dev_id ${dev ? 'WHERE l.dev_id = ?' : ''} ORDER BY l.id DESC LIMIT 200`)
    .all(...(dev ? [dev] : [])));
});
