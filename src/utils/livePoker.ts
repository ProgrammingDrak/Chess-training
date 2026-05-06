// ─── Live Session Tracker — Pure Logic ───────────────────────────────────────
//
// All functions here are PURE: they take session/hand data and return
// derived values.  No I/O, no React, no localStorage.  Tested in
// livePoker.test.ts.

import type {
  LiveSession,
  LiveSeat,
  SeatId,
  LivePosition,
  SessionStats,
  PlayerStats,
  PositionStats,
} from '../types/liveSession';

// ─── Position labels by occupied-count ───────────────────────────────────────
//
// Clockwise from the dealer button.  These are derived from
// `POSITIONS_BY_TABLE_SIZE` in data/poker/profileTemplates but rotated to
// start at BTN so we can zip them onto a clockwise-from-button seat list.
//
// Heads-up note: in 2-handed play the BTN player also posts the small blind,
// so there is no 'SB' label — just BTN (which acts as SB) and BB.

const LABELS_BY_OCCUPIED_COUNT: Record<number, LivePosition[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'HJ', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
};

export function positionLabelsClockwiseFromButton(occupiedCount: number): LivePosition[] {
  return LABELS_BY_OCCUPIED_COUNT[occupiedCount] ?? [];
}

// ─── Seat helpers ────────────────────────────────────────────────────────────

/**
 * Return the seats occupied *at the start of* a given hand index, in
 * ascending seat-id order.  A seat is occupied iff there is a player whose
 * `[joinedAtHandIndex, leftAtHandIndex)` interval contains the hand index.
 */
export function occupiedSeatsAt(seats: LiveSeat[], handIndex: number): SeatId[] {
  return seats
    .filter(s => {
      const p = s.player;
      if (!p) return false;
      if (handIndex < p.joinedAtHandIndex) return false;
      if (p.leftAtHandIndex !== null && handIndex >= p.leftAtHandIndex) return false;
      return true;
    })
    .map(s => s.seatId)
    .sort((a, b) => a - b);
}

/**
 * Next clockwise seat (mod tableSize) starting from `from + 1` that is
 * present in `occupied`.  Returns null if the set is empty or the only
 * occupied seat is `from` itself (no other seat to advance to).
 */
export function nextOccupiedClockwise(
  from: SeatId,
  occupied: SeatId[],
  tableSize: number,
): SeatId | null {
  if (occupied.length === 0) return null;
  const set = new Set(occupied);
  for (let step = 1; step <= tableSize; step++) {
    const candidate = (from + step) % tableSize;
    if (set.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Advance the dealer button one seat clockwise to the next occupied seat.
 * Returns null only when no seats are occupied.
 */
export function advanceButton(
  currentButton: SeatId,
  occupiedNext: SeatId[],
  tableSize: number,
): SeatId | null {
  if (occupiedNext.length === 0) return null;
  return nextOccupiedClockwise(currentButton, occupiedNext, tableSize);
}

// ─── Position derivation ─────────────────────────────────────────────────────

/**
 * Map each occupied seat to its position label for one hand.
 *
 * Algorithm: rotate `occupied` so the button seat is first, walk clockwise
 * around the (mod tableSize) circle, and zip with the canonical label list
 * for that occupied-count.  Heads-up uses the special 2-label list
 * ['BTN', 'BB'] — there is no 'SB' position.
 */
export function derivePositions(
  buttonSeat: SeatId,
  occupied: SeatId[],
  tableSize: number,
): Map<SeatId, LivePosition> {
  const result = new Map<SeatId, LivePosition>();
  if (occupied.length < 2) return result;
  const labels = positionLabelsClockwiseFromButton(occupied.length);
  if (labels.length === 0) return result;

  // Walk seats clockwise starting at buttonSeat, collecting occupied ones.
  const set = new Set(occupied);
  const ordered: SeatId[] = [];
  for (let step = 0; step < tableSize && ordered.length < occupied.length; step++) {
    const seat = (buttonSeat + step) % tableSize;
    if (set.has(seat)) ordered.push(seat);
  }

  ordered.forEach((seat, i) => result.set(seat, labels[i]));
  return result;
}

// ─── Mid-session join eligibility ────────────────────────────────────────────

/**
 * Can a new player be seated at `newSeat` next hand?
 *
 * Rule (per spec): joining player cannot be the SB or BB on their first
 * hand.  We compute the SB/BB for the next hand assuming:
 *   1. The button advances clockwise to the next currently-occupied seat
 *      (independent of the new player — the button never lands on someone
 *      who wasn't dealt in last hand).
 *   2. The seated set for the next hand is `occupiedNow ∪ {newSeat}`.
 *   3. SB = next clockwise from new button among the post-join set.
 *   4. BB = next clockwise from SB among the post-join set.
 *
 * Returns false if the seat is already occupied, out of range, or would
 * make the new player SB/BB.  In heads-up→3-handed transitions a real SB
 * exists for the first time; the new player still can't sit there.
 */
export function canSeatNewPlayerAt(
  newSeat: SeatId,
  currentButton: SeatId,
  occupiedNow: SeatId[],
  tableSize: number,
): boolean {
  if (newSeat < 0 || newSeat >= tableSize) return false;
  if (occupiedNow.includes(newSeat)) return false;
  if (occupiedNow.length === 0) return true; // first player ever — anywhere

  const newButton = advanceButton(currentButton, occupiedNow, tableSize);
  if (newButton === null) return true;

  const occupiedNext = [...occupiedNow, newSeat].sort((a, b) => a - b);

  // Heads-up after join → BTN+BB only; no SB position to forbid.
  if (occupiedNext.length === 2) {
    // newSeat would be either BTN (only if newButton === newSeat, impossible
    // since newButton is in occupiedNow) or BB.  Posting to enter as BB is
    // forbidden by the spec — but also impossible: with just 1 player before
    // join + 1 new, the new player IS BB.  So: forbid.
    return false;
  }

  const sb = nextOccupiedClockwise(newButton, occupiedNext, tableSize);
  if (sb === newSeat) return false;
  const bb = sb === null ? null : nextOccupiedClockwise(sb, occupiedNext, tableSize);
  if (bb === newSeat) return false;
  return true;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

/**
 * Compute aggregate stats for a session.  `nowMs` lets callers stub the
 * clock for testing or for paused/ended sessions.
 */
export function computeStats(session: LiveSession, nowMs?: number): SessionStats {
  const totalHands = session.hands.length;
  const startMs = Date.parse(session.startedAt);
  const endMs = session.endedAt ? Date.parse(session.endedAt) : (nowMs ?? Date.now());
  const elapsedMs = Math.max(0, endMs - startMs);
  const handsPerHour = elapsedMs > 0 ? (totalHands / elapsedMs) * 3_600_000 : 0;

  // Per-player: skipped hands are placeholders only. Chopped pots split one
  // win of credit evenly across all chopping players.
  const playerDealt = new Map<string, number>();
  const playerWon = new Map<string, number>();

  for (const hand of session.hands) {
    if (hand.skipped) continue;

    const dealtPlayerIds = new Set<string>();
    for (const seatId of hand.seatedPlayers) {
      const pid = hand.seatedPlayerProfileIds?.[String(seatId)]
        ?? session.seats.find(s => s.seatId === seatId)?.player?.playerProfileId;
      if (pid) dealtPlayerIds.add(pid);
    }
    for (const pid of dealtPlayerIds) {
      playerDealt.set(pid, (playerDealt.get(pid) ?? 0) + 1);
    }

    if (hand.chopped && hand.chopPlayerProfileIds && hand.chopPlayerProfileIds.length > 0) {
      const credit = 1 / hand.chopPlayerProfileIds.length;
      for (const pid of hand.chopPlayerProfileIds) {
        playerWon.set(pid, (playerWon.get(pid) ?? 0) + credit);
      }
    } else if (hand.winnerPlayerProfileId) {
      playerWon.set(
        hand.winnerPlayerProfileId,
        (playerWon.get(hand.winnerPlayerProfileId) ?? 0) + 1,
      );
    }
  }

  const byPlayer: PlayerStats[] = Array.from(playerDealt.entries()).map(
    ([playerProfileId, handsDealtIn]) => {
      const handsWon = playerWon.get(playerProfileId) ?? 0;
      return {
        playerProfileId,
        handsDealtIn,
        handsWon,
        winPct: handsDealtIn > 0 ? (handsWon / handsDealtIn) * 100 : 0,
      };
    },
  );

  // Per-position: skipped hands are ignored for dealt/won rates. Chopped pots
  // split one position win of credit across the chopping positions.
  const posDealt = new Map<LivePosition, number>();
  const posWon = new Map<LivePosition, number>();

  for (const hand of session.hands) {
    if (hand.skipped) continue;

    const map = derivePositions(hand.buttonSeat, hand.seatedPlayers, hand.tableSize ?? session.tableSize);
    for (const pos of map.values()) {
      posDealt.set(pos, (posDealt.get(pos) ?? 0) + 1);
    }

    if (hand.chopped && hand.chopPositions && hand.chopPositions.length > 0) {
      const credit = 1 / hand.chopPositions.length;
      for (const pos of hand.chopPositions) {
        posWon.set(pos, (posWon.get(pos) ?? 0) + credit);
      }
    } else if (hand.winnerPosition) {
      posWon.set(hand.winnerPosition, (posWon.get(hand.winnerPosition) ?? 0) + 1);
    }
  }

  const byPosition: PositionStats[] = Array.from(posDealt.entries()).map(
    ([position, handsAtPosition]) => {
      const handsWonAtPosition = posWon.get(position) ?? 0;
      return {
        position,
        handsAtPosition,
        handsWonAtPosition,
        winPct: handsAtPosition > 0 ? (handsWonAtPosition / handsAtPosition) * 100 : 0,
      };
    },
  );

  return { totalHands, handsPerHour, elapsedMs, byPlayer, byPosition };
}
