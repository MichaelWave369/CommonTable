import { describe, expect, it } from 'vitest';
import {
  emptyChessGame, inCheck, legalChessMoves, newChessGame, notation,
  playChessMove, squareAttacked, type ChessGame, type ChessMove,
  type Color, type PieceType,
} from './chess';

function sq(text: string) {
  return { row: 8 - Number(text[1]), col: 'abcdefgh'.indexOf(text[0]) };
}
function doMove(game: ChessGame, from: string, to: string, promotion?: ChessMove['promotion']) {
  return playChessMove(game, { from: sq(from), to: sq(to), promotion });
}
function setup(
  pieces: [string, Color, PieceType][], turn: Color = 'white',
): ChessGame {
  const game = emptyChessGame();
  for (const [location, color, type] of pieces) {
    const square = sq(location);
    game.board[square.row][square.col] = { color, type };
  }
  game.turn = turn;
  return game;
}
function destinations(game: ChessGame, from: string): string[] {
  return legalChessMoves(game, sq(from)).map((move) => notation(move.to));
}

describe('Chess: setup and legal moves', () => {
  it('sets up 32 pieces, black and white with 20 opening moves', () => {
    const game = newChessGame();
    expect(game.board.flat().filter(Boolean)).toHaveLength(32);
    expect(game.board[7][4]).toEqual({ color: 'white', type: 'k' });
    expect(game.board[0][3]).toEqual({ color: 'black', type: 'q' });
    expect(legalChessMoves(game)).toHaveLength(20);
    expect(destinations(game, 'e2')).toEqual(['e3', 'e4']);
    expect(inCheck(game)).toBe(false);
  });

  it('rejects wrong-player turns, impossible moves and capturing a king', () => {
    const game = newChessGame();
    expect(doMove(game, 'e7', 'e5')).toBe(game);
    expect(doMove(game, 'e2', 'e5')).toBe(game);
    const custom = setup([
      ['e1', 'white', 'k'], ['e8', 'black', 'k'], ['e7', 'white', 'q'],
    ]);
    expect(destinations(custom, 'e7')).not.toContain('e8');
  });

  it('disallows moves that expose your own king (absolute pin)', () => {
    const game = setup([
      ['e1', 'white', 'k'], ['e2', 'white', 'r'],
      ['e8', 'black', 'r'], ['h8', 'black', 'k'],
    ]);
    expect(destinations(game, 'e2')).not.toContain('f2');
    expect(destinations(game, 'e2')).toContain('e8');
  });

  it('tracks checks and Fool’s Mate checkmate', () => {
    let game = newChessGame();
    for (const [from, to] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']])
      game = doMove(game, from, to);
    expect(game.outcome).toBe('checkmate');
    expect(game.winner).toBe('black');
    expect(inCheck(game)).toBe(true);
    expect(legalChessMoves(game)).toHaveLength(0);
    expect(doMove(game, 'e1', 'e2')).toBe(game);
  });

  it('recognizes stalemate separately from checkmate', () => {
    const game = setup([
      ['h1', 'white', 'k'], ['f2', 'black', 'k'], ['g3', 'black', 'q'],
    ]);
    expect(inCheck(game)).toBe(false);
    expect(legalChessMoves(game)).toHaveLength(0);
    // Play a move that reaches this position, to trigger outcome evaluation.
    const before = setup([
      ['h1', 'white', 'k'], ['f2', 'black', 'k'], ['f3', 'black', 'q'],
    ], 'black');
    const after = doMove(before, 'f3', 'g3');
    expect(after.outcome).toBe('stalemate');
    expect(after.winner).toBeNull();
  });
});

describe('Chess: special moves', () => {
  it('allows both castles when rights, rooks, path and safety permit', () => {
    const game = setup([
      ['e1', 'white', 'k'], ['a1', 'white', 'r'], ['h1', 'white', 'r'],
      ['e8', 'black', 'k'],
    ]);
    game.castling = { wK: true, wQ: true, bK: false, bQ: false };
    expect(destinations(game, 'e1')).toContain('g1');
    expect(destinations(game, 'e1')).toContain('c1');
    const castle = doMove(game, 'e1', 'g1');
    expect(castle.board[7][6]).toEqual({ color: 'white', type: 'k' });
    expect(castle.board[7][5]).toEqual({ color: 'white', type: 'r' });
    expect(castle.board[7][7]).toBeNull();
    expect(castle.castling.wK).toBe(false);
    expect(castle.castling.wQ).toBe(false);
    expect(castle.moveList[0]).toBe('O-O');
  });

  it('rejects castling through attacked squares, absent rooks, or lost rights', () => {
    const game = setup([
      ['e1', 'white', 'k'], ['a1', 'white', 'r'], ['h1', 'white', 'r'],
      ['a8', 'black', 'k'], ['f8', 'black', 'r'],
    ]);
    game.castling = { wK: true, wQ: true, bK: false, bQ: false };
    expect(squareAttacked(game.board, sq('f1'), 'black')).toBe(true);
    expect(destinations(game, 'e1')).not.toContain('g1');
    expect(destinations(game, 'e1')).toContain('c1');
    const moved = doMove(game, 'h1', 'h2');
    expect(moved.castling.wK).toBe(false);
    const withoutRook = setup([['e1', 'white', 'k'], ['e8', 'black', 'k']]);
    withoutRook.castling.wK = true;
    expect(destinations(withoutRook, 'e1')).not.toContain('g1');
  });

  it('supports en passant immediately after an opposing double-pawn move', () => {
    let game = newChessGame();
    for (const [from, to] of [['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5']])
      game = doMove(game, from, to);
    expect(game.enPassant).toEqual(sq('d6'));
    expect(destinations(game, 'e5')).toContain('d6');
    const captured = doMove(game, 'e5', 'd6');
    expect(captured.board[sq('d6').row][sq('d6').col]).toEqual({ color: 'white', type: 'p' });
    expect(captured.board[sq('d5').row][sq('d5').col]).toBeNull();
    expect(captured.halfmoveClock).toBe(0);
    expect(captured.enPassant).toBeNull();
  });

  it('offers all four promotions and requires selecting a promotion type', () => {
    const game = setup([
      ['e1', 'white', 'k'], ['e8', 'black', 'k'], ['a7', 'white', 'p'],
    ]);
    const moves = legalChessMoves(game, sq('a7')).filter((m) => notation(m.to) === 'a8');
    expect(moves.map((m) => m.promotion)).toEqual(['q', 'r', 'b', 'n']);
    expect(doMove(game, 'a7', 'a8')).toBe(game);
    const promoted = doMove(game, 'a7', 'a8', 'n');
    expect(promoted.board[0][0]).toEqual({ color: 'white', type: 'n' });
  });
});

describe('Chess: finish conditions and counters', () => {
  it('detects king-only insufficient material after a capture', () => {
    const before = setup([
      ['e1', 'white', 'k'], ['e8', 'black', 'k'],
      ['e7', 'white', 'q'], ['d8', 'black', 'q'],
    ]);
    // A position with opposing lone bishops of same square color is drawn
    // once a legal move is completed.
    const bishops = setup([
      ['e1', 'white', 'k'], ['e8', 'black', 'k'],
      ['c1', 'white', 'b'], ['f8', 'black', 'b'],
    ]);
    expect(doMove(bishops, 'c1', 'd2').outcome).toBe('insufficient-material');
    expect(before.outcome).toBeNull();
  });

  it('detects fifty-move rule after 100 reversible halfmoves', () => {
    const game = setup([
      ['e1', 'white', 'k'], ['e8', 'black', 'k'], ['a1', 'white', 'r'],
    ]);
    game.halfmoveClock = 99;
    const next = doMove(game, 'a1', 'a2');
    expect(next.halfmoveClock).toBe(100);
    expect(next.outcome).toBe('fifty-move');
    expect(next.winner).toBeNull();
  });

  it('detects threefold repetition', () => {
    let game = newChessGame();
    const loop = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
    for (let i = 0; i < 2; i++) for (const [from, to] of loop) game = doMove(game, from, to);
    expect(game.outcome).toBe('threefold');
    expect(game.winner).toBeNull();
    expect(game.moveList).toHaveLength(8);
    expect(game.fullmove).toBe(5);
  });
});
