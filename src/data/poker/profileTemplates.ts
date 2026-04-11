import { cellHand, handCombos } from '../../utils/handMatrix';
import type { RangeAction, PositionRangeConfig, ProfileTemplate } from '../../types/profiles';

// ─── Position helpers ────────────────────────────────────────────────────────

/** Returns ordered positions for a given table size (EP→BB). */
export function getPositionsForTableSize(tableSize: number): string[] {
  if (tableSize <= 2) return ['SB', 'BB'];
  if (tableSize <= 3) return ['BTN', 'SB', 'BB'];
  if (tableSize <= 4) return ['CO', 'BTN', 'SB', 'BB'];
  if (tableSize <= 5) return ['HJ', 'CO', 'BTN', 'SB', 'BB'];
  if (tableSize <= 6) return ['MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  if (tableSize <= 7) return ['UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  return ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
}

// ─── Hand strength (Chen formula) ────────────────────────────────────────────

const HIGH_CARD: Record<string, number> = {
  A: 10, K: 8, Q: 7, J: 6, T: 5,
  '9': 4.5, '8': 4, '7': 3.5, '6': 3, '5': 2.5, '4': 2, '3': 1.5, '2': 1,
};

function chenScore(hand: string): number {
  // Pair
  if (hand.length === 2 && hand[0] === hand[1]) {
    const v = HIGH_CARD[hand[0]] ?? 1;
    return Math.max(v * 2, 5);
  }

  const suited = hand.endsWith('s');
  const r1 = hand[0];
  const r2 = hand[1];
  const v1 = HIGH_CARD[r1] ?? 1;
  const v2 = HIGH_CARD[r2] ?? 1;

  let score = Math.max(v1, v2);
  if (suited) score += 2;

  // Gap penalty (gap = number of ranks between the two cards, 0 = connected)
  const rankOrder = 'AKQJT98765432';
  const i1 = rankOrder.indexOf(r1);
  const i2 = rankOrder.indexOf(r2);
  const gap = Math.abs(i1 - i2) - 1;

  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;

  // Low connector bonus (both cards below a jack and gap ≤ 1)
  if (gap <= 1 && Math.max(v1, v2) < 6) score += 1;

  return score;
}

// ─── Hand rankings (combo-weighted) ─────────────────────────────────────────

export interface HandRankEntry {
  hand: string;
  combos: number;
  score: number;
  /** Cumulative combos including this hand (1–1326, strongest first). */
  cumulativeCombos: number;
  /** What percentile this hand sits at (0–100). */
  percentile: number;
  /** 1-based rank among 169 hand types (1 = strongest). */
  rank: number;
}

export const HAND_RANKINGS: HandRankEntry[] = (() => {
  const hands: { hand: string; combos: number; score: number }[] = [];
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const hand = cellHand(row, col);
      hands.push({ hand, combos: handCombos(hand), score: chenScore(hand) });
    }
  }

  // Sort strongest → weakest; break ties: pairs > suited > offsuit
  hands.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const typeRank = (h: string) => (h.length === 2 ? 0 : h.endsWith('s') ? 1 : 2);
    return typeRank(a.hand) - typeRank(b.hand);
  });

  let cumulative = 0;
  return hands.map((h, idx) => {
    cumulative += h.combos;
    return {
      ...h,
      cumulativeCombos: cumulative,
      percentile: (cumulative / 1326) * 100,
      rank: idx + 1,
    };
  });
})();

/** Maps hand notation → 1-based rank (1 = AA = strongest). */
export const HAND_RANK_MAP: Record<string, number> = Object.fromEntries(
  HAND_RANKINGS.map(e => [e.hand, e.rank])
);

/** Maps hand notation → cumulative combo percentile (0–100). */
export const HAND_PCT_MAP: Record<string, number> = Object.fromEntries(
  HAND_RANKINGS.map(e => [e.hand, e.percentile])
);

// ─── Range builder ───────────────────────────────────────────────────────────

/**
 * Build a full 169-hand range that assigns `playAction` to all hands
 * whose cumulative combo count falls within the top `playPct` percent,
 * and 'fold' to the rest.
 */
export function buildRangeFromPercentile(
  playPct: number,
  playAction: RangeAction = 'raise',
): Record<string, RangeAction> {
  const targetCombos = (playPct / 100) * 1326;
  const range: Record<string, RangeAction> = {};
  let cumulative = 0;

  for (const entry of HAND_RANKINGS) {
    // Include the hand if adding it keeps us at or under the target
    // (use midpoint: include if we were already under target before this hand)
    if (cumulative < targetCombos) {
      range[entry.hand] = playAction;
    } else {
      range[entry.hand] = 'fold';
    }
    cumulative += entry.combos;
  }
  return range;
}

/** Build the positions array for a new profile with the same range on every position. */
export function buildDefaultPositions(
  tableSize: number,
  defaultRange: Record<string, RangeAction>,
  callThresholdBB: number,
): PositionRangeConfig[] {
  return getPositionsForTableSize(tableSize).map(position => ({
    position,
    range: { ...defaultRange },
    callThresholdBB,
  }));
}

// ─── Built-in templates ──────────────────────────────────────────────────────

const GTO_POST_FLOP = {
  flop:  { minPotOddsPct: 25, minEquityPct: 30 },
  turn:  { minPotOddsPct: 28, minEquityPct: 33 },
  river: { minPotOddsPct: 30, minEquityPct: 35 },
};

/** Build a range where top X% = raiseAction and next Y% = callAction, rest = fold. */
function buildTwoActionRange(
  raisePct: number,
  callPct: number,
): Record<string, RangeAction> {
  const raiseThreshold = (raisePct / 100) * 1326;
  const callThreshold  = ((raisePct + callPct) / 100) * 1326;
  const range: Record<string, RangeAction> = {};
  let cumulative = 0;

  for (const entry of HAND_RANKINGS) {
    if (cumulative < raiseThreshold) {
      range[entry.hand] = 'raise';
    } else if (cumulative < callThreshold) {
      range[entry.hand] = 'call';
    } else {
      range[entry.hand] = 'fold';
    }
    cumulative += entry.combos;
  }
  return range;
}

export const PROFILE_TEMPLATES: ProfileTemplate[] = [
  {
    id: 'nit',
    name: 'NIT',
    description: 'Only premium hands. Tight and predictable — top ~12% of combos.',
    icon: '🦔',
    type: 'villain',
    defaultCallThresholdBB: 10,
    range: buildRangeFromPercentile(12, 'raise'),
    postFlop: {
      flop:  { minPotOddsPct: 40, minEquityPct: 45 },
      turn:  { minPotOddsPct: 45, minEquityPct: 50 },
      river: { minPotOddsPct: 50, minEquityPct: 55 },
    },
  },
  {
    id: 'gto',
    name: 'Pure GTO',
    description: 'Balanced, unexploitable strategy. ~24% VPIP with raise/call split.',
    icon: '🎯',
    type: 'self',
    defaultCallThresholdBB: 20,
    range: buildTwoActionRange(16, 8), // top 16% raise, next 8% call
    postFlop: GTO_POST_FLOP,
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Wide raising range, constant pressure. ~38% VPIP.',
    icon: '🔥',
    type: 'self',
    defaultCallThresholdBB: 30,
    range: buildRangeFromPercentile(38, 'raise'),
    postFlop: {
      flop:  { minPotOddsPct: 20, minEquityPct: 22 },
      turn:  { minPotOddsPct: 22, minEquityPct: 25 },
      river: { minPotOddsPct: 25, minEquityPct: 28 },
    },
  },
  {
    id: 'calling_station',
    name: 'Calling Station',
    description: 'Calls nearly everything. ~48% VPIP, mostly passive.',
    icon: '🐟',
    type: 'villain',
    defaultCallThresholdBB: 999,
    range: buildTwoActionRange(12, 36), // top 12% raise, next 36% call/limp
    postFlop: {
      flop:  { minPotOddsPct: 15, minEquityPct: 18 },
      turn:  { minPotOddsPct: 15, minEquityPct: 20 },
      river: { minPotOddsPct: 18, minEquityPct: 22 },
    },
  },
  {
    id: 'maniac',
    name: 'Maniac',
    description: 'Raises almost everything. Ultra-aggressive, ~62% VPIP.',
    icon: '💥',
    type: 'villain',
    defaultCallThresholdBB: 999,
    range: buildRangeFromPercentile(62, 'raise'),
    postFlop: {
      flop:  { minPotOddsPct: 10, minEquityPct: 12 },
      turn:  { minPotOddsPct: 12, minEquityPct: 15 },
      river: { minPotOddsPct: 15, minEquityPct: 18 },
    },
  },
];
