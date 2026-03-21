import { queensGambit } from './queensGambit';
import { sicilianDefense } from './sicilianDefense';
import { italianGame } from './italianGame';
import { ruyLopez } from './ruyLopez';
import type { Opening } from '../../types';

export const ALL_OPENINGS: Opening[] = [
  queensGambit,
  sicilianDefense,
  italianGame,
  ruyLopez,
];

export { queensGambit, sicilianDefense, italianGame, ruyLopez };
