import type { Game } from '../types';
import { createInitialState, SAVE_VERSION, validateSave } from './logic';
import * as numbers from '../games/2048/logic';

export const gameModules = {
  'block-puzzle': {
    id: 'block-puzzle', name: '1010!', saveVersion: SAVE_VERSION,
    load: () => import('../components/GameBoard.vue'), createInitialState, validateSave,
    getStatus: (game: Game | null) => game?.status ?? 'not_started',
  },
  '2048': {
    id: '2048', name: '2048', saveVersion: numbers.SAVE_VERSION,
    load: () => import('../games/2048/Board2048.vue'), createInitialState: numbers.createInitialState, validateSave: numbers.validateSave,
    getStatus: (game: numbers.State2048 | null) => game?.status ?? 'not_started',
  },
};
