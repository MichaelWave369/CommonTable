export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export type PlayingCard = {
  id: string;
  suit: Suit;
  rank: number;
  faceUp: boolean;
};
export type KlondikeGame = {
  stock: PlayingCard[];
  waste: PlayingCard[];
  tableau: PlayingCard[][];
  foundations: Record<Suit, PlayingCard[]>;
  moves: number;
  won: boolean;
};
export type CardSource =
  | { zone: 'waste' }
  | { zone: 'tableau'; index: number; cardIndex: number }
  | { zone: 'foundation'; suit: Suit };
export type CardDestination =
  | { zone: 'tableau'; index: number }
  | { zone: 'foundation'; suit: Suit };

const red = (suit: Suit) => suit === 'hearts' || suit === 'diamonds';

export function fullDeck(): PlayingCard[] {
  return SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, i) => ({
    id: suit + '-' + (i + 1), suit, rank: i + 1, faceUp: false,
  })));
}

export function newKlondikeGame(rng: () => number = Math.random): KlondikeGame {
  const deck = fullDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tableau: PlayingCard[][] = [];
  for (let col = 0; col < 7; col++) {
    const pile: PlayingCard[] = [];
    for (let row = 0; row <= col; row++) {
      const card = deck.pop()!;
      pile.push({ ...card, faceUp: row === col });
    }
    tableau.push(pile);
  }
  return {
    stock: deck, waste: [], tableau,
    foundations: { spades: [], hearts: [], diamonds: [], clubs: [] },
    moves: 0, won: false,
  };
}

export function drawKlondike(game: KlondikeGame): KlondikeGame {
  if (game.won) return game;
  if (game.stock.length) {
    const stock = [...game.stock];
    const next = stock.pop()!;
    return {
      ...game, stock, waste: [...game.waste, { ...next, faceUp: true }],
      moves: game.moves + 1,
    };
  }
  if (game.waste.length) {
    return {
      ...game,
      stock: [...game.waste].reverse().map((card) => ({ ...card, faceUp: false })),
      waste: [],
      moves: game.moves + 1,
    };
  }
  return game;
}

function movingCards(game: KlondikeGame, source: CardSource): PlayingCard[] {
  if (source.zone === 'waste') {
    return game.waste.length ? [game.waste[game.waste.length - 1]] : [];
  }
  if (source.zone === 'foundation') {
    const pile = game.foundations[source.suit];
    return pile.length ? [pile[pile.length - 1]] : [];
  }
  const pile = game.tableau[source.index];
  if (!pile || source.cardIndex < 0 || source.cardIndex >= pile.length) return [];
  const cards = pile.slice(source.cardIndex);
  if (!cards.every((c) => c.faceUp)) return [];
  for (let i = 1; i < cards.length; i++) {
    if (cards[i - 1].rank !== cards[i].rank + 1 ||
        red(cards[i - 1].suit) === red(cards[i].suit)) return [];
  }
  return cards;
}

export function canMoveKlondike(
  game: KlondikeGame, source: CardSource, destination: CardDestination,
): boolean {
  if (game.won) return false;
  const moving = movingCards(game, source);
  if (!moving.length) return false;
  if (destination.zone === 'foundation') {
    if (moving.length !== 1 || source.zone === 'foundation') return false;
    const card = moving[0];
    const pile = game.foundations[destination.suit];
    return card.suit === destination.suit && card.rank === pile.length + 1;
  }
  if (source.zone === 'tableau' && source.index === destination.index) return false;
  const dest = game.tableau[destination.index];
  if (!dest) return false;
  const card = moving[0];
  if (!dest.length) return card.rank === 13;
  const top = dest[dest.length - 1];
  return top.faceUp && top.rank === card.rank + 1 && red(top.suit) !== red(card.suit);
}

export function moveKlondike(
  game: KlondikeGame, source: CardSource, destination: CardDestination,
): KlondikeGame {
  if (!canMoveKlondike(game, source, destination)) return game;
  const cards = movingCards(game, source);
  const tableau = game.tableau.map((pile) => pile.map((card) => ({ ...card })));
  const foundations: KlondikeGame['foundations'] = {
    spades: [...game.foundations.spades], hearts: [...game.foundations.hearts],
    diamonds: [...game.foundations.diamonds], clubs: [...game.foundations.clubs],
  };
  let waste = [...game.waste];
  if (source.zone === 'waste') waste = waste.slice(0, -1);
  if (source.zone === 'foundation') foundations[source.suit].pop();
  if (source.zone === 'tableau') {
    tableau[source.index] = tableau[source.index].slice(0, source.cardIndex);
    const rest = tableau[source.index];
    if (rest.length) rest[rest.length - 1].faceUp = true;
  }
  if (destination.zone === 'tableau') tableau[destination.index].push(...cards);
  else foundations[destination.suit].push(cards[0]);
  const won = SUITS.every((suit) => foundations[suit].length === 13);
  return { ...game, tableau, foundations, waste, moves: game.moves + 1, won };
}

export function hintKlondike(game: KlondikeGame):
  { source: CardSource; destination: CardDestination } | null {
  const sources: CardSource[] = [
    ...game.tableau.flatMap((pile, index): CardSource[] =>
      pile.flatMap((card, cardIndex): CardSource[] =>
        card.faceUp ? [{ zone: 'tableau', index, cardIndex }] : [])),
    { zone: 'waste' },
  ];
  for (const source of sources) {
    for (const suit of SUITS) {
      const destination: CardDestination = { zone: 'foundation', suit };
      if (canMoveKlondike(game, source, destination)) return { source, destination };
    }
    for (let index = 0; index < 7; index++) {
      const destination: CardDestination = { zone: 'tableau', index };
      if (canMoveKlondike(game, source, destination)) {
        // Moving a full King stack between two empty columns accomplishes nothing.
        if (source.zone === 'tableau' && game.tableau[index].length === 0 &&
            source.cardIndex === 0 && game.tableau[source.index].length ===
            game.tableau[source.index].filter((card) => card.faceUp).length) continue;
        return { source, destination };
      }
    }
  }
  return null;
}
