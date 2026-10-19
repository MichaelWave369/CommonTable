export type Player = 'ivory' | 'ember';
export type Piece = { player: Player; king: boolean };
export type Board = (Piece | null)[][];
export type Position = { row: number; col: number };
export type Move = { from: Position; to: Position; jumped?: Position };
export type CheckersGame = {
  board: Board;
  turn: Player;
  forcedFrom: Position | null;
  winner: Player | null;
};

export const otherPlayer = (player: Player): Player => (player === 'ivory' ? 'ember' : 'ivory');
const inBounds = (row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8;
const same = (a: Position, b: Position) => a.row === b.row && a.col === b.col;

export function newCheckersGame(): CheckersGame {
  const board: Board = Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 8 }, (_, col): Piece | null => {
      if ((row + col) % 2 === 0) return null;
      if (row < 3) return { player: 'ember', king: false };
      if (row > 4) return { player: 'ivory', king: false };
      return null;
    }),
  );
  return { board, turn: 'ivory', forcedFrom: null, winner: null };
}

function rawMoves(board: Board, from: Position): Move[] {
  const piece = board[from.row]?.[from.col];
  if (!piece) return [];
  const rows = piece.king ? [-1, 1] : [piece.player === 'ivory' ? -1 : 1];
  const moves: Move[] = [];
  for (const dy of rows) {
    for (const dx of [-1, 1]) {
      const nr = from.row + dy;
      const nc = from.col + dx;
      if (!inBounds(nr, nc)) continue;
      if (board[nr][nc] === null) {
        moves.push({ from, to: { row: nr, col: nc } });
      } else if (board[nr][nc]?.player !== piece.player) {
        const jr = nr + dy;
        const jc = nc + dx;
        if (inBounds(jr, jc) && board[jr][jc] === null) {
          moves.push({ from, to: { row: jr, col: jc }, jumped: { row: nr, col: nc } });
        }
      }
    }
  }
  return moves;
}

export function legalMoves(game: CheckersGame): Move[] {
  if (game.winner) return [];
  if (game.forcedFrom) {
    return rawMoves(game.board, game.forcedFrom).filter((m) => Boolean(m.jumped));
  }
  const moves: Move[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (game.board[row][col]?.player === game.turn) {
        moves.push(...rawMoves(game.board, { row, col }));
      }
    }
  }
  return moves.some((m) => m.jumped) ? moves.filter((m) => Boolean(m.jumped)) : moves;
}

export function movesFrom(game: CheckersGame, from: Position): Move[] {
  return legalMoves(game).filter((m) => same(m.from, from));
}

export function applyMove(game: CheckersGame, requested: Move): CheckersGame {
  const move = legalMoves(game).find((m) => same(m.from, requested.from) && same(m.to, requested.to));
  if (!move) return game;
  const board = game.board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
  const piece = board[move.from.row][move.from.col]!;
  board[move.from.row][move.from.col] = null;
  board[move.to.row][move.to.col] = piece;
  if (move.jumped) board[move.jumped.row][move.jumped.col] = null;
  const crowned = !piece.king &&
    ((piece.player === 'ivory' && move.to.row === 0) ||
      (piece.player === 'ember' && move.to.row === 7));
  if (crowned) piece.king = true;
  if (move.jumped && !crowned) {
    const additional = rawMoves(board, move.to).some((m) => Boolean(m.jumped));
    if (additional) {
      return { board, turn: game.turn, forcedFrom: move.to, winner: null };
    }
  }
  const next: CheckersGame = { board, turn: otherPlayer(game.turn), forcedFrom: null, winner: null };
  if (legalMoves(next).length === 0) next.winner = game.turn;
  return next;
}
