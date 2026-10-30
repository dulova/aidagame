export type Group = 'square_single' | 'square_double' | 'square_triple' | 'line' | 'l_shape';
export type Cell = [number, number];
export interface Shape { id: string; group: Group; cells: Cell[] }
export interface Game {
  version: 1; status: 'active' | 'completed'; board: (Group | null)[];
  slots: (Shape | null)[]; score: number; best: number; clearedLines: number; turns: number;
}
export interface Settings { theme: string; mode: 'light' | 'dark'; pattern: string }
export interface Snapshot { game: Game | null; settings: Settings; best: number; revision: number }
export interface Backup { appId: 'muroblocks'; exportVersion: 2; exportedAt: string; settings: Settings; games: { 'block-puzzle': { saveVersion: 1; save: Game | null; records: { best: number } } } }
