import { describe, it, expect } from 'vitest';
import {
  positionLabelsClockwiseFromButton,
  occupiedSeatsAt,
  nextOccupiedClockwise,
  advanceButton,
  derivePositions,
  canSeatNewPlayerAt,
  computeStats,
} from './livePoker';
import type { LiveSession, LiveSeat } from '../types/liveSession';

// ─── Position label tables ──────────────────────────────────────────────────

describe('positionLabelsClockwiseFromButton', () => {
  it('returns labels with BTN first for every legal table size', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8, 9]) {
      const labels = positionLabelsClockwiseFromButton(n);
      expect(labels).toHaveLength(n);
      expect(labels[0]).toBe('BTN');
    }
  });
  it('uses BTN+BB for heads-up (no SB)', () => {
    expect(positionLabelsClockwiseFromButton(2)).toEqual(['BTN', 'BB']);
  });
  it('places SB and BB immediately after BTN for 3+ handed', () => {
    expect(positionLabelsClockwiseFromButton(3)).toEqual(['BTN', 'SB', 'BB']);
    expect(positionLabelsClockwiseFromButton(6)).toEqual(['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO']);
    expect(positionLabelsClockwiseFromButton(9)).toEqual([
      'BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO',
    ]);
  });
  it('returns [] for unsupported counts', () => {
    expect(positionLabelsClockwiseFromButton(0)).toEqual([]);
    expect(positionLabelsClockwiseFromButton(1)).toEqual([]);
    expect(positionLabelsClockwiseFromButton(10)).toEqual([]);
  });
});

// ─── Seat helpers ───────────────────────────────────────────────────────────

function seat(seatId: number, playerProfileId: string | null, joinedAt = 0, leftAt: number | null = null): LiveSeat {
  return {
    seatId,
    player: playerProfileId === null ? null : {
      playerProfileId,
      joinedAtHandIndex: joinedAt,
      leftAtHandIndex: leftAt,
    },
  };
}

describe('occupiedSeatsAt', () => {
  it('includes seats where the player is currently seated', () => {
    const seats = [seat(0, 'a'), seat(1, null), seat(2, 'b')];
    expect(occupiedSeatsAt(seats, 0)).toEqual([0, 2]);
  });
  it('excludes seats where the player has left', () => {
    const seats = [seat(0, 'a', 0, 5), seat(1, 'b'), seat(2, 'c')];
    expect(occupiedSeatsAt(seats, 4)).toEqual([0, 1, 2]);
    expect(occupiedSeatsAt(seats, 5)).toEqual([1, 2]); // a left at hand 5
  });
  it('excludes seats where the player has not yet joined', () => {
    const seats = [seat(0, 'a'), seat(1, 'b', 3)];
    expect(occupiedSeatsAt(seats, 2)).toEqual([0]);
    expect(occupiedSeatsAt(seats, 3)).toEqual([0, 1]);
  });
});

describe('nextOccupiedClockwise', () => {
  it('finds the next occupied seat clockwise', () => {
    expect(nextOccupiedClockwise(0, [0, 2, 4], 6)).toBe(2);
    expect(nextOccupiedClockwise(2, [0, 2, 4], 6)).toBe(4);
  });
  it('wraps around the table', () => {
    expect(nextOccupiedClockwise(4, [0, 2, 4], 6)).toBe(0);
    expect(nextOccupiedClockwise(5, [0, 2, 4], 6)).toBe(0);
  });
  it('returns the same seat when it is the only occupied one', () => {
    expect(nextOccupiedClockwise(0, [3], 6)).toBe(3);
    expect(nextOccupiedClockwise(3, [3], 6)).toBe(3);
  });
  it('returns null when no seats are occupied', () => {
    expect(nextOccupiedClockwise(0, [], 6)).toBeNull();
  });
});

// ─── Button advancement ─────────────────────────────────────────────────────

describe('advanceButton', () => {
  it('advances clockwise by one when the next seat is occupied', () => {
    expect(advanceButton(0, [0, 1, 2, 3], 4)).toBe(1);
  });
  it('skips empty seats', () => {
    // Button on seat 0; seats 1, 2 empty; next occupied is 3.
    expect(advanceButton(0, [0, 3, 5], 6)).toBe(3);
  });
  it('skips a seat whose player departed before getting the button', () => {
    // Button is on 2; seat 3 was occupied last hand by a player who left;
    // occupiedNext reflects the post-departure set, so button skips to 5.
    expect(advanceButton(2, [0, 2, 5], 6)).toBe(5);
  });
  it('wraps from the last seat back to the first', () => {
    expect(advanceButton(5, [0, 2, 4], 6)).toBe(0);
  });
  it('returns null when no one is seated', () => {
    expect(advanceButton(0, [], 6)).toBeNull();
  });
});

// ─── Position derivation ────────────────────────────────────────────────────

describe('derivePositions', () => {
  it('heads-up: BTN + BB (no SB)', () => {
    const map = derivePositions(0, [0, 3], 6);
    expect(map.get(0)).toBe('BTN');
    expect(map.get(3)).toBe('BB');
    expect(map.size).toBe(2);
  });
  it('3-handed: BTN, SB, BB clockwise', () => {
    const map = derivePositions(1, [1, 3, 5], 6);
    expect(map.get(1)).toBe('BTN');
    expect(map.get(3)).toBe('SB');
    expect(map.get(5)).toBe('BB');
  });
  it('6-handed full: full label set', () => {
    const map = derivePositions(0, [0, 1, 2, 3, 4, 5], 6);
    expect(map.get(0)).toBe('BTN');
    expect(map.get(1)).toBe('SB');
    expect(map.get(2)).toBe('BB');
    expect(map.get(3)).toBe('UTG');
    expect(map.get(4)).toBe('HJ');
    expect(map.get(5)).toBe('CO');
  });
  it('9-handed full: includes UTG+1, UTG+2, LJ', () => {
    const map = derivePositions(0, [0, 1, 2, 3, 4, 5, 6, 7, 8], 9);
    expect(map.get(0)).toBe('BTN');
    expect(map.get(3)).toBe('UTG');
    expect(map.get(4)).toBe('UTG+1');
    expect(map.get(5)).toBe('UTG+2');
    expect(map.get(6)).toBe('LJ');
    expect(map.get(7)).toBe('HJ');
    expect(map.get(8)).toBe('CO');
  });
  it('skips empty seats when assigning positions', () => {
    // 9-max table, only seats 0, 2, 4, 7 occupied → 4-handed labels.
    const map = derivePositions(0, [0, 2, 4, 7], 9);
    expect(map.get(0)).toBe('BTN');
    expect(map.get(2)).toBe('SB');
    expect(map.get(4)).toBe('BB');
    expect(map.get(7)).toBe('CO');
  });
  it('wraps around the table when button is near the end', () => {
    // Button on seat 8 of 9-max with seats 0, 2, 8 occupied.
    const map = derivePositions(8, [0, 2, 8], 9);
    expect(map.get(8)).toBe('BTN');
    expect(map.get(0)).toBe('SB');
    expect(map.get(2)).toBe('BB');
  });
  it('returns empty map when fewer than 2 players seated', () => {
    expect(derivePositions(0, [0], 6).size).toBe(0);
    expect(derivePositions(0, [], 6).size).toBe(0);
  });
});

// ─── Mid-session join eligibility ───────────────────────────────────────────

describe('canSeatNewPlayerAt', () => {
  it('forbids sitting in an already-occupied seat', () => {
    expect(canSeatNewPlayerAt(2, 0, [0, 2, 4], 6)).toBe(false);
  });
  it('forbids sitting out of range', () => {
    expect(canSeatNewPlayerAt(-1, 0, [0, 2, 4], 6)).toBe(false);
    expect(canSeatNewPlayerAt(6, 0, [0, 2, 4], 6)).toBe(false);
  });
  it('allows the very first player to sit anywhere', () => {
    expect(canSeatNewPlayerAt(3, 0, [], 6)).toBe(true);
  });
  it('forbids the seat that would become SB next hand', () => {
    // 6-max, seats 0 and 3 occupied, button on 0.  Adding a 3rd player:
    //   newButton (without new player) = 3
    //   sb = next clockwise from 3 in {0, 3, X} → X if X is between 3 and 0
    // Seat 4 sits between 3 and 0 clockwise → would be SB → forbidden.
    expect(canSeatNewPlayerAt(4, 0, [0, 3], 6)).toBe(false);
  });
  it('forbids the seat that would become BB next hand', () => {
    // 6-max, seats 0, 2 occupied, button on 0.
    //   newButton = 2
    //   With seat 5 added → set {0, 2, 5}; sb = 5; bb = 0 → seat 5 = SB.
    // Try seat 3: set {0, 2, 3}; sb = 3 → forbidden as SB.
    // Try seat 1: set {0, 1, 2}; newButton from {0, 2} (no new) = 2;
    //   sb = nextClockwise(2, {0,1,2}) = 0; bb = nextClockwise(0, {0,1,2}) = 1
    //   → seat 1 = BB → forbidden.
    expect(canSeatNewPlayerAt(1, 0, [0, 2], 6)).toBe(false);
  });
  it('allows seating in a seat that becomes a non-blind position', () => {
    // 6-max, seats 0, 2, 4 occupied, button on 0.  Adding seat 5:
    //   newButton = 2; set incl. seat 5 = {0, 2, 4, 5}
    //   sb = next clockwise from 2 = 4; bb = next from 4 = 5 → BB → forbidden
    // Try seat 1 instead: set = {0, 1, 2, 4}; sb = 4; bb = 0 → seat 1 is CO.
    expect(canSeatNewPlayerAt(1, 0, [0, 2, 4], 6)).toBe(true);
  });
  it('forbids joining a heads-up table (new player would be BB)', () => {
    // Adding to HU always makes the new player BB on the next hand —
    // there is no non-blind seat available.
    expect(canSeatNewPlayerAt(2, 0, [0, 3], 6)).toBe(false);
    expect(canSeatNewPlayerAt(4, 0, [0, 3], 6)).toBe(false);
  });
});

// ─── Stats ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<LiveSession> = {}): LiveSession {
  return {
    id: 'sess-1',
    startedAt: '2026-04-26T18:00:00.000Z',
    endedAt: null,
    tableSize: 6,
    initialButtonSeat: 0,
    seats: [
      seat(0, 'alice'),
      seat(1, 'bob'),
      seat(2, 'carol'),
      seat(3, null),
      seat(4, null),
      seat(5, null),
    ],
    hands: [],
    updatedAt: '2026-04-26T18:00:00.000Z',
    ...overrides,
  };
}

describe('computeStats', () => {
  it('returns zero stats for an empty session', () => {
    const s = computeStats(makeSession(), Date.parse('2026-04-26T18:00:00.000Z'));
    expect(s.totalHands).toBe(0);
    expect(s.handsPerHour).toBe(0);
    expect(s.byPlayer).toEqual([]);
    expect(s.byPosition).toEqual([]);
  });

  it('computes hands per hour from elapsed time', () => {
    const session = makeSession({
      hands: [
        {
          index: 0,
          startedAt: '2026-04-26T18:00:00.000Z',
          endedAt: '2026-04-26T18:01:00.000Z',
          buttonSeat: 0,
          seatedPlayers: [0, 1, 2],
          winnerSeat: 0,
          winnerPlayerProfileId: 'alice',
          winnerPosition: 'BTN',
        },
        {
          index: 1,
          startedAt: '2026-04-26T18:01:00.000Z',
          endedAt: '2026-04-26T18:02:00.000Z',
          buttonSeat: 1,
          seatedPlayers: [0, 1, 2],
          winnerSeat: 1,
          winnerPlayerProfileId: 'bob',
          winnerPosition: 'BTN',
        },
      ],
    });
    // 2 hands over 30 minutes = 4 hands/hour.
    const stats = computeStats(session, Date.parse('2026-04-26T18:30:00.000Z'));
    expect(stats.totalHands).toBe(2);
    expect(stats.handsPerHour).toBeCloseTo(4, 5);
    expect(stats.elapsedMs).toBe(30 * 60 * 1000);
  });

  it('computes per-player win percentage', () => {
    const session = makeSession({
      hands: [
        // alice wins 2 of 3 hands; bob wins 1; carol wins 0.
        {
          index: 0, startedAt: '', endedAt: '',
          buttonSeat: 0, seatedPlayers: [0, 1, 2],
          winnerSeat: 0, winnerPlayerProfileId: 'alice', winnerPosition: 'BTN',
        },
        {
          index: 1, startedAt: '', endedAt: '',
          buttonSeat: 1, seatedPlayers: [0, 1, 2],
          winnerSeat: 0, winnerPlayerProfileId: 'alice', winnerPosition: 'BB',
        },
        {
          index: 2, startedAt: '', endedAt: '',
          buttonSeat: 2, seatedPlayers: [0, 1, 2],
          winnerSeat: 1, winnerPlayerProfileId: 'bob', winnerPosition: 'BB',
        },
      ],
    });
    const stats = computeStats(session, Date.parse('2026-04-26T19:00:00.000Z'));
    const byId = (id: string) => stats.byPlayer.find(p => p.playerProfileId === id);
    expect(byId('alice')?.handsDealtIn).toBe(3);
    expect(byId('alice')?.handsWon).toBe(2);
    expect(byId('alice')?.winPct).toBeCloseTo(66.67, 1);
    expect(byId('bob')?.winPct).toBeCloseTo(33.33, 1);
    expect(byId('carol')?.winPct).toBe(0);
  });

  it('uses hand player snapshots so later seat moves do not rewrite dealt-in stats', () => {
    const session = makeSession({
      seats: [
        seat(0, 'bob'),
        seat(1, 'alice'),
        seat(2, 'carol'),
        seat(3, null),
        seat(4, null),
        seat(5, null),
      ],
      hands: [
        {
          index: 0, startedAt: '', endedAt: '',
          buttonSeat: 0,
          seatedPlayers: [0, 1, 2],
          seatedPlayerProfileIds: { '0': 'alice', '1': 'bob', '2': 'carol' },
          winnerSeat: 0, winnerPlayerProfileId: 'alice', winnerPosition: 'BTN',
        },
      ],
    });
    const stats = computeStats(session, Date.parse('2026-04-26T19:00:00.000Z'));
    const byId = (id: string) => stats.byPlayer.find(p => p.playerProfileId === id);
    expect(byId('alice')?.handsDealtIn).toBe(1);
    expect(byId('alice')?.handsWon).toBe(1);
    expect(byId('bob')?.handsDealtIn).toBe(1);
    expect(byId('bob')?.handsWon).toBe(0);
  });

  it('computes per-position win percentage from seat snapshots', () => {
    const session = makeSession({
      hands: [
        // 3-handed each hand. Button rotates 0→1→2.
        // hand 0: BTN=0(alice), SB=1(bob), BB=2(carol); winner alice (BTN)
        // hand 1: BTN=1(bob),   SB=2(carol), BB=0(alice); winner alice (BB)
        // hand 2: BTN=2(carol), SB=0(alice), BB=1(bob);   winner alice (SB)
        {
          index: 0, startedAt: '', endedAt: '',
          buttonSeat: 0, seatedPlayers: [0, 1, 2],
          winnerSeat: 0, winnerPlayerProfileId: 'alice', winnerPosition: 'BTN',
        },
        {
          index: 1, startedAt: '', endedAt: '',
          buttonSeat: 1, seatedPlayers: [0, 1, 2],
          winnerSeat: 0, winnerPlayerProfileId: 'alice', winnerPosition: 'BB',
        },
        {
          index: 2, startedAt: '', endedAt: '',
          buttonSeat: 2, seatedPlayers: [0, 1, 2],
          winnerSeat: 0, winnerPlayerProfileId: 'alice', winnerPosition: 'SB',
        },
      ],
    });
    const stats = computeStats(session, Date.parse('2026-04-26T19:00:00.000Z'));
    const byPos = (p: string) => stats.byPosition.find(x => x.position === p);
    // Each position is dealt 3 times (once per hand).  Each is won once.
    expect(byPos('BTN')?.handsAtPosition).toBe(3);
    expect(byPos('BTN')?.winPct).toBeCloseTo(33.33, 1);
    expect(byPos('SB')?.winPct).toBeCloseTo(33.33, 1);
    expect(byPos('BB')?.winPct).toBeCloseTo(33.33, 1);
  });

  it('uses each hand table-size snapshot after the live table is resized', () => {
    const session = makeSession({
      tableSize: 4,
      seats: [
        seat(0, 'alice'),
        seat(1, 'bob'),
        seat(2, 'carol'),
        seat(3, 'dave'),
      ],
      hands: [
        {
          index: 0, startedAt: '', endedAt: '',
          buttonSeat: 0,
          tableSize: 5,
          seatedPlayers: [0, 1, 2, 3, 4],
          seatedPlayerProfileIds: {
            '0': 'alice', '1': 'bob', '2': 'carol', '3': 'dave', '4': 'erin',
          },
          winnerSeat: 4, winnerPlayerProfileId: 'erin', winnerPosition: 'CO',
        },
        {
          index: 1, startedAt: '', endedAt: '',
          buttonSeat: 0,
          tableSize: 4,
          seatedPlayers: [0, 1, 2, 3],
          seatedPlayerProfileIds: {
            '0': 'alice', '1': 'bob', '2': 'carol', '3': 'dave',
          },
          winnerSeat: 3, winnerPlayerProfileId: 'dave', winnerPosition: 'CO',
        },
      ],
    });
    const stats = computeStats(session, Date.parse('2026-04-26T19:00:00.000Z'));
    const byPos = (p: string) => stats.byPosition.find(x => x.position === p);

    expect(byPos('HJ')?.handsAtPosition).toBe(1);
    expect(byPos('CO')?.handsAtPosition).toBe(2);
  });

  it('handles mid-session player joins (only counts hands they were dealt in)', () => {
    // dave joins at hand 2.  Hands 0–1 had 3 players (alice, bob, carol);
    // hands 2–3 had 4.  dave should be dealt-in to 2 hands, not 4.
    const session = makeSession({
      seats: [
        seat(0, 'alice'),
        seat(1, 'bob'),
        seat(2, 'carol'),
        seat(3, 'dave', 2),       // joined at hand 2
        seat(4, null),
        seat(5, null),
      ],
      hands: [
        {
          index: 0, startedAt: '', endedAt: '',
          buttonSeat: 0, seatedPlayers: [0, 1, 2],
          winnerSeat: 0, winnerPlayerProfileId: 'alice', winnerPosition: 'BTN',
        },
        {
          index: 1, startedAt: '', endedAt: '',
          buttonSeat: 1, seatedPlayers: [0, 1, 2],
          winnerSeat: 1, winnerPlayerProfileId: 'bob', winnerPosition: 'BTN',
        },
        {
          index: 2, startedAt: '', endedAt: '',
          buttonSeat: 2, seatedPlayers: [0, 1, 2, 3],
          winnerSeat: 3, winnerPlayerProfileId: 'dave', winnerPosition: 'CO',
        },
        {
          index: 3, startedAt: '', endedAt: '',
          buttonSeat: 3, seatedPlayers: [0, 1, 2, 3],
          winnerSeat: 3, winnerPlayerProfileId: 'dave', winnerPosition: 'BTN',
        },
      ],
    });
    const stats = computeStats(session, Date.parse('2026-04-26T19:00:00.000Z'));
    const dave = stats.byPlayer.find(p => p.playerProfileId === 'dave');
    expect(dave?.handsDealtIn).toBe(2);
    expect(dave?.handsWon).toBe(2);
    expect(dave?.winPct).toBe(100);
    const alice = stats.byPlayer.find(p => p.playerProfileId === 'alice');
    expect(alice?.handsDealtIn).toBe(4);
    expect(alice?.handsWon).toBe(1);
  });

  it('uses session.endedAt when present instead of now', () => {
    const session = makeSession({
      endedAt: '2026-04-26T19:00:00.000Z',
      hands: [{
        index: 0, startedAt: '', endedAt: '',
        buttonSeat: 0, seatedPlayers: [0, 1],
        winnerSeat: 0, winnerPlayerProfileId: 'alice', winnerPosition: 'BTN',
      }],
    });
    // 1 hand in 1 hour = 1 hand/hour, regardless of "now".
    const stats = computeStats(session, Date.parse('2030-01-01T00:00:00.000Z'));
    expect(stats.handsPerHour).toBeCloseTo(1, 5);
    expect(stats.elapsedMs).toBe(60 * 60 * 1000);
  });
});
