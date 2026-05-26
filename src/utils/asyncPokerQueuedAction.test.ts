import { describe, expect, it } from 'vitest';
import type { LiveHandAction } from '../types/liveSession';
import { appendLiveAction } from './pokerGameplay.js';
import {
  normalizeAsyncPokerQueuedAction,
  prepareAsyncPokerQueuedAction,
  type AsyncPokerQueuedActionPlan,
} from './asyncPokerQueuedAction.js';

function action(actions: LiveHandAction[], seatId: number, actionName: LiveHandAction['action'], amountChips: number) {
  return appendLiveAction({
    actions,
    street: 'preflop',
    seatId,
    action: actionName,
    amount: amountChips,
    amountBB: amountChips / 10,
  });
}

function baseState(currentBetChips = 30) {
  let actions: LiveHandAction[] = [];
  actions = action(actions, 0, 'post-blind', 5);
  actions = action(actions, 1, 'post-blind', 10);
  actions = action(actions, 2, 'raise', currentBetChips);
  return {
    street: 'preflop',
    actions,
    foldedUserIds: [],
  };
}

function prepare(queuedAction: AsyncPokerQueuedActionPlan, state = baseState(), stackChips = 300) {
  return prepareAsyncPokerQueuedAction({
    game: { hand_number: 1, big_blind_chips: 10 },
    state,
    actor: { user_id: 10, seat_index: 0, stack_chips: stackChips },
    queuedAction: {
      handNumber: 1,
      street: 'preflop',
      ...queuedAction,
    },
  });
}

describe('async poker queued actions', () => {
  it('raises when the raise target is legal and affordable', () => {
    expect(prepare({ raiseToChips: 100, callCapChips: 150 })).toEqual({
      action: 'raise',
      amountChips: 95,
    });
  });

  it('falls back to the call cap when the raise target is not legal', () => {
    expect(prepare({ raiseToChips: 40, callCapChips: 100 })).toEqual({
      action: 'call',
      amountChips: 25,
    });
  });

  it('folds when the call amount is above the call cap', () => {
    expect(prepare({ raiseToChips: 40, callCapChips: 20 })).toEqual({
      action: 'fold',
      amountChips: null,
    });
  });

  it('allows an all-in call cap to call up to the remaining stack', () => {
    expect(prepare({ raiseToChips: 100, callCapMode: 'all_in' }, baseState(200))).toEqual({
      action: 'call',
      amountChips: 195,
    });
  });

  it('keeps legacy call and raise queued actions compatible', () => {
    expect(normalizeAsyncPokerQueuedAction({ action: 'call', amountChips: 25 })).toMatchObject({
      action: 'call',
      callCapChips: 25,
    });
    expect(prepare({ action: 'raise', amountChips: 100 })).toEqual({
      action: 'raise',
      amountChips: 95,
    });
  });

  it('ignores stale hand or street decisions so the player can act normally', () => {
    expect(prepare({ raiseToChips: 100, callCapChips: 150, street: 'flop' })).toBeNull();
    expect(prepare({ raiseToChips: 100, callCapChips: 150, handNumber: 2 })).toBeNull();
  });
});
