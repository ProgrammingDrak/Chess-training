// ─── Profile Types ───────────────────────────────────────────────────────────

/** Whether this profile represents the user themselves or an opponent. */
export type ProfileType = 'self' | 'villain';

/**
 * The four preflop action categories, shown as colour overlays on the grid:
 *   fold      → 🔴 red    — fold immediately
 *   limp      → 🟡 yellow — willing to call the BB (not GTO, "fun" category)
 *   call      → 🔵 blue   — raise/call up to a user-set BB threshold
 *   raise     → 🟢 green  — raise/call any amount
 */
export type RangeAction = 'fold' | 'limp' | 'call' | 'raise';

/** Per-position range configuration. */
export interface PositionRangeConfig {
  position: string;
  /** Maps each of the 169 hand notations (e.g. "AKs", "72o", "JJ") to an action. */
  range: Record<string, RangeAction>;
  /** BB threshold for the 'call' (blue) action — raise/call up to this many BBs. */
  callThresholdBB: number;
}

export interface PostFlopStreet {
  minPotOddsPct: number; // %, e.g. 33 = need at least 33% pot odds
  minEquityPct: number;  // %, e.g. 30 = need at least 30% equity
}

/** A complete player profile with preflop ranges and post-flop thresholds. */
export interface PlayerProfile {
  id: string;
  name: string;
  type: ProfileType;
  tableSize: number; // 2–9 players
  /** Global default BB threshold for the 'call' action. */
  defaultCallThresholdBB: number;
  /** One entry per position in this table size. */
  positions: PositionRangeConfig[];
  postFlop: {
    flop:  PostFlopStreet;
    turn:  PostFlopStreet;
    river: PostFlopStreet;
  };
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  /** Set when duplicated from a built-in template. */
  templateName?: string;
}

/** Shape of a built-in template (no id/timestamps — those are assigned on duplication). */
export interface ProfileTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: ProfileType;
  defaultCallThresholdBB: number;
  /** Base range applied to all positions when the template is duplicated. */
  range: Record<string, RangeAction>;
  postFlop: PlayerProfile['postFlop'];
}
