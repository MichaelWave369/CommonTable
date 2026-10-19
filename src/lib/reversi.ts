export type ReversiPlayer = 'onyx' | 'ivory';
export type ReversiSquare = { row: number; col: number };
export type ReversiMove = ReversiSquare & { flips: ReversiSquare[] };
export type ReversiBoard = (ReversiPlayer | null)[][];
export type ReversiGame = {
  board: ReversiBoard;
  turn: ReversiPlayer;
  finished: boolean;
  winner: ReversiPlayer | null;
  passes: number;
  moveCount: number;
  lastMove: ReversiSquare | null;
  notice: string;
};

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];
const onBoard = (row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8;
export const otherReversiPlayer = (player: ReversiPlayer): ReversiPlayer =>
  player === 'onyx' ? 'ivory' : 'onyx';

export function newReversiGame(): ReversiGame {
  const board: ReversiBoard = Array.from({ length: 8 }, () => Array<ReversiPlayer | null>(8).fill(null));
  board[3][3] = 'ivory'; board[4][4] = 'ivory';
  board[3][4] = 'onyx'; board[4][3] = 'onyx';
  return {
    board, turn: 'onyx', finished: false, winner: null,
    passes: 0, moveCount: 0, lastMove: null,
    notice: 'Onyx plays first. Capture a line of Ivory discs.',
  };
}

export function reversiScore(board: ReversiBoard): Record<ReversiPlayer, number> {
  const scores = { onyx: 0, ivory: 0 };
  for (const row of board) for (const cell of row) if (cell) scores[cell]++;
  return scores;
}

export function flipsForMove(
  board: ReversiBoard, player: ReversiPlayer, square: ReversiSquare,
): ReversiSquare[] {
  const { row, col } = square;
  if (!onBoard(row, col) || board[row]?.[col] !== null) return [];
  const enemy = otherReversiPlayer(player);
  const captured: ReversiSquare[] = [];
  for (const [dy, dx] of DIRECTIONS) {
    let y = row + dy, x = col + dx;
    const line: ReversiSquare[] = [];
    while (onBoard(y, x) && board[y][x] === enemy) {
      line.push({ row: y, col: x });
      y += dy; x += dx;
    }
    if (line.length && onBoard(y, x) && board[y][x] === player) captured.push(...line);
  }
  return captured;
}

export function legalReversiMoves(board: ReversiBoard, player: ReversiPlayer): ReversiMove[] {
  const moves: ReversiMove[] = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    if (board[row][col] !== null) continue;
    const flips = flipsForMove(board, player, { row, col });
    if (flips.length) moves.push({ row, col, flips });
  }
  return moves;
}

export function availableReversiMoves(game: ReversiGame): ReversiMove[] {
  return game.finished ? [] : legalReversiMoves(game.board, game.turn);
}

/**
 * Applies one legal move. An opponent without legal moves is automatically
 * passed over; when neither side can play, the disc majority wins.
 */
export function playReversiMove(game: ReversiGame, square: ReversiSquare): ReversiGame {
  if (game.finished) return game;
  const legal = availableReversiMoves(game).find((move) =>
    move.row === square.row && move.col === square.col);
  if (!legal) return game;
  const board = game.board.map((row) => [...row]);
  board[legal.row][legal.col] = game.turn;
  for (const tile of legal.flips) board[tile.row][tile.col] = game.turn;

  const rival = otherReversiPlayer(game.turn);
  const opponentMoves = legalReversiMoves(board, rival);
  const ownMoves = opponentMoves.length ? [] : legalReversiMoves(board, game.turn);
  const finished = !opponentMoves.length && !ownMoves.length;
  const scores = reversiScore(board);
  const winner = !finished || scores.onyx === scores.ivory ? null :
    scores.onyx > scores.ivory ? 'onyx' : 'ivory';
  return {
    board, turn: opponentMoves.length ? rival : game.turn,
    finished, winner, moveCount: game.moveCount + 1,
    lastMove: { row: legal.row, col: legal.col },
    passes: game.passes + (!opponentMoves.length && !finished ? 1 : 0),
    notice: finished
      ? winner ? (winner === 'onyx' ? 'Onyx' : 'Ivory') + ' wins on disc count!' : 'A draw: equal discs!'
      : opponentMoves.length ? (rival === 'onyx' ? 'Onyx' : 'Ivory') + ' to play.'
        : (rival === 'onyx' ? 'Onyx' : 'Ivory') + ' has no legal move and must pass. Play again!',
  };
}
