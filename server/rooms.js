// Online rooms: matchmaking tables, timer tables and private friend rooms.
// The server owns the dice and the rules; clients send roll / move and get
// every change pushed over Server-Sent Events.
import crypto from 'node:crypto';
import * as L from '../www/js/engine.js';
import { db, tx, addCoins, getUser } from './db.js';
import { AppError } from './auth.js';

export const TABLES = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000];
export const prizeFor = (entry, players) => Math.floor(entry * players * 0.9);

const TURN_SECONDS = Number(process.env.TURN_SECONDS || 20);
const BOT_FILL_MS = Number(process.env.BOT_FILL_SECONDS || 12) * 1000;
const TIMER_MINUTES = Number(process.env.TIMER_MINUTES || 10);
const MAX_MISSED = 3;
const BOT_DELAY = 850, AUTO_DELAY = 700, PASS_DELAY = 1200;
const BOT_NAMES = ['Aarav', 'Vihaan', 'Ishaan', 'Kabir', 'Riya', 'Ananya', 'Meera', 'Arjun', 'Saanvi', 'Rohan', 'Diya', 'Kiran', 'Zoya', 'Dev', 'Tara', 'Neel'];
const OPPOSITE = { red: 'yellow', yellow: 'red', green: 'blue', blue: 'green' };

const API_EXPIRE_MIN = Number(process.env.API_ROOM_EXPIRE_MINUTES || 30);

// Developer-API events (player joined, started, finished, cancelled, expired) go to this listener.
let roomListener = () => {};
export const onRoomEvent = fn => { roomListener = fn; };
function emit(r, event) {
  if (r.kind !== 'api') return;
  try { roomListener(event, apiView(r)); } catch (err) { console.warn('room listener', err.message); }
}

const rooms = new Map();     // roomId -> room
const byCode = new Map();    // friend code -> roomId
const userRoom = new Map();  // userId -> roomId (one active room per user)

// ---------- helpers ----------
function publicRoom(r) {
  return {
    id: r.id, kind: r.kind, code: r.kind === 'friends' || r.kind === 'api' ? r.code : undefined,
    players: r.players, entry: r.entry, prize: r.prize, winTokens: r.winTokens, cut: r.cut,
    timerMin: r.kind === 'timer' ? TIMER_MINUTES : r.timerMin || null, status: r.status, hostId: r.hostId,
    botsFilled: r.botsFilled, result: r.result || null, fillAt: r.fillAt || null,
    seats: r.seats.map(s => ({ userId: s.bot ? null : s.userId, name: s.name, avatar: s.avatar, photo: s.photo, color: s.color || null, bot: s.bot })),
  };
}

function send(r, payload) {
  const data = `data: ${JSON.stringify({ ...payload, now: Date.now() })}\n\n`;
  for (const res of r.clients) res.write(data);
}

function pushState(r) {
  send(r, { type: 'state', room: publicRoom(r), game: r.g ? L.snapshot(r.g) : null });
}

function saveRow(r) {
  db.prepare('UPDATE matches SET seats = ?, status = ? WHERE id = ?')
    .run(JSON.stringify(r.seats.map(s => ({ userId: s.userId, name: s.name, color: s.color, bot: s.bot }))), r.status, r.id);
}

function activeRoomOf(userId) {
  const id = userRoom.get(userId);
  const r = id && rooms.get(id);
  if (r && (r.status === 'waiting' || r.status === 'playing')) return r;
  userRoom.delete(userId);
  return null;
}

function createRoom({ kind, players, entry, winTokens = 4, cut = true, hostId = null, apiDevId = null, meta = null, timerMin = null }) {
  let code = null;
  if (kind === 'friends') { do { code = String(crypto.randomInt(100000, 1000000)); } while (byCode.has(code)); }
  // API rooms use 8 digits so they never clash with 6-digit friend codes, and stay unique per developer.
  if (kind === 'api') {
    do { code = String(crypto.randomInt(10000000, 100000000)); }
    while (byCode.has(code) || db.prepare('SELECT 1 FROM matches WHERE code = ?').get(code));
  }
  const row = db.prepare('INSERT INTO matches (kind, players, entry, prize, seats, code, api_dev_id, meta, timer_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(kind, players, entry, prizeFor(entry, players), '[]', code, apiDevId, meta ? JSON.stringify(meta) : null, timerMin);
  const r = {
    id: Number(row.lastInsertRowid), kind, players, entry, prize: prizeFor(entry, players),
    winTokens, cut, hostId, seats: [], status: 'waiting', g: null,
    clients: new Set(), timer: null, fillTimer: null, botsFilled: false, code,
    apiDevId, meta, timerMin, createdAt: Date.now(),
  };
  if (code) byCode.set(code, r.id);
  rooms.set(r.id, r);
  return r;
}

function seatUser(r, userId, color) {
  const u = getUser(userId);
  if (!u) throw new AppError('Account not found', 401);
  if (u.coins < r.entry) throw new AppError(`You need ${r.entry} coins to play this table`);
  tx(() => { if (r.entry > 0) addCoins(userId, -r.entry, 'entry', `${labelOf(r)} entry`); });
  r.seats.push({ userId, name: u.name, avatar: u.avatar, photo: u.photo, prefColor: color, bot: false });
  userRoom.set(userId, r.id);
  saveRow(r);
}

const labelOf = r => r.kind === 'friends' ? 'Friends room' : r.kind === 'api' ? 'Room' : r.kind === 'timer' ? 'Timer table' : 'Table';

// ---------- matchmaking ----------
export function joinTable(userId, { kind, players, entry, color }) {
  const existing = activeRoomOf(userId);
  if (existing) return publicRoom(existing);
  if (!['table', 'timer'].includes(kind)) throw new AppError('Unknown game type');
  players = Number(players); entry = Number(entry);
  if (![2, 4].includes(players)) throw new AppError('Choose 2 or 4 players');
  if (!TABLES.includes(entry)) throw new AppError('Unknown table');

  let r = [...rooms.values()].find(x => x.status === 'waiting' && x.kind === kind && x.players === players && x.entry === entry && x.seats.length < players);
  if (!r) {
    r = createRoom({ kind, players, entry });
    r.fillAt = Date.now() + BOT_FILL_MS;
    r.fillTimer = setTimeout(() => fillWithBots(r), BOT_FILL_MS);
  }
  seatUser(r, userId, color);
  if (r.seats.length === r.players) start(r); else pushState(r);
  return publicRoom(r);
}

function fillWithBots(r) {
  if (r.status !== 'waiting' || !r.seats.length) return;
  const used = new Set(r.seats.map(s => s.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  let i = 0;
  while (r.seats.length < r.players) {
    r.seats.push({ userId: -(++i), name: names.pop(), avatar: crypto.randomInt(0, 8), photo: null, bot: true });
  }
  r.botsFilled = true;
  start(r);
}

// ---------- friends rooms ----------
export function createFriends(userId, { players, entry = 0, winTokens = 4, cut = true, color }) {
  const existing = activeRoomOf(userId);
  if (existing) throw new AppError('Finish or leave your current game first');
  players = Number(players); entry = Number(entry); winTokens = Number(winTokens);
  if (![2, 3, 4].includes(players)) throw new AppError('Choose 2, 3 or 4 players');
  if (entry !== 0 && !TABLES.includes(entry)) throw new AppError('Unknown entry amount');
  if (![1, 2, 3, 4].includes(winTokens)) throw new AppError('Choose 1, 2, 3 or 4 gotis');
  const r = createRoom({ kind: 'friends', players, entry, winTokens, cut: cut !== false && cut !== 'false', hostId: userId });
  seatUser(r, userId, color);
  pushState(r);
  return publicRoom(r);
}

export function joinFriends(userId, code, color) {
  const id = byCode.get(String(code || '').trim());
  const r = id && rooms.get(id);
  if (!r || r.status !== 'waiting' || !['friends', 'api'].includes(r.kind)) throw new AppError('Room not found or already started', 404);
  const existing = activeRoomOf(userId);
  if (existing && existing.id === r.id) return publicRoom(r);
  if (existing) throw new AppError('Finish or leave your current game first');
  if (r.seats.length >= r.players) throw new AppError('Room is full');
  seatUser(r, userId, color);
  emit(r, 'room.player_joined');
  if (r.seats.length === r.players) start(r); else pushState(r);
  return publicRoom(r);
}

export function startFriends(userId, roomId) {
  const r = getRoom(roomId);
  if (r.kind !== 'friends' || r.hostId !== userId) throw new AppError('Only the host can start');
  if (r.status !== 'waiting') throw new AppError('Already started');
  if (r.seats.length < 2) throw new AppError('Wait for at least one friend to join');
  start(r);
  return publicRoom(r);
}

// Leave before the game starts (refund) or during the game (you lose).
export function leave(userId, roomId) {
  const r = getRoom(roomId);
  const seat = r.seats.find(s => s.userId === userId && !s.bot);
  if (!seat) throw new AppError('You are not in this room', 403);
  if (r.status === 'waiting') {
    const everyone = r.kind === 'friends' && r.hostId === userId ? r.seats.filter(s => !s.bot) : [seat];
    tx(() => { for (const s of everyone) if (r.entry > 0) addCoins(s.userId, r.entry, 'refund', `${labelOf(r)} left`); });
    for (const s of everyone) userRoom.delete(s.userId);
    r.seats = r.seats.filter(s => !everyone.includes(s));
    if ((!r.seats.length && r.kind !== 'api') || everyone.length > 1) {
      r.status = 'cancelled';
      clearTimeout(r.fillTimer);
      byCode.delete(r.code);
      saveRow(r);
      send(r, { type: 'state', room: publicRoom(r), game: null, cancelled: true });
    } else { saveRow(r); pushState(r); }
    return;
  }
  if (r.status === 'playing') {
    const gs = r.g.seats.find(s => s.id === userId);
    L.eliminate(r.g, gs.color);
    r.g.last.note = 'left';
    userRoom.delete(userId);
    changed(r);
  }
}

// ---------- the game loop ----------
function assignColors(r) {
  const n = r.seats.length;
  let palette;
  if (n === 2) { const first = r.seats[0].prefColor in OPPOSITE ? r.seats[0].prefColor : 'red'; palette = [first, OPPOSITE[first]]; }
  else palette = L.colorsFor(n);
  const free = new Set(palette);
  for (const s of r.seats) if (s.prefColor && free.has(s.prefColor) && !s.bot) { s.color = s.prefColor; free.delete(s.prefColor); }
  for (const s of r.seats) if (!s.color) { s.color = [...free][0]; free.delete(s.color); }
  r.seats.sort((a, b) => L.COLORS.indexOf(a.color) - L.COLORS.indexOf(b.color));   // clockwise turn order
}

function start(r) {
  clearTimeout(r.fillTimer);
  byCode.delete(r.code);
  r.players = r.seats.length;
  r.prize = prizeFor(r.entry, r.players);
  assignColors(r);
  r.g = L.createGame(r.seats.map(s => ({ id: s.userId, name: s.name, color: s.color, bot: s.bot })), {
    turnSeconds: TURN_SECONDS, winTokens: r.winTokens, cut: r.cut,
    endsAt: r.kind === 'timer' ? Date.now() + TIMER_MINUTES * 60000 : r.timerMin ? Date.now() + r.timerMin * 60000 : null,
  });
  r.status = 'playing';
  db.prepare('UPDATE matches SET players = ?, prize = ? WHERE id = ?').run(r.players, r.prize, r.id);
  for (const s of r.seats) if (!s.bot) db.prepare('UPDATE users SET played = played + 1 WHERE id = ?').run(s.userId);
  saveRow(r);
  changed(r);
  emit(r, 'game.started');
}

function changed(r) {
  pushState(r);
  schedule(r);
}

function schedule(r) {
  clearTimeout(r.timer);
  const g = r.g;
  if (!g || r.status !== 'playing') return;
  if (g.phase === 'over') return finish(r);
  const now = Date.now();
  if (g.endsAt && now >= g.endsAt) { L.timeUp(g); return changed(r); }
  const seat = L.currentSeat(g);
  const later = (ms, fn) => { r.timer = setTimeout(() => { if (r.status === 'playing') fn(); }, g.endsAt ? Math.min(ms, Math.max(0, g.endsAt - now)) : ms); };

  if (g.phase === 'pass') { g.deadline = null; return later(PASS_DELAY, () => { if (g.endsAt && Date.now() >= g.endsAt) L.timeUp(g); else L.pass(g); changed(r); }); }
  if (g.phase === 'move') {
    const moves = L.legalMoves(g, seat.color, g.dice);
    const only = L.onlyChoice(g, seat.color, moves);
    if (seat.bot || only !== null || r.autoTurn) {
      g.deadline = null;
      return later(seat.bot ? BOT_DELAY : AUTO_DELAY, () => {
        r.autoTurn = false;
        if (g.endsAt && Date.now() >= g.endsAt) L.timeUp(g);
        else L.move(g, only !== null ? only : L.bestMove(g, seat.color, g.dice, moves));
        changed(r);
      });
    }
  }
  if (g.phase === 'roll' && seat.bot) {
    g.deadline = null;
    return later(BOT_DELAY, () => { if (g.endsAt && Date.now() >= g.endsAt) L.timeUp(g); else L.roll(g, crypto.randomInt(1, 7)); changed(r); });
  }
  g.deadline = now + TURN_SECONDS * 1000;
  later(TURN_SECONDS * 1000 + 300, () => timeout(r));
}

// A human did not act in time: play for them; remove them after MAX_MISSED.
function timeout(r) {
  const g = r.g;
  if (g.endsAt && Date.now() >= g.endsAt) { L.timeUp(g); return changed(r); }
  const seat = L.currentSeat(g);
  seat.missed++;
  if (seat.missed >= MAX_MISSED) {
    L.eliminate(g, seat.color);
    g.last.note = 'missed-turns';
    userRoom.delete(seat.id);
    return changed(r);
  }
  if (g.phase === 'roll') { r.autoTurn = true; L.roll(g, crypto.randomInt(1, 7)); }
  else if (g.phase === 'move') L.move(g, L.bestMove(g, seat.color, g.dice, L.legalMoves(g, seat.color, g.dice)));
  changed(r);
}

function finish(r) {
  clearTimeout(r.timer);
  const g = r.g;
  g.deadline = null;
  r.status = 'over';
  const w = r.seats.find(s => s.color === g.winner);
  r.result = { winnerName: w.name, winnerColor: w.color, winnerIsBot: w.bot, prize: w.bot ? 0 : r.prize };
  tx(() => {
    if (!w.bot) {
      if (r.prize > 0) addCoins(w.userId, r.prize, 'win', `Won ${labelOf(r).toLowerCase()}`);
      db.prepare('UPDATE users SET won = won + 1 WHERE id = ?').run(w.userId);
    }
    db.prepare("UPDATE matches SET status = 'over', winner_id = ?, winner_name = ?, finished_at = datetime('now'), result = ? WHERE id = ?")
      .run(w.bot ? null : w.userId, w.name, JSON.stringify(resultOf(r)), r.id);
  });
  for (const s of r.seats) if (!s.bot && userRoom.get(s.userId) === r.id) userRoom.delete(s.userId);
  pushState(r);
  emit(r, 'game.finished');
  setTimeout(() => { for (const c of r.clients) c.end(); rooms.delete(r.id); }, 10 * 60000).unref();
}

// ---------- player actions ----------
export function getRoom(id) {
  const r = rooms.get(Number(id));
  if (!r) throw new AppError('Game not found. It may have ended.', 404);
  return r;
}

function mySeat(r, userId) {
  if (!r.g) throw new AppError('Game has not started');
  const s = r.g.seats.find(x => x.id === userId);
  if (!s) throw new AppError('You are not playing in this game', 403);
  return s;
}

function myTurn(r, userId) {
  const s = mySeat(r, userId);
  if (r.status !== 'playing') throw new AppError('Game is over');
  if (L.currentSeat(r.g).id !== s.id) throw new AppError('Not your turn');
  return s;
}

export function roll(userId, roomId) {
  const r = getRoom(roomId);
  const s = myTurn(r, userId);
  if (r.g.phase !== 'roll') throw new AppError('Already rolled');
  s.missed = 0;
  L.roll(r.g, crypto.randomInt(1, 7));
  changed(r);
}

export function move(userId, roomId, token) {
  const r = getRoom(roomId);
  const s = myTurn(r, userId);
  if (r.g.phase !== 'move') throw new AppError('Roll the dice first');
  try { L.move(r.g, Number(token)); } catch (err) { throw new AppError(err.message); }
  s.missed = 0;
  changed(r);
}

const EMOJIS = new Set(['👍', '😂', '😡', '😎', '🙏', '🔥', '😭', '🎉', 'Hurry up!', 'Well played!', 'Good luck!', 'Oops!']);
export function chat(userId, roomId, text) {
  const r = getRoom(roomId);
  const seat = r.seats.find(s => s.userId === userId);
  if (!seat) throw new AppError('You are not in this room', 403);
  if (!EMOJIS.has(text)) throw new AppError('Pick one of the quick messages');
  const now = Date.now();
  if (seat.lastChat && now - seat.lastChat < 1500) throw new AppError('Slow down');
  seat.lastChat = now;
  send(r, { type: 'chat', color: seat.color, name: seat.name, text });
}

export function view(userId, roomId) {
  const r = getRoom(roomId);
  if (!r.seats.some(s => s.userId === userId)) throw new AppError('You are not in this room', 403);
  return { room: publicRoom(r), game: r.g ? L.snapshot(r.g) : null };
}

export function current(userId) {
  const r = activeRoomOf(userId);
  return r ? publicRoom(r) : null;
}

export function subscribe(userId, roomId, res) {
  const r = getRoom(roomId);
  if (!r.seats.some(s => s.userId === userId)) throw new AppError('You are not in this room', 403);
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 2000\n\n');
  res.write(`data: ${JSON.stringify({ type: 'state', room: publicRoom(r), game: r.g ? L.snapshot(r.g) : null, now: Date.now() })}\n\n`);
  r.clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  res.on('close', () => { clearInterval(ping); r.clients.delete(res); });
}

// Games live in memory; after a restart, refund anyone whose game was cut off.
export function refundInterrupted() {
  const rows = db.prepare("SELECT * FROM matches WHERE status IN ('waiting', 'playing')").all();
  tx(() => {
    for (const m of rows) {
      for (const s of JSON.parse(m.seats)) if (!s.bot && m.entry > 0) addCoins(s.userId, m.entry, 'refund', 'Game interrupted by server restart');
      db.prepare("UPDATE matches SET status = 'cancelled', finished_at = datetime('now') WHERE id = ?").run(m.id);
    }
  });
  if (rows.length) console.log(`Refunded ${rows.length} interrupted game(s)`);
}

// ---------- admin ----------
export function liveRooms() {
  return [...rooms.values()].filter(r => r.status === 'waiting' || r.status === 'playing').map(r => ({
    ...publicRoom(r),
    seats: r.seats.map(s => ({ userId: s.bot ? null : s.userId, name: s.name, color: s.color || null, bot: s.bot })),
    progress: r.g ? Object.fromEntries(r.g.seats.map(s => [s.color, r.g.tokens[s.color].filter(p => p === L.HOME).length])) : null,
    turn: r.g ? L.currentSeat(r.g).name : null,
  }));
}

// Admin stops a game: everyone gets their entry back.
export function adminCancel(roomId) {
  const r = getRoom(roomId);
  if (!['waiting', 'playing'].includes(r.status)) throw new AppError('Game already ended');
  clearTimeout(r.timer); clearTimeout(r.fillTimer);
  tx(() => { for (const s of r.seats) if (!s.bot && r.entry > 0) addCoins(s.userId, r.entry, 'refund', 'Game cancelled by admin'); });
  r.status = 'cancelled';
  for (const s of r.seats) if (!s.bot && userRoom.get(s.userId) === r.id) userRoom.delete(s.userId);
  byCode.delete(r.code);
  saveRow(r);
  send(r, { type: 'state', room: publicRoom(r), game: null, cancelled: true });
  emit(r, 'room.cancelled');
}

// Remove a banned player from any game they are waiting in or playing.
export function kickUser(userId) {
  const r = activeRoomOf(userId);
  if (r) leave(userId, r.id);
}

export const stats = () => ({
  online: new Set([...userRoom.keys()]).size,
  waiting: [...rooms.values()].filter(r => r.status === 'waiting').length,
  playing: [...rooms.values()].filter(r => r.status === 'playing').length,
});

// ---------- developer API rooms ----------
const MODES = { classic: 4, '1goti': 1, '2goti': 2, '3goti': 3 };

function progressOf(r) {
  if (!r.g) return null;
  const g = r.g;
  return {
    phase: g.phase, turn: L.currentSeat(g)?.color || null, dice: g.dice, endsAt: g.endsAt,
    players: g.seats.map(s => ({
      name: s.name, color: s.color, left: s.out,
      gotis: g.tokens[s.color].map(p => (p < 0 ? 'base' : p === L.HOME ? 'home' : p)),
      home: g.tokens[s.color].filter(p => p === L.HOME).length,
      score: L.score(g, s.color),
    })),
  };
}

function resultOf(r) {
  const g = r.g;
  if (!g?.winner) return null;
  const order = [...g.seats].filter(s => !s.out).sort((a, b) => L.score(g, b.color) - L.score(g, a.color));
  const ranking = [g.seats.find(s => s.color === g.winner), ...order.filter(s => s.color !== g.winner), ...g.seats.filter(s => s.out)];
  return {
    winner: { name: ranking[0].name, color: ranking[0].color, playerId: ranking[0].bot ? null : ranking[0].id },
    ranking: ranking.map((s, i) => ({ position: i + 1, name: s.name, color: s.color, playerId: s.bot ? null : s.id, home: g.tokens[s.color].filter(p => p === L.HOME).length, left: s.out })),
    reason: g.last?.type === 'timeup' ? 'timer' : g.seats.some(s => s.out) && g.ranking.length === 0 ? 'others_left' : 'finished',
  };
}

function apiView(r) {
  return {
    roomCode: r.code, roomId: r.id, status: r.status,
    mode: Object.keys(MODES).find(k => MODES[k] === r.winTokens), cut: r.cut, timerMinutes: r.timerMin || null,
    maxPlayers: r.players, joined: r.seats.length,
    players: r.seats.map(s => ({ name: s.name, playerId: s.userId, color: s.color || null })),
    metadata: r.meta || null, createdAt: new Date(r.createdAt).toISOString(),
    expiresAt: r.status === 'waiting' ? new Date(r.createdAt + API_EXPIRE_MIN * 60000).toISOString() : null,
    result: r.status === 'over' ? resultOf(r) : null,
  };
}

function rowView(m) {
  const seats = JSON.parse(m.seats);
  return {
    roomCode: m.code, roomId: m.id, status: m.status,
    mode: Object.keys(MODES).find(k => MODES[k] === (JSON.parse(m.meta || 'null')?.__winTokens || 4)) || 'classic',
    maxPlayers: m.players, joined: seats.length,
    players: seats.map(s => ({ name: s.name, playerId: s.userId, color: s.color || null })),
    metadata: (({ __winTokens, ...rest }) => (Object.keys(rest).length ? rest : null))(JSON.parse(m.meta || '{}') || {}),
    createdAt: new Date(m.created_at.replace(' ', 'T') + 'Z').toISOString(),
    finishedAt: m.finished_at ? new Date(m.finished_at.replace(' ', 'T') + 'Z').toISOString() : null,
    result: m.result ? JSON.parse(m.result) : null,
  };
}

export function createApiRoom(devId, { players = 2, mode = 'classic', cut = true, timerMinutes = 0, metadata = null } = {}) {
  players = Number(players);
  if (![2, 3, 4].includes(players)) throw new AppError('players must be 2, 3 or 4');
  if (!(mode in MODES)) throw new AppError('mode must be one of: classic, 1goti, 2goti, 3goti');
  const timerMin = Number(timerMinutes) || 0;
  if (timerMin && !(timerMin >= 3 && timerMin <= 60)) throw new AppError('timerMinutes must be 0 (off) or 3 to 60');
  if (metadata !== null && (typeof metadata !== 'object' || JSON.stringify(metadata).length > 1000)) throw new AppError('metadata must be a JSON object under 1000 characters');
  const r = createRoom({
    kind: 'api', players, entry: 0, winTokens: MODES[mode], cut: cut !== false && cut !== 'false',
    apiDevId: devId, meta: metadata ? { ...metadata } : null, timerMin: timerMin || null,
  });
  db.prepare('UPDATE matches SET meta = ? WHERE id = ?').run(JSON.stringify({ ...(metadata || {}), __winTokens: MODES[mode] }), r.id);
  r.expireTimer = setTimeout(() => {
    if (r.status !== 'waiting') return;
    r.status = 'expired';
    for (const s of r.seats) userRoom.delete(s.userId);
    byCode.delete(r.code);
    saveRow(r);
    send(r, { type: 'state', room: publicRoom(r), game: null, cancelled: true });
    emit(r, 'room.expired');
  }, API_EXPIRE_MIN * 60000);
  r.expireTimer.unref?.();
  return apiView(r);
}

function apiRoom(devId, code) {
  const id = byCode.get(String(code));
  const r = id && rooms.get(id);
  if (r && r.kind === 'api' && r.apiDevId === devId) return { live: r };
  const m = db.prepare("SELECT * FROM matches WHERE code = ? AND api_dev_id = ? AND kind = 'api'").get(String(code), devId);
  if (!m) throw new AppError('Room not found', 404);
  const lr = rooms.get(m.id);
  return lr ? { live: lr } : { row: m };
}

export function apiGetRoom(devId, code) {
  const { live, row } = apiRoom(devId, code);
  return live ? apiView(live) : rowView(row);
}

export function apiProgress(devId, code) {
  const { live, row } = apiRoom(devId, code);
  if (!live) return { roomCode: row.code, status: row.status, progress: null, message: 'Live progress is only available while the game is running' };
  return { roomCode: live.code, status: live.status, progress: progressOf(live) };
}

export function apiResult(devId, code) {
  const { live, row } = apiRoom(devId, code);
  const v = live ? apiView(live) : rowView(row);
  return { roomCode: v.roomCode, status: v.status, finished: v.status === 'over', result: v.result };
}

export function apiStart(devId, code) {
  const { live } = apiRoom(devId, code);
  if (!live || live.status !== 'waiting') throw new AppError('Room is not waiting for players');
  if (live.seats.length < 2) throw new AppError('At least 2 players must join before starting');
  clearTimeout(live.expireTimer);
  start(live);
  return apiView(live);
}

export function apiCancel(devId, code) {
  const { live } = apiRoom(devId, code);
  if (!live || !['waiting', 'playing'].includes(live.status)) throw new AppError('Only waiting or running rooms can be cancelled');
  clearTimeout(live.expireTimer);
  adminCancel(live.id);
  return apiView(live);
}

export function apiList(devId, limit = 50) {
  const rows = db.prepare("SELECT * FROM matches WHERE api_dev_id = ? AND kind = 'api' ORDER BY id DESC LIMIT ?").all(devId, Math.min(100, Number(limit) || 50));
  return rows.map(m => (rooms.get(m.id) ? apiView(rooms.get(m.id)) : rowView(m)));
}
