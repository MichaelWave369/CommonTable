export type MancalaPlayer = 'ivory' | 'onyx';
export type MancalaGame = {
  /** Kalah ring: Ivory pits 0..5, store 6; Onyx pits 7..12, store 13. */
  pits: number[];
  turn: MancalaPlayer;
  finished: boolean;
  winner: MancalaPlayer | null;
  moveCount: number;
  extraTurns: number;
  lastPit: number | null;
  notice: string;
};

export const opponent = (player: MancalaPlayer): MancalaPlayer =>
  player === 'ivory' ? 'onyx' : 'ivory';
export const ownStore = (player: MancalaPlayer) => player === 'ivory' ? 6 : 13;
export const ownPits = (player: MancalaPlayer): number[] =>
  player === 'ivory' ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
export const storeScore = (game: MancalaGame, player: MancalaPlayer) => game.pits[ownStore(player)];

export function newMancalaGame(): MancalaGame {
  const pits = Array<number>(14).fill(4);
  pits[6] = 0;
  pits[13] = 0;
  return {
    pits, turn: 'ivory', finished: false, winner: null,
    moveCount: 0, extraTurns: 0, lastPit: null,
    notice: 'Ivory starts. Choose one of your six pits to sow its stones.',
  };
}

export function legalMancalaMoves(game: MancalaGame): number[] {
  if (game.finished) return [];
  return ownPits(game.turn).filter((index) => game.pits[index] > 0);
}

/** Standard six-pit/four-stone Kalah, with counterclockwise sowing and captures. */
export function playMancalaMove(game: MancalaGame, from: number): MancalaGame {
  if (!legalMancalaMoves(game).includes(from)) return game;
  const pits = [...game.pits];
  let seeds = pits[from];
  pits[from] = 0;
  let current = from;
  const oppositeStore = ownStore(opponent(game.turn));
  while (seeds > 0) {
    current = (current + 1) % 14;
    if (current === oppositeStore) continue;
    pits[current]++;
    seeds--;
  }

  const store = ownStore(game.turn);
  const extra = current === store;
  let captured = 0;
  if (!extra && ownPits(game.turn).includes(current) && pits[current] === 1) {
    const oppositePit = 12 - current;
    if (pits[oppositePit] > 0) {
      captured = pits[oppositePit] + 1;
      pits[store] += captured;
      pits[current] = 0;
      pits[oppositePit] = 0;
    }
  }

  const ivoryEmpty = ownPits('ivory').every((index) => pits[index] === 0);
  const onyxEmpty = ownPits('onyx').every((index) => pits[index] === 0);
  const finished = ivoryEmpty || onyxEmpty;
  if (finished) {
    for (const player of ['ivory', 'onyx'] as const) {
      for (const index of ownPits(player)) {
        pits[ownStore(player)] += pits[index];
        pits[index] = 0;
      }
    }
  }
  const winner: MancalaPlayer | null = !finished || pits[6] === pits[13] ? null :
    pits[6] > pits[13] ? 'ivory' : 'onyx';
  let notice: string;
  if (finished) notice = winner
    ? (winner === 'ivory' ? 'Ivory' : 'Onyx') + ' wins with ' + pits[ownStore(winner)] + ' stones!'
    : 'The game ends in a draw!';
  else if (extra) notice = 'Last stone landed in your store. Extra turn!';
  else if (captured) notice = 'Capture! ' + captured + ' stones go to your store.';
  else notice = (opponent(game.turn) === 'ivory' ? 'Ivory' : 'Onyx') + ' to play.';

  return {
    pits, turn: finished || extra ? game.turn : opponent(game.turn),
    finished, winner, moveCount: game.moveCount + 1,
    extraTurns: game.extraTurns + (extra && !finished ? 1 : 0),
    lastPit: from, notice,
  };
}
