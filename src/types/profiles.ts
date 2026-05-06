// ─── Profile Types ───────────────────────────────────────────────────────────

/** Whether this profile represents the user themselves or an opponent. */
export type ProfileType = 'self' | 'villain';

/**
 * Legacy actions plus user-created threshold buckets.
 *   fold  → fold immediately
 *   limp  → see a flop cheaply, up to a configured BB cap
 *   call  → call/raise and build the pot up to a configured BB cap
 *   raise → premium hands willing to get all money in
 *
 * Custom ids are stored in SituationRange.actionBuckets.
 */
export type BaseRangeAction = 'fold' | 'limp' | 'call' | 'raise';
export type RangeAction = BaseRangeAction | (string & {});

export type RangeBucketKind = 'fold' | 'limp' | 'callRaise' | 'premium';

export interface RangeActionBucket {
  id: RangeAction;
  kind: RangeBucketKind;
  label: string;
  emoji: string;
  bg: string;
  border: string;
  text: string;
  /** BB ceiling for threshold buckets. Premium and fold buckets do not use this. */
  maxBB?: number;
}

/**
 * What happened before it is your turn to act.
 *
 * Today the UI only populates 'RFI' (all folded to you — raise first in).
 * The other variants are reserved for future drill dimensions and are stored
 * here so adding them later requires no schema rewrite.
 *
 * Examples of future values:
 *   'vs_open'      — facing one open raise, no callers
 *   'vs_open_call' — facing one raise + one cold-caller (squeeze / flat spot)
 *   'vs_3bet'      — facing a 3-bet
 *   'vs_4bet'      — facing a 4-bet
 *
 * The type is a union of known literals + `string` so callers can store
 * arbitrary future contexts without a code change.
 */
export type ActionContext =
  | 'RFI'            // All folded to you — Raise First In
  | 'vs_open'        // Facing one open raise, no callers
  | 'vs_open_call'   // Facing one raise + one caller
  | 'vs_3bet'        // Facing a 3-bet
  | 'vs_4bet'        // Facing a 4-bet
  | (string & {});   // Extensible — open-ended for future contexts

/** The context that the current UI creates/edits. */
export const DEFAULT_ACTION_CONTEXT: ActionContext = 'RFI';

/**
 * Hand range + threshold for a single (position, action-context) pair.
 * Kept as a flat leaf so it can be shared across positions/contexts via spread.
 */
export interface SituationRange {
  /** Maps every hand notation (e.g. "AKs", "72o", "JJ") to an action. */
  range: Record<string, RangeAction>;
  /** Legacy BB ceiling for the 'call' action. New profiles also store actionBuckets. */
  callThresholdBB: number;
  /** Legacy BB ceiling for the 'limp' action. New profiles also store actionBuckets. */
  limpThresholdBB?: number;
  /** Color/meaning metadata for built-in and user-added threshold actions. */
  actionBuckets?: RangeActionBucket[];
}

/**
 * All range data for a single position.
 *
 * `situations` is keyed by ActionContext.  Today only 'RFI' is written by the
 * UI; the other keys are empty but the structure already supports them so a
 * future "facing a 3-bet" editor can be dropped in without a schema migration.
 */
export interface PositionRangeConfig {
  position: string;
  /**
   * 3-D key: table_size (carried by the parent PlayerProfile) ×
   *           position (this object's .position field) ×
   *           action_before_you (this Record's key).
   *
   * Access pattern today:  positionConfig.situations['RFI']
   * Access pattern later:  positionConfig.situations['vs_3bet']
   */
  situations: Partial<Record<ActionContext, SituationRange>>;
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
  /** Number of players at the table (2–9). Determines which positions exist. */
  tableSize: number;
  /** Global default BB threshold for the 🔵 'call' action. */
  defaultCallThresholdBB: number;
  /** One entry per position for this table size, in EP→BTN→blinds order. */
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

/** Shape of a built-in template (no id/timestamps — assigned on duplication). */
export interface ProfileTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: ProfileType;
  defaultCallThresholdBB: number;
  /** Base SituationRange applied to all positions under 'RFI' when duplicated. */
  baseRange: SituationRange;
  /** Optional exact position ranges, keyed by table size, for researched chart templates. */
  positionRanges?: Partial<Record<number, PositionRangeConfig[]>>;
  postFlop: PlayerProfile['postFlop'];
}
