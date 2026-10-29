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

export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const out = fn(); db.exec('COMMIT'); return out; } catch (err) { db.exec('ROLLBACK'); throw err; }
}

export function addCoins(userId, amount, type, note = null) {
  db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(amount, userId);
  db.prepare('INSERT INTO coin_tx (user_id, amount, type, note) VALUES (?, ?, ?, ?)').run(userId, amount, type, note);
}

export const getUser = id => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
