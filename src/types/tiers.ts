export const USER_TIERS = ['user', 'gold', 'platinum', 'diamond'] as const;

export type UserTier = (typeof USER_TIERS)[number];

export const HIGHEST_USER_TIER: UserTier = 'diamond';
export const DEFAULT_USER_TIER: UserTier = HIGHEST_USER_TIER;

const TIER_RANK: Record<UserTier, number> = {
  user: 0,
  gold: 1,
  platinum: 2,
  diamond: 3,
};

const TIER_LABELS: Record<UserTier, string> = {
  user: 'User',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
};

export function normalizeUserTier(tier: unknown): UserTier {
  return USER_TIERS.includes(tier as UserTier) ? (tier as UserTier) : DEFAULT_USER_TIER;
}

export function getTierLabel(tier: UserTier): string {
  return TIER_LABELS[tier];
}

export function canAccessTier(currentTier: UserTier | null | undefined, requiredTier: UserTier): boolean {
  if (!currentTier) return false;
  return TIER_RANK[normalizeUserTier(currentTier)] >= TIER_RANK[requiredTier];
}
