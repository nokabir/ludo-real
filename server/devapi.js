// Developer API: portal accounts (/api/dev/*) and the public room API (/v1/*).
import express from 'express';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { db, tx, getSettings } from './db.js';
import { AppError, signPayload, verifyToken, hashPassword, checkPassword } from './auth.js';
import * as R from './rooms.js';

// ---------- endpoints, costs, plans ----------
export const ENDPOINTS = [
  { key: 'rooms.create', method: 'POST', path: '/v1/rooms', title: 'Create a room', defaultCost: 5 },
  { key: 'rooms.get', method: 'GET', path: '/v1/rooms/{code}', title: 'Room status and joined players', defaultCost: 1 },
  { key: 'rooms.progress', method: 'GET', path: '/v1/rooms/{code}/progress', title: 'Live game progress', defaultCost: 1 },
  { key: 'rooms.result', method: 'GET', path: '/v1/rooms/{code}/result', title: 'Winner and ranking', defaultCost: 1 },
  { key: 'rooms.start', method: 'POST', path: '/v1/rooms/{code}/start', title: 'Start before all seats fill', defaultCost: 1 },
  { key: 'rooms.cancel', method: 'POST', path: '/v1/rooms/{code}/cancel', title: 'Cancel a room', defaultCost: 0 },
  { key: 'rooms.list', method: 'GET', path: '/v1/rooms', title: 'List your recent rooms', defaultCost: 1 },
  { key: 'account', method: 'GET', path: '/v1/account', title: 'Your plan and credits', defaultCost: 0, always: true },
];
const EP = Object.fromEntries(ENDPOINTS.map(e => [e.key, e]));

export function getCosts() {
  let saved = {};
  try { saved = JSON.parse(getSettings().apiCosts || '{}'); } catch { /* ignore bad JSON */ }
  return Object.fromEntries(ENDPOINTS.map(e => [e.key, Number.isInteger(saved[e.key]) && saved[e.key] >= 0 ? saved[e.key] : e.defaultCost]));
}

if (!db.prepare('SELECT COUNT(*) n FROM plans').get().n) {
  const all = JSON.stringify(ENDPOINTS.map(e => e.key));
  const ins = db.prepare('INSERT INTO plans (name, price, credits, rate_per_min, endpoints, description, is_default, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  ins.run('Free', '₹0', 200, 10, JSON.stringify(['rooms.create', 'rooms.get', 'rooms.result', 'account']), 'Try the API: create rooms and read results.', 1, 1);
  ins.run('Starter', '₹999 / month', 10000, 60, all, 'Every endpoint, for small apps.', 0, 2);
  ins.run('Pro', '₹4,999 / month', 100000, 300, all, 'High volume with higher rate limits.', 0, 3);
}

const planOf = id => db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
export const publicPlan = p => p && ({
  id: p.id, name: p.name, price: p.price, credits: p.credits, ratePerMin: p.rate_per_min,
  endpoints: JSON.parse(p.endpoints || '[]'), description: p.description, active: !!p.active, isDefault: !!p.is_default, sort: p.sort,
});

const month = () => new Date().toISOString().slice(0, 7);

// New month: refill the plan's credits. Bonus credits never reset.
function refreshPeriod(dev) {
  if (dev.period === month()) return dev;
  const plan = planOf(dev.plan_id);
  db.prepare('UPDATE developers SET credits = ?, period = ? WHERE id = ?').run(plan?.credits || 0, month(), dev.id);
  return db.prepare('SELECT * FROM developers WHERE id = ?').get(dev.id);
}

export function devSummary(dev) {
  dev = refreshPeriod(dev);
  const plan = planOf(dev.plan_id);
  return {
    id: dev.id, email: dev.email, name: dev.name, company: dev.company, status: dev.status,
    plan: publicPlan(plan), credits: dev.credits, bonusCredits: dev.bonus_credits, totalCredits: dev.credits + dev.bonus_credits,
    period: dev.period, webhookUrl: dev.webhook_url, requestedPlan: dev.requested_plan ? publicPlan(planOf(dev.requested_plan)) : null,
    createdAt: dev.created_at,
  };
}

// ---------- webhooks (signed, private addresses blocked) ----------
function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:') && privateIp(v.slice(7));
}

export async function checkWebhookUrl(url) {
  let u;
  try { u = new URL(url); } catch { throw new AppError('Webhook URL is not valid'); }
  if (u.protocol !== 'https:') throw new AppError('Webhook URL must use https://');
  if (u.port && !['443', '8443'].includes(u.port)) throw new AppError('Webhook URL must use port 443 or 8443');
  const addrs = await dns.lookup(u.hostname, { all: true }).catch(() => []);
  if (!addrs.length) throw new AppError('Webhook host does not resolve');
  if (addrs.some(a => privateIp(a.address))) throw new AppError('Webhook URL points to a private address');
  return u.toString();
}

async function deliver(dev, payload, attempt = 1) {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', dev.webhook_secret).update(body).digest('hex');
  try {
    const url = await checkWebhookUrl(dev.webhook_url);
    const res = await fetch(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'LudoReal-Webhook/1', 'X-LudoReal-Event': payload.event, 'X-LudoReal-Signature': `sha256=${sig}` },
      body,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    if (attempt < 3) setTimeout(() => deliver(dev, payload, attempt + 1), attempt * 15000).unref();
    else console.warn(`webhook to dev ${dev.id} failed: ${err.message}`);
  }
}

R.onRoomEvent((event, room) => {
  const m = db.prepare('SELECT api_dev_id FROM matches WHERE id = ?').get(room.roomId);
  const dev = m && db.prepare('SELECT * FROM developers WHERE id = ?').get(m.api_dev_id);
  if (dev?.webhook_url && dev.status === 'active') deliver(dev, { event, sentAt: new Date().toISOString(), room });
});

// ---------- developer portal ----------
export const devPortal = express.Router();

const signups = new Map();
devPortal.post('/signup', (req, res) => {
  const { email = '', password = '', name = '', company = '' } = req.body || {};
  const ip = req.headers['x-real-ip'] || req.ip;
  const n = (signups.get(ip) || []).filter(t => Date.now() - t < 3600e3);
  if (n.length >= 5) throw new AppError('Too many sign-ups from this network. Try again later.', 429);
  const e = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e) || e.length > 120) throw new AppError('Enter a valid email');
  if (String(password).length < 8) throw new AppError('Password must be at least 8 characters');
  if (String(name).trim().length < 2) throw new AppError('Enter your name');
  if (db.prepare('SELECT 1 FROM developers WHERE email = ?').get(e)) throw new AppError('An account with this email already exists');
  const plan = db.prepare('SELECT * FROM plans WHERE is_default = 1 AND active = 1 ORDER BY sort LIMIT 1').get();
  const r = db.prepare('INSERT INTO developers (email, name, company, password_hash, plan_id, credits, period, webhook_secret) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(e, String(name).trim().slice(0, 60), String(company).trim().slice(0, 80) || null, hashPassword(password), plan?.id || null, plan?.credits || 0, month(), `whsec_${crypto.randomBytes(24).toString('base64url')}`);
  signups.set(ip, [...n, Date.now()]);
  res.json({ token: signPayload({ dev: Number(r.lastInsertRowid) }, 7 * 864e5) });
});

const devLogins = new Map();
devPortal.post('/login', (req, res) => {
  const ip = req.headers['x-real-ip'] || req.ip;
  const a = devLogins.get(ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) throw new AppError('Too many attempts. Try again in 15 minutes.', 429);
  const dev = db.prepare('SELECT * FROM developers WHERE email = ?').get(String(req.body?.email || '').trim().toLowerCase());
  if (!dev || !checkPassword(req.body?.password || '', dev.password_hash)) {
    if (++a.n >= 8) { a.until = Date.now() + 15 * 60e3; a.n = 0; }
    devLogins.set(ip, a);
    throw new AppError('Wrong email or password', 401);
  }
  devLogins.delete(ip);
  if (dev.status !== 'active') throw new AppError('This developer account is suspended. Contact support.', 403);
  res.json({ token: signPayload({ dev: dev.id }, 7 * 864e5) });
});

devPortal.get('/meta', (req, res) => {
  const costs = getCosts();
  res.json({
    endpoints: ENDPOINTS.map(e => ({ key: e.key, method: e.method, path: e.path, title: e.title, cost: costs[e.key], always: !!e.always })),
    plans: db.prepare('SELECT * FROM plans WHERE active = 1 ORDER BY sort, id').all().map(publicPlan),
    contact: getSettings().contact,
  });
});

devPortal.use((req, res, next) => {
  const h = req.headers.authorization || '';
  const data = verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '');
  if (!data?.dev) return res.status(401).json({ error: 'Please log in again' });
  const dev = db.prepare('SELECT * FROM developers WHERE id = ?').get(data.dev);
  if (!dev) return res.status(401).json({ error: 'Account not found' });
  if (dev.status !== 'active') return res.status(403).json({ error: 'This developer account is suspended. Contact support.' });
  req.dev = dev;
  next();
});

devPortal.get('/me', (req, res) => {
  const d = req.dev.id;
  const usage = db.prepare(`SELECT date(created_at) day, COUNT(*) calls, COALESCE(SUM(cost), 0) credits FROM api_logs
                            WHERE dev_id = ? AND created_at >= date('now', '-13 day') GROUP BY day ORDER BY day`).all(d);
  const byEndpoint = db.prepare(`SELECT endpoint, COUNT(*) calls, COALESCE(SUM(cost), 0) credits FROM api_logs
                                 WHERE dev_id = ? AND created_at >= date('now', 'start of month') GROUP BY endpoint ORDER BY calls DESC`).all(d);
  const rooms = db.prepare("SELECT status, COUNT(*) n FROM matches WHERE api_dev_id = ? AND kind = 'api' GROUP BY status").all(d);
  res.json({ dev: devSummary(req.dev), webhookSecret: req.dev.webhook_secret, usage, byEndpoint, rooms });
});

devPortal.patch('/me', wrapAsync(async (req, res) => {
  const { name, company, webhookUrl, currentPassword, newPassword } = req.body || {};
  if (name !== undefined) {
    if (String(name).trim().length < 2) throw new AppError('Enter your name');
    db.prepare('UPDATE developers SET name = ? WHERE id = ?').run(String(name).trim().slice(0, 60), req.dev.id);
  }
  if (company !== undefined) db.prepare('UPDATE developers SET company = ? WHERE id = ?').run(String(company).trim().slice(0, 80) || null, req.dev.id);
  if (webhookUrl !== undefined) {
    const url = String(webhookUrl).trim() ? await checkWebhookUrl(String(webhookUrl).trim()) : null;
    db.prepare('UPDATE developers SET webhook_url = ? WHERE id = ?').run(url, req.dev.id);
  }
  if (newPassword !== undefined) {
    if (!checkPassword(currentPassword || '', req.dev.password_hash)) throw new AppError('Current password is wrong');
    if (String(newPassword).length < 8) throw new AppError('New password must be at least 8 characters');
    db.prepare('UPDATE developers SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), req.dev.id);
  }
  res.json({ dev: devSummary(db.prepare('SELECT * FROM developers WHERE id = ?').get(req.dev.id)) });
}));

devPortal.post('/webhook/rotate', (req, res) => {
  const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;
  db.prepare('UPDATE developers SET webhook_secret = ? WHERE id = ?').run(secret, req.dev.id);
  res.json({ webhookSecret: secret });
});

devPortal.post('/webhook/test', wrapAsync(async (req, res) => {
  if (!req.dev.webhook_url) throw new AppError('Save a webhook URL first');
  const url = await checkWebhookUrl(req.dev.webhook_url);
  const payload = { event: 'test', sentAt: new Date().toISOString(), room: null };
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', req.dev.webhook_secret).update(body).digest('hex');
  try {
    const r = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/json', 'X-LudoReal-Event': 'test', 'X-LudoReal-Signature': `sha256=${sig}` }, body });
    res.json({ ok: r.ok, status: r.status });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}));

devPortal.get('/keys', (req, res) => {
  res.json(db.prepare('SELECT id, name, prefix, last_used, revoked, created_at FROM api_keys WHERE dev_id = ? ORDER BY id DESC').all(req.dev.id));
});

devPortal.post('/keys', (req, res) => {
  const active = db.prepare('SELECT COUNT(*) n FROM api_keys WHERE dev_id = ? AND revoked = 0').get(req.dev.id).n;
  if (active >= 10) throw new AppError('You can have up to 10 active keys. Revoke one first.');
  const key = `lr_live_${crypto.randomBytes(24).toString('base64url')}`;
  db.prepare('INSERT INTO api_keys (dev_id, name, prefix, key_hash) VALUES (?, ?, ?, ?)')
    .run(req.dev.id, String(req.body?.name || 'My key').trim().slice(0, 40) || 'My key', key.slice(0, 12), sha256(key));
  res.json({ key });
});

devPortal.delete('/keys/:id', (req, res) => {
  const r = db.prepare('UPDATE api_keys SET revoked = 1 WHERE id = ? AND dev_id = ?').run(+req.params.id, req.dev.id);
  if (!r.changes) throw new AppError('Key not found', 404);
  res.json({ ok: true });
});

devPortal.get('/logs', (req, res) => {
  res.json(db.prepare('SELECT endpoint, status, cost, ms, created_at FROM api_logs WHERE dev_id = ? ORDER BY id DESC LIMIT 100').all(req.dev.id));
});

devPortal.get('/rooms', (req, res) => res.json(R.apiList(req.dev.id, 30)));

devPortal.post('/plan-request', (req, res) => {
  const plan = planOf(+req.body?.planId);
  if (!plan || !plan.active) throw new AppError('Plan not found');
  if (plan.id === req.dev.plan_id) throw new AppError("You're already on this plan");
  db.prepare("UPDATE developers SET requested_plan = ?, requested_at = datetime('now') WHERE id = ?").run(plan.id, req.dev.id);
  res.json({ ok: true });
});

function wrapAsync(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

// ---------- public API (/v1) ----------
export const publicApi = express.Router();
const windows = new Map();   // devId -> { minute, n }

const apiError = (res, status, code, message) => res.status(status).json({ error: { code, message } });

function guard(endpointKey) {
  return (req, res, next) => {
    const started = Date.now();
    const key = req.headers['x-api-key'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!key || !String(key).startsWith('lr_')) return apiError(res, 401, 'unauthorized', 'Send your API key in the X-API-Key header');
    const k = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0').get(sha256(String(key)));
    if (!k) return apiError(res, 401, 'unauthorized', 'API key is invalid or revoked');
    let dev = db.prepare('SELECT * FROM developers WHERE id = ?').get(k.dev_id);
    if (!dev || dev.status !== 'active') return apiError(res, 403, 'account_suspended', 'This developer account is suspended');
    dev = refreshPeriod(dev);
    const plan = planOf(dev.plan_id);
    const ep = EP[endpointKey];
    const log = (status, cost) => db.prepare('INSERT INTO api_logs (dev_id, key_id, endpoint, status, cost, ms, ip) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(dev.id, k.id, endpointKey, status, cost, Date.now() - started, String(req.headers['x-real-ip'] || req.ip).slice(0, 45));
    if (!plan) { log(403, 0); return apiError(res, 403, 'no_plan', 'Your account has no plan. Contact support.'); }
    if (!ep.always && !JSON.parse(plan.endpoints || '[]').includes(endpointKey)) {
      log(403, 0);
      return apiError(res, 403, 'endpoint_not_in_plan', `${ep.method} ${ep.path} is not included in the ${plan.name} plan. Upgrade at https://api.ludoreal.in`);
    }
    const now = Math.floor(Date.now() / 60000);
    const w = windows.get(dev.id);
    if (w && w.minute === now && w.n >= plan.rate_per_min) {
      log(429, 0);
      res.set('Retry-After', String(60 - new Date().getSeconds()));
      return apiError(res, 429, 'rate_limited', `Rate limit is ${plan.rate_per_min} requests per minute on the ${plan.name} plan`);
    }
    windows.set(dev.id, w && w.minute === now ? { minute: now, n: w.n + 1 } : { minute: now, n: 1 });
    const cost = getCosts()[endpointKey] || 0;
    if (cost > dev.credits + dev.bonus_credits) {
      log(402, 0);
      return apiError(res, 402, 'insufficient_credits', `This request needs ${cost} credits; you have ${dev.credits + dev.bonus_credits}`);
    }
    db.prepare("UPDATE api_keys SET last_used = datetime('now') WHERE id = ?").run(k.id);
    req.dev = dev;
    // Charge only when the request succeeds.
    res.on('finish', () => {
      const ok = res.statusCode < 400;
      if (ok && cost > 0) {
        tx(() => {
          const d = db.prepare('SELECT credits, bonus_credits FROM developers WHERE id = ?').get(dev.id);
          const fromPlan = Math.min(d.credits, cost);
          db.prepare('UPDATE developers SET credits = credits - ?, bonus_credits = MAX(0, bonus_credits - ?) WHERE id = ?').run(fromPlan, cost - fromPlan, dev.id);
        });
      }
      log(res.statusCode, ok ? cost : 0);
    });
    res.set('X-Credits-Cost', String(cost));
    next();
  };
}

const run = fn => (req, res) => {
  try { res.json(fn(req)); }
  catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    apiError(res, status, status === 404 ? 'not_found' : status >= 500 ? 'server_error' : 'bad_request', status >= 500 ? 'Server error' : err.message);
  }
};

publicApi.use(express.json({ limit: '20kb' }));
publicApi.get('/account', guard('account'), run(req => devSummary(req.dev)));
publicApi.post('/rooms', guard('rooms.create'), run(req => R.createApiRoom(req.dev.id, req.body || {})));
publicApi.get('/rooms', guard('rooms.list'), run(req => ({ rooms: R.apiList(req.dev.id, req.query.limit) })));
publicApi.get('/rooms/:code', guard('rooms.get'), run(req => R.apiGetRoom(req.dev.id, req.params.code)));
publicApi.get('/rooms/:code/progress', guard('rooms.progress'), run(req => R.apiProgress(req.dev.id, req.params.code)));
publicApi.get('/rooms/:code/result', guard('rooms.result'), run(req => R.apiResult(req.dev.id, req.params.code)));
publicApi.post('/rooms/:code/start', guard('rooms.start'), run(req => R.apiStart(req.dev.id, req.params.code)));
publicApi.post('/rooms/:code/cancel', guard('rooms.cancel'), run(req => R.apiCancel(req.dev.id, req.params.code)));
publicApi.use((req, res) => apiError(res, 404, 'not_found', 'Unknown endpoint. See https://api.ludoreal.in/#docs'));

// Keep 60 days of request logs.
setInterval(() => db.prepare("DELETE FROM api_logs WHERE created_at < datetime('now', '-60 day')").run(), 6 * 3600e3).unref();
