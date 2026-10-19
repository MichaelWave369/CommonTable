import { useEffect, useMemo, useState } from 'react';
import {
  legalMancalaMoves, newMancalaGame, ownPits, ownStore,
  playMancalaMove, type MancalaGame, type MancalaPlayer,
} from '../lib/mancala';
import { chooseMancalaMove, type MancalaDifficulty } from '../lib/mancala-ai';

type Mode = 'local' | 'solo';
const COLORS: Record<MancalaPlayer, string> = { ivory: 'Ivory', onyx: 'Onyx' };

function validSaved(value: unknown): value is MancalaGame {
  if (!value || typeof value !== 'object') return false;
  const game = value as MancalaGame;
  return Array.isArray(game.pits) && game.pits.length === 14 &&
    game.pits.every((n) => Number.isInteger(n) && n >= 0 && n <= 48) &&
    game.pits.reduce((sum, n) => sum + n, 0) === 48 &&
    (game.turn === 'ivory' || game.turn === 'onyx') &&
    typeof game.finished === 'boolean' &&
    (game.winner === null || game.winner === 'ivory' || game.winner === 'onyx') &&
    Number.isInteger(game.moveCount) && Number.isInteger(game.extraTurns) &&
    (game.lastPit === null || (Number.isInteger(game.lastPit) && game.lastPit >= 0 && game.lastPit <= 13)) &&
    typeof game.notice === 'string';
}
function initialGame(): MancalaGame {
  try {
    const raw = localStorage.getItem('commontable:mancala');
    if (raw) {
      const candidate: unknown = JSON.parse(raw);
      if (validSaved(candidate)) return candidate;
    }
  } catch { /* Browser saves are optional. */ }
  return newMancalaGame();
}
function initialMode(): Mode {
  try { return localStorage.getItem('commontable:mancala-mode') === 'solo' ? 'solo' : 'local'; }
  catch { return 'local'; }
}
function initialLevel(): MancalaDifficulty {
  try {
    const value = localStorage.getItem('commontable:mancala-level');
    return value === 'easy' || value === 'hard' ? value : 'medium';
  } catch { return 'medium'; }
}

function Seeds({ count, large = false }: { count: number; large?: boolean }) {
  return <span className={'mn-stones' + (large ? ' large' : '')} aria-hidden="true">
    {Array.from({ length: Math.min(9, count) }, (_, i) =>
      <i key={i} className={'mn-stone color-' + (i % 5)} />)}
  </span>;
}
function Pit({
  index, count, active, latest, player, onClick,
}: {
  index: number; count: number; active: boolean; latest: boolean;
  player: MancalaPlayer; onClick: () => void;
}) {
  return <button className={'mn-pit ' + player + (active ? ' playable' : '') + (latest ? ' latest' : '')}
    type="button" onClick={onClick} disabled={!active}
    aria-label={COLORS[player] + ' pit ' + (player === 'ivory' ? index + 1 : index - 6) +
      ', ' + count + ' stones' + (active ? ', choose to sow' : '')}>
    <Seeds count={count}/>
    <span className="mn-pit-count">{count}</span>
  </button>;
}
function Store({ game, player }: { game: MancalaGame; player: MancalaPlayer }) {
  const count = game.pits[ownStore(player)];
  return <div className={'mn-store ' + player} aria-label={COLORS[player] + ' store: ' + count + ' stones'}>
    <span className="mn-store-name">{COLORS[player].toUpperCase()} STORE</span>
    <div className="mn-store-well"><Seeds count={count} large/><strong>{count}</strong></div>
  </div>;
}
export default function MancalaRoom({ onSound }: { onSound: () => void }) {
  const [game, setGame] = useState<MancalaGame>(initialGame);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [difficulty, setDifficulty] = useState<MancalaDifficulty>(initialLevel);
  const [history, setHistory] = useState<MancalaGame[]>([]);
  const [hint, setHint] = useState<number | null>(null);
  const legal = useMemo(() => legalMancalaMoves(game), [game]);
  const computerTurn = mode === 'solo' && game.turn === 'onyx' && !game.finished;
  const scores = { ivory: game.pits[6], onyx: game.pits[13] };
  const sideSums = {
    ivory: ownPits('ivory').reduce((sum, i) => sum + game.pits[i], 0),
    onyx: ownPits('onyx').reduce((sum, i) => sum + game.pits[i], 0),
  };

  useEffect(() => {
    try { localStorage.setItem('commontable:mancala', JSON.stringify(game)); }
    catch { /* Optional */ }
  }, [game]);
  useEffect(() => {
    try {
      localStorage.setItem('commontable:mancala-mode', mode);
      localStorage.setItem('commontable:mancala-level', difficulty);
    } catch { /* Optional */ }
  }, [mode, difficulty]);
  useEffect(() => {
    if (!computerTurn) return;
    const timer = window.setTimeout(() => {
      const move = chooseMancalaMove(game, difficulty);
      if (move === null) return;
      const next = playMancalaMove(game, move);
      if (next === game) return;
      setHistory((stack) => [...stack.slice(-199), game]);
      setGame(next);
      setHint(null);
      onSound();
    }, 380);
    return () => window.clearTimeout(timer);
  }, [game, computerTurn, difficulty, onSound]);

  function sow(index: number) {
    if (computerTurn || !legal.includes(index) || game.finished) return;
    const next = playMancalaMove(game, index);
    if (next === game) return;
    setHistory((stack) => [...stack.slice(-199), game]);
    setGame(next);
    setHint(null);
    onSound();
  }
  function reset() {
    setGame(newMancalaGame());
    setHistory([]);
    setHint(null);
    onSound();
  }
  function changeMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    reset();
  }
  const undoIndex = mode === 'solo'
    ? history.map((previous) => previous.turn === 'ivory' && !previous.finished).lastIndexOf(true)
    : history.length - 1;
  function undo() {
    if (undoIndex < 0) return;
    setGame(history[undoIndex]);
    setHistory((stack) => stack.slice(0, undoIndex));
    setHint(null);
    onSound();
  }
  function suggest() {
    if (computerTurn || game.finished) return;
    setHint(chooseMancalaMove(game, 'medium'));
    onSound();
  }

  const message = game.finished
    ? (game.winner ? COLORS[game.winner] + ' wins!' : 'A perfect tie!')
    : computerTurn ? 'Onyx is choosing a pit…' : COLORS[game.turn] + ' to play';

  const pit = (index: number, player: MancalaPlayer) =>
    <Pit key={index} index={index} count={game.pits[index]} player={player}
      active={!computerTurn && legal.includes(index)}
      latest={index === game.lastPit || index === hint}
      onClick={() => sow(index)} />;
  return <section className="game-room mn-room">
    <div className="room-heading">
      <span className="overline">TABLE NO. 08 / STONES & STRATEGY</span>
      <h1>Mancala <em>Kalah</em><span className="heading-dot">.</span></h1>
      <p>Count the stones. Make your move. Find the rhythm in a classic game of sowing and collecting.</p>
    </div>
    <div className="play-layout mn-layout">
      <div className="play-surface mn-surface">
        <div className="mn-overline">A LITTLE STRATEGY GOES A LONG WAY <span>✣</span> SIX PITS EACH</div>
        <div className="mn-board-scroll">
          <div className="mn-wooden-board" role="group" aria-label="Kalah board, six pits per player">
            <Store game={game} player="onyx"/>
            <div className="mn-middle">
              <div className="mn-pit-row onyx" aria-label="Onyx pits from twelve to seven">
                {[12, 11, 10, 9, 8, 7].map((index) => pit(index, 'onyx'))}
              </div>
              <div className="mn-board-divider">
                <span>ONYX <small>◂</small></span>
                <i>✣</i>
                <span><small>▸</small> IVORY</span>
              </div>
              <div className="mn-pit-row ivory" aria-label="Ivory pits from one to six">
                {[0, 1, 2, 3, 4, 5].map((index) => pit(index, 'ivory'))}
              </div>
            </div>
            <Store game={game} player="ivory"/>
          </div>
        </div>
        <div className="mn-score-rail">
          <div className={'mn-player-score' + (game.turn === 'onyx' && !game.finished ? ' active' : '')}>
            <span className="mn-score-token onyx">✣</span>
            <div><small>ONYX {mode === 'solo' ? '· COMPUTER' : '· PLAYER 2'}</small>
              <strong>{scores.onyx} <span>STORED</span></strong></div>
          </div>
          <span className="mn-score-mid">VS</span>
          <div className={'mn-player-score' + (game.turn === 'ivory' && !game.finished ? ' active' : '')}>
            <div><small>IVORY {mode === 'solo' ? '· YOU' : '· PLAYER 1'}</small>
              <strong>{scores.ivory} <span>STORED</span></strong></div>
            <span className="mn-score-token ivory">✣</span>
          </div>
        </div>
        <div className="board-caption">KALAH · 48 STONES · SOW COUNTERCLOCKWISE · LOCAL PLAY</div>
      </div>
      <aside className="game-aside mn-aside">
        <div className="aside-overline">PULL UP A CHAIR</div>
        <h2 aria-live="polite">{message}</h2>
        <p className="game-message">{computerTurn ? 'The computer is evaluating its legal choices on your device.' : game.notice}</p>
        <div className="stat-strip">
          <div><small>YOUR PITS</small><strong>{sideSums.ivory}</strong></div>
          <div><small>THEIR PITS</small><strong>{sideSums.onyx}</strong></div>
          <div><small>BONUS TURNS</small><strong>{game.extraTurns}</strong></div>
        </div>
        <div className="opponent-controls">
          <label htmlFor="mn-mode">WHO'S SITTING ACROSS?</label>
          <select id="mn-mode" value={mode} onChange={(event) => changeMode(event.target.value as Mode)}>
            <option value="local">Two players · same device</option>
            <option value="solo">Solo · play Onyx AI</option>
          </select>
          {mode === 'solo' && <>
            <label htmlFor="mn-level">COMPUTER DIFFICULTY</label>
            <select id="mn-level" value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as MancalaDifficulty)}>
              <option value="easy">Easy · relaxed</option>
              <option value="medium">Medium · thoughtful</option>
              <option value="hard">Hard · looks ahead</option>
            </select>
          </>}
          <p>{mode === 'solo' ? 'You play Ivory. Onyx is an offline, lightweight computer opponent.' :
            'Ivory starts; take turns using the same screen.'} Changing play mode resets the game.</p>
        </div>
        <div className="aside-controls">
          <button className="gold-button" onClick={reset}>New game ↺</button>
          <button className="quiet-button" onClick={undo} disabled={undoIndex < 0}>
            {mode === 'solo' ? 'Undo last human decision' : 'Undo last move'}
          </button>
          <button className="quiet-button" onClick={suggest}
            disabled={game.finished || computerTurn || !legal.length}>Suggest a pit ✧</button>
        </div>
        <div className="how-to">
          <h3>At this table</h3>
          <p>Each side begins with four stones in each of six pits. Pick one of your nonempty pits to distribute its stones, one by one, counterclockwise. Skip your opponent’s store.</p>
          <p>Drop your last stone in your own store for an extra turn. Land in one of your empty pits opposite an occupied enemy pit to capture both your last stone and the opposing stones.</p>
          <p>When either player’s six pits are empty, all stones remaining on the other side go to that player’s store. Most stones collected wins.</p>
        </div>
      </aside>
    </div>
  </section>;
}
