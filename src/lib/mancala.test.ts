import { describe, expect, it } from 'vitest';
import {
  legalMancalaMoves, newMancalaGame, ownPits,
  playMancalaMove, storeScore, type MancalaGame,
} from './mancala';
import { chooseMancalaMove, type MancalaDifficulty } from './mancala-ai';

function custom(pits: number[], turn: MancalaGame['turn'] = 'ivory'): MancalaGame {
  return { ...newMancalaGame(), pits, turn, notice: 'Test position' };
}
function empty() { return Array<number>(14).fill(0); }
function total(game: MancalaGame): number {
  return game.pits.reduce((sum, seeds) => sum + seeds, 0);
}

describe('Kalah board and sowing', () => {
  it('starts with 48 stones, twelve pits and two empty stores', () => {
    const game = newMancalaGame();
    expect(game.pits).toHaveLength(14);
    expect(total(game)).toBe(48);
    expect(game.pits[6]).toBe(0);
    expect(game.pits[13]).toBe(0);
    expect(legalMancalaMoves(game)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ownPits('onyx')).toEqual([7, 8, 9, 10, 11, 12]);
  });
  it('sows counterclockwise, empties the picked pit and preserves all stones', () => {
    const game = newMancalaGame();
    const prior = JSON.stringify(game);
    const next = playMancalaMove(game, 0);
    expect(next.pits[0]).toBe(0);
    expect(next.pits.slice(1, 5)).toEqual([5, 5, 5, 5]);
    expect(next.turn).toBe('onyx');
    expect(total(next)).toBe(48);
    expect(JSON.stringify(game)).toBe(prior);
  });
  it('grants an extra turn for landing in one’s own store', () => {
    const game = newMancalaGame();
    const next = playMancalaMove(game, 2);
    expect(next.turn).toBe('ivory');
    expect(next.pits[6]).toBe(1);
    expect(next.extraTurns).toBe(1);
    expect(next.notice).toContain('Extra turn');
    expect(next.moveCount).toBe(1);
  });
  it('skips the opponent store for both players', () => {
    const pits = empty();
    pits[5] = 15;
    pits[7] = 1;
    const ivory = playMancalaMove(custom(pits), 5);
    expect(ivory.pits[13]).toBe(0);
    expect(total(ivory)).toBe(16);
    const onyxPits = empty();
    onyxPits[12] = 15;
    onyxPits[0] = 1;
    const onyx = playMancalaMove(custom(onyxPits, 'onyx'), 12);
    expect(onyx.pits[6]).toBe(0);
    expect(total(onyx)).toBe(16);
  });
  it('captures opposing stones only when last stone lands in own empty pit', () => {
    const pits = empty();
    pits[2] = 1;
    pits[3] = 0;
    pits[9] = 5; // opposite of Ivory pit 3
    pits[7] = 1;
    pits[4] = 1; // keep the Ivory side alive to test the capture notice
    const next = playMancalaMove(custom(pits), 2);
    expect(next.pits[6]).toBe(6);
    expect(next.pits[3]).toBe(0);
    expect(next.pits[9]).toBe(0);
    expect(next.notice).toContain('Capture');
    expect(total(next)).toBe(8);
  });
  it('does not capture on an empty opposite pit or an occupied own pit', () => {
    const pits = empty(); pits[2] = 1; pits[3] = 1; pits[7] = 1;
    const next = playMancalaMove(custom(pits), 2);
    expect(next.pits[6]).toBe(0);
    expect(next.pits[3]).toBe(2);
  });
  it('sweeps remaining stones and announces winner when one side empties', () => {
    const pits = empty();
    pits[5] = 1;
    pits[7] = 3;
    pits[12] = 2;
    const next = playMancalaMove(custom(pits), 5);
    expect(next.finished).toBe(true);
    expect(legalMancalaMoves(next)).toEqual([]);
    expect(next.pits[6]).toBe(1);
    expect(next.pits[13]).toBe(5);
    expect(next.winner).toBe('onyx');
    expect(total(next)).toBe(6);
    expect(playMancalaMove(next, 7)).toBe(next);
  });
  it('can finish with a tie and scores the correct stores', () => {
    const pits = empty();
    pits[5] = 1;
    pits[7] = 3;
    pits[6] = 6;
    pits[13] = 4;
    const next = playMancalaMove(custom(pits), 5);
    expect(next.finished).toBe(true);
    expect(storeScore(next, 'ivory')).toBe(7);
    expect(storeScore(next, 'onyx')).toBe(7);
    expect(next.winner).toBeNull();
    expect(next.notice).toContain('draw');
  });
  it('refuses nonexistent, wrong-player, store or empty pits', () => {
    const game = newMancalaGame();
    for (const pit of [-1, 6, 7, 13, 14, 99]) {
      expect(playMancalaMove(game, pit)).toBe(game);
    }
    const taken = playMancalaMove(game, 0);
    expect(playMancalaMove(taken, 0)).toBe(taken);
  });
});

describe('offline Mancala opponent', () => {
  const levels: MancalaDifficulty[] = ['easy', 'medium', 'hard'];
  it.each(levels)('%s selects a legal move without mutating state', (difficulty) => {
    const game = { ...newMancalaGame(), turn: 'onyx' as const };
    const original = JSON.stringify(game);
    const move = chooseMancalaMove(game, difficulty);
    expect(move).not.toBeNull();
    expect(legalMancalaMoves(game)).toContain(move);
    expect(JSON.stringify(game)).toBe(original);
  });
  it('uses an extra turn when the move is profitable', () => {
    const game = { ...newMancalaGame(), turn: 'onyx' as const };
    const move = chooseMancalaMove(game, 'easy')!;
    expect(legalMancalaMoves(game)).toContain(move);
    const next = playMancalaMove(game, move);
    expect(total(next)).toBe(48);
  });
  it('returns null for finished or unplayable positions', () => {
    const game = newMancalaGame();
    expect(chooseMancalaMove({ ...game, finished: true }, 'hard')).toBeNull();
  });
});
