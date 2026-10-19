import { useEffect, useState } from 'react';
import {
  canMoveKlondike, drawKlondike, hintKlondike, moveKlondike, newKlondikeGame,
  SUITS, type CardSource, type CardDestination, type KlondikeGame,
  type PlayingCard, type Suit,
} from '../lib/solitaire';

const suitGlyph: Record<Suit, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};
const rankGlyph = (rank: number) => rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank);
function Card({ card, active = false }: { card: PlayingCard; active?: boolean }) {
  if (!card.faceUp) return <span className="sol-card-back"><span>✣</span></span>;
  return <span className={'sol-card-face ' +
    (card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black') +
    (active ? ' selected' : '')}>
    <span className="sol-card-corner">{rankGlyph(card.rank)}<small>{suitGlyph[card.suit]}</small></span>
    <span className="sol-card-center">{suitGlyph[card.suit]}</span>
    <span className="sol-card-corner bottom">{rankGlyph(card.rank)}<small>{suitGlyph[card.suit]}</small></span>
  </span>;
}
function validSaved(value: unknown): value is KlondikeGame {
  if (!value || typeof value !== 'object') return false;
  const v = value as KlondikeGame;
  return Array.isArray(v.stock) && Array.isArray(v.waste) &&
    Array.isArray(v.tableau) && v.tableau.length === 7 &&
    v.tableau.every(Array.isArray) && v.foundations !== null &&
    typeof v.foundations === 'object' && SUITS.every((s) => Array.isArray(v.foundations[s])) &&
    typeof v.moves === 'number' && typeof v.won === 'boolean';
}
function load(): KlondikeGame {
  try {
    const raw = localStorage.getItem('commontable:klondike');
    if (raw) {
      const candidate: unknown = JSON.parse(raw);
      if (validSaved(candidate)) return candidate;
    }
  } catch { /* Browser saves are optional. */ }
  return newKlondikeGame();
}
function sourceMatches(a: CardSource | null, b: CardSource): boolean {
  if (!a || a.zone !== b.zone) return false;
  if (a.zone === 'waste' && b.zone === 'waste') return true;
  if (a.zone === 'foundation' && b.zone === 'foundation') return a.suit === b.suit;
  if (a.zone === 'tableau' && b.zone === 'tableau') {
    return a.index === b.index && a.cardIndex === b.cardIndex;
  }
  return false;
}
export default function SolitaireRoom({ onSound }: { onSound: () => void }) {
  const [game, setGame] = useState<KlondikeGame>(load);
  const [selected, setSelected] = useState<CardSource | null>(null);
  const [hint, setHint] = useState<{ source: CardSource; destination: CardDestination } | null>(null);
  const [history, setHistory] = useState<KlondikeGame[]>([]);
  useEffect(() => {
    try { localStorage.setItem('commontable:klondike', JSON.stringify(game)); } catch { /* Optional. */ }
  }, [game]);

  function accept(next: KlondikeGame) {
    if (next === game) return false;
    setHistory((past) => [...past.slice(-79), game]);
    setGame(next);
    setSelected(null);
    setHint(null);
    onSound();
    return true;
  }
  function attempt(target: CardDestination): boolean {
    if (!selected) return false;
    const next = moveKlondike(game, selected, target);
    return accept(next);
  }
  function chooseTableau(index: number, cardIndex?: number) {
    if (attempt({ zone: 'tableau', index })) return;
    if (cardIndex === undefined || !game.tableau[index]?.[cardIndex]?.faceUp) return;
    const source: CardSource = { zone: 'tableau', index, cardIndex };
    setSelected(sourceMatches(selected, source) ? null : source);
    setHint(null);
    onSound();
  }
  function chooseFoundation(suit: Suit) {
    if (attempt({ zone: 'foundation', suit })) return;
    if (game.foundations[suit].length) {
      const source: CardSource = { zone: 'foundation', suit };
      setSelected(sourceMatches(selected, source) ? null : source);
      setHint(null);
      onSound();
    }
  }
  function chooseWaste() {
    if (!game.waste.length) return;
    const source: CardSource = { zone: 'waste' };
    setSelected(sourceMatches(selected, source) ? null : source);
    setHint(null);
    onSound();
  }
  function newGame() {
    setGame(newKlondikeGame());
    setSelected(null);
    setHint(null);
    setHistory([]);
    onSound();
  }
  function undo() {
    if (!history.length) return;
    setGame(history[history.length - 1]);
    setHistory((past) => past.slice(0, -1));
    setSelected(null);
    setHint(null);
    onSound();
  }
  function giveHint() {
    const move = hintKlondike(game);
    setHint(move);
    setSelected(move?.source ?? null);
    onSound();
  }
  const foundationsDone = SUITS.reduce((n, suit) => n + game.foundations[suit].length, 0);
  const selectedLabel = selected
    ? selected.zone === 'tableau' ? 'tableau column ' + (selected.index + 1)
      : selected.zone === 'foundation' ? selected.suit + ' foundation' : 'waste pile'
    : 'none';
  return <section className="game-room">
    <div className="room-heading">
      <span className="overline">TABLE NO. 04 / YOUR OWN LITTLE CORNER</span>
      <h1>Solitaire<span className="heading-dot">.</span></h1>
      <p>Draw-one Klondike. A deck of cards, a quiet table, and all the time you need.</p>
    </div>
    <div className="play-layout solitaire-layout">
      <div className="play-surface solitaire-surface">
        <div className="sol-table-scroll">
          <div className="sol-game-table">
            <div className="sol-top-row">
              <div className="sol-stock-group">
                <button className="sol-card-slot sol-stock" disabled={game.won || (!game.stock.length && !game.waste.length)}
                  aria-label={game.stock.length ? 'Draw a card from the stock' : 'Recycle waste into stock'}
                  onClick={() => accept(drawKlondike(game))}>
                  {game.stock.length ? <span className="sol-card-back"><span>✣</span></span> :
                    <span className="sol-recycle">{game.waste.length ? '↻' : '·'}</span>}
                </button>
                <button className={'sol-card-slot sol-waste' + (sourceMatches(selected, { zone: 'waste' }) ? ' active' : '')}
                  aria-label={game.waste.length ? 'Select top waste card' : 'Waste pile is empty'}
                  onClick={chooseWaste} disabled={!game.waste.length}>
                  {game.waste.length ? <Card card={game.waste[game.waste.length - 1]}
                    active={sourceMatches(selected, { zone: 'waste' })}/> : <span className="sol-slot-symbol">·</span>}
                </button>
              </div>
              <div className="sol-foundation-group">
                {SUITS.map((suit) => {
                  const stack = game.foundations[suit];
                  const active = sourceMatches(selected, { zone: 'foundation', suit });
                  const suggested = hint?.destination.zone === 'foundation' && hint.destination.suit === suit;
                  const eligible = selected && canMoveKlondike(game, selected, { zone: 'foundation', suit });
                  return <button key={suit}
                    className={'sol-card-slot sol-foundation' + (eligible || suggested ? ' target' : '') + (active ? ' active' : '')}
                    onClick={() => chooseFoundation(suit)}
                    aria-label={suit + ' foundation: ' + stack.length + ' cards' + (eligible ? ', legal destination' : '')}>
                    {stack.length ? <Card card={stack[stack.length - 1]} active={active}/> :
                      <span className={'sol-slot-symbol ' + suit}>{suitGlyph[suit]}</span>}
                  </button>;
                })}
              </div>
            </div>
            <div className="sol-row-label">THE TABLEAU <span>BUILD DOWN IN ALTERNATING COLORS</span></div>
            <div className="sol-tableau" role="group" aria-label="Seven Klondike tableau columns">
              {game.tableau.map((pile, index) => {
                const eligible = selected && canMoveKlondike(game, selected, { zone: 'tableau', index });
                const suggested = hint?.destination.zone === 'tableau' && hint.destination.index === index;
                return <div className={'sol-column' + (eligible || suggested ? ' target' : '')}
                  key={index} style={{ minHeight: Math.max(188, 126 + pile.length * 30) }}>
                  <button className="sol-column-landing"
                    onClick={() => chooseTableau(index)}
                    aria-label={'Place on column ' + (index + 1) + (eligible ? ', legal destination' : '')}>
                    {pile.length === 0 ? 'K' : ''}
                  </button>
                  {pile.map((card, cardIndex) => {
                    const source: CardSource = { zone: 'tableau', index, cardIndex };
                    const active = sourceMatches(selected, source);
                    return <button className="sol-tableau-card" key={card.id}
                      style={{ top: cardIndex * 30 }}
                      onClick={() => chooseTableau(index, cardIndex)}
                      disabled={!card.faceUp && !eligible}
                      aria-label={card.faceUp ?
                        rankGlyph(card.rank) + ' of ' + card.suit + ', tableau column ' + (index + 1) :
                        'Face-down card, column ' + (index + 1)}
                      aria-pressed={active}>
                      <Card card={card} active={active}/>
                    </button>;
                  })}
                </div>;
              })}
            </div>
          </div>
        </div>
        <div className="board-caption">DRAW ONE · BUILD FOUNDATIONS ACE TO KING · TAP CARDS TO MOVE</div>
      </div>
      <aside className="game-aside">
        <div className="aside-overline">A LITTLE PATIENCE GOES A LONG WAY</div>
        <h2>{game.won ? 'You did it!' : foundationsDone + ' / 52 sorted'}</h2>
        <p className="game-message">{game.won ? 'All four foundations complete. Another peaceful round?' :
          selected ? 'Selected ' + selectedLabel + '. Choose a highlighted target.' :
          'Select a face-up card or draw from the stock. Work toward four full foundations.'}</p>
        <div className="stat-strip">
          <div><small>STOCK</small><strong>{game.stock.length}</strong></div>
          <div><small>FOUNDATIONS</small><strong>{foundationsDone}</strong></div>
          <div><small>MOVES</small><strong>{game.moves}</strong></div>
        </div>
        {hint && <p className="sol-hint-message">
          HINT: {hint.destination.zone === 'foundation' ? 'Move to the ' + hint.destination.suit + ' foundation.' :
          'Move to tableau column ' + (hint.destination.index + 1) + '.'}
        </p>}
        <div className="aside-controls">
          <button className="gold-button" onClick={newGame}>New shuffle ↺</button>
          <button className="quiet-button" onClick={undo} disabled={!history.length}>Undo last action</button>
          <button className="quiet-button" disabled={game.won} onClick={giveHint}>Show a legal move ✧</button>
          {selected && <button className="quiet-button" onClick={() => { setSelected(null); setHint(null); }}>Clear selection</button>}
        </div>
        <div className="how-to">
          <h3>At this table</h3>
          <p>Turn one stock card at a time. Put aces on their suit's foundation, then build upward to kings.</p>
          <p>On the tableau, stack cards in alternating colors, one rank lower each time. Only kings may start empty columns. Tap a face-up card, then tap its destination.</p>
          <p>Move valid sequences together. Empty stock? Tap the recycle symbol to go through the waste again. Unlimited redeals, no clock, no pressure.</p>
        </div>
      </aside>
    </div>
  </section>;
}
