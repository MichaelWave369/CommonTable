export type Color = 'white' | 'black';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type ChessPiece = { color: Color; type: PieceType };
export type Square = { row: number; col: number };
export type ChessMove = {
  from: Square; to: Square;
  promotion?: 'q' | 'r' | 'b' | 'n';
  castle?: 'king' | 'queen';
  enPassant?: boolean;
};
export type CastlingRights = { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
export type ChessOutcome = 'checkmate' | 'stalemate' | 'fifty-move' | 'threefold' | 'insufficient-material';
export type ChessGame = {
  board: (ChessPiece | null)[][];
  turn: Color;
  castling: CastlingRights;
  enPassant: Square | null;
  halfmoveClock: number;
  fullmove: number;
  positionHistory: string[];
  moveList: string[];
  lastMove: { from: Square; to: Square } | null;
  outcome: ChessOutcome | null;
  winner: Color | null;
};

const PROMOTIONS = ['q', 'r', 'b', 'n'] as const;
const inBounds = (row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8;
const equal = (a: Square, b: Square) => a.row === b.row && a.col === b.col;
export const opponent = (color: Color): Color => color === 'white' ? 'black' : 'white';
export const notation = (square: Square) => 'abcdefgh'[square.col] + (8 - square.row);
export const pieceName = (type: PieceType): string =>
  ({ p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' })[type];

function cloneBoard(board: ChessGame['board']): ChessGame['board'] {
  return board.map((line) => line.map((piece) => piece && { ...piece }));
}
const initialBack: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

export function emptyChessGame(): ChessGame {
  return {
    board: Array.from({ length: 8 }, () => Array<ChessPiece | null>(8).fill(null)),
    turn: 'white',
    castling: { wK: false, wQ: false, bK: false, bQ: false },
    enPassant: null, halfmoveClock: 0, fullmove: 1,
    positionHistory: [], moveList: [], lastMove: null, outcome: null, winner: null,
  };
}

export function newChessGame(): ChessGame {
  const game = emptyChessGame();
  for (let col = 0; col < 8; col++) {
    game.board[0][col] = { color: 'black', type: initialBack[col] };
    game.board[1][col] = { color: 'black', type: 'p' };
    game.board[6][col] = { color: 'white', type: 'p' };
    game.board[7][col] = { color: 'white', type: initialBack[col] };
  }
  game.castling = { wK: true, wQ: true, bK: true, bQ: true };
  game.positionHistory = [positionKey(game)];
  return game;
}

function positionKey(game: ChessGame): string {
  const board = game.board.map((line) => line.map((p) =>
    p ? (p.color === 'white' ? p.type.toUpperCase() : p.type) : '.').join('')).join('/');
  const c = game.castling;
  return [board, game.turn, [c.wK && 'K', c.wQ && 'Q', c.bK && 'k', c.bQ && 'q']
    .filter(Boolean).join('') || '-', game.enPassant ? notation(game.enPassant) : '-'].join(' ');
}

function addMoves(results: ChessMove[], from: Square, to: Square, promotion: boolean, extras: Partial<ChessMove> = {}) {
  if (promotion) {
    for (const type of PROMOTIONS) results.push({ from, to, ...extras, promotion: type });
  } else results.push({ from, to, ...extras });
}

export function squareAttacked(board: ChessGame['board'], square: Square, by: Color): boolean {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== by) continue;
      const dy = square.row - row, dx = square.col - col;
      const ady = Math.abs(dy), adx = Math.abs(dx);
      if (piece.type === 'p') {
        if (dy === (by === 'white' ? -1 : 1) && adx === 1) return true;
        continue;
      }
      if (piece.type === 'n') {
        if ((ady === 2 && adx === 1) || (ady === 1 && adx === 2)) return true;
        continue;
      }
      if (piece.type === 'k') {
        if (Math.max(ady, adx) === 1) return true;
        continue;
      }
      const diagonal = ady === adx && ady !== 0;
      const straight = (dy === 0 && dx !== 0) || (dx === 0 && dy !== 0);
      if (!(piece.type === 'q' && (diagonal || straight)) &&
          !(piece.type === 'r' && straight) && !(piece.type === 'b' && diagonal)) continue;
      const stepY = Math.sign(dy), stepX = Math.sign(dx);
      let r = row + stepY, c = col + stepX;
      let clear = true;
      while (r !== square.row || c !== square.col) {
        if (board[r][c]) { clear = false; break; }
        r += stepY; c += stepX;
      }
      if (clear) return true;
    }
  }
  return false;
}

export function inCheck(game: ChessGame, color: Color = game.turn): boolean {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = game.board[row][col];
      if (piece?.type === 'k' && piece.color === color)
        return squareAttacked(game.board, { row, col }, opponent(color));
    }
  }
  // Defensive behavior for malformed imported/saved positions.
  return true;
}

function pseudoMoves(game: ChessGame, from: Square): ChessMove[] {
  const piece = game.board[from.row]?.[from.col];
  if (!piece || piece.color !== game.turn) return [];
  const results: ChessMove[] = [];
  const addTarget = (row: number, col: number, extras: Partial<ChessMove> = {}) => {
    if (!inBounds(row, col)) return;
    const target = game.board[row][col];
    if (!target || (target.color !== piece.color && target.type !== 'k'))
      addMoves(results, from, { row, col }, piece.type === 'p' && (row === 0 || row === 7), extras);
  };
  if (piece.type === 'p') {
    const dir = piece.color === 'white' ? -1 : 1;
    const start = piece.color === 'white' ? 6 : 1;
    const one = from.row + dir;
    if (inBounds(one, from.col) && !game.board[one][from.col]) {
      addTarget(one, from.col);
      const two = from.row + dir * 2;
      if (from.row === start && !game.board[two][from.col]) addTarget(two, from.col);
    }
    for (const dx of [-1, 1]) {
      const col = from.col + dx;
      if (!inBounds(one, col)) continue;
      const target = game.board[one][col];
      if (target && target.color !== piece.color && target.type !== 'k') addTarget(one, col);
      else if (game.enPassant && equal(game.enPassant, { row: one, col }) &&
        game.board[from.row][col]?.type === 'p' &&
        game.board[from.row][col]?.color === opponent(piece.color)) {
        addTarget(one, col, { enPassant: true });
      }
    }
    return results;
  }
  if (piece.type === 'n') {
    for (const [dy, dx] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]])
      addTarget(from.row + dy, from.col + dx);
    return results;
  }
  const dirs: number[][] = [];
  if (piece.type === 'b' || piece.type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
  if (piece.type === 'r' || piece.type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
  if (piece.type === 'k') dirs.push(
    [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
  );
  for (const [dy, dx] of dirs) {
    let row = from.row + dy, col = from.col + dx;
    while (inBounds(row, col)) {
      const target = game.board[row][col];
      addTarget(row, col);
      if (target || piece.type === 'k') break;
      row += dy; col += dx;
    }
  }
  if (piece.type === 'k' && from.col === 4 && from.row === (piece.color === 'white' ? 7 : 0)) {
    const row = from.row, enemy = opponent(piece.color);
    const rights = piece.color === 'white'
      ? { king: game.castling.wK, queen: game.castling.wQ }
      : { king: game.castling.bK, queen: game.castling.bQ };
    if (!inCheck(game, piece.color)) {
      if (rights.king && game.board[row][7]?.type === 'r' && game.board[row][7]?.color === piece.color &&
        !game.board[row][5] && !game.board[row][6] &&
        !squareAttacked(game.board, { row, col: 5 }, enemy) &&
        !squareAttacked(game.board, { row, col: 6 }, enemy)) {
        results.push({ from, to: { row, col: 6 }, castle: 'king' });
      }
      if (rights.queen && game.board[row][0]?.type === 'r' && game.board[row][0]?.color === piece.color &&
        !game.board[row][1] && !game.board[row][2] && !game.board[row][3] &&
        !squareAttacked(game.board, { row, col: 3 }, enemy) &&
        !squareAttacked(game.board, { row, col: 2 }, enemy)) {
        results.push({ from, to: { row, col: 2 }, castle: 'queen' });
      }
    }
  }
  return results;
}

function executeWithoutStatus(game: ChessGame, move: ChessMove): ChessGame {
  const board = cloneBoard(game.board);
  const moving = board[move.from.row][move.from.col]!;
  const captured = board[move.to.row][move.to.col];
  board[move.from.row][move.from.col] = null;
  board[move.to.row][move.to.col] = { ...moving, type: move.promotion || moving.type };
  if (move.enPassant) board[move.from.row][move.to.col] = null;
  if (move.castle) {
    const rookFrom = move.castle === 'king' ? 7 : 0;
    const rookTo = move.castle === 'king' ? 5 : 3;
    board[move.from.row][rookTo] = board[move.from.row][rookFrom];
    board[move.from.row][rookFrom] = null;
  }
  const rights = { ...game.castling };
  if (moving.type === 'k') {
    if (moving.color === 'white') { rights.wK = false; rights.wQ = false; }
    else { rights.bK = false; rights.bQ = false; }
  }
  if (moving.type === 'r') {
    if (move.from.row === 7 && move.from.col === 0) rights.wQ = false;
    if (move.from.row === 7 && move.from.col === 7) rights.wK = false;
    if (move.from.row === 0 && move.from.col === 0) rights.bQ = false;
    if (move.from.row === 0 && move.from.col === 7) rights.bK = false;
  }
  if (captured?.type === 'r') {
    if (move.to.row === 7 && move.to.col === 0) rights.wQ = false;
    if (move.to.row === 7 && move.to.col === 7) rights.wK = false;
    if (move.to.row === 0 && move.to.col === 0) rights.bQ = false;
    if (move.to.row === 0 && move.to.col === 7) rights.bK = false;
  }
  const enPassant: Square | null = moving.type === 'p' &&
    Math.abs(move.to.row - move.from.row) === 2
    ? { row: (move.to.row + move.from.row) / 2, col: move.from.col } : null;
  return {
    ...game, board, castling: rights, enPassant,
    halfmoveClock: moving.type === 'p' || captured || move.enPassant ? 0 : game.halfmoveClock + 1,
    fullmove: game.fullmove + (game.turn === 'black' ? 1 : 0),
    turn: opponent(game.turn), outcome: null, winner: null,
    lastMove: { from: move.from, to: move.to },
  };
}

export function legalChessMoves(game: ChessGame, from?: Square): ChessMove[] {
  if (game.outcome) return [];
  const all: ChessMove[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = { row, col };
      if (from && !equal(from, square)) continue;
      for (const move of pseudoMoves(game, square)) {
        if (!inCheck(executeWithoutStatus(game, move), game.turn)) all.push(move);
      }
    }
  }
  return all;
}

function hasInsufficientMaterial(board: ChessGame['board']): boolean {
  const pieces = board.flatMap((line, row) => line.flatMap((piece, col) =>
    piece && piece.type !== 'k' ? [{ ...piece, row, col }] : []));
  if (!pieces.length) return true;
  if (pieces.length === 1 && (pieces[0].type === 'b' || pieces[0].type === 'n')) return true;
  if (pieces.length === 2 && pieces.every((p) => p.type === 'b') &&
      pieces[0].color !== pieces[1].color &&
      (pieces[0].row + pieces[0].col) % 2 === (pieces[1].row + pieces[1].col) % 2) return true;
  return false;
}

export function playChessMove(game: ChessGame, attempted: ChessMove): ChessGame {
  const move = legalChessMoves(game, attempted.from).find((candidate) =>
    equal(candidate.to, attempted.to) && candidate.promotion === attempted.promotion);
  if (!move) return game;
  const next = executeWithoutStatus(game, move);
  next.moveList = [...game.moveList, move.castle === 'king' ? 'O-O' : move.castle === 'queen' ? 'O-O-O' :
    notation(move.from) + (game.board[move.to.row][move.to.col] || move.enPassant ? '×' : '–') +
    notation(move.to) + (move.promotion ? '=' + move.promotion.toUpperCase() : '')];
  next.positionHistory = [...game.positionHistory, positionKey(next)];
  const noMoves = legalChessMoves(next).length === 0;
  if (noMoves) {
    next.outcome = inCheck(next) ? 'checkmate' : 'stalemate';
    next.winner = next.outcome === 'checkmate' ? game.turn : null;
  } else if (hasInsufficientMaterial(next.board)) next.outcome = 'insufficient-material';
  else if (next.halfmoveClock >= 100) next.outcome = 'fifty-move';
  else if (next.positionHistory.filter((key) => key === positionKey(next)).length >= 3)
    next.outcome = 'threefold';
  return next;
}
