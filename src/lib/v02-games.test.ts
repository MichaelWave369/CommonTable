import { describe, expect, it } from 'vitest';
import {
  canPlay, doubleSixSet, drawDomino, ends, newDominoGame, passDomino,
  playDomino, playableSides, remainingPips, type DominoGame,
} from './dominoes';
import {
  canMoveKlondike, drawKlondike, fullDeck, hintKlondike,
  moveKlondike, newKlondikeGame, type KlondikeGame,
} from './solitaire';

describe('Double-six draw dominoes', () => {
  it('deals 28 unique tiles, 7 each, and 14 in the boneyard', () => {
    const game = newDominoGame(() => 0.3);
    expect(doubleSixSet()).toHaveLength(28);
    expect(new Set(doubleSixSet().map((tile) => tile.id)).size).toBe(28);
    expect(game.hands.map((hand) => hand.length)).toEqual([7, 7]);
    expect(game.stock).toHaveLength(14);
    expect(game.turn).toBe(0);
    expect(canPlay(game)).toBe(true);
  });

  it('joins the correct pips on either side and rejects illegal moves', () => {
    const game: DominoGame = {
      hands: [[{ id: 1, a: 2, b: 5 }], [{ id: 2, a: 1, b: 6 }]],
      stock: [], chain: [{ id: 3, a: 5, b: 6 }],
      turn: 0, consecutivePasses: 0, winner: null, ended: false,
    };
    expect(playableSides(game, game.hands[0][0])).toEqual(['left']);
    expect(playDomino(game, 1, 'right')).toBe(game);
    const next = playDomino(game, 1, 'left');
    expect(next.chain.map((tile) => [tile.a, tile.b])).toEqual([[2, 5], [5, 6]]);
    expect(ends(next)).toEqual({ left: 2, right: 6 });
    expect(next.winner).toBe(0);
    expect(next.ended).toBe(true);
  });

  it('draws only when unable to play and passes only when the boneyard is empty', () => {
    const game: DominoGame = {
      hands: [[{ id: 0, a: 0, b: 0 }], [{ id: 1, a: 2, b: 2 }]],
      stock: [{ id: 4, a: 4, b: 4 }],
      chain: [{ id: 2, a: 1, b: 1 }],
      turn: 0, consecutivePasses: 0, winner: null, ended: false,
    };
    expect(canPlay(game)).toBe(false);
    expect(passDomino(game)).toBe(game);
    const drawn = drawDomino(game);
    expect(drawn.stock).toHaveLength(0);
    expect(drawn.hands[0]).toHaveLength(2);
    expect(passDomino(drawn).turn).toBe(1);
  });

  it('awards a blocked game to the lower pip count or draws on a tie', () => {
    const game: DominoGame = {
      hands: [[{ id: 0, a: 0, b: 1 }], [{ id: 1, a: 2, b: 2 }]],
      stock: [], chain: [{ id: 2, a: 6, b: 6 }],
      turn: 0, consecutivePasses: 0, winner: null, ended: false,
    };
    const passed = passDomino(game);
    expect(passed.turn).toBe(1);
    const over = passDomino(passed);
    expect(over.ended).toBe(true);
    expect(over.winner).toBe(0);
    expect(remainingPips(game.hands[1])).toBe(4);
  });
});

describe('Klondike draw-one solitaire', () => {
  it('creates a 52-card unique deck, seven columns, and 24-card stock', () => {
    const game = newKlondikeGame(() => 0.5);
    expect(fullDeck()).toHaveLength(52);
    expect(new Set(fullDeck().map((card) => card.id)).size).toBe(52);
    expect(game.tableau.map((pile) => pile.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(game.tableau.every((pile) => pile.filter((card) => card.faceUp).length === 1)).toBe(true);
    expect(game.stock).toHaveLength(24);
  });

  it('draws cards and recycles waste in draw order', () => {
    let game = newKlondikeGame(() => 0.5);
    const lastTwo = game.stock.slice(-2).map((c) => c.id).reverse();
    game = drawKlondike(game);
    game = drawKlondike(game);
    expect(game.waste.map((c) => c.id)).toEqual(lastTwo);
    const onlyWaste: KlondikeGame = { ...game, stock: [] };
    const recycled = drawKlondike(onlyWaste);
    expect(recycled.waste).toHaveLength(0);
    expect(recycled.stock.map((c) => c.id)).toEqual([...lastTwo].reverse());
    expect(drawKlondike(recycled).waste[0].id).toBe(lastTwo[0]);
  });

  it('moves aces to foundations and reveals covered cards after tableau moves', () => {
    const game = newKlondikeGame(() => 0.5);
    const ace = { id: 'hearts-1', suit: 'hearts' as const, rank: 1, faceUp: true };
    const two = { id: 'clubs-2', suit: 'clubs' as const, rank: 2, faceUp: true };
    const covered = { id: 'spades-7', suit: 'spades' as const, rank: 7, faceUp: false };
    const test: KlondikeGame = {
      ...game, waste: [ace],
      tableau: [[covered, two], [{ id: 'diamonds-3', suit: 'diamonds', rank: 3, faceUp: true }], [], [], [], [], []],
    };
    expect(canMoveKlondike(test, { zone: 'waste' }, { zone: 'foundation', suit: 'hearts' })).toBe(true);
    const placed = moveKlondike(test, { zone: 'waste' }, { zone: 'foundation', suit: 'hearts' });
    expect(placed.foundations.hearts).toHaveLength(1);
    expect(placed.waste).toHaveLength(0);
    const moved = moveKlondike(placed,
      { zone: 'tableau', index: 0, cardIndex: 1 }, { zone: 'tableau', index: 1 });
    expect(moved.tableau[0][0].faceUp).toBe(true);
    expect(moved.tableau[1].map((c) => c.rank)).toEqual([3, 2]);
    expect(hintKlondike(moved)).not.toBeNull();
  });

  it('rejects invalid builds and only allows kings onto empty columns', () => {
    const game = newKlondikeGame(() => 0.5);
    const card = { id: 'clubs-7', suit: 'clubs' as const, rank: 7, faceUp: true };
    const test: KlondikeGame = { ...game, waste: [card], tableau: [[], [], [], [], [], [], []] };
    expect(canMoveKlondike(test, { zone: 'waste' }, { zone: 'tableau', index: 0 })).toBe(false);
    const king: KlondikeGame = {
      ...test, waste: [{ id: 'clubs-13', suit: 'clubs', rank: 13, faceUp: true }],
    };
    expect(canMoveKlondike(king, { zone: 'waste' }, { zone: 'tableau', index: 0 })).toBe(true);
    expect(moveKlondike(test, { zone: 'waste' }, { zone: 'tableau', index: 0 })).toBe(test);
  });
});
