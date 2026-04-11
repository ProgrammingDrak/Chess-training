import { cellHand, handCombos } from '../../utils/handMatrix';
import type {
  RangeAction,
  SituationRange,
  PositionRangeConfig,
  ProfileTemplate,
  ActionContext,
} from '../../types/profiles';
import { DEFAULT_ACTION_CONTEXT } from '../../types/profiles';

// ─── Position labels by table size ───────────────────────────────────────────
//
// Labels follow standard modern poker nomenclature:
//   9-max: UTG  UTG+1  UTG+2  LJ   HJ   CO   BTN  SB  BB
//   8-max: UTG  UTG+1  LJ     HJ   CO   BTN  SB   BB
//   7-max: UTG  LJ     HJ     CO   BTN  SB   BB
//   6-max: UTG  HJ     CO     BTN  SB   BB
//   5-max: HJ   CO     BTN    SB   BB
//   4-max: CO   BTN    SB     BB
//   3-max: BTN  SB     BB
//   2-max: BTN  BB   (heads-up: BTN = dealer/SB)

const POSITIONS_BY_TABLE_SIZE: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

export function getPositionsForTableSize(tableSize: number): string[] {
  return POSITIONS_BY_TABLE_SIZE[tableSize] ?? POSITIONS_BY_TABLE_SIZE[6];
}

// ─── Position-aware VPIP suggestions ────────────────────────────────────────
//
// Suggested "play top X%" default for the quick-start slider, based on
// table size × position.  Ranges open wider short-handed and from late position.
// These are approximate GTO-ish open-raise frequencies; callers can use them
// as starting points for the percentile slider.

type PosKey = string; // e.g. "UTG", "BTN", "BB"

const VPIP_SUGGESTIONS: Record<number, Record<PosKey, number>> = {
  2: { BTN: 70, BB: 85 },
  3: { BTN: 58, SB: 42, BB: 75 },
  4: { CO: 32, BTN: 50, SB: 36, BB: 72 },
  5: { HJ: 22, CO: 30, BTN: 46, SB: 32, BB: 70 },
  6: { UTG: 16, HJ: 22, CO: 28, BTN: 42, SB: 30, BB: 68 },
  7: { UTG: 14, LJ: 18, HJ: 22, CO: 28, BTN: 42, SB: 30, BB: 68 },
  8: { UTG: 12, 'UTG+1': 14, LJ: 18, HJ: 22, CO: 28, BTN: 42, SB: 30, BB: 68 },
  9: { UTG: 11, 'UTG+1': 13, 'UTG+2': 15, LJ: 17, HJ: 21, CO: 27, BTN: 42, SB: 30, BB: 68 },
};

/**
 * Suggested open-raise VPIP % for a given position at a given table size.
 * Returns a sensible fallback (20%) if the combination isn't in the table.
 */
export function suggestedVpip(tableSize: number, position: string): number {
  return VPIP_SUGGESTIONS[tableSize]?.[position] ?? 20;
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

  const rankOrder = 'AKQJT98765432';
  const gap = Math.abs(rankOrder.indexOf(r1) - rankOrder.indexOf(r2)) - 1;

  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;

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
    return { ...h, cumulativeCombos: cumulative, percentile: (cumulative / 1326) * 100, rank: idx + 1 };
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

// ─── Range builders ──────────────────────────────────────────────────────────

/**
 * Build a full 169-hand range: top `playPct`% of combos → `playAction`,
 * everything else → 'fold'.
 */
export function buildRangeFromPercentile(
  playPct: number,
  playAction: RangeAction = 'raise',
): Record<string, RangeAction> {
  const targetCombos = (playPct / 100) * 1326;
  const range: Record<string, RangeAction> = {};
  let cumulative = 0;

  for (const entry of HAND_RANKINGS) {
    range[entry.hand] = cumulative < targetCombos ? playAction : 'fold';
    cumulative += entry.combos;
  }
  return range;
}

/** Build a range: top `raisePct`% → raise, next `callPct`% → call, rest → fold. */
function buildTwoActionRange(
  raisePct: number,
  callPct: number,
): Record<string, RangeAction> {
  const raiseThreshold = (raisePct / 100) * 1326;
  const callThreshold  = ((raisePct + callPct) / 100) * 1326;
  const range: Record<string, RangeAction> = {};
  let cumulative = 0;

  for (const entry of HAND_RANKINGS) {
    if (cumulative < raiseThreshold)      range[entry.hand] = 'raise';
    else if (cumulative < callThreshold)  range[entry.hand] = 'call';
    else                                  range[entry.hand] = 'fold';
    cumulative += entry.combos;
  }
  return range;
}

// ─── Position config builders ─────────────────────────────────────────────────

/** Wrap a flat range + threshold into the `situations` structure. */
export function makeSituationRange(
  range: Record<string, RangeAction>,
  callThresholdBB: number,
): SituationRange {
  return { range, callThresholdBB };
}

/**
 * Build a `PositionRangeConfig` array for the given table size, seeding every
 * position with the provided `SituationRange` under `DEFAULT_ACTION_CONTEXT` ('RFI').
 *
 * The `situations` map is intentionally sparse (only 'RFI' populated today)
 * so that future action-context keys can be added without a schema migration.
 */
export function buildDefaultPositions(
  tableSize: number,
  baseSitRange: SituationRange,
): PositionRangeConfig[] {
  return getPositionsForTableSize(tableSize).map(position => ({
    position,
    situations: {
      [DEFAULT_ACTION_CONTEXT]: {
        range: { ...baseSitRange.range },
        callThresholdBB: baseSitRange.callThresholdBB,
      },
    } as Partial<Record<ActionContext, SituationRange>>,
  }));
}

// ─── Built-in templates ──────────────────────────────────────────────────────

const GTO_POST_FLOP: PlayerProfile_postFlop = {
  flop:  { minPotOddsPct: 25, minEquityPct: 30 },
  turn:  { minPotOddsPct: 28, minEquityPct: 33 },
  river: { minPotOddsPct: 30, minEquityPct: 35 },
};

// Local alias so we don't import the whole type just for this
type PlayerProfile_postFlop = {
  flop:  { minPotOddsPct: number; minEquityPct: number };
  turn:  { minPotOddsPct: number; minEquityPct: number };
  river: { minPotOddsPct: number; minEquityPct: number };
};

export const PROFILE_TEMPLATES: ProfileTemplate[] = [
  {
    id: 'nit',
    name: 'NIT',
    description: 'Only premium hands. Tight and predictable — top ~12% of combos.',
    icon: '🦔',
    type: 'villain',
    defaultCallThresholdBB: 10,
    baseRange: makeSituationRange(buildRangeFromPercentile(12, 'raise'), 10),
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
    baseRange: makeSituationRange(buildTwoActionRange(16, 8), 20),
    postFlop: GTO_POST_FLOP,
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Wide raising range, constant pressure. ~38% VPIP.',
    icon: '🔥',
    type: 'self',
    defaultCallThresholdBB: 30,
    baseRange: makeSituationRange(buildRangeFromPercentile(38, 'raise'), 30),
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
    baseRange: makeSituationRange(buildTwoActionRange(12, 36), 999),
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
    baseRange: makeSituationRange(buildRangeFromPercentile(62, 'raise'), 999),
    postFlop: {
      flop:  { minPotOddsPct: 10, minEquityPct: 12 },
      turn:  { minPotOddsPct: 12, minEquityPct: 15 },
      river: { minPotOddsPct: 15, minEquityPct: 18 },
    },
  },
];
