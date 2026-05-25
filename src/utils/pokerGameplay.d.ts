import type {
  LiveActionType,
  LiveHandAction,
  LiveStackSnapshot,
  LiveStreet,
  SeatId,
} from '../types/liveSession';
import type { RangeBucketKind } from '../types/profiles';
import type { ActionInput, ActionSummary, GuidedActionState } from './liveHandEngine';

export function nextActionOrder(actions: LiveHandAction[]): number;
export function totalPotBB(actions: LiveHandAction[]): number;
export function streetPotBB(actions: LiveHandAction[], street: LiveStreet): number;
export function seatStreetContributionBB(actions: LiveHandAction[], street: LiveStreet, seatId: SeatId): number;
export function currentStreetBetBB(actions: LiveHandAction[], street: LiveStreet): number;
export function minRaiseInfo(actions: LiveHandAction[], street: LiveStreet): {
  currentBetBB: number;
  minRaiseDeltaBB: number;
  minRaiseToBB: number;
};
export function toCallBB(actions: LiveHandAction[], street: LiveStreet, seatId: SeatId): number;
export function appendLiveAction(input: ActionInput): LiveHandAction[];
export function actionSummary(actions: LiveHandAction[], street: LiveStreet, seatId: SeatId): ActionSummary;
export function nextClockwise(from: SeatId, occupied: SeatId[], tableSize: number): SeatId | null;
export function foldedSeats(actions: LiveHandAction[]): Set<SeatId>;
export function unfoldedSeats(actions: LiveHandAction[], seatedPlayers: SeatId[]): SeatId[];
export function allInSeats(actions: LiveHandAction[]): Set<SeatId>;
export function liveActionSeats(actions: LiveHandAction[], seatedPlayers: SeatId[]): SeatId[];
export function firstPreflopActor(input: {
  seatedPlayers: SeatId[];
  tableSize: number;
  bigBlindSeat: SeatId | null;
  straddleSeat?: SeatId | null;
}): SeatId | null;
export function firstPostflopActor(input: {
  actions: LiveHandAction[];
  seatedPlayers: SeatId[];
  tableSize: number;
  buttonSeat: SeatId;
}): SeatId | null;
export function blindSeatsForButton(input: {
  buttonSeat: SeatId | null;
  seatedPlayers: SeatId[];
  tableSize: number;
}): { smallBlindSeat: SeatId | null; bigBlindSeat: SeatId | null };
export function isBettingRoundClosed(actions: LiveHandAction[], street: LiveStreet, seatedPlayers: SeatId[]): boolean;
export function nextActorAfter(input: {
  actions: LiveHandAction[];
  street: LiveStreet;
  actedSeat: SeatId;
  seatedPlayers: SeatId[];
  tableSize: number;
}): SeatId | null;
export function nextGuidedActionState(input: {
  actions: LiveHandAction[];
  street: LiveStreet;
  actedSeat: SeatId;
  seatedPlayers: SeatId[];
  tableSize: number;
  buttonSeat: SeatId;
}): GuidedActionState;
export function undoLastAction(actions: LiveHandAction[]): { actions: LiveHandAction[]; undone: LiveHandAction | null };
export function deriveHeroPlayedAction(actions: LiveHandAction[], heroSeatId: SeatId): LiveHandAction | null;
export function followedAdviceBucket(input: {
  recommendedKind?: RangeBucketKind;
  recommendedMaxBB?: number;
  action: LiveHandAction | null;
}): boolean | undefined;
export function createForcedBlindActions(input: {
  baseActions: LiveHandAction[];
  smallBlindSeat: SeatId | null;
  bigBlindSeat: SeatId | null;
  smallBlind: number;
  bigBlind: number;
  currency: string;
  playerIdBySeat: Map<SeatId, string>;
}): LiveHandAction[];
export function applyActionCostsToStacks(
  startingStacks: LiveStackSnapshot[],
  actions: LiveHandAction[],
): LiveStackSnapshot[];
export function distributePotToWinners(input: {
  snapshots: LiveStackSnapshot[];
  winnerSeats: SeatId[];
  potBB: number;
}): LiveStackSnapshot[];

export { LiveActionType, LiveHandAction, LiveStackSnapshot, LiveStreet, SeatId };
