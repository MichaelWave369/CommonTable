import { useEffect, useMemo, useState } from 'react';
import {
  availableReversiMoves, newReversiGame, playReversiMove, reversiScore,
  type ReversiGame, type ReversiMove, type ReversiPlayer,
} from '../lib/reversi';
import { chooseReversiMove, type ReversiDifficulty } from '../lib/reversi-ai';

type Mode = 'local' | 'solo';

function validSave(value: unknown): value is ReversiGame {
  if (!value || typeof value !== 'object') return false;
  const game = value as ReversiGame;
  const colors = ['onyx', 'ivory'];
  return Array.isArray(game.board) && game.board.length === 8 &&
    game.board.every((row) => Array.isArray(row) && row.length === 8 &&
      row.every((cell) => cell === null || colors.includes(cell))) &&
    colors.includes(game.turn) && typeof game.finished === 'boolean' &&
    (game.winner === null || colors.includes(game.winner)) &&
    Number.isInteger(game.passes) && Number.isInteger(game.moveCount) &&
    (game.lastMove === null || (!!game.lastMove &&
      Number.isInteger(game.lastMove.row) && Number.isInteger(game.lastMove.col))) &&
    typeof game.notice === 'string';
}
function readGame(): ReversiGame {
  try {
    const raw = localStorage.getItem('commontable:reversi');
    if (raw) {
      const saved: unknown = JSON.parse(raw);
      if (validSave(saved)) return saved;
    }
  } catch { /* Private browsing may block storage. */ }
  return newReversiGame();
}
function readMode(): Mode {
  try { return localStorage.getItem('commontable:reversi-mode') === 'solo' ? 'solo' : 'local'; }
  catch { return 'local'; }
}
function readLevel(): ReversiDifficulty {
  try {
    const value = localStorage.getItem('commontable:reversi-level');
    return value === 'easy' || value === 'hard' ? value : 'medium';
  } catch { return 'medium'; }
}

export default function ReversiRoom({ onSound }: { onSound: () => void }) {
  const [game, setGame] = useState<ReversiGame>(readGame);
  const [mode, setMode] = useState<Mode>(readMode);
  const [difficulty, setDifficulty] = useState<ReversiDifficulty>(readLevel);
  const [history, setHistory] = useState<ReversiGame[]>([]);
  const [showMoves, setShowMoves] = useState(true);
  const [hint, setHint] = useState<{ row: number; col: number } | null>(null);
  const computerTurn = mode === 'solo' && game.turn === 'onyx' && !game.finished;
  const legal = useMemo(() => availableReversiMoves(game), [game]);
  const scores = useMemo(() => reversiScore(game.board), [game.board]);

  useEffect(() => {
    try { localStorage.setItem('commontable:reversi', JSON.stringify(game)); }
    catch { /* Optional save. */ }
  }, [game]);
  useEffect(() => {
    try {
      localStorage.setItem('commontable:reversi-mode', mode);
      localStorage.setItem('commontable:reversi-level', difficulty);
    } catch { /* Optional save. */ }
  }, [mode, difficulty]);

  useEffect(() => {
    if (!computerTurn) return;
    const timer = window.setTimeout(() => {
      const move = chooseReversiMove(game, difficulty);
      if (!move) return;
      const next = playReversiMove(game, move);
      if (next === game) return;
      setHistory((stack) => [...stack.slice(-149), game]);
      setGame(next);
      setHint(null);
      onSound();
    }, 330);
    return () => window.clearTimeout(timer);
  }, [computerTurn, game, difficulty, onSound]);

  function place(row: number, col: number) {
    if (computerTurn || game.finished || !legal.some((move) => move.row === row && move.col === col)) return;
    const next = playReversiMove(game, { row, col });
    if (next === game) return;
    setHistory((stack) => [...stack.slice(-149), game]);
    setGame(next);
    setHint(null);
    onSound();
  }
  function reset() {
    setGame(newReversiGame());
    setHistory([]);
    setHint(null);
    onSound();
  }
  function changeMode(next: Mode) {
    if (mode === next) return;
    setMode(next);
    reset();
  }
  const undoIndex = mode === 'solo'
    ? history.map((state) => state.turn === 'ivory' && !state.finished).lastIndexOf(true)
    : history.length - 1;
  function undo() {
    if (undoIndex < 0) return;
    setGame(history[undoIndex]);
    setHistory((stack) => stack.slice(0, undoIndex));
    setHint(null);
    onSound();
  }
  function askHint() {
    if (computerTurn || game.finished) return;
    const best = chooseReversiMove(game, 'easy');
    setHint(best && { row: best.row, col: best.col });
    onSound();
  }
  const winnerText = game.finished ? (game.winner
    ? (game.winner === 'onyx' ? 'Onyx' : 'Ivory') + ' wins!'
    : 'A beautifully even draw!') : computerTurn ? 'Onyx is thinking…'
    : (game.turn === 'onyx' ? "Onyx's turn" : "Ivory's turn");
  const pointsText = 'Onyx ' + scores.onyx + ', Ivory ' + scores.ivory;
  return <section className="game-room rv-room">
    <div className="room-heading">
      <span className="overline">TABLE NO. 07 / A FLIP OF FORTUNE</span>
      <h1>Reversi<span className="heading-dot">.</span></h1>
      <p>A move, a flip, a surprise. Every disc has two sides to the story.</p>
    </div>
    <div className="play-layout rv-layout">
      <div className="play-surface rv-surface">
        <div className="rv-top-rail">
          <span className="rv-rail-brand">✣ <span>THE COMMON TABLE</span></span>
          <span>REVERSI · 8 × 8</span>
        </div>
        <div className="rv-board-frame">
          <div className="rv-board" role="group" aria-label="Reversi board with eight rows and eight columns">
            {game.board.flatMap((line, row) => line.map((cell, col) => {
              const move: ReversiMove | undefined = legal.find((candidate) =>
                candidate.row === row && candidate.col === col);
              const suggestion = hint?.row === row && hint.col === col;
              const latest = game.lastMove?.row === row && game.lastMove.col === col;
              return <button key={row + '-' + col} type="button"
                className={'rv-square' + (move && showMoves ? ' legal' : '') +
                  (latest ? ' last' : '') + (suggestion ? ' hinted' : '')}
                onClick={() => place(row, col)} disabled={computerTurn || game.finished}
                aria-label={'Row ' + (row + 1) + ', column ' + (col + 1) +
                  (cell ? ', ' + cell + ' disc' : ', empty') +
                  (move ? ', legal placement flips ' + move.flips.length : '') +
                  (latest ? ', last placed disc' : '')}>
                {cell && <span className={'rv-disc ' + cell} aria-hidden="true"><span /></span>}
                {!cell && !!move && (showMoves || suggestion) &&
                  <span className={'rv-legal-marker' + (suggestion ? ' hint' : '')} aria-hidden="true" />}
                {latest && <span className="rv-last-ring" aria-hidden="true" />}
              </button>;
            }))}
          </div>
        </div>
        <div className="rv-scoreboard" aria-label={'Score: ' + pointsText}>
          <div className={'rv-player-score' + (game.turn === 'onyx' && !game.finished ? ' active' : '')}>
            <span className="rv-disc onyx"><span /></span>
            <div><small>ONYX {mode === 'solo' ? '· COMPUTER' : '· PLAYER 1'}</small><strong>{scores.onyx}</strong></div>
          </div>
          <span className="rv-score-separator">VS</span>
          <div className={'rv-player-score' + (game.turn === 'ivory' && !game.finished ? ' active' : '')}>
            <div><small>IVORY {mode === 'solo' ? '· YOU' : '· PLAYER 2'}</small><strong>{scores.ivory}</strong></div>
            <span className="rv-disc ivory"><span /></span>
          </div>
        </div>
        <div className="board-caption">LEGAL PLACEMENTS {showMoves ? 'HIGHLIGHTED' : 'HIDDEN'} · ALL PLAY IS LOCAL</div>
      </div>
      <aside className="game-aside rv-aside">
        <div className="aside-overline">GOOD COMPANY. CLEVER MOVES.</div>
        <h2 aria-live="polite">{winnerText}</h2>
        <p className="game-message">{game.finished ? game.notice :
          computerTurn ? 'The computer is considering its next legal placement.' : game.notice}</p>
        <div className="stat-strip">
          <div><small>EMPTY</small><strong>{64 - scores.onyx - scores.ivory}</strong></div>
          <div><small>LEGAL</small><strong>{legal.length}</strong></div>
          <div><small>PASSES</small><strong>{game.passes}</strong></div>
        </div>
        <div className="opponent-controls">
          <label htmlFor="rv-mode">WHO'S SITTING ACROSS?</label>
          <select id="rv-mode" value={mode} onChange={(event) => changeMode(event.target.value as Mode)}>
            <option value="local">Two players · same device</option>
            <option value="solo">Solo · play Onyx AI</option>
          </select>
          {mode === 'solo' && <>
            <label htmlFor="rv-level">COMPUTER DIFFICULTY</label>
            <select id="rv-level" value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as ReversiDifficulty)}>
              <option value="easy">Easy · relaxed</option>
              <option value="medium">Medium · thoughtful</option>
              <option value="hard">Hard · looks further ahead</option>
            </select>
          </>}
          <p>{mode === 'solo' ? 'You play Ivory. Onyx moves first, and the computer plays entirely in this browser.' :
            'Take turns on the same device. Onyx moves first.'} Switching modes begins a fresh game.</p>
        </div>
        <div className="aside-controls">
          <button className="gold-button" onClick={reset}>New game ↺</button>
          <button className="quiet-button" onClick={undo} disabled={undoIndex < 0}>
            {mode === 'solo' ? 'Undo your last turn' : 'Undo last move'}
          </button>
          <button className="quiet-button" onClick={askHint}
            disabled={game.finished || computerTurn || !legal.length}>Suggest a move ✧</button>
          <button className="quiet-button" onClick={() => setShowMoves((visible) => !visible)}>
            {showMoves ? 'Hide' : 'Show'} legal moves
          </button>
        </div>
        <div className="how-to">
          <h3>At this table</h3>
          <p>Place a disc to surround a straight line of opponent discs between your new disc and one you already own. All trapped discs flip to your color, across any of eight directions.</p>
          <p>You must flip at least one disc to move. If you have no legal placement, your turn passes automatically. When neither player can move, the player with the most discs wins.</p>
          <p>Solo mode has an original lightweight offline search opponent. No accounts, ads, downloads or timer.</p>
        </div>
      </aside>
    </div>
  </section>;
}
