import { describe, it, expect } from 'vitest';
import { applyMove, legalMoves, newCheckersGame, type CheckersGame } from './checkers';
import { availablePairs, gardenSlots, isFree, newMahjongGame, removePair, shuffleRemaining } from './mahjong';

describe('American checkers', () => {
  it('starts with 12 pieces each and four moves', () => {
    const game = newCheckersGame();
    expect(game.board.flat().filter((p) => p?.player === 'ivory')).toHaveLength(12);
    expect(game.board.flat().filter((p) => p?.player === 'ember')).toHaveLength(12);
    expect(legalMoves(game)).toHaveLength(7);
  });

  it('enforces captures and a continuing jump', () => {
    const game = newCheckersGame();
    const board = game.board.map((row) => row.map(() => null)) as CheckersGame['board'];
    board[5][0] = { player: 'ivory', king: false };
    board[4][1] = { player: 'ember', king: false };
    board[2][3] = { player: 'ember', king: false };
    board[5][4] = { player: 'ivory', king: false };
    const testGame: CheckersGame = { board, turn: 'ivory', forcedFrom: null, winner: null };
    expect(legalMoves(testGame)).toHaveLength(1);
    const first = applyMove(testGame, legalMoves(testGame)[0]);
    expect(first.turn).toBe('ivory');
    expect(first.forcedFrom).toEqual({ row: 3, col: 2 });
    expect(legalMoves(first)).toHaveLength(1);
    const second = applyMove(first, legalMoves(first)[0]);
    expect(second.winner).toBe('ivory');
  });

  it('crowns pieces at the opposite edge', () => {
    const game = newCheckersGame();
    const board = game.board.map((row) => row.map(() => null)) as CheckersGame['board'];
    board[1][2] = { player: 'ivory', king: false };
    board[7][6] = { player: 'ember', king: false };
    const promoted = applyMove({ board, turn: 'ivory', forcedFrom: null, winner: null },
      { from: { row: 1, col: 2 }, to: { row: 0, col: 1 } });
    expect(promoted.board[0][1]?.king).toBe(true);
  });
});

describe('Garden Mahjong Solitaire', () => {
  it('has 72 tiles and four copies of each face', () => {
    expect(gardenSlots()).toHaveLength(72);
    const tiles = newMahjongGame();
    for (const face of new Set(tiles.map((t) => t.face))) {
      expect(tiles.filter((t) => t.face === face)).toHaveLength(4);
    }
    expect(availablePairs(tiles).length).toBeGreaterThan(0);
  });

  it('blocks covered tiles and rejects nonmatching selections', () => {
    const tiles = newMahjongGame();
    const base = tiles.find((tile) => tile.id === 'base-2-4')!;
    expect(isFree(tiles, base)).toBe(false);
    expect(removePair(tiles, tiles[0].id, tiles[1].id)).toBe(tiles);
  });

  it('rescues a vertical-stack dead end by re-dealing existing faces', () => {
    const trapped = [
      { id: 'base-2-4', layer: 0, row: 2, col: 4, face: 'B1' },
      { id: 'top-2-4', layer: 1, row: 2, col: 4, face: 'B1' },
    ];
    expect(availablePairs(trapped)).toHaveLength(0);
    const repacked = shuffleRemaining(trapped);
    expect(repacked).toHaveLength(2);
    expect(availablePairs(repacked)).toHaveLength(1);
    expect(repacked.map((t) => t.face)).toEqual(['B1', 'B1']);
  });

  it('can clear its generated layout by re-dealing after each match', () => {
    let tiles = newMahjongGame();
    const first = availablePairs(tiles)[0];
    tiles = removePair(tiles, first[0].id, first[1].id);
    tiles = shuffleRemaining(tiles);
    for (let n = 0; n < 35; n++) {
      // Alternate legal choices can dead-end even a solvable deal.
      // Reshuffling constructs a fresh removal path for the remaining faces.
      tiles = shuffleRemaining(tiles);
      const pair = availablePairs(tiles)[0];
      expect(pair).toBeDefined();
      tiles = removePair(tiles, pair[0].id, pair[1].id);
    }
    expect(tiles).toHaveLength(0);
  });
});
