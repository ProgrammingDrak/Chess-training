import { queensGambit } from './queensGambit';
import { sicilianDefense } from './sicilianDefense';
import { italianGame } from './italianGame';
import { ruyLopez } from './ruyLopez';
import { londonSystem } from './londonSystem';
import { frenchDefense } from './frenchDefense';
import { caroKann } from './caroKann';
import { kingsGambit } from './kingsGambit';
import { kingsIndian } from './kingsIndian';
import { englishOpening } from './englishOpening';
import type { Opening } from '../../types';

export const ALL_OPENINGS: Opening[] = [
  queensGambit,
  sicilianDefense,
  italianGame,
  ruyLopez,
  londonSystem,
  frenchDefense,
  caroKann,
  kingsGambit,
  kingsIndian,
  englishOpening,
];

export { queensGambit, sicilianDefense, italianGame, ruyLopez, londonSystem, frenchDefense, caroKann, kingsGambit, kingsIndian, englishOpening };
