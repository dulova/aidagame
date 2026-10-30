import type { Game } from '../types';
import { createInitialState, SAVE_VERSION, validateSave } from './logic';

// Register only implemented games; future catalogue cards do not create fake modules or saves.
export const gameModules = {
  'block-puzzle': {
    id: 'block-puzzle', name: '1010!', saveVersion: SAVE_VERSION,
    load: () => import('../components/GameBoard.vue'), createInitialState, validateSave,
    getStatus: (game: Game | null) => game?.status ?? 'not_started',
  },
};
