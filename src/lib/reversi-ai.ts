import {
  availableReversiMoves, legalReversiMoves, playReversiMove, reversiScore,
  type ReversiGame, type ReversiMove, type ReversiBoard,
} from './reversi';

export type ReversiDifficulty = 'easy' | 'medium' | 'hard';

/** Positive scores favor Onyx. Opponents run entirely inside the browser. */
const BOARD_WEIGHTS = [
  [90, -24, 12, 8, 8, 12, -24, 90],
  [-24, -42, -5, -5, -5, -5, -42, -24],
  [12, -5, 7, 3, 3, 7, -5, 12],
  [8, -5, 3, 1, 1, 3, -5, 8],
  [8, -5, 3, 1, 1, 3, -5, 8],
  [12, -5, 7, 3, 3, 7, -5, 12],
  [-24, -42, -5, -5, -5, -5, -42, -24],
  [90, -24, 12, 8, 8, 12, -24, 90],
];

function evaluate(board: ReversiBoard, finished: boolean): number {
  const count = reversiScore(board);
  if (finished) return Math.sign(count.onyx - count.ivory) * 100_000 +
    count.onyx - count.ivory;
  const total = count.onyx + count.ivory;
  let score = 0;
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    if (board[row][col]) score += BOARD_WEIGHTS[row][col] * (board[row][col] === 'onyx' ? 1 : -1);
  }
  const mobility = legalReversiMoves(board, 'onyx').length -
    legalReversiMoves(board, 'ivory').length;
  score += mobility * (total < 45 ? 9 : 5);
  score += (count.onyx - count.ivory) * (total > 48 ? 12 : 1);
  return score;
}
function priority(move: ReversiMove): number {
  const corner = (move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7);
  return (corner ? 500 : 0) + BOARD_WEIGHTS[move.row][move.col] +
    move.flips.length * 3;
}
function search(
  game: ReversiGame, depth: number, alpha: number, beta: number,
  budget: { nodes: number; max: number },
): number {
  budget.nodes++;
  if (game.finished || depth === 0 || budget.nodes >= budget.max)
    return evaluate(game.board, game.finished);
  const moves = availableReversiMoves(game).sort((a, b) => priority(b) - priority(a));
  if (!moves.length) return evaluate(game.board, true);
  const maximize = game.turn === 'onyx';
  let best = maximize ? -Infinity : Infinity;
  for (const move of moves) {
    const next = playReversiMove(game, move);
    const value = search(next, depth - 1, alpha, beta, budget);
    best = maximize ? Math.max(best, value) : Math.min(best, value);
    if (maximize) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (alpha >= beta || budget.nodes >= budget.max) break;
  }
  return best;
}

/**
 * Easy: one-ply greedy positional move.
 * Medium: two-ply minimax.
 * Hard: four-ply alpha-beta, up to 4500 search nodes.
 */
export function chooseReversiMove(game: ReversiGame, difficulty: ReversiDifficulty): ReversiMove | null {
  const moves = availableReversiMoves(game).sort((a, b) => priority(b) - priority(a));
  if (!moves.length) return null;
  const depth = difficulty === 'hard' ? 4 : difficulty === 'medium' ? 2 : 1;
  const budget = { nodes: 0, max: difficulty === 'hard' ? 4500 : 1200 };
  const maximize = game.turn === 'onyx';
  let chosen = moves[0];
  let best = maximize ? -Infinity : Infinity;
  for (const move of moves) {
    const next = playReversiMove(game, move);
    const score = search(next, depth - 1, -Infinity, Infinity, budget);
    if ((maximize && score > best) || (!maximize && score < best)) {
      best = score;
      chosen = move;
    }
    if (budget.nodes >= budget.max) break;
  }
  return chosen;
}
