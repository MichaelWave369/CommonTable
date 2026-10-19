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

// Assign matching faces in an order that can always be removed from an
// unplayed layout. A different sequence of player matches may still require a shuffle.
function assignSolvable(slots: Slot[], pairFaces: string[]): MahjongTile[] {
  const remaining: MahjongTile[] = slots.map((slot) => ({ ...slot, face: '' }));
  const byId = new Map<string, string>();
  for (const face of shuffled(pairFaces)) {
    const free = shuffled(remaining.filter((tile) => isFree(remaining, tile)));
    if (free.length < 2) throw new Error('Garden layout has no removal path');
    for (const tile of free.slice(0, 2)) {
      byId.set(tile.id, face);
      remaining.splice(remaining.findIndex((t) => t.id === tile.id), 1);
    }
  }
  return slots.map((slot) => ({ ...slot, face: byId.get(slot.id)! }));
}

export function newMahjongGame(): MahjongTile[] {
  return assignSolvable(gardenSlots(), FACES.flatMap((face) => [face, face]));
}

export function shuffleRemaining(tiles: MahjongTile[]): MahjongTile[] {
  const counts = new Map<string, number>();
  for (const tile of tiles) counts.set(tile.face, (counts.get(tile.face) || 0) + 1);
  if ([...counts.values()].some((count) => count % 2 !== 0)) return tiles;
  const pairFaces = [...counts.entries()].flatMap(([face, count]) => Array(count / 2).fill(face) as string[]);
  return assignSolvable(tiles.map(({ id, row, col, layer }) => ({ id, row, col, layer })), pairFaces);
}

export function removePair(tiles: MahjongTile[], aId: string, bId: string): MahjongTile[] {
  if (aId === bId) return tiles;
  const a = tiles.find((tile) => tile.id === aId);
  const b = tiles.find((tile) => tile.id === bId);
  if (!a || !b || a.face !== b.face || !isFree(tiles, a) || !isFree(tiles, b)) return tiles;
  return tiles.filter((tile) => tile.id !== aId && tile.id !== bId);
}
