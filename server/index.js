import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, tx, addCoins, getUser } from './db.js';
import { AppError, signToken, verifyToken, requireUser, verifyFirebaseToken } from './auth.js';
import * as R from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WELCOME_COINS = Number(process.env.WELCOME_COINS || 1000);
const REFERRAL_COINS = Number(process.env.REFERRAL_COINS || 500);
const SPIN_PRIZES = [50, 100, 150, 200, 250, 300, 500, 1000];
const SPIN_WEIGHTS = [20, 20, 15, 15, 10, 10, 7, 3];
const SPIN_HOURS = 24;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));

// The Android app loads its screens from inside the APK, so the API must accept that origin.
app.use('/api', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function publicUser(u) {
  const nextSpin = u.last_spin ? new Date(u.last_spin.replace(' ', 'T') + 'Z').getTime() + SPIN_HOURS * 3600e3 : 0;
  return {
    id: u.id, name: u.name, avatar: u.avatar, photo: u.photo, coins: u.coins, provider: u.provider,
    played: u.played, won: u.won, refCode: u.ref_code, referred: !!u.referred_by,
    spinAt: nextSpin > Date.now() ? nextSpin : 0, createdAt: u.created_at,
  };
}

function newRefCode() {
  let code;
  do { code = crypto.randomBytes(4).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase(); }
  while (code.length < 6 || db.prepare('SELECT 1 FROM users WHERE ref_code = ?').get(code));
  return code;
}

function signIn({ uid, provider, name, photo }) {
  let u = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);
  if (!u) {
    const display = (name || `Player${crypto.randomInt(1000, 10000)}`).slice(0, 20);
    u = tx(() => {
      const r = db.prepare('INSERT INTO users (uid, provider, name, photo, avatar, ref_code) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uid, provider, display, photo, crypto.randomInt(0, 8), newRefCode());
      const id = Number(r.lastInsertRowid);
      addCoins(id, WELCOME_COINS, 'welcome', 'Welcome bonus');
      return getUser(id);
    });
  } else if (photo && photo !== u.photo) {
    db.prepare('UPDATE users SET photo = ?, provider = ? WHERE id = ?').run(photo, provider, u.id);
    u = getUser(u.id);
  }
  return { token: signToken(u.id), user: publicUser(u) };
}

// ---------- auth ----------
app.post('/api/auth/firebase', wrap(async (req, res) => {
  const claims = await verifyFirebaseToken(req.body?.idToken);
  res.json(signIn(claims));
}));

// Browser testing without the Android app (turn off in production).
app.post('/api/auth/dev', (req, res) => {
  if (process.env.ALLOW_DEV_LOGIN !== '1') throw new AppError('Please use the Android app to sign in', 403);
  const id = String(req.body?.deviceId || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64) || crypto.randomUUID();
  res.json(signIn({ uid: `dev:${id}`, provider: 'dev', name: null, photo: null }));
});

app.get('/api/config', (req, res) => res.json({
  devLogin: process.env.ALLOW_DEV_LOGIN === '1',
  notice: process.env.NOTICE || 'Welcome to Ludo Real! Spin the wheel every day for free coins.',
  links: {
    whatsapp: process.env.WHATSAPP_URL || '', telegram: process.env.TELEGRAM_URL || '', youtube: process.env.YOUTUBE_URL || '',
    privacy: process.env.PRIVACY_URL || '/privacy.html', contact: process.env.CONTACT_EMAIL || '',
    share: process.env.SHARE_URL || 'https://play.google.com/store/apps/details?id=com.definiteautomation.dreamludo',
  },
  tables: R.TABLES.map(e => ({ entry: e, prize2: R.prizeFor(e, 2), prize4: R.prizeFor(e, 4) })),
  spinPrizes: SPIN_PRIZES,
}));

// Live game stream (EventSource can't send headers, so the token is in the query).
app.get('/api/match/:id/stream', (req, res) => {
  const data = verifyToken(req.query.token);
  if (!data) throw new AppError('Please sign in again', 401);
  R.subscribe(data.id, req.params.id, res);
});

app.use('/api', requireUser);

// ---------- profile & coins ----------
app.get('/api/me', (req, res) => {
  const u = getUser(req.userId);
  if (!u) throw new AppError('Account not found', 401);
  res.json({ user: publicUser(u), current: R.current(req.userId) });
});

app.patch('/api/me', (req, res) => {
  const { name, avatar } = req.body || {};
  if (name !== undefined) {
    const n = String(name).trim().replace(/\s+/g, ' ');
    if (n.length < 3 || n.length > 16) throw new AppError('Name must be 3 to 16 characters');
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(n, req.userId);
  }
  if (avatar !== undefined) {
    const a = Number(avatar);
    if (!(a >= 0 && a < 8)) throw new AppError('Unknown avatar');
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(a, req.userId);
  }
  res.json({ user: publicUser(getUser(req.userId)) });
});

app.post('/api/spin', (req, res) => {
  const out = tx(() => {
    const u = getUser(req.userId);
    if (publicUser(u).spinAt) throw new AppError('Come back later for your next free spin');
    let pick = crypto.randomInt(0, SPIN_WEIGHTS.reduce((a, b) => a + b, 0)), i = 0;
    while (pick >= SPIN_WEIGHTS[i]) pick -= SPIN_WEIGHTS[i++];
    db.prepare("UPDATE users SET last_spin = datetime('now') WHERE id = ?").run(u.id);
    addCoins(u.id, SPIN_PRIZES[i], 'spin', 'Daily spin');
    return { index: i, coins: SPIN_PRIZES[i] };
  });
  res.json({ ...out, user: publicUser(getUser(req.userId)) });
});

app.post('/api/referral', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  tx(() => {
    const me = getUser(req.userId);
    if (me.referred_by) throw new AppError('You already used a referral code');
    if (Date.now() - new Date(me.created_at.replace(' ', 'T') + 'Z') > 7 * 864e5) throw new AppError('Referral codes can only be used in your first 7 days');
    const friend = db.prepare('SELECT * FROM users WHERE ref_code = ?').get(code);
    if (!friend) throw new AppError('Code not found');
    if (friend.id === me.id) throw new AppError("That's your own code");
    db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(friend.id, me.id);
    addCoins(me.id, REFERRAL_COINS, 'referral', `Joined with ${friend.name}'s code`);
    addCoins(friend.id, REFERRAL_COINS, 'referral', `${me.name} joined with your code`);
  });
  res.json({ user: publicUser(getUser(req.userId)), coins: REFERRAL_COINS });
});

app.get('/api/coins', (req, res) => {
  res.json(db.prepare('SELECT amount, type, note, created_at FROM coin_tx WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.userId));
});

app.get('/api/history', (req, res) => {
  const rows = db.prepare(`SELECT id, kind, players, entry, prize, seats, winner_id, winner_name, finished_at FROM matches
                           WHERE status = 'over' AND seats LIKE ? ORDER BY id DESC LIMIT 20`).all(`%"userId":${req.userId},%`);
  res.json(rows.map(m => ({ ...m, seats: JSON.parse(m.seats), won: m.winner_id === req.userId })));
});

app.get('/api/leaderboard', (req, res) => {
  const last = req.query.period === 'last';
  const range = last ? ["date('now','start of month','-1 month')", "date('now','start of month')"] : ["date('now','start of month')", "date('now','start of month','+1 month')"];
  const rows = db.prepare(`SELECT u.id, u.name, u.avatar, u.photo, SUM(t.amount) AS coins, COUNT(*) AS wins
                           FROM coin_tx t JOIN users u ON u.id = t.user_id
                           WHERE t.type = 'win' AND t.created_at >= ${range[0]} AND t.created_at < ${range[1]}
                           GROUP BY u.id ORDER BY coins DESC LIMIT 50`).all();
  res.json({ rows, me: rows.findIndex(r => r.id === req.userId) + 1 || null });
});

// ---------- matches ----------
app.post('/api/match/table', (req, res) => res.json(R.joinTable(req.userId, req.body || {})));
app.post('/api/match/friends/create', (req, res) => res.json(R.createFriends(req.userId, req.body || {})));
app.post('/api/match/friends/join', (req, res) => res.json(R.joinFriends(req.userId, req.body?.code, req.body?.color)));
app.get('/api/match/:id', (req, res) => res.json(R.view(req.userId, req.params.id)));
app.post('/api/match/:id/start', (req, res) => res.json(R.startFriends(req.userId, req.params.id)));
app.post('/api/match/:id/leave', (req, res) => { R.leave(req.userId, req.params.id); res.json({ ok: true, user: publicUser(getUser(req.userId)) }); });
app.post('/api/match/:id/roll', (req, res) => { R.roll(req.userId, req.params.id); res.json({ ok: true }); });
app.post('/api/match/:id/move', (req, res) => { R.move(req.userId, req.params.id, req.body?.token); res.json({ ok: true }); });
app.post('/api/match/:id/chat', (req, res) => { R.chat(req.userId, req.params.id, req.body?.text); res.json({ ok: true }); });

app.get('/healthz', (req, res) => res.json({ ok: true, ...R.stats() }));
app.use(express.static(path.join(__dirname, '..', 'www')));

app.use((err, req, res, next) => {
  const status = err.status && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.status ? 'Server error' : err.message });
});

R.refundInterrupted();
const port = Number(process.env.PORT || 3090);
const host = process.env.HOST || '0.0.0.0';   // 127.0.0.1 behind Nginx
app.listen(port, host, () => console.log(`Ludo Real server on http://${host}:${port}`));
