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

  // ── Phase 2 (deferred): pot + bet sizes ──
  potBB?: number;
  bets?: { seatId: SeatId; betBB: number }[];

  // ── Phase 3 (deferred): community cards ──
  board?: {
    flop?: [Card | null, Card | null, Card | null];
    turn?: Card | null;
    river?: Card | null;
  };

  // ── Phase 4 (deferred): showdown hole cards ──
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

  // ── Phase 2 (deferred): stakes metadata ──
  stakes?: { sbBB?: number; bbBB?: number; currency?: string };

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

export interface SessionStats {
  totalHands: number;
  /** Hands per hour, computed from session.startedAt to (endedAt ?? now). */
  handsPerHour: number;
  /** Elapsed milliseconds used as the denominator above. */
  elapsedMs: number;
  byPlayer: PlayerStats[];
  byPosition: PositionStats[];
}
