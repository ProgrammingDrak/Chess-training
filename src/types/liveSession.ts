// ─── Live Session Tracker — Types ────────────────────────────────────────────
//
// Models a real-world poker session at a physical table.  The shape is
// designed so future phases (pot/bet sizes, board cards, showdown hole
// cards) can be added by populating optional fields — no schema migration.
//
// Hand-by-hand action history (per-street fold rates, bet-size-to-fold,
// showdown/muck) is intentionally NOT modeled yet; when added it will live
// inside `LiveHand` as another optional sub-object.
//
// The Position labels here mirror `getPositionsForTableSize()` from
// data/poker/profileTemplates so live and GTO modules stay consistent.

import type { Card } from './poker';
import type { RangeAction } from './profiles';

/** Index of a seat at the table. 0-based, length === LiveSession.tableSize. */
export type SeatId = number;

/** One-card or two-card exposed hand information. */
export type ExposedCards = [Card] | [Card, Card];

export type LiveStreet = 'preflop' | 'flop' | 'turn' | 'river';
export type LiveSessionActiveTab = 'live' | 'statsAdvice' | 'venue';
export type LiveCardPickerMode = 'grid' | 'quick' | 'text';

export type LiveActionType =
  | 'check'
  | 'call'
  | 'fold'
  | 'bet'
  | 'raise'
  | 'all-in'
  | 'post-blind'
  | 'post-straddle';

export interface LiveSessionDetails {
  /** Human-friendly venue or host name, e.g. "Chris's house" or "Harrah's Cherokee". */
  venue?: string;
  /** Street address or location detail for the game. */
  address?: string;
  /** Group tag for filtering later, e.g. "home-game", "casino", "tournament". */
  groupTag?: string;
  /** Freeform game/session notes. */
  notes?: string;
}

export interface BlindLevel {
  /** Hand index at which this blind level becomes active, inclusive. */
  effectiveFromHandIndex: number;
  smallBlind: number;
  bigBlind: number;
  currency?: string;
}

export interface LiveBetSizing {
  /** Seat/player the bet sizing was attached to. */
  seatId: SeatId;
  /** Raw dollar/currency amount of the bet at the time it was entered. */
  amount: number;
  /** Bet converted into big blinds using the blind level active for this hand. */
  amountBB: number;
  /** Pot before the bet, in dollars/currency. */
  potAmount?: number;
  /** Pot before the bet, converted into big blinds. */
  potBB?: number;
  /** Bet as fraction of pot, e.g. 0.5 = half pot, 1 = pot-sized. */
  potFraction?: number;
  /** Big blind used for the conversion so historical hands do not change retroactively. */
  bigBlindAtHand: number;
  /** Small blind used for context at the time of the hand. */
  smallBlindAtHand?: number;
  /** Original entry mode selected by the user. */
  inputMode: 'amount' | 'bb';
}

export interface LiveStraddle {
  /** Seat/player who posted the straddle. */
  seatId: SeatId;
  /** Raw dollar/currency amount of the straddle at the time it was entered. */
  amount: number;
  /** Straddle converted into big blinds using the blind level active for this hand. */
  amountBB: number;
  /** Big blind used for historical conversion. */
  bigBlindAtHand: number;
  /** Original entry mode selected by the user. */
  inputMode: 'amount' | 'bb';
}

export interface LiveHandAction {
  street: LiveStreet;
  seatId: SeatId;
  playerProfileId?: string;
  action: LiveActionType;
  /** Raw dollar/currency amount added by this action. */
  amount?: number;
  /** Amount added by this action in big blinds. */
  amountBB?: number;
  potBeforeBB: number;
  potAfterBB: number;
  order: number;
  createdAt?: string;
}

export interface LiveStackSnapshot {
  seatId: SeatId;
  playerProfileId: string;
  startingStack: number;
  startingStackBB: number;
  endingStack: number;
  endingStackBB: number;
}

export interface LivePlayerTag {
  playerProfileId: string;
  label: string;
  note?: string;
  createdAt: string;
}

export interface BankrollLog {
  buyIns: number[];
  cashOut: number;
  currency?: string;
  /** cashOut - sum(buyIns) */
  net: number;
  recordedAt: string;
}

export interface LiveSessionPause {
  /** ISO timestamp when the break/pause started. */
  startedAt: string;
  /** ISO timestamp when play resumed; null while currently paused. */
  endedAt: string | null;
}

/**
 * A player occupying a seat for some range of hands.
 *
 * `playerProfileId` is a *reference* into the user's PlayerProfile list
 * (see types/profiles.ts) — never a snapshot. Reading a session later
 * dereferences the current profile so edits propagate to historical views.
 */
export interface SeatPlayer {
  /** PlayerProfile.id — string because profiles use stringified server ids. */
  playerProfileId: string;
  /** Hand index at which this player joined the seat (inclusive). */
  joinedAtHandIndex: number;
  /** Hand index at which this player left (exclusive); null if still seated. */
  leftAtHandIndex: number | null;
}

export interface LiveSeat {
  seatId: SeatId;
  /** null when seat is empty. */
  player: SeatPlayer | null;
}

/**
 * Position labels assignable in a live session. Matches the labels used by
 * `getPositionsForTableSize()` in data/poker/profileTemplates so the two
 * modules can swap freely.
 *
 * Heads-up note: in 2-handed play the BTN player also posts the small blind.
 * We use 'BTN' for that role and 'BB' for the other.
 */
export type LivePosition =
  | 'BTN'
  | 'SB'
  | 'BB'
  | 'UTG'
  | 'UTG+1'
  | 'UTG+2'
  | 'LJ'
  | 'HJ'
  | 'CO';

export interface LiveHandDecisionSnapshot {
  /** Seat whose hole cards were checked against a profile/range. */
  seatId: SeatId;
  /** PlayerProfile.id of the checked player at the time of the hand. */
  playerProfileId: string;
  /** Stored position label for the checked player. */
  position: LivePosition;
  /** Exact hero/check-player hole cards. */
  cards: [Card, Card];
  /** Canonical 169-grid notation, e.g. AKs, AKo, JJ. */
  handNotation: string;
  /** Whether the recommendation came from the selected player profile or fallback GTO chart. */
  source: 'profile' | 'gto';
  /** Selected profile used for the recommendation, when available. */
  profileId?: string;
  profileName?: string;
  /** The action shown to the user during live play. */
  recommendedAction: RangeAction;
  recommendedActionLabel: string;
  /** GTO fallback/comparison action at the same table size and position. */
  gtoAction: RangeAction;
  gtoActionLabel: string;
  /** Optional user-entered actual action for future audit/reporting. */
  playedAction?: RangeAction;
  /** Actual Hero action inferred from the hand action log. */
  playedActionType?: LiveActionType;
  /** Actual amount Hero put in for that action, in BB. */
  playedActionAmountBB?: number;
  /** Whether the inferred Hero action matched the recommendation bucket. */
  followedAdvice?: boolean;
  recommendedBucketKind?: 'fold' | 'limp' | 'callRaise' | 'premium';
  recommendedBucketMaxBB?: number;
}

/**
 * One hand row in a session.
 *
 * Normal completed hands have winner fields populated. Skipped hands are
 * intentionally stored as blank rows with `skipped: true` so hand numbers and
 * dealer-button advancement remain accurate when hands are missed.
 */
export interface LiveHand {
  /** 0-based, monotonically increasing within a session. */
  index: number;
  /** ISO timestamp when the hand started (button assignment time). */
  startedAt: string;
  /** ISO timestamp when the winner was tapped, the chop was saved, or the hand was skipped. */
  endedAt: string;
  /** Seat holding the dealer button when the hand was dealt/skipped. */
  buttonSeat: SeatId;
  /** Table size when this hand was dealt/skipped. */
  tableSize?: number;
  /** Snapshot: seats that were dealt cards or would have been dealt in this hand (clockwise order). */
  seatedPlayers: SeatId[];
  /**
   * Snapshot of player profile ids by seat for this hand. This keeps
   * historical player stats stable if people are later moved to different
   * physical seats.
   */
  seatedPlayerProfileIds?: Record<string, string>;
  /** True when this is a blank placeholder for a hand missed/skipped in real life. */
  skipped?: boolean;
  /** Optional note for why the hand was skipped. */
  skippedReason?: string;
  /** True when the pot was chopped between multiple players. */
  chopped?: boolean;
  /** Seats that shared the chopped pot. */
  chopSeats?: SeatId[];
  /** PlayerProfile.ids that shared the chopped pot. */
  chopPlayerProfileIds?: string[];
  /** Position labels for the chopping players. */
  chopPositions?: LivePosition[];
  /** Seat that won the pot. Omitted for skipped/chopped hands. */
  winnerSeat?: SeatId;
  /** PlayerProfile.id of the winner. Omitted for skipped/chopped hands. */
  winnerPlayerProfileId?: string;
  /** Position label assigned to the winner at hand-end. Omitted for skipped/chopped hands. */
  winnerPosition?: LivePosition;
  /** Exact exposed winning cards, or null when the winner did not show. */
  winningCards?: ExposedCards | null;
  /** Optional profile/range recommendation captured during the live hand. */
  heroDecision?: LiveHandDecisionSnapshot;
  /** Full street-by-street action log for this hand. */
  actions?: LiveHandAction[];
  /** Stack snapshots for players dealt into this hand. */
  stackSnapshots?: LiveStackSnapshot[];
  /** Freeform hand note. */
  notes?: string;
  /** Tags applied while observing this hand. */
  playerTags?: LivePlayerTag[];

  // ── Phase 2: pot + bet sizes ──
  potBB?: number;
  finalPotAmount?: number;
  finalPotBB?: number;
  straddle?: LiveStraddle;
  bets?: { seatId: SeatId; betBB: number }[];
  betSizing?: LiveBetSizing;

  // ── Phase 3: community cards ──
  board?: {
    flop?: [Card | null, Card | null, Card | null];
    turn?: Card | null;
    river?: Card | null;
  };

  // ── Phase 4: showdown hole cards ──
  showdown?: { seatId: SeatId; cards: ExposedCards }[];
}

/**
 * A live poker session at a physical table.
 *
 * `id` is a client-generated UUID (crypto.randomUUID()). Server upserts
 * by this id, so two devices working offline create distinct rows when
 * they eventually sync — no overwrite races.
 */
export interface LiveSession {
  /** Client-generated UUID — stable across offline writes & server sync. */
  id: string;
  /** Optional human label, e.g. "Saturday $2/$5 at Bicycle". */
  name?: string;
  /** Optional venue/address/group metadata for the game. */
  details?: LiveSessionDetails;
  /** ISO timestamp — anchor for hands/hour. */
  startedAt: string;
  /** ISO timestamp set when session is ended; null while active. */
  endedAt: string | null;
  /** Seat count, 2–9. */
  tableSize: number;
  /** Seat that held the button at hand 0. */
  initialButtonSeat: SeatId;
  /**
   * One-hand override used after the active table is resized/reseated. The
   * next recorded hand consumes this value, then normal button advancement
   * resumes from that hand's stored buttonSeat.
   */
  nextButtonSeat?: SeatId;
  /** All seats; length === tableSize. Indices are stable seat positions. */
  seats: LiveSeat[];
  /** Completed hands in chronological order. */
  hands: LiveHand[];
  /** Initial stack baseline for each seated player at session start. */
  initialStacks?: LiveStackSnapshot[];
  /** Session-level player tags/notes. */
  playerTags?: LivePlayerTag[];

  /** Blind levels over time. The last level with effectiveFromHandIndex <= hand index applies. */
  blindLevels?: BlindLevel[];
  /** Backward-compatible current stakes metadata. Prefer blindLevels for hand-level conversion. */
  stakes?: { sbBB?: number; bbBB?: number; currency?: string };
  /** Optional bankroll result recorded when ending the session. */
  bankroll?: BankrollLog;
  /** Breaks that should be excluded from elapsed time, hands/hour, and $/hour. */
  pauses?: LiveSessionPause[];
  /** View-only preferences for the active live-session UI. */
  uiPreferences?: {
    activeTab?: LiveSessionActiveTab;
    cardPickerMode?: LiveCardPickerMode;
  };

  /** Last time the session was modified (ISO). */
  updatedAt: string;
}

// ─── Stats — computed view models ────────────────────────────────────────────
//
// Pure derivations from a LiveSession; no state held here.

export interface PlayerStats {
  playerProfileId: string;
  handsDealtIn: number;
  handsWon: number;
  /** 0–100. */
  winPct: number;
}

export interface PositionStats {
  position: LivePosition;
  handsAtPosition: number;
  handsWonAtPosition: number;
  /** 0–100. */
  winPct: number;
}

export interface PlayerPositionStats {
  playerProfileId: string;
  position: LivePosition;
  handsAtPosition: number;
  handsWonAtPosition: number;
  /** 0–100. */
  winPct: number;
}

export interface ProfitStats {
  net: number;
  dollarsPerHour: number;
  currency: string;
}

export interface ShowdownVisibilityStats {
  /** Normal won pots where show/no-show is known. Chops and skipped hands excluded. */
  knownWonHands: number;
  shownWins: number;
  noShowWins: number;
  unknownWins: number;
  shownPct: number;
  noShowPct: number;
}

export interface PlayerShowdownStats {
  playerProfileId: string;
  wins: number;
  shownWins: number;
  noShowWins: number;
  shownLosingHands: number;
  shownPct: number;
  noShowPct: number;
}

export interface CountPctStats {
  label: string;
  count: number;
  /** 0–100. */
  pct: number;
}

export interface ShowdownProfileStats {
  byPlayer: PlayerShowdownStats[];
  winningHandClasses: CountPctStats[];
  boardTextures: CountPctStats[];
}

export interface BetSizingBucketStats {
  key: string;
  count: number;
  avgBetBB: number;
  avgPotBB: number;
  avgFinalPotBB: number | null;
  avgPotFraction: number | null;
}

export interface BetSizingStats {
  sampleSize: number;
  finalPotSampleSize: number;
  avgBetBB: number;
  avgPotBB: number;
  avgFinalPotBB: number | null;
  avgPotFraction: number | null;
  byPlayer: BetSizingBucketStats[];
  byPosition: BetSizingBucketStats[];
}

export interface AdvisorStats {
  totalAdvice: number;
  recordedActions: number;
  followed: number;
  different: number;
  followPct: number;
}

export interface ActionStatsByPlayer {
  playerProfileId: string;
  hands: number;
  vpip: number;
  pfr: number;
  threeBet: number;
  fourBet: number;
  straddle: number;
  aggressionActions: number;
  passiveActions: number;
  vpipPct: number;
  pfrPct: number;
  threeBetPct: number;
  fourBetPct: number;
  straddlePct: number;
  aggressionFactor: number | null;
}

export interface ActionStats {
  byPlayer: ActionStatsByPlayer[];
}

export interface SessionStats {
  totalHands: number;
  /** Count of hands explicitly recorded as chopped pots. */
  choppedPots: number;
  /** Hands per hour, computed from session.startedAt to (endedAt ?? now). */
  handsPerHour: number;
  /** Elapsed milliseconds used as the denominator above. */
  elapsedMs: number;
  profit: ProfitStats | null;
  showdownVisibility: ShowdownVisibilityStats;
  showdownProfiles: ShowdownProfileStats;
  betSizing: BetSizingStats;
  advisor: AdvisorStats;
  actionStats: ActionStats;
  byPlayer: PlayerStats[];
  byPosition: PositionStats[];
  byPlayerPosition: PlayerPositionStats[];
}
