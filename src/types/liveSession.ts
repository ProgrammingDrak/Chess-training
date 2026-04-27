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

/** Index of a seat at the table.  0-based, length === LiveSession.tableSize. */
export type SeatId = number;

/**
 * A player occupying a seat for some range of hands.
 *
 * `playerProfileId` is a *reference* into the user's PlayerProfile list
 * (see types/profiles.ts) — never a snapshot.  Reading a session later
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
 * Position labels assignable in a live session.  Matches the labels used by
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

/**
 * One completed hand in a session.
 *
 * `winnerPosition` is computed at hand-end and *stored* (not recomputed
 * from raw seat layout later).  This keeps stats deterministic when
 * players join/leave mid-session — the seated set at the time of the
 * hand might not be reconstructable from a static seat list.
 */
export interface LiveHand {
  /** 0-based, monotonically increasing within a session. */
  index: number;
  /** ISO timestamp when the hand started (button assignment time). */
  startedAt: string;
  /** ISO timestamp when the winner was tapped. */
  endedAt: string;
  /** Seat holding the dealer button when the hand was dealt. */
  buttonSeat: SeatId;
  /** Snapshot: seats that were dealt cards in this hand (clockwise order). */
  seatedPlayers: SeatId[];
  /** Seat that won the pot. */
  winnerSeat: SeatId;
  /** PlayerProfile.id of the winner (preserved separately so seat reseats
   *  don't lose attribution). */
  winnerPlayerProfileId: string;
  /** Position label assigned to the winner at hand-end. */
  winnerPosition: LivePosition;

  // ── Phase 2 (deferred): pot + bet sizes ──
  potBB?: number;
  bets?: { seatId: SeatId; betBB: number }[];

  // ── Phase 3 (deferred): community cards ──
  board?: { flop?: [Card, Card, Card]; turn?: Card; river?: Card };

  // ── Phase 4 (deferred): showdown hole cards ──
  showdown?: { seatId: SeatId; cards: [Card, Card] }[];
}

/**
 * A live poker session at a physical table.
 *
 * `id` is a client-generated UUID (crypto.randomUUID()).  Server upserts
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
  /** All seats; length === tableSize.  Indices are stable seat positions. */
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
