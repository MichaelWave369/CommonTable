export type DominoPlayer = 0 | 1;
export type DominoTile = { id: number; a: number; b: number };
export type DominoSide = 'left' | 'right';
export type DominoGame = {
  hands: [DominoTile[], DominoTile[]];
  stock: DominoTile[];
  chain: DominoTile[];
  turn: DominoPlayer;
  consecutivePasses: number;
  winner: DominoPlayer | null;
  ended: boolean;
};

export function other(player: DominoPlayer): DominoPlayer {
  return player === 0 ? 1 : 0;
}

export function doubleSixSet(): DominoTile[] {
  const tiles: DominoTile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push({ id: tiles.length, a, b });
    }
  }
  return tiles;
}

export function newDominoGame(rng: () => number = Math.random): DominoGame {
  const deck = doubleSixSet();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return {
    hands: [deck.slice(0, 7), deck.slice(7, 14)],
    stock: deck.slice(14),
    chain: [],
    turn: 0,
    consecutivePasses: 0,
    winner: null,
    ended: false,
  };
}

export function ends(game: DominoGame): { left: number; right: number } | null {
  if (!game.chain.length) return null;
  return { left: game.chain[0].a, right: game.chain[game.chain.length - 1].b };
}

export function playableSides(game: DominoGame, tile: DominoTile): DominoSide[] {
  if (game.ended) return [];
  const open = ends(game);
  if (!open) return ['left', 'right'];
  const sides: DominoSide[] = [];
  if (tile.a === open.left || tile.b === open.left) sides.push('left');
  if (tile.a === open.right || tile.b === open.right) sides.push('right');
  return sides;
}

export function canPlay(game: DominoGame, player: DominoPlayer = game.turn): boolean {
  return !game.ended && game.hands[player].some((tile) => playableSides(game, tile).length > 0);
}

export function playDomino(game: DominoGame, tileId: number, side: DominoSide): DominoGame {
  if (game.ended) return game;
  const tile = game.hands[game.turn].find((t) => t.id === tileId);
  if (!tile || !playableSides(game, tile).includes(side)) return game;
  const open = ends(game);
  let placed: DominoTile;
  if (!open) {
    placed = { ...tile };
  } else if (side === 'left') {
    // Newly placed right pip must join the current left end.
    placed = tile.b === open.left ? { ...tile } : { ...tile, a: tile.b, b: tile.a };
  } else {
    // Newly placed left pip must join the current right end.
    placed = tile.a === open.right ? { ...tile } : { ...tile, a: tile.b, b: tile.a };
  }
  const hands: [DominoTile[], DominoTile[]] = [
    [...game.hands[0]], [...game.hands[1]],
  ];
  hands[game.turn] = hands[game.turn].filter((t) => t.id !== tileId);
  const chain = side === 'left' ? [placed, ...game.chain] : [...game.chain, placed];
  const won = hands[game.turn].length === 0;
  return {
    ...game, hands, chain, turn: won ? game.turn : other(game.turn),
    consecutivePasses: 0, winner: won ? game.turn : null, ended: won,
  };
}

export function drawDomino(game: DominoGame): DominoGame {
  if (game.ended || canPlay(game) || game.stock.length === 0) return game;
  const stock = [...game.stock];
  const drawn = stock.pop()!;
  const hands: [DominoTile[], DominoTile[]] = [
    [...game.hands[0]], [...game.hands[1]],
  ];
  hands[game.turn].push(drawn);
  return { ...game, stock, hands, consecutivePasses: 0 };
}

export function remainingPips(hand: DominoTile[]): number {
  return hand.reduce((sum, tile) => sum + tile.a + tile.b, 0);
}

export function passDomino(game: DominoGame): DominoGame {
  if (game.ended || canPlay(game) || game.stock.length > 0) return game;
  const consecutivePasses = game.consecutivePasses + 1;
  if (consecutivePasses < 2) {
    return { ...game, consecutivePasses, turn: other(game.turn) };
  }
  const a = remainingPips(game.hands[0]);
  const b = remainingPips(game.hands[1]);
  const winner: DominoPlayer | null = a === b ? null : a < b ? 0 : 1;
  return { ...game, consecutivePasses, ended: true, winner };
}
