import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DB_PATH || './data/ludo-real.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  uid         TEXT NOT NULL UNIQUE,                 -- Firebase uid (or dev:* for browser testing)
  provider    TEXT NOT NULL,                        -- anonymous | google.com | dev
  name        TEXT NOT NULL,
  avatar      INTEGER NOT NULL DEFAULT 0,           -- index into the built-in avatar set
  photo       TEXT,                                 -- Google profile photo URL
  coins       INTEGER NOT NULL DEFAULT 0,
  played      INTEGER NOT NULL DEFAULT 0,
  won         INTEGER NOT NULL DEFAULT 0,
  ref_code    TEXT UNIQUE,
  referred_by INTEGER REFERENCES users(id),
  last_spin   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coin_tx (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  amount     INTEGER NOT NULL,                      -- + earned, - spent
  type       TEXT NOT NULL,                         -- welcome | spin | entry | win | refund | referral
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS coin_tx_user ON coin_tx(user_id, id);
CREATE INDEX IF NOT EXISTS coin_tx_type_time ON coin_tx(type, created_at);

CREATE TABLE IF NOT EXISTS matches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL,                        -- table | timer | friends
  players     INTEGER NOT NULL,
  entry       INTEGER NOT NULL,
  prize       INTEGER NOT NULL,
  seats       TEXT NOT NULL,                        -- JSON [{userId, name, color, bot}]
  status      TEXT NOT NULL DEFAULT 'waiting',      -- waiting | playing | over | cancelled
  winner_id   INTEGER REFERENCES users(id),
  winner_name TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);
`);

// Admin-editable settings (notice, links, bonus amounts).
db.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (!userCols.includes('banned')) db.exec('ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0');
if (!userCols.includes('last_seen')) db.exec('ALTER TABLE users ADD COLUMN last_seen TEXT');

// Columns for developer-API rooms.
const matchCols = db.prepare('PRAGMA table_info(matches)').all().map(c => c.name);
for (const [col, type] of [['code', 'TEXT'], ['api_dev_id', 'INTEGER'], ['meta', 'TEXT'], ['result', 'TEXT'], ['timer_min', 'INTEGER']]) {
  if (!matchCols.includes(col)) db.exec(`ALTER TABLE matches ADD COLUMN ${col} ${type}`);
}
db.exec('CREATE INDEX IF NOT EXISTS matches_api ON matches(api_dev_id, code)');

// Developer API: accounts, keys, plans, request log.
db.exec(`
CREATE TABLE IF NOT EXISTS plans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  price         TEXT NOT NULL DEFAULT '',          -- shown to developers, e.g. "₹999 / month"
  credits       INTEGER NOT NULL DEFAULT 0,        -- monthly credits
  rate_per_min  INTEGER NOT NULL DEFAULT 60,
  endpoints     TEXT NOT NULL DEFAULT '[]',        -- JSON list of endpoint keys allowed
  description   TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  is_default    INTEGER NOT NULL DEFAULT 0,        -- given to new developers
  sort          INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS developers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name            TEXT NOT NULL,
  company         TEXT,
  password_hash   TEXT NOT NULL,
  plan_id         INTEGER REFERENCES plans(id),
  credits         INTEGER NOT NULL DEFAULT 0,      -- this month's plan credits (reset monthly)
  bonus_credits   INTEGER NOT NULL DEFAULT 0,      -- extra credits from admin (never reset)
  period          TEXT,                            -- YYYY-MM of the current credit period
  status          TEXT NOT NULL DEFAULT 'active',  -- active | suspended
  webhook_url     TEXT,
  webhook_secret  TEXT NOT NULL,
  requested_plan  INTEGER REFERENCES plans(id),
  requested_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS api_keys (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  dev_id     INTEGER NOT NULL REFERENCES developers(id),
  name       TEXT NOT NULL,
  prefix     TEXT NOT NULL,
  key_hash   TEXT NOT NULL UNIQUE,
  last_used  TEXT,
  revoked    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS api_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  dev_id     INTEGER NOT NULL,
  key_id     INTEGER,
  endpoint   TEXT NOT NULL,
  status     INTEGER NOT NULL,
  cost       INTEGER NOT NULL DEFAULT 0,
  ms         INTEGER,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS api_logs_dev ON api_logs(dev_id, id);
CREATE INDEX IF NOT EXISTS api_logs_time ON api_logs(created_at);
`);

export const SETTING_DEFAULTS = {
  notice: process.env.NOTICE || 'Welcome to Ludo Real! Spin the wheel every day for free coins.',
  whatsapp: process.env.WHATSAPP_URL || '',
  telegram: process.env.TELEGRAM_URL || '',
  youtube: process.env.YOUTUBE_URL || '',
  contact: process.env.CONTACT_EMAIL || '',
  share: process.env.SHARE_URL || 'https://play.google.com/store/apps/details?id=com.definiteautomation.dreamludo',
  welcomeCoins: String(process.env.WELCOME_COINS || 1000),
  referralCoins: String(process.env.REFERRAL_COINS || 500),
  playStoreUrl: '',                 // landing page download button ("Coming soon" while empty)
  // AdMob ad units (defaults are Google's public test units; replace before publishing).
  adsEnabled: '1',
  admobBanner: 'ca-app-pub-3940256099942544/9214589741',
  admobInterstitial: 'ca-app-pub-3940256099942544/1033173712',
  admobRewarded: 'ca-app-pub-3940256099942544/5224354917',
  interstitialEvery: '2',           // show a full-screen ad after every N finished games (0 = never)
  rewardCoins: '200',               // coins for watching a rewarded ad
  rewardDailyLimit: '10',           // rewarded ads per player per day
  apiCosts: '',                     // JSON { endpointKey: credits } for the developer API
};

export function getSettings() {
  const out = { ...SETTING_DEFAULTS };
  for (const r of db.prepare('SELECT key, value FROM settings').all()) if (r.key in out) out[r.key] = r.value;
  return out;
}

export function saveSettings(values) {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(values)) if (k in SETTING_DEFAULTS) stmt.run(k, String(v));
}

export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const out = fn(); db.exec('COMMIT'); return out; } catch (err) { db.exec('ROLLBACK'); throw err; }
}

export function addCoins(userId, amount, type, note = null) {
  db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(amount, userId);
  db.prepare('INSERT INTO coin_tx (user_id, amount, type, note) VALUES (?, ?, ?, ?)').run(userId, amount, type, note);
}

export const getUser = id => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
