import { describe, expect, it } from 'vitest';
import type { LiveHandAction, LiveSession, LiveStackSnapshot } from '../types/liveSession';
import {
  actionSummary,
  appendLiveAction,
  applyActionCostsToStacks,
  computeActionStats,
  deriveHeroPlayedAction,
  distributePotToWinners,
  firstPostflopActor,
  firstPreflopActor,
  followedAdviceBucket,
  isBettingRoundClosed,
  nextGuidedActionState,
  totalPotBB,
  undoLastAction,
} from './liveHandEngine';
import { convertAmount, convertPotSize, stackDepthLabel } from './liveMoney';

describe('liveMoney', () => {
  it('converts dollar amounts into big blinds', () => {
    expect(convertAmount({ value: 12, inputMode: 'amount', bigBlind: 3 })).toMatchObject({
      amount: 12,
      amountBB: 4,
    });
  });

  it('converts big blinds into dollar amounts', () => {
    const session = makeSession();
    expect(convertPotSize({ session, handIndex: 0, value: 20, inputMode: 'bb' })).toEqual({
      finalPotAmount: 40,
      finalPotBB: 20,
    });
  });

  it('labels stack depth bands', () => {
    expect(stackDepthLabel(39)).toBe('Short');
    expect(stackDepthLabel(40)).toBe('Medium');
    expect(stackDepthLabel(100)).toBe('Medium');
    expect(stackDepthLabel(101)).toBe('Deep');
  });
});

describe('liveHandEngine', () => {
  it('appends actions with stable order and pot snapshots', () => {
    let actions: LiveHandAction[] = [];
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 1, action: 'post-blind', amountBB: 1 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 2, action: 'raise', amountBB: 2 });

    expect(actions.map(action => action.order)).toEqual([0, 1]);
    expect(actions[1].potBeforeBB).toBe(1);
    expect(actions[1].potAfterBB).toBe(3);
    expect(totalPotBB(actions)).toBe(3);
  });

  it('computes call amount from street contributions', () => {
    let actions: LiveHandAction[] = [];
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 0, action: 'post-blind', amountBB: 0.5 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 1, action: 'post-blind', amountBB: 1 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 2, action: 'raise', amountBB: 3 });

    const sb = actionSummary(actions, 'preflop', 0);
    const raiser = actionSummary(actions, 'preflop', 2);

    expect(sb.toCallBB).toBe(2.5);
    expect(raiser.toCallBB).toBe(0);
    expect(raiser.canBet).toBe(false);
    expect(raiser.canRaise).toBe(true);
  });

  it('updates stacks for action costs and pot distribution', () => {
    const stacks: LiveStackSnapshot[] = [
      stack(0, 'hero', 100),
      stack(1, 'villain', 100),
    ];
    let actions: LiveHandAction[] = [];
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 0, action: 'raise', amountBB: 3 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 1, action: 'call', amountBB: 3 });

    const afterCosts = applyActionCostsToStacks(stacks, actions);
    const afterPayout = distributePotToWinners({ snapshots: afterCosts, winnerSeats: [0], potBB: 6 });

    expect(afterPayout.find(s => s.seatId === 0)?.endingStackBB).toBe(103);
    expect(afterPayout.find(s => s.seatId === 1)?.endingStackBB).toBe(97);
  });

  it('derives VPIP/PFR/3-bet/4-bet and straddle rates from action logs', () => {
    const session = makeSession({
      hands: [{
        index: 0,
        startedAt: '',
        endedAt: '',
        buttonSeat: 0,
        seatedPlayers: [0, 1, 2, 3],
        seatedPlayerProfileIds: { '0': 'hero', '1': 'a', '2': 'b', '3': 'c' },
        actions: [
          action(0, 'post-blind', 0.5, 'hero'),
          action(1, 'post-blind', 1, 'a'),
          action(2, 'post-straddle', 2, 'b'),
          action(3, 'raise', 6, 'c'),
          action(0, 'raise', 18, 'hero'),
          action(1, 'raise', 40, 'a'),
        ],
      }],
    });

    const stats = computeActionStats(session);
    const hero = stats.find(row => row.playerProfileId === 'hero');
    const a = stats.find(row => row.playerProfileId === 'a');
    const b = stats.find(row => row.playerProfileId === 'b');
    const c = stats.find(row => row.playerProfileId === 'c');

    expect(c?.pfr).toBe(1);
    expect(hero?.threeBet).toBe(1);
    expect(a?.fourBet).toBe(1);
    expect(b?.straddle).toBe(1);
  });

  it('starts guided preflop action after the big blind or straddle', () => {
    expect(firstPreflopActor({ seatedPlayers: [0, 1, 2, 3], tableSize: 4, bigBlindSeat: 2 })).toBe(3);
    expect(firstPreflopActor({ seatedPlayers: [0, 1, 2, 3], tableSize: 4, bigBlindSeat: 2, straddleSeat: 3 })).toBe(0);
  });

  it('starts postflop action left of the button among live players', () => {
    const actions = [
      action(1, 'fold', 0, 'a'),
    ];
    expect(firstPostflopActor({ actions, seatedPlayers: [0, 1, 2, 3], tableSize: 4, buttonSeat: 0 })).toBe(2);
  });

  it('keeps betting open after a raise until live players respond, then auto advances streets', () => {
    let actions: LiveHandAction[] = [];
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 0, action: 'post-blind', amountBB: 0.5 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 1, action: 'post-blind', amountBB: 1 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 2, action: 'raise', amountBB: 3 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 3, action: 'fold' });

    expect(isBettingRoundClosed(actions, 'preflop', [0, 1, 2, 3])).toBe(false);
    expect(nextGuidedActionState({
      actions,
      street: 'preflop',
      actedSeat: 3,
      seatedPlayers: [0, 1, 2, 3],
      tableSize: 4,
      buttonSeat: 3,
    })).toMatchObject({ street: 'preflop', seatId: 0 });

    actions = appendLiveAction({ actions, street: 'preflop', seatId: 0, action: 'call', amountBB: 2.5 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 1, action: 'call', amountBB: 2 });
    const next = nextGuidedActionState({
      actions,
      street: 'preflop',
      actedSeat: 1,
      seatedPlayers: [0, 1, 2, 3],
      tableSize: 4,
      buttonSeat: 3,
    });

    expect(next).toMatchObject({ street: 'flop', seatId: 0, roundClosed: true });
  });

  it('closes the hand when folds leave one player un-folded', () => {
    let actions: LiveHandAction[] = [];
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 0, action: 'post-blind', amountBB: 0.5 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 1, action: 'post-blind', amountBB: 1 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 2, action: 'raise', amountBB: 3 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 3, action: 'fold' });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 0, action: 'fold' });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 1, action: 'fold' });

    expect(nextGuidedActionState({
      actions,
      street: 'preflop',
      actedSeat: 1,
      seatedPlayers: [0, 1, 2, 3],
      tableSize: 4,
      buttonSeat: 3,
    })).toMatchObject({ street: 'preflop', seatId: 2, roundClosed: true, handActionClosed: true });
  });

  it('undoes only the latest non-forced action', () => {
    let actions: LiveHandAction[] = [];
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 0, action: 'post-blind', amountBB: 0.5 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 1, action: 'post-blind', amountBB: 1 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 2, action: 'raise', amountBB: 3 });

    const result = undoLastAction(actions);

    expect(result.undone?.seatId).toBe(2);
    expect(result.actions.map(item => item.action)).toEqual(['post-blind', 'post-blind']);
  });

  it('derives Hero played action and bucket adherence from the action log', () => {
    let actions: LiveHandAction[] = [];
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 0, action: 'post-blind', amountBB: 0.5 });
    actions = appendLiveAction({ actions, street: 'preflop', seatId: 0, action: 'call', amountBB: 2, playerProfileId: 'hero' });

    const heroAction = deriveHeroPlayedAction(actions, 0);

    expect(heroAction?.action).toBe('call');
    expect(followedAdviceBucket({ recommendedKind: 'callRaise', recommendedMaxBB: 10, action: heroAction })).toBe(true);
    expect(followedAdviceBucket({ recommendedKind: 'limp', recommendedMaxBB: 1, action: heroAction })).toBe(false);
    expect(followedAdviceBucket({ recommendedKind: 'premium', action: heroAction })).toBe(false);
  });
});

function stack(seatId: number, playerProfileId: string, stackBB: number): LiveStackSnapshot {
  return {
    seatId,
    playerProfileId,
    startingStack: stackBB * 2,
    startingStackBB: stackBB,
    endingStack: stackBB * 2,
    endingStackBB: stackBB,
  };
}

function action(
  seatId: number,
  actionType: LiveHandAction['action'],
  amountBB: number,
  playerProfileId: string,
): LiveHandAction {
  return {
    street: 'preflop',
    seatId,
    playerProfileId,
    action: actionType,
    amountBB,
    potBeforeBB: 0,
    potAfterBB: amountBB,
    order: seatId,
  };
}

function makeSession(overrides: Partial<LiveSession> = {}): LiveSession {
  return {
    id: 'session',
    startedAt: '2026-05-07T12:00:00.000Z',
    endedAt: null,
    tableSize: 6,
    initialButtonSeat: 0,
    seats: [
      { seatId: 0, player: { playerProfileId: 'hero', joinedAtHandIndex: 0, leftAtHandIndex: null } },
      { seatId: 1, player: { playerProfileId: 'a', joinedAtHandIndex: 0, leftAtHandIndex: null } },
      { seatId: 2, player: { playerProfileId: 'b', joinedAtHandIndex: 0, leftAtHandIndex: null } },
      { seatId: 3, player: { playerProfileId: 'c', joinedAtHandIndex: 0, leftAtHandIndex: null } },
      { seatId: 4, player: null },
      { seatId: 5, player: null },
    ],
    hands: [],
    blindLevels: [{ effectiveFromHandIndex: 0, smallBlind: 1, bigBlind: 2, currency: '$' }],
    updatedAt: '2026-05-07T12:00:00.000Z',
    ...overrides,
  };
}
