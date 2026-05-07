import type {
  LiveActionType,
  LiveHand,
  LiveHandAction,
  LiveSession,
  LiveStackSnapshot,
  LiveStreet,
  SeatId,
} from '../types/liveSession';
import type { RangeBucketKind } from '../types/profiles';

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

export function playerIdForSeat(session: LiveSession, hand: LiveHand, seatId: SeatId): string | null {
  return hand.seatedPlayerProfileIds?.[String(seatId)]
    ?? session.seats.find(s => s.seatId === seatId)?.player?.playerProfileId
    ?? null;
}

export function nextActionOrder(actions: LiveHandAction[]): number {
  return actions.reduce((max, action) => Math.max(max, action.order), -1) + 1;
}

export function totalPotBB(actions: LiveHandAction[]): number {
  return actions.reduce((sum, action) => sum + (action.amountBB ?? 0), 0);
}

export function streetPotBB(actions: LiveHandAction[], street: LiveStreet): number {
  return actions
    .filter(action => action.street === street)
    .reduce((sum, action) => sum + (action.amountBB ?? 0), 0);
}

export function seatStreetContributionBB(
  actions: LiveHandAction[],
  street: LiveStreet,
  seatId: SeatId,
): number {
  return actions
    .filter(action => action.street === street && action.seatId === seatId)
    .reduce((sum, action) => sum + (action.amountBB ?? 0), 0);
}

export function currentStreetBetBB(actions: LiveHandAction[], street: LiveStreet): number {
  const bySeat = new Map<SeatId, number>();
  for (const action of actions.filter(action => action.street === street)) {
    bySeat.set(action.seatId, (bySeat.get(action.seatId) ?? 0) + (action.amountBB ?? 0));
  }
  return Math.max(0, ...bySeat.values());
}

export function toCallBB(actions: LiveHandAction[], street: LiveStreet, seatId: SeatId): number {
  const currentBet = currentStreetBetBB(actions, street);
  const contribution = seatStreetContributionBB(actions, street, seatId);
  return Math.max(0, currentBet - contribution);
}

export function appendLiveAction(input: ActionInput): LiveHandAction[] {
  const amountBB = input.amountBB ?? 0;
  const potBeforeBB = totalPotBB(input.actions);
  const action: LiveHandAction = {
    street: input.street,
    seatId: input.seatId,
    ...(input.playerProfileId ? { playerProfileId: input.playerProfileId } : {}),
    action: input.action,
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
    ...(input.amountBB !== undefined ? { amountBB: input.amountBB } : {}),
    potBeforeBB,
    potAfterBB: potBeforeBB + amountBB,
    order: nextActionOrder(input.actions),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  return [...input.actions, action];
}

export function actionSummary(actions: LiveHandAction[], street: LiveStreet, seatId: SeatId): ActionSummary {
  const currentBetBB = currentStreetBetBB(actions, street);
  const seatContributionBB = seatStreetContributionBB(actions, street, seatId);
  const callBB = Math.max(0, currentBetBB - seatContributionBB);
  return {
    potBB: totalPotBB(actions),
    streetPotBB: streetPotBB(actions, street),
    toCallBB: callBB,
    currentBetBB,
    seatContributionBB,
    canCheck: callBB === 0,
    canCall: callBB > 0,
    canBet: currentBetBB === 0,
    canRaise: currentBetBB > 0,
  };
}

function nextClockwise(from: SeatId, occupied: SeatId[], tableSize: number): SeatId | null {
  if (occupied.length === 0) return null;
  const set = new Set(occupied);
  for (let step = 1; step <= tableSize; step++) {
    const seatId = (from + step) % tableSize;
    if (set.has(seatId)) return seatId;
  }
  return null;
}

function actionSort(a: LiveHandAction, b: LiveHandAction): number {
  return a.order - b.order;
}

export function foldedSeats(actions: LiveHandAction[]): Set<SeatId> {
  return new Set(actions.filter(action => action.action === 'fold').map(action => action.seatId));
}

export function allInSeats(actions: LiveHandAction[]): Set<SeatId> {
  return new Set(actions.filter(action => action.action === 'all-in').map(action => action.seatId));
}

export function liveActionSeats(actions: LiveHandAction[], seatedPlayers: SeatId[]): SeatId[] {
  const folded = foldedSeats(actions);
  const allIn = allInSeats(actions);
  return seatedPlayers.filter(seatId => !folded.has(seatId) && !allIn.has(seatId));
}

export function firstPreflopActor({
  seatedPlayers,
  tableSize,
  bigBlindSeat,
  straddleSeat,
}: {
  seatedPlayers: SeatId[];
  tableSize: number;
  bigBlindSeat: SeatId | null;
  straddleSeat?: SeatId | null;
}): SeatId | null {
  const anchor = straddleSeat ?? bigBlindSeat;
  if (anchor === null) return seatedPlayers[0] ?? null;
  return nextClockwise(anchor, seatedPlayers, tableSize);
}

export function firstPostflopActor({
  actions,
  seatedPlayers,
  tableSize,
  buttonSeat,
}: {
  actions: LiveHandAction[];
  seatedPlayers: SeatId[];
  tableSize: number;
  buttonSeat: SeatId;
}): SeatId | null {
  return nextClockwise(buttonSeat, liveActionSeats(actions, seatedPlayers), tableSize);
}

export function isBettingRoundClosed(
  actions: LiveHandAction[],
  street: LiveStreet,
  seatedPlayers: SeatId[],
): boolean {
  const activeSeats = liveActionSeats(actions, seatedPlayers);
  if (activeSeats.length <= 1) return true;
  const streetActions = actions.filter(action => action.street === street).sort(actionSort);
  const voluntary = streetActions.filter(action => action.action !== 'post-blind' && action.action !== 'post-straddle');
  if (voluntary.length === 0) return false;

  const currentBet = currentStreetBetBB(actions, street);
  return activeSeats.every(seatId => {
    const acted = voluntary.some(action => action.seatId === seatId);
    if (!acted) return false;
    return seatStreetContributionBB(actions, street, seatId) >= currentBet;
  });
}

export function nextActorAfter({
  actions,
  street,
  actedSeat,
  seatedPlayers,
  tableSize,
}: {
  actions: LiveHandAction[];
  street: LiveStreet;
  actedSeat: SeatId;
  seatedPlayers: SeatId[];
  tableSize: number;
}): SeatId | null {
  if (isBettingRoundClosed(actions, street, seatedPlayers)) return null;
  return nextClockwise(actedSeat, liveActionSeats(actions, seatedPlayers), tableSize);
}

export function nextGuidedActionState({
  actions,
  street,
  actedSeat,
  seatedPlayers,
  tableSize,
  buttonSeat,
}: {
  actions: LiveHandAction[];
  street: LiveStreet;
  actedSeat: SeatId;
  seatedPlayers: SeatId[];
  tableSize: number;
  buttonSeat: SeatId;
}): GuidedActionState {
  const nextSeat = nextActorAfter({ actions, street, actedSeat, seatedPlayers, tableSize });
  if (nextSeat !== null) {
    return { street, seatId: nextSeat, roundClosed: false, handActionClosed: false };
  }

  const order: LiveStreet[] = ['preflop', 'flop', 'turn', 'river'];
  const index = order.indexOf(street);
  if (index < 0 || index === order.length - 1) {
    return { street, seatId: null, roundClosed: true, handActionClosed: true };
  }

  const nextStreet = order[index + 1];
  return {
    street: nextStreet,
    seatId: firstPostflopActor({ actions, seatedPlayers, tableSize, buttonSeat }),
    roundClosed: true,
    handActionClosed: false,
  };
}

export function undoLastAction(actions: LiveHandAction[]): { actions: LiveHandAction[]; undone: LiveHandAction | null } {
  const sorted = [...actions].sort((a, b) => b.order - a.order);
  const undone = sorted.find(action => action.action !== 'post-blind' && action.action !== 'post-straddle') ?? null;
  if (!undone) return { actions, undone: null };
  return {
    actions: actions.filter(action => action.order !== undone.order),
    undone,
  };
}

export function deriveHeroPlayedAction(
  actions: LiveHandAction[],
  heroSeatId: SeatId,
): LiveHandAction | null {
  return [...actions]
    .sort(actionSort)
    .find(action => (
      action.seatId === heroSeatId
      && action.action !== 'post-blind'
      && action.action !== 'post-straddle'
    )) ?? null;
}

export function followedAdviceBucket({
  recommendedKind,
  recommendedMaxBB,
  action,
}: {
  recommendedKind?: RangeBucketKind;
  recommendedMaxBB?: number;
  action: LiveHandAction | null;
}): boolean | undefined {
  if (!recommendedKind || !action) return undefined;
  if (recommendedKind === 'fold') return action.action === 'fold';
  if (recommendedKind === 'premium') return action.action === 'bet' || action.action === 'raise' || action.action === 'all-in';
  if (recommendedKind === 'limp' || recommendedKind === 'callRaise') {
    const amountBB = action.amountBB ?? 0;
    return (action.action === 'call' || action.action === 'check') && amountBB <= (recommendedMaxBB ?? Number.POSITIVE_INFINITY);
  }
  return undefined;
}

export function createForcedBlindActions({
  baseActions,
  smallBlindSeat,
  bigBlindSeat,
  smallBlind,
  bigBlind,
  currency,
  playerIdBySeat,
}: {
  baseActions: LiveHandAction[];
  smallBlindSeat: SeatId | null;
  bigBlindSeat: SeatId | null;
  smallBlind: number;
  bigBlind: number;
  currency: string;
  playerIdBySeat: Map<SeatId, string>;
}): LiveHandAction[] {
  let actions = baseActions;
  if (smallBlindSeat !== null && smallBlind > 0) {
    actions = appendLiveAction({
      actions,
      street: 'preflop',
      seatId: smallBlindSeat,
      playerProfileId: playerIdBySeat.get(smallBlindSeat),
      action: 'post-blind',
      amount: smallBlind,
      amountBB: smallBlind / Math.max(0.01, bigBlind),
    });
  }
  if (bigBlindSeat !== null && bigBlind > 0) {
    actions = appendLiveAction({
      actions,
      street: 'preflop',
      seatId: bigBlindSeat,
      playerProfileId: playerIdBySeat.get(bigBlindSeat),
      action: 'post-blind',
      amount: bigBlind,
      amountBB: 1,
    });
  }
  void currency;
  return actions;
}

export function applyActionCostsToStacks(
  startingStacks: LiveStackSnapshot[],
  actions: LiveHandAction[],
): LiveStackSnapshot[] {
  const spentBySeat = new Map<SeatId, number>();
  for (const action of actions) {
    spentBySeat.set(action.seatId, (spentBySeat.get(action.seatId) ?? 0) + (action.amountBB ?? 0));
  }
  return startingStacks.map(snapshot => {
    const spentBB = spentBySeat.get(snapshot.seatId) ?? 0;
    const endingStackBB = Math.max(0, snapshot.startingStackBB - spentBB);
    const bigBlind = snapshot.startingStackBB > 0
      ? snapshot.startingStack / snapshot.startingStackBB
      : snapshot.startingStack;
    return {
      ...snapshot,
      endingStackBB,
      endingStack: endingStackBB * Math.max(0.01, bigBlind),
    };
  });
}

export function distributePotToWinners({
  snapshots,
  winnerSeats,
  potBB,
}: {
  snapshots: LiveStackSnapshot[];
  winnerSeats: SeatId[];
  potBB: number;
}): LiveStackSnapshot[] {
  if (winnerSeats.length === 0 || potBB <= 0) return snapshots;
  const creditBB = potBB / winnerSeats.length;
  return snapshots.map(snapshot => {
    if (!winnerSeats.includes(snapshot.seatId)) return snapshot;
    const bigBlind = snapshot.startingStackBB > 0
      ? snapshot.startingStack / snapshot.startingStackBB
      : snapshot.startingStack;
    const endingStackBB = snapshot.endingStackBB + creditBB;
    return {
      ...snapshot,
      endingStackBB,
      endingStack: endingStackBB * Math.max(0.01, bigBlind),
    };
  });
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
