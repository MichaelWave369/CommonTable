export type MahjongTile = {
  id: string;
  row: number;
  col: number;
  layer: number;
  face: string;
};
type Slot = Omit<MahjongTile, 'face'>;
const suits = ['B', 'C', 'D'] as const;
export const FACES = suits.flatMap((suit) => Array.from({ length: 6 }, (_, i) => suit + (i + 1)));

export function gardenSlots(): Slot[] {
  const slots: Slot[] = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 9; col++) {
      slots.push({ id: 'base-' + row + '-' + col, row, col, layer: 0 });
    }
  }
  for (let row = 1; row <= 3; row++) {
    for (let col = 2; col <= 7; col++) {
      slots.push({ id: 'top-' + row + '-' + col, row, col, layer: 1 });
    }
  }
  return slots;
}

export function isFree(tiles: MahjongTile[], tile: MahjongTile): boolean {
  if (!tiles.some((t) => t.id === tile.id)) return false;
  if (tiles.some((t) => t.layer > tile.layer && t.row === tile.row && t.col === tile.col)) return false;
  const left = tiles.some((t) => t.layer === tile.layer && t.row === tile.row && t.col === tile.col - 1);
  const right = tiles.some((t) => t.layer === tile.layer && t.row === tile.row && t.col === tile.col + 1);
  return !left || !right;
}

export function availablePairs(tiles: MahjongTile[]): [MahjongTile, MahjongTile][] {
  const free = tiles.filter((tile) => isFree(tiles, tile));
  const matches: [MahjongTile, MahjongTile][] = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (free[i].face === free[j].face) matches.push([free[i], free[j]]);
    }
  }
  return matches;
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A verified geometric removal order: uncover the upper tier, peel both ends
// of each base row, then remove the six exposed center tiles in pairs.
// Each entry is a pair of simultaneously free positions.
function canonicalRemovalPairs(): [Slot, Slot][] {
  const slots = gardenSlots();
  const by = (layer: number, row: number, col: number): Slot => {
    const tile = slots.find((slot) => slot.layer === layer && slot.row === row && slot.col === col);
    if (!tile) throw new Error('Invalid Garden position');
    return tile;
  };
  const pairs: [Slot, Slot][] = [];
  for (let row = 1; row <= 3; row++) {
    for (let edge = 0; edge < 3; edge++) {
      pairs.push([by(1, row, 2 + edge), by(1, row, 7 - edge)]);
    }
  }
  for (let row = 0; row < 6; row++) {
    for (let edge = 0; edge < 4; edge++) {
      pairs.push([by(0, row, edge), by(0, row, 8 - edge)]);
    }
  }
  for (let row = 0; row < 6; row += 2) {
    pairs.push([by(0, row, 4), by(0, row + 1, 4)]);
  }
  return pairs;
}
const REMOVAL_PAIRS = canonicalRemovalPairs();

function dealOnPairs(pairs: [Slot, Slot][], pairFaces: string[]): MahjongTile[] {
  if (pairs.length !== pairFaces.length) throw new Error('Expected one face for every pair');
  const assignments = new Map<string, string>();
  shuffled(pairFaces).forEach((face, i) => {
    const [a, b] = pairs[i];
    assignments.set(a.id, face);
    assignments.set(b.id, face);
  });
  // Rendering order remains bottom tier first, top tier second.
  return gardenSlots()
    .filter((slot) => assignments.has(slot.id))
    .map((slot) => ({ ...slot, face: assignments.get(slot.id)! }));
}

export function newMahjongGame(): MahjongTile[] {
  return dealOnPairs(REMOVAL_PAIRS, FACES.flatMap((face) => [face, face]));
}

export function shuffleRemaining(tiles: MahjongTile[]): MahjongTile[] {
  if (tiles.length === 0) return tiles;
  const counts = new Map<string, number>();
  for (const tile of tiles) counts.set(tile.face, (counts.get(tile.face) || 0) + 1);
  if ([...counts.values()].some((count) => count % 2 !== 0)) return tiles;
  const pairFaces = [...counts.entries()].flatMap(([face, count]) => Array(count / 2).fill(face) as string[]);
  // A face-only shuffle cannot repair an isolated vertical stack, where just
  // one tile is free. Re-deal all remaining tiles into a safe Garden shape.
  // Face multiplicities, remaining tile count and progress are preserved.
  const pairs = REMOVAL_PAIRS.slice(REMOVAL_PAIRS.length - pairFaces.length);
  return dealOnPairs(pairs, pairFaces);
}

export function removePair(tiles: MahjongTile[], aId: string, bId: string): MahjongTile[] {
  if (aId === bId) return tiles;
  const a = tiles.find((tile) => tile.id === aId);
  const b = tiles.find((tile) => tile.id === bId);
  if (!a || !b || a.face !== b.face || !isFree(tiles, a) || !isFree(tiles, b)) return tiles;
  return tiles.filter((tile) => tile.id !== aId && tile.id !== bId);
}
