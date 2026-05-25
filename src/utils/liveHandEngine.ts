import type {
  LiveActionType,
  LiveHand,
  LiveHandAction,
  LiveSession,
  LiveStackSnapshot,
  LiveStreet,
  SeatId,
} from '../types/liveSession';
import {
  actionSummary,
  allInSeats,
  appendLiveAction,
  applyActionCostsToStacks,
  createForcedBlindActions,
  currentStreetBetBB,
  deriveHeroPlayedAction,
  distributePotToWinners,
  firstPostflopActor,
  firstPreflopActor,
  foldedSeats,
  followedAdviceBucket,
  isBettingRoundClosed,
  liveActionSeats,
  minRaiseInfo,
  nextActionOrder,
  nextActorAfter,
  nextClockwise,
  nextGuidedActionState,
  seatStreetContributionBB,
  streetPotBB,
  toCallBB,
  totalPotBB,
  undoLastAction,
  unfoldedSeats,
} from './pokerGameplay.js';

const AGGRESSIVE_ACTIONS = new Set<LiveActionType>(['bet', 'raise', 'all-in']);
const PASSIVE_ACTIONS = new Set<LiveActionType>(['call', 'check']);

export interface ActionInput {
  actions: LiveHandAction[];
  street: LiveStreet;
  seatId: SeatId;
  playerProfileId?: string;
  action: LiveActionType;
  amount?: number;
  amountBB?: number;
  createdAt?: string;
}

export interface ActionSummary {
  potBB: number;
  streetPotBB: number;
  toCallBB: number;
  currentBetBB: number;
  seatContributionBB: number;
  minRaiseDeltaBB: number;
  minRaiseToBB: number;
  canCheck: boolean;
  canCall: boolean;
  canBet: boolean;
  canRaise: boolean;
}

export interface PlayerActionStats {
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

export interface GuidedActionState {
  street: LiveStreet;
  seatId: SeatId | null;
  roundClosed: boolean;
  handActionClosed: boolean;
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

export {
  actionSummary,
  allInSeats,
  appendLiveAction,
  applyActionCostsToStacks,
  createForcedBlindActions,
  currentStreetBetBB,
  deriveHeroPlayedAction,
  distributePotToWinners,
  firstPostflopActor,
  firstPreflopActor,
  foldedSeats,
  followedAdviceBucket,
  isBettingRoundClosed,
  liveActionSeats,
  minRaiseInfo,
  nextActionOrder,
  nextActorAfter,
  nextClockwise,
  nextGuidedActionState,
  seatStreetContributionBB,
  streetPotBB,
  toCallBB,
  totalPotBB,
  undoLastAction,
  unfoldedSeats,
};

export function playerIdForSeat(session: LiveSession, hand: LiveHand, seatId: SeatId): string | null {
  return hand.seatedPlayerProfileIds?.[String(seatId)]
    ?? session.seats.find(s => s.seatId === seatId)?.player?.playerProfileId
    ?? null;
}

export function currentStacksForNextHand(session: LiveSession): LiveStackSnapshot[] {
  const lastWithStacks = [...session.hands].reverse().find(hand => hand.stackSnapshots && hand.stackSnapshots.length > 0);
  if (lastWithStacks?.stackSnapshots) {
    return lastWithStacks.stackSnapshots.map(snapshot => ({
      ...snapshot,
      startingStack: snapshot.endingStack,
      startingStackBB: snapshot.endingStackBB,
    }));
  }
  return session.initialStacks ?? [];
}

export function computeActionStats(session: LiveSession): PlayerActionStats[] {
  const playerHands = new Map<string, number>();
  const rows = new Map<string, Omit<PlayerActionStats,
    'playerProfileId' | 'vpipPct' | 'pfrPct' | 'threeBetPct' | 'fourBetPct' | 'straddlePct' | 'aggressionFactor'
  >>();

  const ensure = (playerProfileId: string) => {
    if (!rows.has(playerProfileId)) {
      rows.set(playerProfileId, {
        hands: 0,
        vpip: 0,
        pfr: 0,
        threeBet: 0,
        fourBet: 0,
        straddle: 0,
        aggressionActions: 0,
        passiveActions: 0,
      });
    }
    return rows.get(playerProfileId)!;
  };

  for (const hand of session.hands) {
    if (hand.skipped) continue;
    const dealtIds = new Set<string>();
    for (const seatId of hand.seatedPlayers) {
      const pid = playerIdForSeat(session, hand, seatId);
      if (pid) dealtIds.add(pid);
    }
    for (const pid of dealtIds) {
      playerHands.set(pid, (playerHands.get(pid) ?? 0) + 1);
      ensure(pid).hands += 1;
    }

    const preflop = (hand.actions ?? []).filter(action => action.street === 'preflop');
    const voluntary = new Set<string>();
    const straddlers = new Set<string>();
    const raisePlayers: string[] = [];

    for (const action of hand.actions ?? []) {
      const pid = action.playerProfileId ?? playerIdForSeat(session, hand, action.seatId);
      if (!pid) continue;
      const row = ensure(pid);
      if (AGGRESSIVE_ACTIONS.has(action.action)) row.aggressionActions += 1;
      if (PASSIVE_ACTIONS.has(action.action)) row.passiveActions += 1;
    }

    for (const action of preflop) {
      const pid = action.playerProfileId ?? playerIdForSeat(session, hand, action.seatId);
      if (!pid) continue;
      if (action.action === 'post-straddle') straddlers.add(pid);
      if (['call', 'bet', 'raise', 'all-in'].includes(action.action)) voluntary.add(pid);
      if (['bet', 'raise', 'all-in'].includes(action.action)) raisePlayers.push(pid);
    }

    for (const pid of voluntary) ensure(pid).vpip += 1;
    for (const pid of straddlers) ensure(pid).straddle += 1;
    if (raisePlayers[0]) ensure(raisePlayers[0]).pfr += 1;
    if (raisePlayers[1]) ensure(raisePlayers[1]).threeBet += 1;
    if (raisePlayers[2]) ensure(raisePlayers[2]).fourBet += 1;
  }

  return Array.from(rows.entries()).map(([playerProfileId, row]) => ({
    playerProfileId,
    ...row,
    vpipPct: pct(row.vpip, row.hands),
    pfrPct: pct(row.pfr, row.hands),
    threeBetPct: pct(row.threeBet, row.hands),
    fourBetPct: pct(row.fourBet, row.hands),
    straddlePct: pct(row.straddle, row.hands),
    aggressionFactor: row.passiveActions > 0 ? row.aggressionActions / row.passiveActions : null,
  }));
}
