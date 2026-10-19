import { useEffect, useState } from 'react';
import {
  canPlay, drawDomino, ends, newDominoGame, passDomino, playDomino,
  playableSides, remainingPips, type DominoGame, type DominoSide, type DominoTile,
} from '../lib/dominoes';

const patterns: Record<number, number[]> = {
  0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8],
  4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
function Half({ pip }: { pip: number }) {
  return <span className="dom-pip-half">
    {Array.from({ length: 9 }, (_, i) =>
      <span key={i} className={patterns[pip].includes(i) ? 'pip on' : 'pip'} />)}
  </span>;
}
function Tile({ tile, selected = false }: { tile: DominoTile; selected?: boolean }) {
  return <span className={'dom-tile' + (selected ? ' chosen' : '')}>
    <Half pip={tile.a}/><span className="dom-divider"/><Half pip={tile.b}/>
  </span>;
}
function validSaved(value: unknown): value is DominoGame {
  if (!value || typeof value !== 'object') return false;
  const v = value as DominoGame;
  return Array.isArray(v.hands) && v.hands.length === 2 &&
    v.hands.every(Array.isArray) && Array.isArray(v.chain) && Array.isArray(v.stock) &&
    (v.turn === 0 || v.turn === 1) && typeof v.ended === 'boolean' &&
    typeof v.consecutivePasses === 'number';
}
function load(): DominoGame {
  try {
    const raw = localStorage.getItem('commontable:dominoes');
    if (raw) {
      const candidate: unknown = JSON.parse(raw);
      if (validSaved(candidate)) return candidate;
    }
  } catch { /* Saving is optional. */ }
  return newDominoGame();
}
export default function DominoesRoom({ onSound }: { onSound: () => void }) {
  const [game, setGame] = useState<DominoGame>(load);
  const [selected, setSelected] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { localStorage.setItem('commontable:dominoes', JSON.stringify(game)); } catch { /* Optional. */ }
  }, [game]);
  const activeHand = game.hands[game.turn];
  const chosenTile = activeHand.find((tile) => tile.id === selected);
  const sides = chosenTile ? playableSides(game, chosenTile) : [];
  const open = ends(game);
  const blocked = !canPlay(game);
  const isDraw = game.ended && game.winner === null;

  function takeTurn(next: DominoGame) {
    if (next === game) return;
    onSound();
    setGame(next);
    setSelected(null);
    if (next.turn !== game.turn && !next.ended) setReady(false);
  }
  function freshGame() {
    setGame(newDominoGame());
    setSelected(null);
    setReady(false);
    onSound();
  }

  return <section className="game-room">
    <div className="room-heading">
      <span className="overline">TABLE NO. 03 / THE BONEYARD</span>
      <h1>Dominoes<span className="heading-dot">.</span></h1>
      <p>Double-six Draw Dominoes. Take turns, match the ends, and see who goes out first.</p>
    </div>
    <div className="play-layout">
      <div className="play-surface dom-surface">
        <div className="dom-status-bar">
          <span>PLAYER 1 · {game.hands[0].length} TILES</span>
          <span className="dom-active-dot">✦</span>
          <span>PLAYER 2 · {game.hands[1].length} TILES</span>
        </div>
        <div className="dom-chain-scroll" role="group" aria-label="Played domino chain">
          {game.chain.length ?
            <div className="dom-chain">
              {game.chain.map((tile) => <Tile key={tile.id} tile={tile}/>)}
            </div> :
            <div className="dom-empty-chain">THE TABLE IS YOURS <span>✣</span> PLACE THE FIRST TILE</div>}
        </div>
        <div className="dom-end-summary">
          <span>LEFT END <strong>{open?.left ?? '·'}</strong></span>
          <span>RIGHT END <strong>{open?.right ?? '·'}</strong></span>
        </div>
        <div className="dom-hand-area">
          {game.ended ? <div className="dom-handoff">
            <h3>{isDraw ? 'A friendly draw.' : 'Player ' + ((game.winner ?? 0) + 1) + ' wins!'}</h3>
            <p>{isDraw ? 'Both hands have equal pip totals.' : 'Another round around the table?'}</p>
            <button className="gold-button" onClick={freshGame}>New round ↺</button>
          </div> :
            !ready ? <div className="dom-handoff">
              <span className="dom-handoff-icon">✣</span>
              <h3>Pass the table to Player {game.turn + 1}</h3>
              <p>Keep your tiles private. When the next player is ready, reveal their hand.</p>
              <button className="gold-button" onClick={() => { setReady(true); onSound(); }}>Reveal my tiles</button>
            </div> :
            <>
              <div className="dom-hand-label">
                <span>PLAYER {game.turn + 1}'S HAND</span>
                <span>{activeHand.length} TILES</span>
              </div>
              <div className="dom-hand" role="group" aria-label={'Player ' + (game.turn + 1) + ' domino tiles'}>
                {activeHand.map((tile) => {
                  const playable = playableSides(game, tile).length > 0;
                  return <button key={tile.id} className={'dom-hand-tile' + (selected === tile.id ? ' active' : '')}
                    disabled={!playable} onClick={() => { setSelected(tile.id); onSound(); }}
                    aria-pressed={selected === tile.id}
                    aria-label={'Domino ' + tile.a + ' and ' + tile.b + (playable ? ', playable' : ', blocked')}>
                    <Tile tile={tile} selected={selected === tile.id}/>
                  </button>;
                })}
              </div>
              {chosenTile ?
                <div className="dom-placement">
                  <span>PLACE {chosenTile.a} | {chosenTile.b} ON</span>
                  {sides.includes('left') && <button className="quiet-button" onClick={() => takeTurn(playDomino(game, chosenTile.id, 'left' as DominoSide))}>← Left end</button>}
                  {sides.includes('right') && <button className="quiet-button" onClick={() => takeTurn(playDomino(game, chosenTile.id, 'right' as DominoSide))}>Right end →</button>}
                </div> :
                <p className="dom-instruction">{blocked ? 'No matching tile? Draw from the boneyard or pass.' : 'Choose a highlighted tile to see where it fits.'}</p>}
            </>}
        </div>
        <div className="board-caption">DOUBLE-SIX · TWO PLAYERS · PASS & PLAY</div>
      </div>
      <aside className="game-aside">
        <div className="aside-overline">GOOD GAMES, GOOD COMPANY</div>
        <h2>{game.ended ? (isDraw ? 'A tie game' : 'Player ' + ((game.winner ?? 0) + 1) + ' wins') :
          'Player ' + (game.turn + 1) + "'s turn"}</h2>
        <p className="game-message">{game.ended ? 'Round complete. The lowest pip total wins when both players are blocked.' :
          blocked ? (game.stock.length ? 'No legal match. Draw a tile from the boneyard.' : 'No legal match and an empty boneyard. You can pass.') :
          'Pick a tile from your hand and place it against a matching open end.'}</p>
        <div className="stat-strip">
          <div><small>BONEYARD</small><strong>{game.stock.length}</strong></div>
          <div><small>CHAIN</small><strong>{game.chain.length}</strong></div>
          <div><small>TURN</small><strong>{game.turn + 1}</strong></div>
        </div>
        {game.ended && <div className="dom-scores">
          <span>PLAYER 1 PIPS <strong>{remainingPips(game.hands[0])}</strong></span>
          <span>PLAYER 2 PIPS <strong>{remainingPips(game.hands[1])}</strong></span>
        </div>}
        <div className="aside-controls">
          <button className="gold-button" disabled={game.ended || !ready || !blocked || game.stock.length === 0}
            onClick={() => takeTurn(drawDomino(game))}>Draw one tile ({game.stock.length} left)</button>
          <button className="quiet-button" disabled={game.ended || !ready || !blocked || game.stock.length > 0}
            onClick={() => takeTurn(passDomino(game))}>Pass turn</button>
          <button className="quiet-button" onClick={freshGame}>Start a new round ↺</button>
        </div>
        <div className="how-to">
          <h3>At this table</h3>
          <p>Each player starts with seven double-six dominoes. Match either exposed end, or start the chain with any tile.</p>
          <p>If no tile fits, draw from the boneyard until you can play. When it runs out, pass. First to empty their hand wins. If both players pass, the hand with fewer pips wins.</p>
          <p>The next player's hand stays covered until they're ready. No accounts or networking required.</p>
        </div>
      </aside>
    </div>
  </section>;
}
