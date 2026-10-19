export type BGPlayer = 'ivory' | 'onyx';
export type BGFrom = number | 'bar';
export type BGTo = number | 'off';
export type BGMove = { from: BGFrom; to: BGTo; die: number; hit: boolean };
export type BGPhase = 'roll' | 'move' | 'finished';
export type BGGame = {
  /** Positive counters belong to Ivory; negative counters to Onyx. */
  points: number[];
  bar: Record<BGPlayer, number>;
  off: Record<BGPlayer, number>;
  turn: BGPlayer;
  phase: BGPhase;
  dice: number[];
  lastRoll: [number, number] | null;
  rollCount: number;
  winner: BGPlayer | null;
  notice: string;
};

export const bgOther = (player: BGPlayer): BGPlayer =>
  player === 'ivory' ? 'onyx' : 'ivory';
const signOf = (player: BGPlayer) => player === 'ivory' ? 1 : -1;
const ownCount = (value: number, player: BGPlayer) => Math.max(0, value * signOf(player));
const validDie = (die: number) => Number.isInteger(die) && die >= 1 && die <= 6;

export function newBackgammonGame(): BGGame {
  const points = Array<number>(24).fill(0);
  // Ivory moves from point 24 toward point 1 (index 23 -> 0).
  points[23] = 2; points[12] = 5; points[7] = 3; points[5] = 5;
  // Onyx moves the opposite direction (index 0 -> 23).
  points[0] = -2; points[11] = -5; points[16] = -3; points[18] = -5;
  return {
    points,
    bar: { ivory: 0, onyx: 0 },
    off: { ivory: 0, onyx: 0 },
    turn: 'ivory',
    phase: 'roll',
    dice: [],
    lastRoll: null,
    rollCount: 0,
    winner: null,
    notice: 'Ivory begins. Roll to make your first move.',
  };
}

function homeReady(game: BGGame, player: BGPlayer): boolean {
  if (game.bar[player]) return false;
  for (let index = 0; index < 24; index++) {
    const home = player === 'ivory' ? index <= 5 : index >= 18;
    if (!home && ownCount(game.points[index], player)) return false;
  }
  return true;
}
function canBear(game: BGGame, player: BGPlayer, from: number, die: number): boolean {
  if (!homeReady(game, player)) return false;
  const distance = player === 'ivory' ? from + 1 : 24 - from;
  if (die === distance) return true;
  if (die < distance) return false;
  // With an oversized die, only the furthest checker may leave.
  for (let index = 0; index < 24; index++) {
    const further = player === 'ivory' ? index > from : index < from;
    if (further && ownCount(game.points[index], player)) return false;
  }
  return true;
}
function canLand(game: BGGame, player: BGPlayer, target: number): boolean {
  return target >= 0 && target < 24 &&
    game.points[target] * signOf(player) >= -1;
}

function rawMoves(game: BGGame, die: number): BGMove[] {
  if (!validDie(die)) return [];
  const player = game.turn, direction = player === 'ivory' ? -1 : 1;
  if (game.bar[player] > 0) {
    const target = player === 'ivory' ? 24 - die : die - 1;
    return canLand(game, player, target) ? [{
      from: 'bar', to: target, die,
      hit: game.points[target] * signOf(player) === -1,
    }] : [];
  }
  const moves: BGMove[] = [];
  for (let from = 0; from < 24; from++) {
    if (ownCount(game.points[from], player) === 0) continue;
    const target = from + direction * die;
    if (target >= 0 && target < 24) {
      if (canLand(game, player, target))
        moves.push({ from, to: target, die, hit: game.points[target] * signOf(player) === -1 });
    } else if (canBear(game, player, from, die)) {
      moves.push({ from, to: 'off', die, hit: false });
    }
  }
  return moves;
}

function afterRaw(game: BGGame, move: BGMove): BGGame {
  const points = [...game.points];
  const bar = { ...game.bar }, off = { ...game.off };
  const player = game.turn, sign = signOf(player);
  if (move.from === 'bar') bar[player]--;
  else points[move.from] -= sign;
  if (move.to === 'off') off[player]++;
  else {
    if (points[move.to] * sign === -1) {
      points[move.to] = 0;
      bar[bgOther(player)]++;
    }
    points[move.to] += sign;
  }
  const remaining = [...game.dice];
  const index = remaining.indexOf(move.die);
  if (index >= 0) remaining.splice(index, 1);
  return { ...game, points, bar, off, dice: remaining };
}

function positionKey(game: BGGame): string {
  return game.points.join(',') + '|' + game.bar.ivory + ',' + game.bar.onyx +
    '|' + game.off.ivory + ',' + game.off.onyx + '|' + [...game.dice].sort().join(',');
}

/**
 * Maximum dice-use rule. Explores the full remaining turn (at most four dice).
 * This also prevents choosing a legal-looking move that would waste a second die.
 */
function bestDiceCount(game: BGGame, memo: Map<string, number>): number {
  const key = positionKey(game);
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  if (!game.dice.length) return 0;
  let max = 0;
  for (const die of new Set(game.dice)) {
    for (const move of rawMoves(game, die)) {
      const next = afterRaw(game, move);
      max = Math.max(max, 1 + bestDiceCount(next, memo));
      if (max === game.dice.length) break;
    }
    if (max === game.dice.length) break;
  }
  memo.set(key, max);
  return max;
}

export function legalBackgammonMoves(game: BGGame): BGMove[] {
  if (game.phase !== 'move' || game.winner || !game.dice.length) return [];
  const memo = new Map<string, number>();
  const candidates = [...new Set(game.dice)].flatMap((die) => rawMoves(game, die));
  if (!candidates.length) return [];
  const scored = candidates.map((move) => ({
    move, count: 1 + bestDiceCount(afterRaw(game, move), memo),
  }));
  const required = Math.max(...scored.map((entry) => entry.count));
  let available = scored.filter((entry) => entry.count === required).map((entry) => entry.move);
  // With two different dice and only one usable, the higher die is mandatory.
  if (game.dice.length === 2 && game.dice[0] !== game.dice[1] && required === 1) {
    const high = Math.max(...available.map((move) => move.die));
    available = available.filter((move) => move.die === high);
  }
  return available;
}

function passTurn(game: BGGame, notice: string): BGGame {
  return {
    ...game, dice: [], phase: 'roll', turn: bgOther(game.turn), notice,
  };
}

export function rollBackgammon(
  game: BGGame, roll?: [number, number], rng: () => number = Math.random,
): BGGame {
  if (game.phase !== 'roll' || game.winner) return game;
  const dice: [number, number] = roll ?? [
    Math.floor(rng() * 6) + 1, Math.floor(rng() * 6) + 1,
  ];
  if (!dice.every(validDie)) return game;
  const remaining = dice[0] === dice[1] ? Array<number>(4).fill(dice[0]) : [...dice];
  const next: BGGame = {
    ...game, dice: remaining, lastRoll: dice, phase: 'move',
    rollCount: game.rollCount + 1,
    notice: dice[0] === dice[1] ? 'Doubles! Four moves with ' + dice[0] + '.' : 'Play both dice if possible.',
  };
  return legalBackgammonMoves(next).length
    ? next : passTurn(next, 'No legal moves. Turn passes to ' + bgOther(game.turn) + '.');
}

export function applyBackgammonMove(game: BGGame, requested: BGMove): BGGame {
  const move = legalBackgammonMoves(game).find((legal) =>
    legal.from === requested.from && legal.to === requested.to && legal.die === requested.die);
  if (!move) return game;
  const next = afterRaw(game, move);
  if (next.off[game.turn] === 15) {
    return { ...next, dice: [], phase: 'finished', winner: game.turn,
      notice: (game.turn === 'ivory' ? 'Ivory' : 'Onyx') + ' has borne off all fifteen checkers!' };
  }
  return legalBackgammonMoves(next).length
    ? { ...next, notice: move.hit ? 'A blot was hit! Opponent must re-enter from the bar.' : 'Make your next move.' }
    : passTurn(next, 'Turn complete. ' + bgOther(game.turn) + ' is ready to roll.');
}
