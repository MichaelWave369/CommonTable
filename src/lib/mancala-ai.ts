import {
  legalMancalaMoves, ownPits, playMancalaMove,
  type MancalaGame,
} from './mancala';

export type MancalaDifficulty = 'easy' | 'medium' | 'hard';
const WIN = 100_000;

function score(game: MancalaGame): number {
  const lead = game.pits[13] - game.pits[6];
  if (game.finished) return Math.sign(lead) * WIN + lead;
  const stones = (player: 'onyx' | 'ivory') =>
    ownPits(player).reduce((sum, i) => sum + game.pits[i], 0);
  // Side stones are worth something until they reach a store; empty pits
  // reduce flexibility. Points are scored from the Onyx computer's view.
  const availability = legalMancalaMoves({ ...game, turn: 'onyx' }).length -
    legalMancalaMoves({ ...game, turn: 'ivory' }).length;
  return lead * 16 + (stones('onyx') - stones('ivory')) * 1.2 + availability * 1.5;
}
function search(
  game: MancalaGame, depth: number, alpha: number, beta: number,
  budget: { nodes: number; max: number },
): number {
  budget.nodes++;
  if (game.finished || depth <= 0 || budget.nodes >= budget.max) return score(game);
  const moves = legalMancalaMoves(game);
  if (!moves.length) return score(game);
  const maximize = game.turn === 'onyx';
  let best = maximize ? -Infinity : Infinity;
  for (const move of moves) {
    const child = playMancalaMove(game, move);
    // Extra turns must be evaluated for the same player, not reversed.
    const value = search(child, depth - 1, alpha, beta, budget);
    best = maximize ? Math.max(best, value) : Math.min(best, value);
    if (maximize) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (alpha >= beta || budget.nodes >= budget.max) break;
  }
  return best;
}

/** Deterministic and fully offline. Easy 1, medium 3, hard 6 plies. */
export function chooseMancalaMove(game: MancalaGame, difficulty: MancalaDifficulty): number | null {
  const moves = legalMancalaMoves(game);
  if (!moves.length) return null;
  const depth = difficulty === 'hard' ? 6 : difficulty === 'medium' ? 3 : 1;
  const budget = { nodes: 0, max: difficulty === 'hard' ? 3500 : 1800 };
  const maximize = game.turn === 'onyx';
  let best = moves[0], bestScore = maximize ? -Infinity : Infinity;
  for (const pit of moves) {
    const child = playMancalaMove(game, pit);
    const value = search(child, depth - 1, -Infinity, Infinity, budget);
    if ((maximize && value > bestScore) || (!maximize && value < bestScore)) {
      bestScore = value; best = pit;
    }
    if (budget.nodes >= budget.max) break;
  }
  return best;
}
