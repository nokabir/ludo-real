// Games played on this device only: vs Computer, and Pass & Play (friends share one phone).
import * as L from './engine.js';
import { LudoView } from './board-ui.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const die = () => 1 + Math.floor(Math.random() * 6);

// seats: [{ name, bot, avatarHtml }]   opts: { winTokens, cut, myColor, auto() }
export function startLocal(root, seats, { winTokens = 4, cut = true, onOver, auto = () => false } = {}) {
  const g = L.createGame(seats.map((s, i) => ({ id: i, name: s.name, bot: !!s.bot })), { winTokens, cut });
  const humans = new Set(g.seats.filter(s => !s.bot).map(s => s.color));
  const passAndPlay = humans.size > 1;
  let stopped = false, acting = false;

  const view = new LudoView(root, L.snapshot(g), {
    me: passAndPlay ? null : [...humans][0],
    local: passAndPlay,
    controls: c => humans.has(c) && L.currentSeat(g).color === c,
    avatarFor: c => seats[g.seats.findIndex(s => s.color === c)]?.avatarHtml || '',
    onRoll: () => act(() => L.roll(g, die())),
    onMove: t => act(() => L.move(g, t)),
  });

  const sync = () => view.update(L.snapshot(g));

  async function act(fn) {
    if (acting || stopped) return;
    acting = true;
    try { fn(); await sync(); await run(); } catch { /* tap at the wrong moment */ } finally { acting = false; }
  }

  // Plays everything that doesn't need a person: passes, forced moves, computer turns, auto mode.
  async function run() {
    while (!stopped && !g.winner) {
      const seat = L.currentSeat(g);
      const robot = seat.bot || (!passAndPlay && auto());
      if (g.phase === 'pass') { await sleep(900); L.pass(g); await sync(); continue; }
      if (g.phase === 'move') {
        const moves = L.legalMoves(g, seat.color, g.dice);
        const only = L.onlyChoice(g, seat.color, moves);
        if (robot || only !== null) {
          await sleep(robot ? 650 : 350);
          if (stopped) return;
          L.move(g, only !== null ? only : L.bestMove(g, seat.color, g.dice, moves));
          await sync();
          continue;
        }
        return;
      }
      if (g.phase === 'roll' && robot) { await sleep(650); if (stopped) return; L.roll(g, die()); await sync(); continue; }
      return;
    }
    if (g.winner && !stopped) {
      const w = g.seats.find(s => s.color === g.winner);
      onOver?.({ winnerName: w.name, winnerColor: w.color, iWon: !w.bot && !passAndPlay });
    }
  }

  run();
  return {
    view,
    kick() { if (!acting) run(); },            // e.g. auto mode switched on
    stop() { stopped = true; view.destroy(); },
  };
}
