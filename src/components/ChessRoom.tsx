import { useEffect, useMemo, useState } from 'react';
import {
  inCheck, legalChessMoves, newChessGame, notation, opponent, pieceName,
  playChessMove, type ChessGame, type ChessMove, type ChessPiece,
  type Color, type PieceType, type Square,
} from '../lib/chess';

const GLYPHS: Record<Color, Record<PieceType, string>> = {
  white: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  black: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
const COLORS: Record<Color, string> = { white: 'Ivory', black: 'Onyx' };
const same = (a: Square | null, b: Square) => !!a && a.row === b.row && a.col === b.col;
type Pending = { from: Square; to: Square };

function validate(value: unknown): value is ChessGame {
  if (!value || typeof value !== 'object') return false;
  const g = value as ChessGame;
  return (g.turn === 'white' || g.turn === 'black') &&
    Array.isArray(g.board) && g.board.length === 8 &&
    g.board.every((row) => Array.isArray(row) && row.length === 8 &&
      row.every((p) => p === null || (!!p && ['white', 'black'].includes(p.color) &&
        ['p', 'n', 'b', 'r', 'q', 'k'].includes(p.type)))) &&
    !!g.castling && typeof g.castling.wK === 'boolean' &&
    typeof g.castling.wQ === 'boolean' && typeof g.castling.bK === 'boolean' &&
    typeof g.castling.bQ === 'boolean' &&
    typeof g.halfmoveClock === 'number' && typeof g.fullmove === 'number' &&
    Array.isArray(g.moveList) && Array.isArray(g.positionHistory) &&
    (g.outcome === null || ['checkmate', 'stalemate', 'fifty-move', 'threefold', 'insufficient-material'].includes(g.outcome));
}
function load(): ChessGame {
  try {
    const raw = localStorage.getItem('commontable:chess');
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (validate(value)) return value;
    }
  } catch { /* Browser-local save is optional. */ }
  return newChessGame();
}

function PiecesTaken({ game, by }: { game: ChessGame; by: Color }) {
  const defeated = opponent(by);
  const original: Record<PieceType, number> = { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 };
  for (const row of game.board) for (const piece of row) {
    if (piece?.color === defeated) original[piece.type]--;
  }
  // Promotions can result in more queens or other pieces than were in the starting set.
  const pieces = (Object.entries(original) as [PieceType, number][])
    .flatMap(([type, count]) => Array(Math.max(0, count)).fill(type) as PieceType[]);
  return <span className="chess-taken" aria-label={'Pieces captured by ' + COLORS[by] + ': ' +
    (pieces.length ? pieces.map(pieceName).join(', ') : 'none')}>
    {pieces.map((type, i) => <span key={type + '-' + i} aria-hidden="true">{GLYPHS[defeated][type]}</span>)}
  </span>;
}

export default function ChessRoom({ onSound }: { onSound: () => void }) {
  const [game, setGame] = useState<ChessGame>(load);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<Pending | null>(null);
  const [history, setHistory] = useState<ChessGame[]>([]);
  const [flipped, setFlipped] = useState(false);
  const moves = useMemo(() => legalChessMoves(game), [game]);
  const options = selected ? moves.filter((m) => same(selected, m.from)) : [];
  const checked = inCheck(game);
  const rows = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  useEffect(() => {
    try { localStorage.setItem('commontable:chess', JSON.stringify(game)); } catch { /* Optional */ }
  }, [game]);

  function commit(move: ChessMove) {
    const next = playChessMove(game, move);
    if (next === game) return;
    setHistory((stack) => [...stack.slice(-199), game]);
    setGame(next);
    setSelected(null);
    setPromotion(null);
    onSound();
  }
  function choose(square: Square) {
    if (promotion || game.outcome) return;
    const targetMoves = options.filter((m) => same(square, m.to));
    if (targetMoves.length) {
      if (targetMoves.some((m) => m.promotion)) {
        setPromotion({ from: selected!, to: square });
        return;
      }
      commit(targetMoves[0]);
      return;
    }
    const piece = game.board[square.row][square.col];
    if (piece?.color === game.turn && moves.some((m) => same(m.from, square))) {
      setSelected(same(selected, square) ? null : square);
      onSound();
    } else {
      setSelected(null);
    }
  }
  function fresh() {
    setGame(newChessGame());
    setSelected(null); setPromotion(null); setHistory([]);
    onSound();
  }
  function undo() {
    if (!history.length) return;
    setGame(history[history.length - 1]);
    setHistory((stack) => stack.slice(0, -1));
    setSelected(null); setPromotion(null);
    onSound();
  }
  const winner = game.winner && COLORS[game.winner];
  const resultText = game.outcome === 'checkmate' ? winner + ' wins by checkmate!' :
    game.outcome === 'stalemate' ? 'Draw by stalemate' :
    game.outcome === 'threefold' ? 'Draw by repetition' :
    game.outcome === 'fifty-move' ? 'Draw by fifty-move rule' :
    game.outcome === 'insufficient-material' ? 'Draw: insufficient material' :
    checked ? COLORS[game.turn] + ' is in check!' : COLORS[game.turn] + ' to move';

  const movePairs: { white: string; black?: string; n: number }[] = [];
  for (let i = 0; i < game.moveList.length; i += 2)
    movePairs.push({ n: i / 2 + 1, white: game.moveList[i], black: game.moveList[i + 1] });

  return <section className="game-room chess-room">
    <div className="room-heading">
      <span className="overline">TABLE NO. 05 / THE ROYAL GAME</span>
      <h1>Chess<span className="heading-dot">.</span></h1>
      <p>A classic test of patience and planning. No timers, no pressure, just the next good move.</p>
    </div>
    <div className="play-layout chess-layout">
      <div className="play-surface chess-surface">
        <div className="chess-player-bar">
          <span className="chess-player-identity"><span className="chess-player-symbol onyx">♚</span> ONYX <span className="chess-player-sub">BLACK</span></span>
          <PiecesTaken game={game} by="black"/>
        </div>
        <div className="chess-board-frame">
          <div className="chess-board" role="group" aria-label="Chess board">
            {rows.flatMap((row, ri) => cols.map((col, ci) => {
              const square = { row, col };
              const piece: ChessPiece | null = game.board[row][col];
              const active = same(selected, square);
              const legalTarget = options.some((m) => same(square, m.to));
              const prev = game.lastMove && (same(game.lastMove.from, square) || same(game.lastMove.to, square));
              const check = piece?.type === 'k' && piece.color === game.turn && checked;
              const dark = (row + col) % 2 === 1;
              return <button type="button" key={row + '-' + col}
                className={['chess-square', dark ? 'dark' : 'light',
                  active ? 'chosen' : '', legalTarget ? 'legal-target' : '',
                  prev ? 'last-move' : '', check ? 'checked-king' : ''].join(' ')}
                onClick={() => choose(square)} aria-pressed={active}
                aria-label={notation(square) +
                  (piece ? ', ' + piece.color + ' ' + pieceName(piece.type) : ', empty') +
                  (legalTarget ? ', legal destination' : '')}>
                {ci === 0 && <span className="chess-coordinate rank">{8 - row}</span>}
                {ri === 7 && <span className="chess-coordinate file">{'abcdefgh'[col]}</span>}
                {piece && <span className={'chess-piece ' + piece.color} aria-hidden="true">{GLYPHS[piece.color][piece.type]}</span>}
                {legalTarget && <span className={'chess-move-marker' + (piece ? ' capture' : '')} aria-hidden="true"/>}
              </button>;
            }))}
          </div>
        </div>
        <div className="chess-player-bar lower">
          <span className="chess-player-identity"><span className="chess-player-symbol ivory">♔</span> IVORY <span className="chess-player-sub">WHITE</span></span>
          <PiecesTaken game={game} by="white"/>
        </div>
        <div className="board-caption">STANDARD CHESS · TWO PLAYERS · NO TIMER</div>
      </div>
      <aside className="game-aside chess-aside">
        <div className="aside-overline">MAKE YOUR NEXT MOVE COUNT</div>
        <h2>{resultText}</h2>
        <p className="game-message">{game.outcome ? 'The game is complete. Ready for another?' :
          checked ? 'Your king is under attack. You must escape check.' :
          selected ? 'Choose one of the highlighted squares, or another piece.' :
          'Select a piece to show its legal moves.'}</p>
        <div className="chess-turn-badges">
          <span className={'chess-turn-pill ' + (game.turn === 'white' ? 'active' : '')}>♔ IVORY</span>
          <span className={'chess-turn-pill ' + (game.turn === 'black' ? 'active' : '')}>♚ ONYX</span>
        </div>
        <div className="aside-controls">
          <button className="gold-button" onClick={fresh}>New game ↺</button>
          <button className="quiet-button" disabled={!history.length} onClick={undo}>Undo last move</button>
          <button className="quiet-button" onClick={() => { setFlipped((value) => !value); setSelected(null); setPromotion(null); }}>Flip the board ⇅</button>
        </div>
        <div className="chess-move-section">
          <div className="chess-history-head"><h3>Move history</h3><span>{game.moveList.length} PLY</span></div>
          <div className="chess-history-list" aria-label="Move history" role="log">
            {!movePairs.length ? <p>Every good game starts with one move.</p> : movePairs.map((pair) =>
              <div key={pair.n} className="chess-move-pair">
                <span>{pair.n}.</span><strong>{pair.white}</strong><strong>{pair.black || '·'}</strong>
              </div>)}
          </div>
          <div className="chess-counterline">MOVE {game.fullmove} · {game.halfmoveClock} HALFMOVES SINCE LAST PAWN MOVE/CAPTURE</div>
        </div>
        <div className="how-to">
          <h3>At this table</h3>
          <p>White moves first. Select a piece and choose a highlighted legal destination. Kings may castle when safe, pawns can capture en passant, and you may choose your promotion piece.</p>
          <p>Checkmate wins. Stalemate and insufficient material draw. For relaxed play, three repetitions or fifty moves without a capture or pawn move automatically draw.</p>
          <p>Two people share this device. A solo computer opponent is planned for a future update.</p>
        </div>
      </aside>
    </div>
    {promotion && <div className="chess-promotion-backdrop" role="presentation">
      <div className="chess-promotion-dialog" role="dialog" aria-modal="true" aria-label="Choose your pawn promotion">
        <span className="overline">THE PAWN REACHES THE FAR SIDE</span>
        <h2>Choose a promotion</h2>
        <p>What shall your pawn become?</p>
        <div className="chess-promotion-options">
          {(['q', 'r', 'b', 'n'] as const).map((type) =>
            <button key={type} type="button" onClick={() => commit({ ...promotion, promotion: type })}
              aria-label={'Promote to ' + pieceName(type)}>
              <span>{GLYPHS[game.turn][type]}</span><small>{pieceName(type)}</small>
            </button>)}
        </div>
        <button className="quiet-button" onClick={() => setPromotion(null)}>Cancel promotion</button>
      </div>
    </div>}
  </section>;
}
