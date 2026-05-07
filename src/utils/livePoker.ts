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
  PlayerPositionStats,
  BetSizingBucketStats,
  CountPctStats,
} from '../types/liveSession';
import type { Card } from '../types/poker';
import { classifyHandType } from './poker';
import { computeActionStats } from './liveHandEngine';

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

function playerIdForSeat(session: LiveSession, hand: LiveSession['hands'][number], seatId: SeatId): string | null {
  return hand.seatedPlayerProfileIds?.[String(seatId)]
    ?? session.seats.find(s => s.seatId === seatId)?.player?.playerProfileId
    ?? null;
}

function addCount<K>(map: Map<K, number>, key: K, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

const RANK_VALUE: Record<Card['rank'], number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
};

function cardsToNotation(cards: [Card, Card]): string {
  const [first, second] = cards;
  if (first.rank === second.rank) return `${first.rank}${second.rank}`;
  const [high, low] = RANK_VALUE[first.rank] >= RANK_VALUE[second.rank]
    ? [first, second]
    : [second, first];
  return `${high.rank}${low.rank}${first.suit === second.suit ? 's' : 'o'}`;
}

function winningHandClass(cards: [Card] | [Card, Card]): string {
  if (cards.length === 1) return 'One card shown';
  const notation = cardsToNotation(cards);
  const type = classifyHandType(notation);
  if (type === 'premium') return 'Premium';
  if (type === 'interesting') return 'Playable / speculative';
  return 'Other';
}

function boardCards(hand: LiveSession['hands'][number]): Card[] {
  const board = hand.board;
  if (!board) return [];
  return [
    ...(board.flop ?? []),
    board.turn ?? null,
    board.river ?? null,
  ].filter((card): card is Card => card !== null);
}

function boardTextureLabels(cards: Card[]): string[] {
  if (cards.length < 3) return [];
  const labels: string[] = [];
  const ranks = cards.map(card => card.rank);
  const suits = cards.map(card => card.suit);
  const uniqueRanks = new Set(ranks);
  const uniqueSuits = new Set(suits);
  const values = [...new Set(cards.map(card => RANK_VALUE[card.rank]))].sort((a, b) => a - b);

  if (uniqueRanks.size < ranks.length) labels.push('Paired');
  if (uniqueSuits.size === 1) labels.push('Monotone');
  else if (uniqueSuits.size === 2) labels.push('Two-tone');
  else labels.push('Rainbow');

  for (let i = 0; i <= values.length - 3; i++) {
    if (values[i + 2] - values[i] <= 4) {
      labels.push('Connected');
      break;
    }
  }
  if (cards.some(card => ['A', 'K', 'Q'].includes(card.rank))) labels.push('High-card');
  return labels;
}

function countPctRows(counts: Map<string, number>, denominator: number): CountPctStats[] {
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count, pct: pct(count, denominator) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

interface BetSample {
  playerProfileId: string | null;
  position: LivePosition | null;
  betBB: number;
  potBB: number;
  finalPotBB: number | null;
  potFraction: number | null;
}

function pauseDurationMs(session: LiveSession, endMs: number): number {
  const sessionStart = Date.parse(session.startedAt);
  return (session.pauses ?? []).reduce((sum, pause) => {
    const pauseStart = Date.parse(pause.startedAt);
    if (!Number.isFinite(pauseStart)) return sum;
    const pauseEnd = pause.endedAt ? Date.parse(pause.endedAt) : endMs;
    if (!Number.isFinite(pauseEnd)) return sum;
    const clippedStart = Math.max(sessionStart, pauseStart);
    const clippedEnd = Math.min(endMs, pauseEnd);
    return sum + Math.max(0, clippedEnd - clippedStart);
  }, 0);
}

function betBucketStats(key: string, samples: BetSample[]): BetSizingBucketStats {
  return {
    key,
    count: samples.length,
    avgBetBB: average(samples.map(sample => sample.betBB)) ?? 0,
    avgPotBB: average(samples.map(sample => sample.potBB)) ?? 0,
    avgFinalPotBB: average(samples.flatMap(sample => sample.finalPotBB === null ? [] : [sample.finalPotBB])),
    avgPotFraction: average(samples.flatMap(sample => sample.potFraction === null ? [] : [sample.potFraction])),
  };
}

/**
 * Compute aggregate stats for a session.  `nowMs` lets callers stub the
 * clock for testing or for paused/ended sessions.
 */
export function computeStats(session: LiveSession, nowMs?: number): SessionStats {
  const totalHands = session.hands.length;
  const choppedPots = session.hands.filter(hand => hand.chopped).length;
  const startMs = Date.parse(session.startedAt);
  const endMs = session.endedAt ? Date.parse(session.endedAt) : (nowMs ?? Date.now());
  const elapsedMs = Math.max(0, endMs - startMs - pauseDurationMs(session, endMs));
  const handsPerHour = elapsedMs > 0 ? (totalHands / elapsedMs) * 3_600_000 : 0;
  const elapsedHours = elapsedMs / 3_600_000;
  const profit = session.bankroll && elapsedHours > 0
    ? {
        net: session.bankroll.net,
        dollarsPerHour: session.bankroll.net / elapsedHours,
        currency: session.bankroll.currency ?? session.stakes?.currency ?? '$',
      }
    : null;

  // Per-player: skipped hands are table-volume placeholders only. Chopped pots
  // award one full win of credit to each chopping player.
  const playerDealt = new Map<string, number>();
  const playerWon = new Map<string, number>();
  const playerPositionDealt = new Map<string, number>();
  const playerPositionWon = new Map<string, number>();
  const playerPositionMeta = new Map<string, { playerProfileId: string; position: LivePosition }>();
  const playerShowdown = new Map<string, {
    wins: number;
    shownWins: number;
    noShowWins: number;
    shownLosingHands: number;
  }>();
  const handClassCounts = new Map<string, number>();
  const boardTextureCounts = new Map<string, number>();
  const betSamples: BetSample[] = [];
  let shownWins = 0;
  let noShowWins = 0;
  let unknownWins = 0;
  let adviceTotal = 0;
  let recordedActions = 0;
  let followed = 0;

  for (const hand of session.hands) {
    if (hand.skipped) continue;

    const positionMap = derivePositions(hand.buttonSeat, hand.seatedPlayers, hand.tableSize ?? session.tableSize);
    const dealtPlayerIds = new Set<string>();
    for (const seatId of hand.seatedPlayers) {
      const pid = playerIdForSeat(session, hand, seatId);
      if (pid) dealtPlayerIds.add(pid);

      const position = positionMap.get(seatId);
      if (pid && position) {
        const key = `${pid}|${position}`;
        addCount(playerPositionDealt, key);
        playerPositionMeta.set(key, { playerProfileId: pid, position });
      }
    }
    for (const pid of dealtPlayerIds) {
      addCount(playerDealt, pid);
    }

    if (hand.chopped && hand.chopPlayerProfileIds && hand.chopPlayerProfileIds.length > 0) {
      for (const pid of hand.chopPlayerProfileIds) {
        addCount(playerWon, pid);
      }
    } else if (hand.winnerPlayerProfileId) {
      addCount(playerWon, hand.winnerPlayerProfileId);
    }

    if (hand.chopped && hand.chopSeats && hand.chopSeats.length > 0) {
      hand.chopSeats.forEach((seatId, index) => {
        const pid = hand.chopPlayerProfileIds?.[index] ?? playerIdForSeat(session, hand, seatId);
        const position = hand.chopPositions?.[index] ?? positionMap.get(seatId);
        if (!pid || !position) return;
        const key = `${pid}|${position}`;
        addCount(playerPositionWon, key);
        playerPositionMeta.set(key, { playerProfileId: pid, position });
      });
    } else if (hand.winnerPlayerProfileId && hand.winnerPosition) {
      const key = `${hand.winnerPlayerProfileId}|${hand.winnerPosition}`;
      addCount(playerPositionWon, key);
      playerPositionMeta.set(key, {
        playerProfileId: hand.winnerPlayerProfileId,
        position: hand.winnerPosition,
      });
    }

    if (!hand.chopped && hand.winnerPlayerProfileId) {
      const row = playerShowdown.get(hand.winnerPlayerProfileId) ?? {
        wins: 0,
        shownWins: 0,
        noShowWins: 0,
        shownLosingHands: 0,
      };
      row.wins += 1;
      if (hand.winningCards === null) {
        row.noShowWins += 1;
        noShowWins += 1;
      } else if (hand.winningCards) {
        row.shownWins += 1;
        shownWins += 1;
        addCount(handClassCounts, winningHandClass(hand.winningCards));
      } else {
        unknownWins += 1;
      }
      playerShowdown.set(hand.winnerPlayerProfileId, row);
    }

    if (hand.showdown) {
      for (const shown of hand.showdown) {
        const pid = playerIdForSeat(session, hand, shown.seatId);
        if (!pid) continue;
        const row = playerShowdown.get(pid) ?? {
          wins: 0,
          shownWins: 0,
          noShowWins: 0,
          shownLosingHands: 0,
        };
        row.shownLosingHands += 1;
        playerShowdown.set(pid, row);
      }
    }

    const textures = boardTextureLabels(boardCards(hand));
    for (const texture of textures) addCount(boardTextureCounts, texture);

    const betSizing = hand.betSizing;
    if (betSizing && betSizing.amountBB > 0) {
      const potBB = hand.potBB ?? betSizing.potBB ?? 0;
      betSamples.push({
        playerProfileId: playerIdForSeat(session, hand, betSizing.seatId),
        position: positionMap.get(betSizing.seatId) ?? null,
        betBB: betSizing.amountBB,
        potBB,
        finalPotBB: hand.finalPotBB ?? null,
        potFraction: betSizing.potFraction ?? (potBB > 0 ? betSizing.amountBB / potBB : null),
      });
    }

    if (hand.heroDecision) {
      adviceTotal += 1;
      if (hand.heroDecision.followedAdvice !== undefined || hand.heroDecision.playedAction || hand.heroDecision.playedActionType) {
        recordedActions += 1;
        if (hand.heroDecision.followedAdvice ?? hand.heroDecision.playedAction === hand.heroDecision.recommendedAction) followed += 1;
      }
    }
  }

  const byPlayer: PlayerStats[] = Array.from(playerDealt.entries()).map(
    ([playerProfileId, handsDealtIn]) => {
      const handsWon = playerWon.get(playerProfileId) ?? 0;
      return {
        playerProfileId,
        handsDealtIn,
        handsWon,
        winPct: pct(handsWon, handsDealtIn),
      };
    },
  );

  const byPlayerPosition: PlayerPositionStats[] = Array.from(playerPositionDealt.entries()).map(
    ([key, handsAtPosition]) => {
      const meta = playerPositionMeta.get(key)!;
      const handsWonAtPosition = playerPositionWon.get(key) ?? 0;
      return {
        ...meta,
        handsAtPosition,
        handsWonAtPosition,
        winPct: pct(handsWonAtPosition, handsAtPosition),
      };
    },
  );

  // Per-position: skipped hands are table-volume placeholders only. Chopped
  // pots award one full win of credit to each chopping position.
  const posDealt = new Map<LivePosition, number>();
  const posWon = new Map<LivePosition, number>();

  for (const hand of session.hands) {
    if (hand.skipped) continue;

    const map = derivePositions(hand.buttonSeat, hand.seatedPlayers, hand.tableSize ?? session.tableSize);
    for (const pos of map.values()) {
      addCount(posDealt, pos);
    }

    if (hand.chopped && hand.chopPositions && hand.chopPositions.length > 0) {
      for (const pos of hand.chopPositions) {
        addCount(posWon, pos);
      }
    } else if (hand.winnerPosition) {
      addCount(posWon, hand.winnerPosition);
    }
  }

  const byPosition: PositionStats[] = Array.from(posDealt.entries()).map(
    ([position, handsAtPosition]) => {
      const handsWonAtPosition = posWon.get(position) ?? 0;
      return {
        position,
        handsAtPosition,
        handsWonAtPosition,
        winPct: pct(handsWonAtPosition, handsAtPosition),
      };
    },
  );

  const knownWonHands = shownWins + noShowWins;
  const byShowdownPlayer = Array.from(playerShowdown.entries())
    .map(([playerProfileId, row]) => ({
      playerProfileId,
      ...row,
      shownPct: pct(row.shownWins, row.shownWins + row.noShowWins),
      noShowPct: pct(row.noShowWins, row.shownWins + row.noShowWins),
    }))
    .sort((a, b) => b.wins - a.wins || b.shownLosingHands - a.shownLosingHands);

  const betByPlayer = new Map<string, BetSample[]>();
  const betByPosition = new Map<string, BetSample[]>();
  for (const sample of betSamples) {
    if (sample.playerProfileId) {
      betByPlayer.set(sample.playerProfileId, [...(betByPlayer.get(sample.playerProfileId) ?? []), sample]);
    }
    if (sample.position) {
      betByPosition.set(sample.position, [...(betByPosition.get(sample.position) ?? []), sample]);
    }
  }

  const betSizing = {
    sampleSize: betSamples.length,
    finalPotSampleSize: betSamples.filter(sample => sample.finalPotBB !== null).length,
    avgBetBB: average(betSamples.map(sample => sample.betBB)) ?? 0,
    avgPotBB: average(betSamples.map(sample => sample.potBB)) ?? 0,
    avgFinalPotBB: average(betSamples.flatMap(sample => sample.finalPotBB === null ? [] : [sample.finalPotBB])),
    avgPotFraction: average(betSamples.flatMap(sample => sample.potFraction === null ? [] : [sample.potFraction])),
    byPlayer: Array.from(betByPlayer.entries())
      .map(([key, samples]) => betBucketStats(key, samples))
      .sort((a, b) => b.count - a.count),
    byPosition: Array.from(betByPosition.entries())
      .map(([key, samples]) => betBucketStats(key, samples))
      .sort((a, b) => b.count - a.count),
  };

  return {
    totalHands,
    choppedPots,
    handsPerHour,
    elapsedMs,
    profit,
    showdownVisibility: {
      knownWonHands,
      shownWins,
      noShowWins,
      unknownWins,
      shownPct: pct(shownWins, knownWonHands),
      noShowPct: pct(noShowWins, knownWonHands),
    },
    showdownProfiles: {
      byPlayer: byShowdownPlayer,
      winningHandClasses: countPctRows(handClassCounts, shownWins),
      boardTextures: countPctRows(boardTextureCounts, session.hands.filter(hand => boardCards(hand).length >= 3).length),
    },
    betSizing,
    advisor: {
      totalAdvice: adviceTotal,
      recordedActions,
      followed,
      different: recordedActions - followed,
      followPct: pct(followed, recordedActions),
    },
    actionStats: {
      byPlayer: computeActionStats(session),
    },
    byPlayer,
    byPosition,
    byPlayerPosition,
  };
}
