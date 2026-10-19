import { useEffect, useMemo, useState } from 'react';
import {
  applyBackgammonMove, legalBackgammonMoves, newBackgammonGame, rollBackgammon,
  type BGFrom, type BGGame, type BGMove, type BGPlayer, type BGTo,
} from '../lib/backgammon';

const FACE_PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const LABELS: Record<BGPlayer, string> = { ivory: 'Ivory', onyx: 'Onyx' };
const nameOf = (index: number) => (index + 1).toString();
const pieceCount = (value: number) => Math.abs(value);
function Dice({ value, used = false }: { value: number; used?: boolean }) {
  return <span className={'bg-die' + (used ? ' used' : '')} aria-label={'Die showing ' + value}>
    {Array.from({ length: 9 }, (_, i) =>
      <span className={FACE_PIPS[value].includes(i) ? 'bg-pip visible' : 'bg-pip'} key={i} />)}
  </span>;
}
function validSave(value: unknown): value is BGGame {
  if (!value || typeof value !== 'object') return false;
  const v = value as BGGame;
  return Array.isArray(v.points) && v.points.length === 24 &&
    v.points.every((p) => Number.isInteger(p) && p >= -15 && p <= 15) &&
    (v.turn === 'ivory' || v.turn === 'onyx') &&
    (v.phase === 'roll' || v.phase === 'move' || v.phase === 'finished') &&
    Array.isArray(v.dice) && v.dice.length <= 4 &&
    v.dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6) &&
    v.bar != null && Number.isInteger(v.bar.ivory) && Number.isInteger(v.bar.onyx) &&
    v.off != null && Number.isInteger(v.off.ivory) && Number.isInteger(v.off.onyx) &&
    typeof v.notice === 'string' && typeof v.rollCount === 'number' &&
    (v.winner === null || v.winner === 'ivory' || v.winner === 'onyx');
}
function load(): BGGame {
  try {
    const raw = localStorage.getItem('commontable:backgammon');
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (validSave(parsed)) return parsed;
    }
  } catch { /* Browser-local saves are optional. */ }
  return newBackgammonGame();
}

type PointProps = {
  index: number;
  value: number;
  upper: boolean;
  selected: boolean;
  target: boolean;
  canChoose: boolean;
  onClick: () => void;
};
function BoardPoint({ index, value, upper, selected, target, canChoose, onClick }: PointProps) {
  const color = value > 0 ? 'ivory' : 'onyx';
  const count = pieceCount(value);
  return <button type="button" onClick={onClick}
    className={['bg-point', upper ? 'upper' : 'lower', index % 2 ? 'wine' : 'sand',
      selected ? 'selected' : '', target ? 'target' : ''].join(' ')}
    aria-pressed={selected}
    aria-label={'Point ' + nameOf(index) + ': ' +
      (count ? count + ' ' + color + ' checkers' : 'empty') +
      (target ? ', legal destination' : '') +
      (canChoose ? ', selectable' : '')}>
    <span className="bg-triangle" aria-hidden="true" />
    <span className="bg-point-number">{index + 1}</span>
    {count > 0 && <span className="bg-checker-stack" aria-hidden="true">
      {Array.from({ length: Math.min(5, count) }, (_, i) =>
        <span className={'bg-disc ' + color} key={i} />)}
    </span>}
    {count > 5 && <span className="bg-stack-count" aria-hidden="true">×{count}</span>}
    {target && <span className="bg-target-dot" aria-hidden="true">●</span>}
  </button>;
}

export default function BackgammonRoom({ onSound }: { onSound: () => void }) {
  const [game, setGame] = useState<BGGame>(load);
  const [history, setHistory] = useState<BGGame[]>([]);
  const [selected, setSelected] = useState<BGFrom | null>(null);
  const moves = useMemo(() => legalBackgammonMoves(game), [game]);
  const options = selected === null ? [] : moves.filter((move) => move.from === selected);
  const hasOffMove = options.some((move) => move.to === 'off');
  const activeLabel = LABELS[game.turn];
  useEffect(() => {
    try { localStorage.setItem('commontable:backgammon', JSON.stringify(game)); } catch { /* Optional */ }
  }, [game]);

  function commit(next: BGGame) {
    if (next === game) return;
    setHistory((stack) => [...stack.slice(-99), game]);
    setGame(next);
    setSelected(null);
    onSound();
  }
  function choosePoint(index: number) {
    if (game.phase !== 'move') return;
    const destination = options.find((move) => move.to === index);
    if (destination) { commit(applyBackgammonMove(game, destination)); return; }
    const selectable = moves.some((move) => move.from === index);
    if (selectable) {
      setSelected(selected === index ? null : index);
      onSound();
    } else setSelected(null);
  }
  function chooseBar() {
    if (game.phase !== 'move' || !moves.some((move) => move.from === 'bar')) return;
    setSelected(selected === 'bar' ? null : 'bar');
    onSound();
  }
  function bearOff() {
    const move = options.find((candidate) => candidate.to === 'off');
    if (move) commit(applyBackgammonMove(game, move));
  }
  function roll() {
    if (game.phase !== 'roll') return;
    commit(rollBackgammon(game));
  }
  function undo() {
    if (!history.length) return;
    setGame(history[history.length - 1]);
    setHistory((stack) => stack.slice(0, -1));
    setSelected(null);
    onSound();
  }
  function reset() {
    setGame(newBackgammonGame());
    setSelected(null);
    setHistory([]);
    onSound();
  }

  const drawPoint = (index: number, upper: boolean) =>
    <BoardPoint index={index} key={index} value={game.points[index]} upper={upper}
      selected={selected === index} target={options.some((move) => move.to === index)}
      canChoose={moves.some((move) => move.from === index)}
      onClick={() => choosePoint(index)}/>;
  const bar = (player: BGPlayer) =>
    <button type="button" className={'bg-bar-seat' + (selected === 'bar' && game.turn === player ? ' selected' : '') +
        (moves.some((move) => move.from === 'bar') && game.turn === player ? ' selectable' : '')}
      key={player} onClick={chooseBar} aria-label={LABELS[player] + ' checkers on bar: ' + game.bar[player]}>
      <small>{player === 'onyx' ? 'ONYX BAR' : 'IVORY BAR'}</small>
      <span className={'bg-disc ' + player}>{game.bar[player] || '·'}</span>
    </button>;

  return <section className="game-room bg-room">
    <div className="room-heading">
      <span className="overline">TABLE NO. 06 / THE DICE ARE ROLLING</span>
      <h1>Backgammon<span className="heading-dot">.</span></h1>
      <p>Twenty-four points, fifteen checkers each, and one delightful little roll of the dice.</p>
    </div>
    <div className="play-layout bg-layout">
      <div className="play-surface bg-surface">
        <div className="bg-board-scroll">
          <div className="bg-board-frame">
            <div className="bg-board">
              <div className="bg-points-row upper">
                {[12, 13, 14, 15, 16, 17].map((index) => drawPoint(index, true))}
                <div className="bg-bar-slot">{bar('onyx')}</div>
                {[18, 19, 20, 21, 22, 23].map((index) => drawPoint(index, true))}
              </div>
              <div className="bg-middle-rail">
                <span>✣</span>
                <div className="bg-middle-dice" aria-label="Last roll">
                  {game.lastRoll ? game.lastRoll.map((die, i) => <Dice key={i} value={die} />) :
                    <small>ROLL THE DICE</small>}
                </div>
                <span>✣</span>
              </div>
              <div className="bg-points-row lower">
                {[11, 10, 9, 8, 7, 6].map((index) => drawPoint(index, false))}
                <div className="bg-bar-slot">{bar('ivory')}</div>
                {[5, 4, 3, 2, 1, 0].map((index) => drawPoint(index, false))}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-underboard">
          <span>ONYX OFF <strong>{game.off.onyx} / 15</strong></span>
          <span>IVORY OFF <strong>{game.off.ivory} / 15</strong></span>
        </div>
        <div className="board-caption">BACKGAMMON · STANDARD SETUP · LOCAL TWO-PLAYER TABLE</div>
      </div>

      <aside className="game-aside">
        <div className="aside-overline">LET THE GOOD TIMES ROLL</div>
        <h2 aria-live="polite">{game.winner ? LABELS[game.winner] + ' wins!' :
          activeLabel + (game.phase === 'roll' ? ', roll the dice!' : ', your move')}</h2>
        <p className="game-message">{game.notice}</p>
        <div className="bg-turn-line">
          <span className={'bg-turn-token ' + game.turn}><span className={'bg-disc ' + game.turn}/> {activeLabel.toUpperCase()}</span>
          <span className="bg-turn-note">{game.phase === 'move' ? 'SELECT A CHECKER, THEN A TARGET' : 'PASS THE DEVICE, THEN ROLL'}</span>
        </div>
        <div className="bg-remaining-dice">
          <span className="opponent-controls-label">DICE STILL TO PLAY</span>
          <div className="bg-dice-line">{game.dice.length ?
            game.dice.map((die, i) => <Dice key={i} value={die}/>) :
            <span className="bg-no-dice">No dice in play</span>}</div>
        </div>
        <div className="stat-strip">
          <div><small>IVORY OFF</small><strong>{game.off.ivory}</strong></div>
          <div><small>ONYX OFF</small><strong>{game.off.onyx}</strong></div>
          <div><small>ROLLS</small><strong>{game.rollCount}</strong></div>
        </div>
        <div className="aside-controls">
          <button className="gold-button" onClick={roll} disabled={game.phase !== 'roll'}>⚄ Roll the dice</button>
          <button className="quiet-button" onClick={bearOff} disabled={!hasOffMove}>Bear off selected checker →</button>
          <button className="quiet-button" onClick={undo} disabled={!history.length}>Undo last action</button>
          <button className="quiet-button" onClick={reset}>New game ↺</button>
        </div>
        <div className="how-to">
          <h3>At this table</h3>
          <p>Ivory travels from point 24 toward point 1. Onyx travels from point 1 toward point 24. Select a checker, then a highlighted destination.</p>
          <p>You must play both dice if possible. Doubles provide four moves. You cannot land on two or more opposing checkers. Landing on one sends it to the bar, which must be cleared before any other checker moves.</p>
          <p>Once all your checkers are in your home board, bear them off. The first player to bear off all fifteen wins. This relaxed version has no doubling cube or match scoring.</p>
        </div>
      </aside>
    </div>
  </section>;
}
