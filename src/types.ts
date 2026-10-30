import type { State2048 } from './games/2048/logic';
export type Group = 'square_single' | 'square_double' | 'square_triple' | 'line' | 'l_shape';
export type Cell = [number, number];
export interface Shape { id: string; group: Group; cells: Cell[] }
export interface Game {
  version: 1; status: 'active' | 'completed'; board: (Group | null)[];
  slots: (Shape | null)[]; score: number; best: number; clearedLines: number; turns: number;
}
export const GAME_IDS = ['block-puzzle', '2048'] as const;
export type GameId = typeof GAME_IDS[number];
export interface GameEntry<T> { save: T | null; best: number }
export interface GameEntries { 'block-puzzle': GameEntry<Game>; '2048': GameEntry<State2048> }
export interface Settings { theme: string; mode: 'light' | 'dark'; pattern: string }
export interface Snapshot {
  games: GameEntries;
  settings: Settings;
  revision: number;
  // Read errors are transient. Commits preserve raw damaged modules until explicit recovery.
  damaged?: Partial<Record<GameId, string>>;
}
export type BackupGames = { [K in GameId]: { saveVersion: 1; save: GameEntries[K]['save']; records: { best: number } } };
export interface Backup { appId: 'muroblocks'; exportVersion: 2; exportedAt: string; settings: Settings; games: BackupGames }
