import {
  applyMove, legalMoves, type CheckersGame, type Move as CheckerMove,
} from './checkers';
import {
  inCheck, legalChessMoves, previewChessMove,
  type ChessGame, type ChessMove, type Color, type PieceType,
} from './chess';

export type Difficulty = 'easy' | 'medium' | 'hard';

const CHECKER_DEPTH: Record<Difficulty, number> = { easy: 1, medium: 3, hard: 5 };
const CHESS_DEPTH: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
const PIECE_VALUES: Record<PieceType, number> = {
  p: 100, n: 320, b: 335, r: 500, q: 900, k: 0,
};
const MATE_SCORE = 100_000;

/**
 * Deterministic, completely browser-local AI. No online model and no
 * calls to the network. Scores are positive for the computer side:
 * Ember in Checkers, Black in Chess.
 */
function checkersScore(game: CheckersGame): number {
  if (game.winner) return game.winner === 'ember' ? MATE_SCORE : -MATE_SCORE;
  let score = 0;
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const piece = game.board[row][col];
    if (!piece) continue;
    const position = (piece.king ? 165 : 100) +
      (piece.king ? 0 : piece.player === 'ember' ? row * 3 : (7 - row) * 3) +
      (col >= 2 && col <= 5 ? 4 : 0);
    score += piece.player === 'ember' ? position : -position;
  }
  return score;
}
function checkerOrder(game: CheckersGame, moves: CheckerMove[]): CheckerMove[] {
  return [...moves].sort((a, b) => {
    const value = (move: CheckerMove) =>
      (move.jumped ? 200 : 0) +
      (game.board[move.from.row][move.from.col]?.king ? 7 : 0) +
      (3.5 - Math.abs(move.to.col - 3.5));
    return value(b) - value(a);
  });
}
function checkersSearch(game: CheckersGame, depth: number, alpha: number, beta: number): number {
  if (game.winner || depth <= 0) return checkersScore(game);
  const moves = legalMoves(game);
  if (!moves.length) return game.turn === 'ember' ? -MATE_SCORE : MATE_SCORE;
  const maximizing = game.turn === 'ember';
  let best = maximizing ? -Infinity : Infinity;
  for (const move of checkerOrder(game, moves)) {
    const next = applyMove(game, move);
    // Multiple jumps are still a single turn, and must remain together.
    const plyCost = next.turn === game.turn ? 0 : 1;
    const value = checkersSearch(next, depth - plyCost, alpha, beta);
    best = maximizing ? Math.max(best, value) : Math.min(best, value);
    if (maximizing) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseCheckersMove(game: CheckersGame, difficulty: Difficulty): CheckerMove | null {
  const moves = checkerOrder(game, legalMoves(game));
  if (!moves.length) return null;
  const maximizing = game.turn === 'ember';
  let best = moves[0], bestScore = maximizing ? -Infinity : Infinity;
  const depth = CHECKER_DEPTH[difficulty];
  for (const move of moves) {
    const next = applyMove(game, move);
    const value = checkersSearch(next, depth - (next.turn === game.turn ? 0 : 1), -Infinity, Infinity);
    if ((maximizing && value > bestScore) || (!maximizing && value < bestScore)) {
      best = move; bestScore = value;
    }
  }
  return best;
}

function chessScore(game: ChessGame): number {
  if (game.outcome === 'checkmate') return game.winner === 'black' ? MATE_SCORE : -MATE_SCORE;
  if (game.outcome) return 0;
  let total = 0;
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const piece = game.board[row][col];
    if (!piece) continue;
    const advance = piece.type === 'p'
      ? (piece.color === 'black' ? row - 1 : 6 - row) * 7 : 0;
    const center = (3.5 - Math.abs(col - 3.5) + 3.5 - Math.abs(row - 3.5));
    const positional = ['n', 'b', 'p'].includes(piece.type) ? center * 4 : center;
    total += (piece.color === 'black' ? 1 : -1) *
      (PIECE_VALUES[piece.type] + advance + positional);
  }
  return total;
}
function orderChessMoves(game: ChessGame, moves: ChessMove[]): ChessMove[] {
  const priority = (move: ChessMove) => {
    const victim = game.board[move.to.row][move.to.col];
    const moving = game.board[move.from.row][move.from.col];
    return (victim ? PIECE_VALUES[victim.type] * 10 - PIECE_VALUES[moving?.type || 'p'] : 0) +
      (move.enPassant ? 950 : 0) +
      (move.promotion ? PIECE_VALUES[move.promotion] : 0) +
      (move.castle ? 35 : 0);
  };
  return [...moves].sort((a, b) => priority(b) - priority(a));
}

// Keeps hard mode bounded on slower mobile browsers. The hard search may
// truncate to static evaluations near the budget; it always returns legal moves.
function chessSearch(
  game: ChessGame, depth: number, alpha: number, beta: number, counter: { nodes: number; budget: number },
): number {
  counter.nodes++;
  if (counter.nodes >= counter.budget) return chessScore(game);
  if (depth <= 0) {
    // A checkmated side has zero replies. Recognize mate at the leaf.
    if (inCheck(game) && legalChessMoves(game).length === 0)
      return game.turn === 'black' ? -MATE_SCORE - depth : MATE_SCORE + depth;
    return chessScore(game);
  }
  const moves = legalChessMoves(game);
  if (!moves.length) {
    if (!inCheck(game)) return 0;
    return game.turn === 'black' ? -MATE_SCORE - depth : MATE_SCORE + depth;
  }
  if (game.halfmoveClock >= 100) return 0;
  const maximizing = game.turn === 'black';
  let best = maximizing ? -Infinity : Infinity;
  for (const move of orderChessMoves(game, moves)) {
    const next = previewChessMove(game, move);
    const value = chessSearch(next, depth - 1, alpha, beta, counter);
    best = maximizing ? Math.max(best, value) : Math.min(best, value);
    if (maximizing) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (alpha >= beta || counter.nodes >= counter.budget) break;
  }
  return best;
}

export function chooseChessMove(game: ChessGame, difficulty: Difficulty): ChessMove | null {
  const moves = orderChessMoves(game, legalChessMoves(game));
  if (!moves.length) return null;
  const maximizing = game.turn === 'black';
  let best = moves[0], bestScore = maximizing ? -Infinity : Infinity;
  const depth = CHESS_DEPTH[difficulty];
  const counter = { nodes: 0, budget: difficulty === 'hard' ? 5000 : 2500 };
  for (const move of moves) {
    const value = chessSearch(previewChessMove(game, move), depth - 1, -Infinity, Infinity, counter);
    if ((maximizing && value > bestScore) || (!maximizing && value < bestScore)) {
      best = move; bestScore = value;
    }
    if (counter.nodes >= counter.budget) break;
  }
  return best;
}
