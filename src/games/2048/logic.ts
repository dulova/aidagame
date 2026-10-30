export const SAVE_VERSION = 1;
export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export type Direction = typeof DIRECTIONS[number];
export interface State2048 {
  version: 1;
  status: 'active' | 'completed';
  board: number[];
  score: number;
  moves: number;
}
export interface Motion { from: number; to: number; value: number }
export interface Merge { from: [number, number]; to: number; value: number }
export interface Spawn { index: number; value: number }
export interface BoardMove { board: number[]; changed: boolean; scoreDelta: number; movements: Motion[]; merges: Merge[] }
export interface Move2048 extends BoardMove { state: State2048; spawn: Spawn | null }

export function isTile(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 2 && /^10+$/.test(value.toString(2));
}
export function canMove(board: number[]): boolean {
  if (!board.some(value => value !== 0)) return false;
  if (board.includes(0)) return true;
  return board.some((value, i) => (i % 4 < 3 && value === board[i + 1]) || (i < 12 && value === board[i + 4]));
}
function indices(direction: Direction, line: number): number[] {
  return Array.from({ length: 4 }, (_, n) => {
    if (direction === 'left') return line * 4 + n;
    if (direction === 'right') return line * 4 + 3 - n;
    if (direction === 'up') return n * 4 + line;
    return (3 - n) * 4 + line;
  });
}
export function moveBoard(board: number[], direction: Direction): BoardMove {
  const next = Array<number>(16).fill(0), movements: Motion[] = [], merges: Merge[] = [];
  let scoreDelta = 0;
  for (let line = 0; line < 4; line++) {
    const order = indices(direction, line);
    const occupied = order.filter(from => board[from] !== 0);
    let target = 0;
    for (let n = 0; n < occupied.length; n++) {
      const from = occupied[n], value = board[from], to = order[target++];
      movements.push({ from, to, value });
      if (n + 1 < occupied.length && board[occupied[n + 1]] === value) {
        const second = occupied[++n], merged = value * 2;
        if (!Number.isSafeInteger(merged)) throw Error('Число плитки превышает безопасный диапазон');
        movements.push({ from: second, to, value }); merges.push({ from: [from, second], to, value: merged });
        next[to] = merged; scoreDelta += merged;
      } else next[to] = value;
    }
  }
  return { board: next, changed: next.some((value, i) => value !== board[i]), scoreDelta, movements, merges };
}
function random(rng: () => number): number {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw Error('Некорректный источник случайных чисел');
  return value;
}
export function spawnTile(board: number[], rng = Math.random): { board: number[]; spawn: Spawn | null } {
  const free = board.flatMap((value, index) => value === 0 ? [index] : []);
  if (!free.length) return { board: [...board], spawn: null };
  // Each spawn consumes exactly two random values: position, then value.
  const index = free[Math.floor(random(rng) * free.length)], value = random(rng) < .9 ? 2 : 4;
  const next = [...board]; next[index] = value;
  return { board: next, spawn: { index, value } };
}
export function createInitialState(rng = Math.random): State2048 {
  const first = spawnTile(Array<number>(16).fill(0), rng);
  const second = spawnTile(first.board, rng);
  return { version: 1, status: 'active', board: second.board, score: 0, moves: 0 };
}
export function applyMove(state: State2048, direction: Direction, rng = Math.random): Move2048 {
  const unchanged = { state, board: state.board, changed: false, scoreDelta: 0, movements: [], merges: [], spawn: null };
  if (state.status !== 'active') return unchanged;
  const moved = moveBoard(state.board, direction);
  if (!moved.changed) return unchanged;
  const spawned = spawnTile(moved.board, rng), score = state.score + moved.scoreDelta, moves = state.moves + 1;
  if (!Number.isSafeInteger(score) || !Number.isSafeInteger(moves)) throw Error('Счёт превышает безопасный диапазон');
  return { ...moved, ...spawned, state: { version: 1, status: canMove(spawned.board) ? 'active' : 'completed', board: spawned.board, score, moves } };
}
export function validateSave(value: unknown): value is State2048 {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<State2048>;
  if (s.version !== 1 || !Array.isArray(s.board) || s.board.length !== 16 || s.board.some(v => v !== 0 && !isTile(v)) || s.board.filter(Boolean).length < 2) return false;
  if (!Number.isSafeInteger(s.score) || s.score! < 0 || !Number.isSafeInteger(s.moves) || s.moves! < 0) return false;
  return s.status === (canMove(s.board) ? 'active' : 'completed');
}
