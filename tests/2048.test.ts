import { describe, expect, test, vi } from 'vitest';
import { applyMove, canMove, createInitialState, moveBoard, spawnTile, isTile, validateSave, type State2048 } from '../src/games/2048/logic';
const board = (row: number[]) => [...row, ...Array<number>(12).fill(0)];
const state = (values: number[]): State2048 => ({ version: 1, status: canMove(values) ? 'active' : 'completed', board: values, score: 0, moves: 0 });

describe('2048 rules', () => {
  test('starts with exactly two different positions; rng order is position then value', () => {
    const values = [.0, .899999, .9999, .9]; const rng = vi.fn(() => values.shift()!);
    const game = createInitialState(rng);
    expect(game.board).toEqual([2,...Array(14).fill(0),4]); expect(rng).toHaveBeenCalledTimes(4); expect(validateSave(game)).toBe(true);
  });
  test.each([
    [[2,0,2,0],[4,0,0,0],4], [[2,2,2,0],[4,2,0,0],4], [[2,2,2,2],[4,4,0,0],8],
    [[2,2,4,0],[4,4,0,0],4], [[4,4,8,8],[8,16,0,0],24], [[4,0,4,8],[8,8,0,0],8],
  ])('left merges %j once into %j', (input, output, points) => {
    const original=board(input as number[]); const moved=moveBoard(original,'left');
    expect(moved.board.slice(0,4)).toEqual(output); expect(moved.scoreDelta).toBe(points); expect(original).toEqual(board(input as number[]));
    const sources=moved.merges.flatMap(m=>m.from);expect(new Set(sources).size).toBe(sources.length);
  });
  test('opposite directions transform the input, not just the output', () => {
    const input=board([2,2,4,4]);expect(moveBoard(input,'left').board.slice(0,4)).toEqual([4,8,0,0]);expect(moveBoard(input,'right').board.slice(0,4)).toEqual([0,0,4,8]);
    const reversed=board([4,4,2,2]);expect(moveBoard(reversed,'left').board.slice(0,4).reverse()).toEqual(moveBoard(input,'right').board.slice(0,4));
  });
  test('up/down share rules; moving alone does not award points', () => {
    const input=[2,0,0,0,2,0,0,0,4,0,0,0,4,0,0,0];
    expect(moveBoard(input,'up').board).toEqual([4,0,0,0,8,0,0,0,...Array(8).fill(0)]);
    expect(moveBoard(input,'down').board).toEqual([...Array(8).fill(0),4,0,0,0,8,0,0,0]);
    expect(moveBoard(board([0,2,0,4]),'left').scoreDelta).toBe(0);
  });
  test('a no-op is the same state, never spawns or consumes randomness', () => {
    const s=state(board([2,4,2,4])),rng=vi.fn(()=>0);const moved=applyMove(s,'left',rng);
    expect(moved.changed).toBe(false);expect(moved.state).toBe(s);expect(rng).not.toHaveBeenCalled();
  });
  test('a changed move spawns once and scores merges only; 2048 continues', () => {
    const s=state(board([1024,1024,0,0])),rng=vi.fn(()=>0);const moved=applyMove(s,'left',rng);
    expect(moved.state.board.slice(0,4)).toEqual([2048,2,0,0]);expect(moved.state.score).toBe(2048);expect(moved.state.status).toBe('active');expect(moved.state.moves).toBe(1);expect(rng).toHaveBeenCalledTimes(2);
    expect(s.board).toEqual(board([1024,1024,0,0]));expect(validateSave(moved.state)).toBe(true);
  });
  test('spawn only uses empty cells, including the last free position', () => {
    const full=Array(16).fill(2);const rng=vi.fn(()=>0);expect(spawnTile(full,rng).spawn).toBeNull();expect(rng).not.toHaveBeenCalled();
    full[12]=0;expect(spawnTile(full,()=>.99).spawn).toEqual({index:12,value:4});
  });
  test('a full board ends only when no adjacent equal pair remains', () => {
    const values=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];expect(canMove(values)).toBe(false);
    const completed=state(values),rng=vi.fn();expect(applyMove(completed,'up',rng).state).toBe(completed);expect(rng).not.toHaveBeenCalled();
    values[0]=4;expect(canMove(values)).toBe(true);values[0]=0;expect(canMove(values)).toBe(true);expect(canMove(Array(16).fill(0))).toBe(false);
  });
  test('invalid, empty, foreign or inconsistent saves are rejected', () => {
    const good=createInitialState(()=>.5);
    for(const bad of [null,{}, {...good,version:2},{...good,board:Array(16).fill(0)},{...good,board:[2,4]}, {...good,board:[3,...good.board.slice(1)]}, {...good,score:-1},{...good,moves:.5},{...good,status:'completed'},{...good,board:[Infinity,...good.board.slice(1)]}])expect(validateSave(bad)).toBe(false);
  });
  test('large safe tiles are powers of two, not rounded logarithms', () => {
    expect(isTile(2 ** 52)).toBe(true);expect(isTile(2 ** 52 - 1)).toBe(false);expect(isTile(2 ** 52 + 1)).toBe(false);expect(isTile(2 ** 53)).toBe(false);
  });
  test('seeded legal play conserves existing tile mass and remains valid', () => {
    let seed=17; const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};let s=createInitialState(rng);
    for(let n=0;n<600&&s.status==='active';n++) {
      const before=s.board.reduce((a,b)=>a+b,0);const dir=(['left','up','right','down'] as const)[n%4];const result=applyMove(s,dir,rng);
      expect(result.state.board.reduce((a,b)=>a+b,0)).toBe(before+(result.spawn?.value??0));expect(result.state.score).toBe(s.score+result.scoreDelta);expect(validateSave(result.state)).toBe(true);s=result.state;
    }
  });
});
