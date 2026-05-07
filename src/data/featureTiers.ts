import type { UserTier } from '../types/tiers';
import type { PokerDrillType } from '../types/poker';

export const FEATURE_TIERS = {
  pokerHandLookup: 'gold',
  pokerProfiles: 'user',
  pokerLiveSession: 'diamond',
} as const satisfies Record<string, UserTier>;

export const POKER_DRILL_TIERS: Partial<Record<PokerDrillType, UserTier>> = {
  opponent_simulation: 'gold',
  range_reading: 'platinum',
};
