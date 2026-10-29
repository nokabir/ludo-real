// Ludo rules engine. Pure functions, no DOM: used by the server (online games)
// and the browser (practice games).
//
// Board is a 15x15 grid (x right, y down). Colours sit clockwise:
//   red bottom-left, green top-left, yellow top-right, blue bottom-right.
// Token progress p:  -1 = in base, 0..50 = main track (relative to own start),
//                    51..55 = own home column, 56 = home (finished).

export const COLORS = ['red', 'green', 'yellow', 'blue'];
export const HOME = 56;
const LAST_TRACK = 50;

// 52 main-track cells starting at red's start square, going clockwise.
export const TRACK = [
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7],
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0],
  [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7],
  [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14],
  [6, 14],
];

export const START = { red: 0, green: 13, yellow: 26, blue: 39 };

export const HOME_COLUMN = {
  red: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

// Where finished tokens rest (inside the centre triangle of their colour).
export const HOME_SPOT = { red: [7, 8.2], green: [6.2, 7], yellow: [7, 5.8], blue: [7.8, 7] };

// Four base circles per colour (cell centres).
export const BASE_SPOTS = {
  red: [[1.75, 10.75], [3.25, 10.75], [1.75, 12.25], [3.25, 12.25]],
  green: [[1.75, 1.75], [3.25, 1.75], [1.75, 3.25], [3.25, 3.25]],
  yellow: [[10.75, 1.75], [12.25, 1.75], [10.75, 3.25], [12.25, 3.25]],
  blue: [[10.75, 10.75], [12.25, 10.75], [10.75, 12.25], [12.25, 12.25]],
};

// Start squares + star squares: no captures here.
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const STARS = [8, 21, 34, 47];

// Seat colours by player count (2 players sit opposite each other).
export function colorsFor(n) {
  return { 2: ['red', 'yellow'], 3: ['red', 'green', 'yellow'], 4: ['red', 'green', 'yellow', 'blue'] }[n];
}

export function absIndex(color, p) {
  return p >= 0 && p <= LAST_TRACK ? (START[color] + p) % 52 : null;
}

// Board cell (x, y) of a token, for drawing.
export function cellOf(color, p, tokenIdx = 0) {
  if (p < 0) { const [x, y] = BASE_SPOTS[color][tokenIdx]; return [x - .5, y - .5]; }   // spots are centres; cells are corners
  if (p <= LAST_TRACK) return TRACK[absIndex(color, p)];
  if (p < HOME) return HOME_COLUMN[color][p - LAST_TRACK - 1];
  return HOME_SPOT[color];
}

export function createGame(players, opts = {}) {
  // players: [{ id, name, color?, bot? }]
  // opts: { winTokens 1-4 (gotis needed home), cut (captures on), endsAt (timer mode, ms timestamp), turnSeconds }
  const colors = colorsFor(players.length);
  const tokens = {};
  const seats = players.map((pl, i) => {
    const color = pl.color || colors[i];
    tokens[color] = [-1, -1, -1, -1];
    return { id: pl.id, name: pl.name, color, bot: !!pl.bot, missed: 0, out: false };
  });
  return {
    seats, tokens, turn: 0, phase: 'roll', dice: null, sixes: 0,
    winner: null, ranking: [], seq: 0, last: null,
    turnSeconds: opts.turnSeconds || 25, deadline: null,
    winTokens: Math.min(4, Math.max(1, opts.winTokens || 4)), cut: opts.cut !== false, endsAt: opts.endsAt || null,
  };
}

export const currentSeat = g => g.seats[g.turn];

export function legalMoves(g, color, roll) {
  const out = [];
  g.tokens[color].forEach((p, i) => {
    if (p === HOME) return;
    if (p < 0) { if (roll === 6) out.push(i); return; }
    if (p + roll <= HOME) out.push(i);
  });
  return out;
}

// True when every legal move is equivalent (same token position), so the game can move for the player.
export function onlyChoice(g, color, moves) {
  if (!moves.length) return null;
  const ps = new Set(moves.map(i => g.tokens[color][i]));
  return ps.size === 1 ? moves[0] : null;
}

function nextActive(g, from) {
  for (let k = 1; k <= g.seats.length; k++) {
    const i = (from + k) % g.seats.length;
    if (!g.seats[i].out && !g.ranking.includes(g.seats[i].color)) return i;
  }
  return from;
}

function endTurn(g, extra) {
  if (!extra) { g.turn = nextActive(g, g.turn); g.sixes = 0; }
  g.phase = 'roll';
  g.dice = null;
}

// First player with all four tokens home wins; so does the last player left in.
function checkGameOver(g) {
  if (!g.winner && g.ranking.length) g.winner = g.ranking[0];
  const remaining = g.seats.filter(s => !s.out);
  if (!g.winner && remaining.length === 1) g.winner = remaining[0].color;
  return !!g.winner;
}

// Roll the dice for the current player. `value` comes from the caller (server RNG / Math.random).
export function roll(g, value) {
  if (g.winner || g.phase !== 'roll') throw new Error('Not time to roll');
  const seat = currentSeat(g);
  g.seq++;
  g.dice = value;
  g.sixes = value === 6 ? g.sixes + 1 : 0;
  const moves = legalMoves(g, seat.color, value);
  g.last = { type: 'roll', color: seat.color, value, moves };

  if (g.sixes === 3) {               // three sixes in a row: turn is lost
    g.last.note = 'three-sixes';
    g.phase = 'pass';
    return { moves: [], pass: true };
  }
  if (!moves.length) { g.phase = 'pass'; return { moves, pass: true }; }
  g.phase = 'move';
  return { moves, pass: false };
}

// After a roll with no legal move (or three sixes), hand the turn on.
export function pass(g) {
  if (g.phase !== 'pass') throw new Error('Nothing to pass');
  g.seq++;
  endTurn(g, false);
}

export function move(g, tokenIdx) {
  if (g.winner || g.phase !== 'move') throw new Error('Not time to move');
  const seat = currentSeat(g);
  const color = seat.color;
  const r = g.dice;
  if (!legalMoves(g, color, r).includes(tokenIdx)) throw new Error('Illegal move');

  const from = g.tokens[color][tokenIdx];
  const to = from < 0 ? 0 : from + r;
  g.tokens[color][tokenIdx] = to;
  g.seq++;

  const captured = [];
  const abs = absIndex(color, to);
  if (g.cut !== false && abs !== null && !SAFE.has(abs)) {
    for (const s of g.seats) {
      if (s.color === color) continue;
      g.tokens[s.color].forEach((p, i) => {
        if (absIndex(s.color, p) === abs) { captured.push({ color: s.color, token: i, from: p }); g.tokens[s.color][i] = -1; }
      });
    }
  }

  const reachedHome = to === HOME;
  if (reachedHome && g.tokens[color].filter(p => p === HOME).length >= (g.winTokens || 4)) g.ranking.push(color);

  g.last = { type: 'move', color, token: tokenIdx, from, to, dice: r, captured, reachedHome };
  if (checkGameOver(g)) { g.phase = 'over'; return g.last; }

  const extra = (r === 6 || captured.length > 0 || reachedHome) && !g.ranking.includes(color);
  endTurn(g, extra);
  return g.last;
}

// Timer mode: when time is up, the player whose gotis have travelled furthest wins.
export function score(g, color) {
  return g.tokens[color].reduce((sum, p) => sum + (p < 0 ? 0 : p + 1), 0);
}

export function timeUp(g) {
  if (g.winner) return;
  const alive = g.seats.filter(s => !s.out);
  const scores = Object.fromEntries(alive.map(s => [s.color, score(g, s.color)]));
  const home = c => g.tokens[c].filter(p => p === HOME).length;
  alive.sort((a, b) => scores[b.color] - scores[a.color] || home(b.color) - home(a.color));
  g.winner = alive[0].color;
  g.phase = 'over';
  g.seq++;
  g.last = { type: 'timeup', scores };
}

// Remove a player (left the game or missed too many turns).
export function eliminate(g, color) {
  const seat = g.seats.find(s => s.color === color);
  if (!seat || seat.out) return;
  seat.out = true;
  g.seq++;
  g.last = { type: 'out', color };
  if (checkGameOver(g)) { g.phase = 'over'; return; }
  if (currentSeat(g).color === color) endTurn(g, false);
}

// Simple strategy for bots and for auto-moves on timeout.
export function bestMove(g, color, roll, moves) {
  let best = moves[0], bestScore = -Infinity;
  for (const i of moves) {
    const from = g.tokens[color][i];
    const to = from < 0 ? 0 : from + roll;
    let score = to * 0.1;
    if (to === HOME) score += 100;
    if (from < 0) score += 40;
    if (to > 50 && from <= 50) score += 25;                      // safe in home column
    const abs = absIndex(color, to);
    if (abs !== null) {
      if (SAFE.has(abs)) score += 15;
      else {
        for (const s of g.seats) if (s.color !== color && !s.out) {
          if (g.tokens[s.color].some(p => absIndex(s.color, p) === abs)) score += 80;   // capture
          // danger: an opponent 1-6 squares behind the landing square
          if (g.tokens[s.color].some(p => { const a = absIndex(s.color, p); return a !== null && ((abs - a + 52) % 52) >= 1 && ((abs - a + 52) % 52) <= 6; })) score -= 20;
        }
      }
    }
    const fromAbs = absIndex(color, from);
    if (fromAbs !== null && !SAFE.has(fromAbs)) score += 5;           // get out of danger
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

// Public view of a game (safe to send to every player).
export function snapshot(g) {
  return {
    seats: g.seats.map(s => ({ id: s.id, name: s.name, color: s.color, bot: s.bot, missed: s.missed, out: s.out })),
    tokens: g.tokens, turn: g.turn, phase: g.phase, dice: g.dice, winner: g.winner,
    seq: g.seq, last: g.last, deadline: g.deadline, turnSeconds: g.turnSeconds,
    winTokens: g.winTokens, cut: g.cut, endsAt: g.endsAt,
  };
}
