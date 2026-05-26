import type { LiveHandAction } from '../types/liveSession';

export interface AsyncPokerQueuedActionPlan {
  action?: 'call' | 'raise';
  amountChips?: number | null;
  raiseToChips?: number | null;
  callCapChips?: number | null;
  callCapMode?: 'amount' | 'all_in';
  handNumber?: number;
  street?: string;
  note?: string | null;
}

export interface AsyncPokerQueuedActionInput {
  game: { hand_number: number; big_blind_chips: number };
  state: {
    street: string;
    actions: LiveHandAction[];
    foldedUserIds?: number[];
  };
  actor: { user_id: number; seat_index: number; stack_chips: number };
  queuedAction: AsyncPokerQueuedActionPlan;
}

export function normalizeAsyncPokerQueuedAction(queuedAction: AsyncPokerQueuedActionPlan): AsyncPokerQueuedActionPlan | null;
export function prepareAsyncPokerQueuedAction(input: AsyncPokerQueuedActionInput): { action: string; amountChips: number | null } | null;
export function asyncPokerQueuedActionNote(queuedAction: AsyncPokerQueuedActionPlan): string;
