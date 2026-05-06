import { RANKS, cellHand, handCombos } from '../../utils/handMatrix';
import type {
  RangeAction,
  SituationRange,
  PositionRangeConfig,
  ProfileTemplate,
  ActionContext,
} from '../../types/profiles';
import { DEFAULT_ACTION_CONTEXT } from '../../types/profiles';
import { defaultActionBuckets } from '../../utils/profileActionBuckets';

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

function buildFoldRange(): Record<string, RangeAction> {
  const range: Record<string, RangeAction> = {};
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      range[cellHand(row, col)] = 'fold';
    }
  }
  return range;
}

const LOW_TO_HIGH_RANKS: string[] = [...RANKS].reverse();

function rankValue(rank: string): number {
  return LOW_TO_HIGH_RANKS.indexOf(rank);
}

function normalizeHand(high: string, low: string, suffix: 's' | 'o'): string {
  return rankValue(high) > rankValue(low)
    ? `${high}${low}${suffix}`
    : `${low}${high}${suffix}`;
}

/**
 * Build a full 169-hand range from compact poker notation:
 *   66+, A3s+, KJo+, T9s, 98o
 */
export function buildRangeFromNotation(
  notation: string[],
  playAction: RangeAction = 'raise',
): Record<string, RangeAction> {
  const range = buildFoldRange();

  for (const raw of notation) {
    const token = raw.trim().toUpperCase();
    const hasPlus = token.endsWith('+');
    const base = hasPlus ? token.slice(0, -1) : token;

    if (base.length === 2 && base[0] === base[1]) {
      const start = rankValue(base[0]);
      for (const rank of LOW_TO_HIGH_RANKS.slice(start)) {
        range[`${rank}${rank}`] = playAction;
      }
      continue;
    }

    if (base.length === 3 && (base[2] === 'S' || base[2] === 'O')) {
      const high = base[0];
      const low = base[1];
      const suffix = base[2].toLowerCase() as 's' | 'o';

      if (!hasPlus) {
        range[normalizeHand(high, low, suffix)] = playAction;
        continue;
      }

      const highValue = rankValue(high);
      const lowValue = rankValue(low);
      for (const kicker of LOW_TO_HIGH_RANKS) {
        const kickerValue = rankValue(kicker);
        if (kickerValue >= lowValue && kickerValue < highValue) {
          range[normalizeHand(high, kicker, suffix)] = playAction;
        }
      }
    }
  }

  return range;
}

function mergeNotationIntoRange(
  range: Record<string, RangeAction>,
  notation: string[],
  playAction: RangeAction,
): Record<string, RangeAction> {
  const overlay = buildRangeFromNotation(notation, playAction);
  for (const [hand, action] of Object.entries(overlay)) {
    if (action !== 'fold') range[hand] = action;
  }
  return range;
}

/** Build a range: top `raisePct`% -> raise, next `callPct`% -> call, rest -> fold. */
function buildTwoActionRange(
  raisePct: number,
  callPct: number,
): Record<string, RangeAction> {
  const raiseThreshold = (raisePct / 100) * 1326;
  const callThreshold = ((raisePct + callPct) / 100) * 1326;
  const range: Record<string, RangeAction> = {};
  let cumulative = 0;

  for (const entry of HAND_RANKINGS) {
    if (cumulative < raiseThreshold) range[entry.hand] = 'raise';
    else if (cumulative < callThreshold) range[entry.hand] = 'call';
    else range[entry.hand] = 'fold';
    cumulative += entry.combos;
  }
  return range;
}

// ─── Position config builders ─────────────────────────────────────────────────

/** Wrap a flat range + threshold into the `situations` structure. */
export function makeSituationRange(
  range: Record<string, RangeAction>,
  callThresholdBB: number,
  limpThresholdBB = 1,
): SituationRange {
  return {
    range,
    callThresholdBB,
    limpThresholdBB,
    actionBuckets: defaultActionBuckets(callThresholdBB, limpThresholdBB),
  };
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
        limpThresholdBB: baseSitRange.limpThresholdBB,
        actionBuckets: baseSitRange.actionBuckets
          ? structuredClone(baseSitRange.actionBuckets)
          : defaultActionBuckets(baseSitRange.callThresholdBB, baseSitRange.limpThresholdBB ?? 1),
      },
    } as Partial<Record<ActionContext, SituationRange>>,
  }));
}

export interface GtoRfiChartEntry {
  position: string;
  publishedPct: number | null;
  notation: string[];
  premiumNotation: string[];
  limpNotation: string[];
  note: string;
  range: Record<string, RangeAction>;
}

const SIX_MAX_GTO_RFI_NOTATION: Record<string, Omit<GtoRfiChartEntry, 'position' | 'range'>> = {
  UTG: {
    publishedPct: 17.6,
    notation: ['66+', 'A3s+', 'K8s+', 'Q9s+', 'J9s+', 'T9s', 'ATo+', 'KJo+', 'QJo'],
    premiumNotation: ['QQ+', 'AKs', 'AKo'],
    limpNotation: [],
    note: 'Lojack/UTG 100bb baseline: chart hands are mostly call/raise-to-10BB hands; only top premiums are all-in-comfortable.',
  },
  HJ: {
    publishedPct: 21.4,
    notation: ['55+', 'A2s+', 'K6s+', 'Q9s+', 'J9s+', 'T9s', '98s', '87s', '76s', 'ATo+', 'KTo+', 'QTo+'],
    premiumNotation: ['QQ+', 'AKs', 'AKo'],
    limpNotation: ['54s', '65s', '75s', '86s', '97s', 'T8s'],
    note: 'Hijack 100bb baseline: adds suited connectors and broadways; nearby suited connectors can be cheap-flop candidates.',
  },
  CO: {
    publishedPct: 27.8,
    notation: ['33+', 'A2s+', 'K3s+', 'Q6s+', 'J8s+', 'T7s+', '97s+', '87s', '76s', 'A8o+', 'KTo+', 'QTo+', 'JTo'],
    premiumNotation: ['QQ+', 'AKs', 'AKo'],
    limpNotation: ['22', 'A2o', 'A3o', 'A4o', 'A5o', 'K9o', 'Q9o', 'J9o', 'T8o', '98o', '65s', '54s', '43s'],
    note: 'Cutoff 100bb baseline: wider late-position coverage; add a cheap-flop layer for hands just under the raise/call range.',
  },
  BTN: {
    publishedPct: 43.5,
    notation: ['33+', 'A2s+', 'K2s+', 'Q3s+', 'J4s+', 'T6s+', '96s+', '85s+', '75s+', '64s+', '53s+', 'A4o+', 'K8o+', 'Q9o+', 'J9o+', 'T8o+', '98o'],
    premiumNotation: ['JJ+', 'AKs', 'AQs', 'AKo'],
    limpNotation: ['22', 'Q2s', 'J2s+', 'T2s+', '92s+', '82s+', '72s+', '62s+', '52s+', '42s+', '32s', 'A2o', 'A3o', 'K5o+', 'Q8o+', 'J8o+', 'T7o+', '97o+', '87o', '76o'],
    note: 'Button 100bb baseline: widest in-position range, with a wider cheap-flop layer because less action remains behind.',
  },
  SB: {
    publishedPct: 62.3,
    notation: ['22+', 'A2s+', 'K2s+', 'Q2s+', 'J2s+', 'T3s+', '94s+', '84s+', '74s+', '63s+', '53s+', '43s', 'A2o+', 'K4o+', 'Q5o+', 'J7o+', 'T7o+', '96o+', '86o+', '76o'],
    premiumNotation: ['TT+', 'AKs', 'AQs', 'AJs', 'AKo', 'AQo'],
    limpNotation: ['T2s', '92s', '82s', '72s', '62s', '52s', '42s', '32s', 'K2o', 'K3o', 'Q2o+', 'J5o+', 'T6o+', '95o', '85o', '75o', '65o'],
    note: 'Small blind blind-vs-blind baseline: strongest chart hands build the pot; the cheap-flop layer is widest because no late position remains behind.',
  },
  BB: {
    publishedPct: null,
    notation: ['22+', 'A2s+', 'K2s+', 'Q2s+', 'J2s+', 'T2s+', '92s+', '82s+', '72s+', '62s+', '52s+', '42s+', '32s', 'A2o+', 'K5o+', 'Q7o+', 'J8o+', 'T8o+', '98o', '87o', '76o', '65o'],
    premiumNotation: ['JJ+', 'AKs', 'AQs', 'AKo'],
    limpNotation: ['K2o+', 'Q2o+', 'J5o+', 'T6o+', '96o+', '86o+', '75o+', '64o+', '54o'],
    note: 'Big blind defense baseline versus a late-position open. Defense depends heavily on opener, sizing, rake, and stack depth; this is not a raise-first-in spot.',
  },
};

export const SIX_MAX_GTO_RFI_CHART: GtoRfiChartEntry[] = getPositionsForTableSize(6).map(position => {
  const entry = SIX_MAX_GTO_RFI_NOTATION[position];
  const range = buildFoldRange();
  mergeNotationIntoRange(range, entry.limpNotation, 'limp');
  mergeNotationIntoRange(range, entry.notation, 'call');
  mergeNotationIntoRange(range, entry.premiumNotation, 'raise');

  return {
    position,
    ...entry,
    range,
  };
});

export function getSixMaxGtoRfiChartEntry(position: string): GtoRfiChartEntry | null {
  return SIX_MAX_GTO_RFI_CHART.find(entry => entry.position === position) ?? null;
}

const FIVE_MAX_GTO_RFI_NOTATION =
  Object.fromEntries(
    getPositionsForTableSize(5).map(position => [position, SIX_MAX_GTO_RFI_NOTATION[position]])
  ) as Record<string, Omit<GtoRfiChartEntry, 'position' | 'range'>>;

const FOUR_MAX_GTO_RFI_NOTATION =
  Object.fromEntries(
    getPositionsForTableSize(4).map(position => [position, SIX_MAX_GTO_RFI_NOTATION[position]])
  ) as Record<string, Omit<GtoRfiChartEntry, 'position' | 'range'>>;

const THREE_MAX_GTO_RFI_NOTATION =
  Object.fromEntries(
    getPositionsForTableSize(3).map(position => [position, SIX_MAX_GTO_RFI_NOTATION[position]])
  ) as Record<string, Omit<GtoRfiChartEntry, 'position' | 'range'>>;

const HEADS_UP_GTO_NOTATION: Record<string, Omit<GtoRfiChartEntry, 'position' | 'range'>> = {
  BTN: {
    publishedPct: 85,
    notation: ['22+', 'A2s+', 'K2s+', 'Q4s+', 'J6s+', 'T6s+', '96s+', '86s+', '75s+', '65s', '54s', 'A2o+', 'K5o+', 'Q8o+', 'J8o+', 'T8o+', '98o'],
    premiumNotation: ['TT+', 'AJs+', 'KQs', 'AQo+'],
    limpNotation: ['Q2s+', 'J2s+', 'T2s+', '92s+', '82s+', '72s+', '62s+', '52s+', '42s+', '32s', 'K2o+', 'Q2o+', 'J4o+', 'T4o+', '94o+', '84o+', '74o+', '64o+', '54o'],
    note: 'Heads-up button is also the small blind. Open extremely wide because you are against one hand and act last postflop; fold only the weakest disconnected offsuit hands.',
  },
  BB: {
    publishedPct: null,
    notation: ['22+', 'A2s+', 'K2s+', 'Q2s+', 'J2s+', 'T4s+', '94s+', '84s+', '74s+', '64s+', '54s', 'A2o+', 'K2o+', 'Q6o+', 'J7o+', 'T7o+', '97o+', '87o', '76o'],
    premiumNotation: ['TT+', 'A9s+', 'K9s+', 'AQo+', 'KQo'],
    limpNotation: ['T2s+', '93s+', '83s+', '73s+', '63s+', '53s+', '43s', 'Q2o+', 'J4o+', 'T5o+', '96o+', '86o+', '75o+', '65o', '54o'],
    note: 'Heads-up big blind defense versus a small button open. Defend wide, especially against 2x opens; tighten versus 2.5x-3x and use premiums/suited blockers as reraises.',
  },
};

const SEVEN_MAX_GTO_RFI_NOTATION: Record<string, Omit<GtoRfiChartEntry, 'position' | 'range'>> = {
  UTG: {
    publishedPct: 15.7,
    notation: ['66+', 'A4s+', 'K9s+', 'Q9s+', 'J9s+', 'T9s', 'ATo+', 'KJo+'],
    premiumNotation: ['QQ+', 'AKs', 'AKo'],
    limpNotation: [],
    note: '7-max UTG has one more player behind than 6-max UTG/LJ, so the first-open range tightens before widening again from LJ onward.',
  },
  LJ: SIX_MAX_GTO_RFI_NOTATION.UTG,
  HJ: SIX_MAX_GTO_RFI_NOTATION.HJ,
  CO: SIX_MAX_GTO_RFI_NOTATION.CO,
  BTN: SIX_MAX_GTO_RFI_NOTATION.BTN,
  SB: SIX_MAX_GTO_RFI_NOTATION.SB,
  BB: SIX_MAX_GTO_RFI_NOTATION.BB,
};

const EIGHT_MAX_GTO_RFI_NOTATION: Record<string, Omit<GtoRfiChartEntry, 'position' | 'range'>> = {
  UTG: {
    publishedPct: 12.5,
    notation: ['77+', 'A5s+', 'A8s+', 'KTs+', 'QTs+', 'JTs', 'T9s', 'AJo+', 'KQo'],
    premiumNotation: ['QQ+', 'AKs', 'AKo'],
    limpNotation: [],
    note: '8-max UTG has seven players behind, so it sits between full-ring UTG and 7-max UTG. Keep offsuit broadways tight and prefer hands that tolerate 3-bets.',
  },
  'UTG+1': SEVEN_MAX_GTO_RFI_NOTATION.UTG,
  LJ: SIX_MAX_GTO_RFI_NOTATION.UTG,
  HJ: SIX_MAX_GTO_RFI_NOTATION.HJ,
  CO: SIX_MAX_GTO_RFI_NOTATION.CO,
  BTN: SIX_MAX_GTO_RFI_NOTATION.BTN,
  SB: SIX_MAX_GTO_RFI_NOTATION.SB,
  BB: SIX_MAX_GTO_RFI_NOTATION.BB,
};

const NINE_MAX_GTO_RFI_NOTATION: Record<string, Omit<GtoRfiChartEntry, 'position' | 'range'>> = {
  UTG: {
    publishedPct: 10.1,
    notation: ['88+', 'A9s+', 'KJs+', 'KQo', 'QJs', 'JTs', 'T9s', 'AJo+'],
    premiumNotation: ['QQ+', 'AKs', 'AKo'],
    limpNotation: [],
    note: '9-max/full-ring UTG has eight players behind. This is the tightest open seat: strong pairs, strong aces, and robust suited broadways only.',
  },
  'UTG+1': EIGHT_MAX_GTO_RFI_NOTATION.UTG,
  'UTG+2': SEVEN_MAX_GTO_RFI_NOTATION.UTG,
  LJ: SIX_MAX_GTO_RFI_NOTATION.UTG,
  HJ: SIX_MAX_GTO_RFI_NOTATION.HJ,
  CO: SIX_MAX_GTO_RFI_NOTATION.CO,
  BTN: SIX_MAX_GTO_RFI_NOTATION.BTN,
  SB: SIX_MAX_GTO_RFI_NOTATION.SB,
  BB: SIX_MAX_GTO_RFI_NOTATION.BB,
};

export const FIVE_MAX_GTO_RFI_CHART: GtoRfiChartEntry[] = getPositionsForTableSize(5).map(position => {
  const entry = FIVE_MAX_GTO_RFI_NOTATION[position];
  const range = buildFoldRange();
  mergeNotationIntoRange(range, entry.limpNotation, 'limp');
  mergeNotationIntoRange(range, entry.notation, 'call');
  mergeNotationIntoRange(range, entry.premiumNotation, 'raise');

  return {
    position,
    ...entry,
    range,
  };
});

export const FOUR_MAX_GTO_RFI_CHART: GtoRfiChartEntry[] = getPositionsForTableSize(4).map(position => {
  const entry = FOUR_MAX_GTO_RFI_NOTATION[position];
  const range = buildFoldRange();
  mergeNotationIntoRange(range, entry.limpNotation, 'limp');
  mergeNotationIntoRange(range, entry.notation, 'call');
  mergeNotationIntoRange(range, entry.premiumNotation, 'raise');

  return {
    position,
    ...entry,
    range,
  };
});

export const THREE_MAX_GTO_RFI_CHART: GtoRfiChartEntry[] = getPositionsForTableSize(3).map(position => {
  const entry = THREE_MAX_GTO_RFI_NOTATION[position];
  const range = buildFoldRange();
  mergeNotationIntoRange(range, entry.limpNotation, 'limp');
  mergeNotationIntoRange(range, entry.notation, 'call');
  mergeNotationIntoRange(range, entry.premiumNotation, 'raise');

  return {
    position,
    ...entry,
    range,
  };
});

export const HEADS_UP_GTO_CHART: GtoRfiChartEntry[] = getPositionsForTableSize(2).map(position => {
  const entry = HEADS_UP_GTO_NOTATION[position];
  const range = buildFoldRange();
  mergeNotationIntoRange(range, entry.limpNotation, 'limp');
  mergeNotationIntoRange(range, entry.notation, 'call');
  mergeNotationIntoRange(range, entry.premiumNotation, 'raise');

  return {
    position,
    ...entry,
    range,
  };
});

export const SEVEN_MAX_GTO_RFI_CHART: GtoRfiChartEntry[] = getPositionsForTableSize(7).map(position => {
  const entry = SEVEN_MAX_GTO_RFI_NOTATION[position];
  const range = buildFoldRange();
  mergeNotationIntoRange(range, entry.limpNotation, 'limp');
  mergeNotationIntoRange(range, entry.notation, 'call');
  mergeNotationIntoRange(range, entry.premiumNotation, 'raise');

  return {
    position,
    ...entry,
    range,
  };
});

export const EIGHT_MAX_GTO_RFI_CHART: GtoRfiChartEntry[] = getPositionsForTableSize(8).map(position => {
  const entry = EIGHT_MAX_GTO_RFI_NOTATION[position];
  const range = buildFoldRange();
  mergeNotationIntoRange(range, entry.limpNotation, 'limp');
  mergeNotationIntoRange(range, entry.notation, 'call');
  mergeNotationIntoRange(range, entry.premiumNotation, 'raise');

  return {
    position,
    ...entry,
    range,
  };
});

export const NINE_MAX_GTO_RFI_CHART: GtoRfiChartEntry[] = getPositionsForTableSize(9).map(position => {
  const entry = NINE_MAX_GTO_RFI_NOTATION[position];
  const range = buildFoldRange();
  mergeNotationIntoRange(range, entry.limpNotation, 'limp');
  mergeNotationIntoRange(range, entry.notation, 'call');
  mergeNotationIntoRange(range, entry.premiumNotation, 'raise');

  return {
    position,
    ...entry,
    range,
  };
});

export function getGtoChartEntry(tableSize: number, position: string): GtoRfiChartEntry | null {
  const chart = tableSize === 2
      ? HEADS_UP_GTO_CHART
    : tableSize === 9
      ? NINE_MAX_GTO_RFI_CHART
    : tableSize === 8
      ? EIGHT_MAX_GTO_RFI_CHART
    : tableSize === 7
      ? SEVEN_MAX_GTO_RFI_CHART
    : tableSize === 3
      ? THREE_MAX_GTO_RFI_CHART
    : tableSize === 4
      ? FOUR_MAX_GTO_RFI_CHART
    : tableSize === 5
      ? FIVE_MAX_GTO_RFI_CHART
    : tableSize === 6
      ? SIX_MAX_GTO_RFI_CHART
      : null;
  return chart?.find(entry => entry.position === position) ?? null;
}

export function buildSixMaxGtoRfiPositions(): PositionRangeConfig[] {
  return SIX_MAX_GTO_RFI_CHART.map(entry => ({
    position: entry.position,
    situations: {
      [DEFAULT_ACTION_CONTEXT]: makeSituationRange(entry.range, 10, entry.position === 'SB' ? 2 : 1),
    },
  }));
}

export function buildFiveMaxGtoRfiPositions(): PositionRangeConfig[] {
  return FIVE_MAX_GTO_RFI_CHART.map(entry => ({
    position: entry.position,
    situations: {
      [DEFAULT_ACTION_CONTEXT]: makeSituationRange(entry.range, 10, entry.position === 'SB' || entry.position === 'BB' ? 2 : 1),
    },
  }));
}

export function buildFourMaxGtoRfiPositions(): PositionRangeConfig[] {
  return FOUR_MAX_GTO_RFI_CHART.map(entry => ({
    position: entry.position,
    situations: {
      [DEFAULT_ACTION_CONTEXT]: makeSituationRange(entry.range, 10, entry.position === 'SB' || entry.position === 'BB' ? 2 : 1),
    },
  }));
}

export function buildThreeMaxGtoRfiPositions(): PositionRangeConfig[] {
  return THREE_MAX_GTO_RFI_CHART.map(entry => ({
    position: entry.position,
    situations: {
      [DEFAULT_ACTION_CONTEXT]: makeSituationRange(entry.range, 10, entry.position === 'SB' || entry.position === 'BB' ? 2 : 1),
    },
  }));
}

export function buildHeadsUpGtoPositions(): PositionRangeConfig[] {
  return HEADS_UP_GTO_CHART.map(entry => ({
    position: entry.position,
    situations: {
      [DEFAULT_ACTION_CONTEXT]: makeSituationRange(entry.range, entry.position === 'BB' ? 2.5 : 10, entry.position === 'BB' ? 2 : 1),
    },
  }));
}

export function buildSevenMaxGtoRfiPositions(): PositionRangeConfig[] {
  return SEVEN_MAX_GTO_RFI_CHART.map(entry => ({
    position: entry.position,
    situations: {
      [DEFAULT_ACTION_CONTEXT]: makeSituationRange(entry.range, 10, entry.position === 'SB' || entry.position === 'BB' ? 2 : 1),
    },
  }));
}

export function buildEightMaxGtoRfiPositions(): PositionRangeConfig[] {
  return EIGHT_MAX_GTO_RFI_CHART.map(entry => ({
    position: entry.position,
    situations: {
      [DEFAULT_ACTION_CONTEXT]: makeSituationRange(entry.range, 10, entry.position === 'SB' || entry.position === 'BB' ? 2 : 1),
    },
  }));
}

export function buildNineMaxGtoRfiPositions(): PositionRangeConfig[] {
  return NINE_MAX_GTO_RFI_CHART.map(entry => ({
    position: entry.position,
    situations: {
      [DEFAULT_ACTION_CONTEXT]: makeSituationRange(entry.range, 10, entry.position === 'SB' || entry.position === 'BB' ? 2 : 1),
    },
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
    id: 'six_max_gto_rfi',
    name: 'GTO Position Charts',
    description: 'Researched 100bb heads-up through full-ring ranges, with tighter added early seats and blind-defense rows.',
    icon: '📊',
    type: 'villain',
    defaultCallThresholdBB: 10,
    baseRange: makeSituationRange(buildRangeFromPercentile(24, 'call'), 10),
    positionRanges: {
      2: buildHeadsUpGtoPositions(),
      3: buildThreeMaxGtoRfiPositions(),
      4: buildFourMaxGtoRfiPositions(),
      5: buildFiveMaxGtoRfiPositions(),
      6: buildSixMaxGtoRfiPositions(),
      7: buildSevenMaxGtoRfiPositions(),
      8: buildEightMaxGtoRfiPositions(),
      9: buildNineMaxGtoRfiPositions(),
    },
    postFlop: GTO_POST_FLOP,
  },
  {
    id: 'gto',
    name: 'Pure GTO',
    description: 'Balanced, unexploitable strategy. ~24% VPIP with raise/call split.',
    icon: '🎯',
    type: 'villain',
    defaultCallThresholdBB: 20,
    baseRange: makeSituationRange(buildTwoActionRange(16, 8), 20),
    postFlop: GTO_POST_FLOP,
  },
];
