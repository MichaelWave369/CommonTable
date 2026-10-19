import { describe, expect, it } from 'vitest';
import {
  applyBackgammonMove, legalBackgammonMoves, newBackgammonGame,
  rollBackgammon, type BGGame,
} from './backgammon';
import { applyMove, legalMoves, newCheckersGame } from './checkers';

function position(input: Partial<BGGame> & { points?: number[] } = {}): BGGame {
  return {
    ...newBackgammonGame(),
    points: Array(24).fill(0),
    turn: 'ivory', phase: 'move', dice: [1], ...input,
  };
}

describe('backgammon v0.5', () => {
  it('starts with fifteen pieces per player and twenty-four points', () => {
    const game = newBackgammonGame();
    expect(game.points).toHaveLength(24);
    expect(game.points.filter((x) => x > 0).reduce((a, b) => a + b, 0)).toBe(15);
    expect(game.points.filter((x) => x < 0).reduce((a, b) => a - b, 0)).toBe(15);
    expect(game.phase).toBe('roll');
    expect(game.turn).toBe('ivory');
  });
  it('rolls two different dice or four equal dice', () => {
    const game = newBackgammonGame();
    const regular = rollBackgammon(game, [2, 5]);
    expect(regular.dice).toEqual([2, 5]);
    expect(regular.phase).toBe('move');
    const doubles = rollBackgammon(game, [3, 3]);
    expect(doubles.dice).toEqual([3, 3, 3, 3]);
    expect(rollBackgammon(regular, [1, 1])).toBe(regular);
  });
  it('enforces entering from the bar first, hitting blots', () => {
    const points = Array<number>(24).fill(0);
    points[21] = -1;
    points[2] = 1;
    const game = position({ points, bar: { ivory: 1, onyx: 0 }, dice: [3] });
    const moves = legalBackgammonMoves(game);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ from: 'bar', to: 21, die: 3, hit: true });
    const next = applyBackgammonMove(game, moves[0]);
    expect(next.points[21]).toBe(1);
    expect(next.bar).toEqual({ ivory: 0, onyx: 1 });
    expect(next.turn).toBe('onyx');
  });
  it('will not land on two or more opposing checkers', () => {
    const points = Array<number>(24).fill(0);
    points[7] = 1; points[6] = -2;
    const game = position({ points, dice: [1] });
    expect(legalBackgammonMoves(game)).toHaveLength(0);
  });
  it('requires moves preserving the maximum number of dice', () => {
    const points = Array<number>(24).fill(0);
    points[6] = 1; points[5] = -2;
    const game = position({ points, dice: [1, 2] });
    // A move of two to point 5 (index 4) permits the one afterward.
    const moves = legalBackgammonMoves(game);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => move.die === 2)).toBe(true);
    const next = applyBackgammonMove(game, moves[0]);
    expect(next.dice).toEqual([1]);
    expect(next.turn).toBe('ivory');
  });
  it('forces the higher die when only one of two dice can be used', () => {
    const points = Array<number>(24).fill(0);
    points[5] = 1; points[4] = -2;
    const game = position({ points, dice: [1, 6] });
    const moves = legalBackgammonMoves(game);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ from: 5, to: 'off', die: 6 });
  });
  it('cannot bear off before every checker reaches home', () => {
    const points = Array<number>(24).fill(0);
    points[3] = 1; points[7] = 1;
    const game = position({ points, dice: [4] });
    expect(legalBackgammonMoves(game).some((move) => move.to === 'off')).toBe(false);
  });
  it('permits exact bearing off and oversized dice from the furthest point', () => {
    const points = Array<number>(24).fill(0);
    points[0] = 1; points[3] = 1;
    const game = position({ points, dice: [6] });
    const moves = legalBackgammonMoves(game);
    expect(moves.filter((move) => move.to === 'off')).toMatchObject([{ from: 3, to: 'off', die: 6, hit: false }]);
    const exact = position({ points: points.map((value, index) => index === 3 ? 0 : value), dice: [1] });
    expect(legalBackgammonMoves(exact)).toMatchObject([{ from: 0, to: 'off', die: 1, hit: false }]);
  });
  it('marks the winner when fifteen checkers have borne off', () => {
    const points = Array<number>(24).fill(0); points[0] = 1;
    const game = position({ points, off: { ivory: 14, onyx: 0 } });
    const next = applyBackgammonMove(game, legalBackgammonMoves(game)[0]);
    expect(next.winner).toBe('ivory');
    expect(next.off.ivory).toBe(15);
    expect(next.phase).toBe('finished');
    expect(next.dice).toHaveLength(0);
  });
  it('supports Onyx moving the opposite way and bearing off', () => {
    const points = Array<number>(24).fill(0); points[23] = -1;
    const game = position({ points, turn: 'onyx', off: { ivory: 0, onyx: 14 } });
    const moves = legalBackgammonMoves(game);
    expect(moves).toMatchObject([{ from: 23, to: 'off', die: 1, hit: false }]);
    expect(applyBackgammonMove(game, moves[0]).winner).toBe('onyx');
  });
  it('automatically passes when the bar is blocked on all dice', () => {
    const points = Array<number>(24).fill(0);
    for (let point = 18; point < 24; point++) points[point] = -2;
    const game = position({ points, bar: { ivory: 1, onyx: 0 }, phase: 'roll', dice: [] });
    const next = rollBackgammon(game, [1, 2]);
    expect(next.phase).toBe('roll');
    expect(next.turn).toBe('onyx');
    expect(next.dice).toHaveLength(0);
  });
  it('rejects a move when no matching die or point exists', () => {
    const game = position({ points: Array<number>(24).fill(0).map((_, i) => i === 7 ? 1 : 0) });
    const before = JSON.stringify(game);
    expect(applyBackgammonMove(game, { from: 7, to: 0, die: 5, hit: false })).toBe(game);
    expect(JSON.stringify(game)).toBe(before);
  });
});

describe('crowned checkers keep playing normally', () => {
  it('allows backwards moves after crowning without changing board dimensions', () => {
    const opening = newCheckersGame();
    const board = opening.board.map((line) => line.map(() => null)) as typeof opening.board;
    board[1][2] = { player: 'ivory', king: false };
    board[6][5] = { player: 'ember', king: false };
    const start = { ...opening, board };
    const crown = applyMove(start, { from: { row: 1, col: 2 }, to: { row: 0, col: 1 } });
    expect(crown.board).toHaveLength(8);
    expect(crown.board.every((line) => line.length === 8)).toBe(true);
    expect(crown.board[0][1]?.king).toBe(true);
    const returned = applyMove(crown, legalMoves(crown)[0]);
    expect(returned.turn).toBe('ivory');
    expect(legalMoves(returned).some((move) => move.from.row === 0 && move.to.row === 1)).toBe(true);
  });
});
