import { describe, expect, it } from 'vitest';
import {
  availableReversiMoves, flipsForMove, legalReversiMoves, newReversiGame,
  playReversiMove, reversiScore, type ReversiGame, type ReversiBoard,
} from './reversi';
import { chooseReversiMove, type ReversiDifficulty } from './reversi-ai';

const board = (): ReversiBoard =>
  Array.from({ length: 8 }, () => Array<ReversiBoard[number][number]>(8).fill(null));
function position(b: ReversiBoard, turn: ReversiGame['turn']): ReversiGame {
  return { ...newReversiGame(), board: b, turn };
}
describe('Reversi: local rules', () => {
  it('sets four center discs and four legal opening squares for Onyx', () => {
    const game = newReversiGame();
    expect(game.turn).toBe('onyx');
    expect(reversiScore(game.board)).toEqual({ onyx: 2, ivory: 2 });
    expect(availableReversiMoves(game).map((m) => [m.row, m.col])).toEqual([
      [2, 3], [3, 2], [4, 5], [5, 4],
    ]);
  });
  it('flips captured discs and switches turns without mutating the original', () => {
    const game = newReversiGame();
    const prior = JSON.stringify(game);
    const played = playReversiMove(game, { row: 2, col: 3 });
    expect(reversiScore(played.board)).toEqual({ onyx: 4, ivory: 1 });
    expect(played.board[3][3]).toBe('onyx');
    expect(played.lastMove).toEqual({ row: 2, col: 3 });
    expect(played.turn).toBe('ivory');
    expect(played.moveCount).toBe(1);
    expect(JSON.stringify(game)).toBe(prior);
  });
  it('cannot play on occupied cells or on squares with no brackets', () => {
    const game = newReversiGame();
    expect(playReversiMove(game, { row: 3, col: 3 })).toBe(game);
    expect(playReversiMove(game, { row: 0, col: 0 })).toBe(game);
    expect(playReversiMove(game, { row: -1, col: 5 })).toBe(game);
    expect(flipsForMove(game.board, 'onyx', { row: 3, col: 3 })).toEqual([]);
  });
  it('captures across several directions simultaneously', () => {
    const b = board();
    for (const [dy, dx] of [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]]) {
      b[3 + dy][3 + dx] = 'ivory';
      b[3 + dy * 2][3 + dx * 2] = 'onyx';
    }
    const game = position(b, 'onyx');
    const flips = flipsForMove(b, 'onyx', { row: 3, col: 3 });
    expect(flips).toHaveLength(8);
    const next = playReversiMove(game, { row: 3, col: 3 });
    expect(reversiScore(next.board).onyx).toBe(17);
    expect(reversiScore(next.board).ivory).toBe(0);
  });
  it('does not wrap horizontal capture from edge to next row', () => {
    const b = board();
    b[0][7] = 'onyx'; b[1][0] = 'ivory'; b[1][1] = 'onyx';
    expect(flipsForMove(b, 'onyx', { row: 0, col: 6 })).toEqual([]);
    expect(flipsForMove(b, 'onyx', { row: 1, col: 2 })).toEqual([]);
  });
  it('automatically skips a player without a legal reply', () => {
    const b: ReversiBoard = Array.from({ length: 8 }, () =>
      Array<ReversiBoard[number][number]>(8).fill('onyx'));
    b[0][1] = 'ivory'; b[0][2] = null;
    b[7][6] = 'ivory'; b[7][5] = null;
    const game = position(b, 'onyx');
    const next = playReversiMove(game, { row: 0, col: 2 });
    expect(next.finished).toBe(false);
    expect(next.turn).toBe('onyx');
    expect(next.passes).toBe(1);
    expect(next.notice).toContain('must pass');
    expect(availableReversiMoves(next).map((m) => [m.row, m.col])).toContainEqual([7, 5]);
  });
  it('ends after neither side can play and counts winners', () => {
    const b: ReversiBoard = Array.from({ length: 8 }, () =>
      Array<ReversiBoard[number][number]>(8).fill('onyx'));
    b[0][1] = 'ivory'; b[0][2] = null;
    const game = position(b, 'onyx');
    const next = playReversiMove(game, { row: 0, col: 2 });
    expect(next.finished).toBe(true);
    expect(next.winner).toBe('onyx');
    expect(next.board.flat().every(Boolean)).toBe(true);
    expect(availableReversiMoves(next)).toHaveLength(0);
    expect(playReversiMove(next, { row: 4, col: 4 })).toBe(next);
  });
  it('declares a genuine 32–32 tie when the last legal disc is played', () => {
    const b = board();
    b[0][1] = 'ivory';
    b[0][2] = 'onyx';
    b[1][0] = 'onyx';
    b[1][1] = 'onyx';
    let onyxCount = 3;
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      if ((row === 0 && col === 0) || b[row][col]) continue;
      if (onyxCount < 30) { b[row][col] = 'onyx'; onyxCount++; }
      else b[row][col] = 'ivory';
    }
    expect(reversiScore(b)).toEqual({ onyx: 30, ivory: 33 });
    const next = playReversiMove(position(b, 'onyx'), { row: 0, col: 0 });
    expect(next.finished).toBe(true);
    expect(next.winner).toBeNull();
    expect(reversiScore(next.board)).toEqual({ onyx: 32, ivory: 32 });
    expect(next.notice).toContain('draw');
  });
});
describe('Reversi: offline opponent', () => {
  const levels: ReversiDifficulty[] = ['easy', 'medium', 'hard'];
  it.each(levels)('%s returns one of the legal moves, without mutating input', (level) => {
    const game = newReversiGame();
    const before = JSON.stringify(game);
    const move = chooseReversiMove(game, level);
    expect(move).not.toBeNull();
    expect(availableReversiMoves(game)).toContainEqual(move);
    expect(JSON.stringify(game)).toBe(before);
  });
  it('favors an available corner on Easy', () => {
    const b = board();
    b[0][1] = 'ivory'; b[0][2] = 'onyx';
    b[3][3] = 'ivory'; b[3][4] = 'onyx';
    const game = position(b, 'onyx');
    expect(availableReversiMoves(game).some((m) => m.row === 0 && m.col === 0)).toBe(true);
    const move = chooseReversiMove(game, 'easy');
    expect(move).toMatchObject({ row: 0, col: 0 });
  });
  it('returns null when finished', () => {
    const game = newReversiGame();
    expect(chooseReversiMove({ ...game, finished: true }, 'hard')).toBeNull();
  });
});
