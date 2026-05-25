import { describe, expect, it } from 'vitest';
import type { LiveStackSnapshot, SeatId } from '../types/liveSession';
import { cardKey } from './cardInput';
import { buildDeck } from './holdemEquity';
import { dealHoldemBoardWithBurns, simulateTrackedHoldemHand } from './pokerSimulator';

function playerMap(seats: SeatId[]): Map<SeatId, string> {
  return new Map(seats.map(seatId => [seatId, `player-${seatId}`]));
}

function startingStacks(seats: SeatId[]): LiveStackSnapshot[] {
  return seats.map(seatId => ({
    seatId,
    playerProfileId: `player-${seatId}`,
    startingStack: 100,
    startingStackBB: 100,
    endingStack: 100,
    endingStackBB: 100,
  }));
}

describe('simulateTrackedHoldemHand', () => {
  it('burns before dealing the flop, turn, and river', () => {
    const deck = buildDeck();
    const board = dealHoldemBoardWithBurns(deck);

    expect(board.map(cardKey)).toEqual(['Ah', 'Ad', 'Ac', 'Kh', 'Kc']);
    expect(deck[0] && cardKey(deck[0])).toBe('Qs');
  });

  it('deals a full tracked holdem hand without duplicate cards', () => {
    const seats = [0, 1, 2, 3];
    const result = simulateTrackedHoldemHand({
      handIndex: 0,
      tableSize: 6,
      buttonSeat: 0,
      seatedPlayers: seats,
      playerIdBySeat: playerMap(seats),
      blindLevel: { effectiveFromHandIndex: 0, smallBlind: 0.5, bigBlind: 1, currency: '$' },
      startingStacks: startingStacks(seats),
      heroSeatId: 0,
      rng: () => 0.42,
      startedAt: '2026-05-17T12:00:00.000Z',
    });

    const dealtCards = [
      ...result.boardCards,
      ...[...result.holeCardsBySeat.values()].flat(),
    ];

    expect(new Set(dealtCards.map(cardKey)).size).toBe(dealtCards.length);
    expect(result.hand.board?.flop).toHaveLength(3);
    expect(result.hand.board?.turn).toBeTruthy();
    expect(result.hand.board?.river).toBeTruthy();
    expect(result.hand.showdown).toHaveLength(4);
    expect(result.heroCards).toHaveLength(2);
  });

  it('records blinds, calls, checks, showdown, and stack movement in tracker shape', () => {
    const seats = [0, 1, 2];
    const result = simulateTrackedHoldemHand({
      handIndex: 4,
      tableSize: 6,
      buttonSeat: 0,
      seatedPlayers: seats,
      playerIdBySeat: playerMap(seats),
      blindLevel: { effectiveFromHandIndex: 0, smallBlind: 1, bigBlind: 2, currency: '$' },
      startingStacks: startingStacks(seats),
      rng: () => 0.1,
    });

    expect(result.hand.index).toBe(4);
    expect(result.hand.seatedPlayerProfileIds).toEqual({
      '0': 'player-0',
      '1': 'player-1',
      '2': 'player-2',
    });
    expect(result.hand.actions?.filter(action => action.action === 'post-blind')).toHaveLength(2);
    expect(result.hand.actions?.some(action => action.action === 'call')).toBe(true);
    expect(result.hand.actions?.filter(action => action.action === 'check').length).toBeGreaterThanOrEqual(3);
    expect(result.hand.finalPotBB).toBeGreaterThan(0);
    expect(result.hand.stackSnapshots).toHaveLength(3);
    expect(result.winnerSeats.length).toBeGreaterThanOrEqual(1);
    expect(result.hand.winnerSeat ?? result.hand.chopSeats?.[0]).toBe(result.winnerSeats[0]);
  });

  it('throws when fewer than two players are seated', () => {
    expect(() => simulateTrackedHoldemHand({
      handIndex: 0,
      tableSize: 6,
      buttonSeat: 0,
      seatedPlayers: [0],
      playerIdBySeat: playerMap([0]),
      blindLevel: { effectiveFromHandIndex: 0, smallBlind: 0.5, bigBlind: 1 },
      startingStacks: startingStacks([0]),
    })).toThrow(/at least two/);
  });
});
