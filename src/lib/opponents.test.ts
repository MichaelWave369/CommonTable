import { describe, expect, it } from 'vitest';
import { applyMove, legalMoves, newCheckersGame, type CheckersGame } from './checkers';
import { emptyChessGame, legalChessMoves, newChessGame, playChessMove } from './chess';
import { chooseCheckersMove, chooseChessMove, type Difficulty } from './opponents';

const levels: Difficulty[] = ['easy', 'medium', 'hard'];
describe('offline checkers opponent', () => {
  it.each(levels)('%s always proposes a legal opening move', (difficulty) => {
    const opening = newCheckersGame();
    const game = applyMove(opening, legalMoves(opening)[0]); // Ember to play.
    const original = JSON.stringify(game);
    const chosen = chooseCheckersMove(game, difficulty);
    expect(chosen).toBeDefined();
    expect(legalMoves(game)).toContainEqual(chosen);
    expect(JSON.stringify(game)).toBe(original);
    expect(applyMove(game, chosen!).turn).toBe('ivory');
  });
  it('obeys mandatory captures, including chained jumps', () => {
    const game = newCheckersGame();
    const board: CheckersGame['board'] = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[2][1] = { player: 'ember', king: false };
    board[3][2] = { player: 'ivory', king: false };
    board[5][4] = { player: 'ivory', king: false };
    board[2][5] = { player: 'ember', king: false };
    const position: CheckersGame = { ...game, board, turn: 'ember' };
    const first = chooseCheckersMove(position, 'hard')!;
    expect(first.jumped).toEqual({ row: 3, col: 2 });
    const continuation = applyMove(position, first);
    expect(continuation.forcedFrom).toEqual({ row: 4, col: 3 });
    const second = chooseCheckersMove(continuation, 'hard')!;
    expect(second.jumped).toEqual({ row: 5, col: 4 });
    expect(applyMove(continuation, second).winner).toBe('ember');
  });
  it('returns null if the game is finished', () => {
    const g = newCheckersGame();
    expect(chooseCheckersMove({ ...g, winner: 'ember' }, 'easy')).toBeNull();
  });
});
describe('offline chess opponent', () => {
  it.each(levels)('%s chooses a legal move without mutating input', (difficulty) => {
    const opening = newChessGame();
    const game = playChessMove(opening, legalChessMoves(opening)[0]); // Black to play.
    const before = JSON.stringify(game);
    const move = chooseChessMove(game, difficulty);
    expect(move).not.toBeNull();
    expect(legalChessMoves(game)).toContainEqual(move);
    expect(JSON.stringify(game)).toBe(before);
  });
  it('chooses queen promotion over weaker pieces on easy', () => {
    const game = emptyChessGame();
    game.board[0][7] = { color: 'white', type: 'k' };
    game.board[7][7] = { color: 'black', type: 'k' };
    game.board[6][0] = { color: 'black', type: 'p' };
    game.turn = 'black';
    const move = chooseChessMove(game, 'easy')!;
    expect(move.promotion).toBe('q');
    expect(move.to).toEqual({ row: 7, col: 0 });
  });
  it('never proposes a move that exposes its own king', () => {
    const game = emptyChessGame();
    game.board[0][4] = { color: 'black', type: 'k' };
    game.board[1][4] = { color: 'black', type: 'r' };
    game.board[7][4] = { color: 'white', type: 'r' };
    game.board[7][7] = { color: 'white', type: 'k' };
    game.turn = 'black';
    const move = chooseChessMove(game, 'hard');
    expect(move).not.toBeNull();
    expect(legalChessMoves(game)).toContainEqual(move);
    expect(move?.to.col).toBe(4);
  });
  it('returns null on a complete game', () => {
    const g = newChessGame();
    expect(chooseChessMove({ ...g, outcome: 'stalemate' }, 'easy')).toBeNull();
  });
});
