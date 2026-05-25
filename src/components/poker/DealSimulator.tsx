import { useMemo, useState } from 'react';
import type { PlayerProfile } from '../../types/profiles';
import type { Card } from '../../types/poker';
import type {
  BlindLevel,
  LiveHandAction,
  LiveStackSnapshot,
  LiveStreet,
  SeatId,
} from '../../types/liveSession';
import { PokerTable } from './live/PokerTable';
import { LiveActionBar, type LiveActionOdds } from './live/LiveActionBar';
import { LiveTableCenter, visibleBoardCards } from './live/LiveTableCenter';
import { PlayingCard } from './HandDisplay';
import { buildDeck, handNotationFromCards } from '../../utils/holdemEquity';
import { dealHoldemBoardWithBurns, shuffleDeck } from '../../utils/pokerSimulator';
import { derivePositions } from '../../utils/livePoker';
import {
  actionSummary,
  appendLiveAction,
  createForcedBlindActions,
  firstPreflopActor,
  nextGuidedActionState,
  totalPotBB,
  undoLastAction,
  unfoldedSeats,
} from '../../utils/liveHandEngine';
import { formatLiveNumber, stackDepthLabel } from '../../utils/liveMoney';

const TABLE_SIZE = 6;
const HERO_SEAT: SeatId = 0;
const SEATED_PLAYERS: SeatId[] = [0, 1, 2, 3, 4, 5];
const BLINDS: BlindLevel = {
  effectiveFromHandIndex: 0,
  smallBlind: 1,
  bigBlind: 2,
  currency: '$',
};
const PREFLOP_OPEN_ADJUSTMENT: Record<string, number> = {
  UTG: 0.1,
  HJ: 0.04,
  CO: -0.02,
  BTN: -0.08,
  SB: -0.02,
  BB: 0,
};

interface DealSimulatorProps {
  profiles: PlayerProfile[];
  onBack: () => void;
}

interface GameState {
  handNumber: number;
  buttonSeat: SeatId;
  heroCards: [Card, Card];
  holeCardsBySeat: Map<SeatId, [Card, Card]>;
  boardCards: [Card, Card, Card, Card, Card];
  actions: LiveHandAction[];
  street: LiveStreet;
  actionSeatId: SeatId | null;
  history: GameState[];
  phase: 'playing' | 'preflop_complete' | 'hand_over';
  result: string | null;
  actionLog: string[];
}

type SimulatorProfileKey =
  | 'chart_tightener'
  | 'chart_baseline'
  | 'chart_expander'
  | 'sticky_defender'
  | 'pressure_3bettor';

interface SimulatorProfile {
  key: SimulatorProfileKey;
  label: string;
  description: string;
  rangeFloor: number;
  openRaiseFloor: number;
  valueBetEquity: number;
  raiseEquity: number;
  callSlack: number;
  impliedOddsFactor: number;
  bluffRate: number;
  threeBetFloor: number;
}

interface HandProfile {
  high: number;
  low: number;
  gap: number;
  isPair: boolean;
  isSuited: boolean;
  isBroadway: boolean;
  hasAce: boolean;
  isConnector: boolean;
  isSmallPair: boolean;
  isSpeculative: boolean;
}

interface BotDecision {
  action: 'check' | 'call' | 'fold' | 'bet' | 'raise';
  amountBB: number;
  reason: string;
}

const SIMULATOR_PROFILES: Record<SimulatorProfileKey, SimulatorProfile> = {
  chart_tightener: {
    key: 'chart_tightener',
    label: 'Chart Tightener',
    description: 'Starts from the chart, drops mixed opens and marginal continues.',
    rangeFloor: 0.68,
    openRaiseFloor: 0.82,
    valueBetEquity: 0.66,
    raiseEquity: 0.76,
    callSlack: 0.01,
    impliedOddsFactor: 0.08,
    bluffRate: 0.02,
    threeBetFloor: 0.9,
  },
  chart_baseline: {
    key: 'chart_baseline',
    label: 'Chart Baseline',
    description: 'Follows the position/action chart with small mixed-frequency noise.',
    rangeFloor: 0.52,
    openRaiseFloor: 0.69,
    valueBetEquity: 0.57,
    raiseEquity: 0.68,
    callSlack: 0.03,
    impliedOddsFactor: 0.16,
    bluffRate: 0.07,
    threeBetFloor: 0.8,
  },
  chart_expander: {
    key: 'chart_expander',
    label: 'Chart Expander',
    description: 'Adds nearby suited, connected, and blocker hands around chart edges.',
    rangeFloor: 0.38,
    openRaiseFloor: 0.58,
    valueBetEquity: 0.49,
    raiseEquity: 0.61,
    callSlack: 0.05,
    impliedOddsFactor: 0.22,
    bluffRate: 0.16,
    threeBetFloor: 0.68,
  },
  sticky_defender: {
    key: 'sticky_defender',
    label: 'Sticky Defender',
    description: 'Over-defends one band wider, mostly with hands that can realize equity.',
    rangeFloor: 0.28,
    openRaiseFloor: 0.76,
    valueBetEquity: 0.62,
    raiseEquity: 0.76,
    callSlack: 0.07,
    impliedOddsFactor: 0.24,
    bluffRate: 0.01,
    threeBetFloor: 0.86,
  },
  pressure_3bettor: {
    key: 'pressure_3bettor',
    label: 'Pressure 3-Bettor',
    description: 'Uses more 3-bet pressure, but still prefers blockers and playable hands.',
    rangeFloor: 0.18,
    openRaiseFloor: 0.42,
    valueBetEquity: 0.43,
    raiseEquity: 0.53,
    callSlack: 0.08,
    impliedOddsFactor: 0.28,
    bluffRate: 0.28,
    threeBetFloor: 0.58,
  },
};

const SIMULATOR_PROFILE_BY_SEAT: Record<SeatId, SimulatorProfileKey> = {
  1: 'chart_baseline',
  2: 'chart_tightener',
  3: 'chart_expander',
  4: 'sticky_defender',
  5: 'pressure_3bettor',
};

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

function formatNumber(value: number): string {
  return formatLiveNumber(value);
}

function formatOddsRatio(rewardBB: number, riskBB: number): string {
  if (riskBB <= 0) return 'Free';
  return `${formatNumber(rewardBB / riskBB)}:1`;
}

function formatCard(card: Card): string {
  return `${card.rank}${card.suit.toUpperCase()}`;
}

function profileName(profile: PlayerProfile | undefined, fallback: string): string {
  return profile?.name?.trim() || fallback;
}

function buildPlayerNames(profiles: PlayerProfile[]): string[] {
  const hero = profiles.find(profile => profile.type === 'self');
  const villains = profiles.filter(profile => profile.type !== 'self');
  return [
    profileName(hero, 'Hero'),
    profileName(villains[0], 'Villain 1'),
    profileName(villains[1], 'Villain 2'),
    profileName(villains[2], 'Villain 3'),
    profileName(villains[3], 'Villain 4'),
    profileName(villains[4], 'Villain 5'),
  ];
}

function playerIdBySeat(): Map<SeatId, string> {
  return new Map(SEATED_PLAYERS.map(seatId => [seatId, seatId === HERO_SEAT ? 'hero' : `villain-${seatId}`]));
}

function stackInfoBySeat(): Map<SeatId, LiveStackSnapshot> {
  return new Map(SEATED_PLAYERS.map(seatId => [seatId, {
    seatId,
    playerProfileId: seatId === HERO_SEAT ? 'hero' : `villain-${seatId}`,
    startingStack: 200,
    startingStackBB: 100,
    endingStack: 200,
    endingStackBB: 100,
  }]));
}

function dealCards(): Pick<GameState, 'heroCards' | 'holeCardsBySeat' | 'boardCards'> {
  const deck = shuffleDeck(buildDeck());
  const holeCardsBySeat = new Map<SeatId, [Card, Card]>();
  for (const seatId of SEATED_PLAYERS) {
    const first = deck.shift();
    const second = deck.shift();
    if (!first || !second) throw new Error('Not enough cards to deal hand.');
    holeCardsBySeat.set(seatId, [first, second]);
  }
  const boardCards = dealHoldemBoardWithBurns(deck);
  return {
    heroCards: holeCardsBySeat.get(HERO_SEAT) as [Card, Card],
    holeCardsBySeat,
    boardCards,
  };
}

function createBaseActions(buttonSeat: SeatId): LiveHandAction[] {
  const positions = derivePositions(buttonSeat, SEATED_PLAYERS, TABLE_SIZE);
  const smallBlindSeat = SEATED_PLAYERS.find(seatId => positions.get(seatId) === 'SB')
    ?? SEATED_PLAYERS.find(seatId => positions.get(seatId) === 'BTN')
    ?? null;
  const bigBlindSeat = SEATED_PLAYERS.find(seatId => positions.get(seatId) === 'BB') ?? null;
  return createForcedBlindActions({
    baseActions: [],
    smallBlindSeat,
    bigBlindSeat,
    smallBlind: BLINDS.smallBlind,
    bigBlind: BLINDS.bigBlind,
    currency: BLINDS.currency ?? '$',
    playerIdBySeat: playerIdBySeat(),
  });
}

function createGame(handNumber: number, buttonSeat: SeatId, playerNames: string[]): GameState {
  const cards = dealCards();
  const positions = derivePositions(buttonSeat, SEATED_PLAYERS, TABLE_SIZE);
  const bigBlindSeat = SEATED_PLAYERS.find(seatId => positions.get(seatId) === 'BB') ?? null;
  const baseActions = createBaseActions(buttonSeat);
  const firstActor = firstPreflopActor({
    seatedPlayers: SEATED_PLAYERS,
    tableSize: TABLE_SIZE,
    bigBlindSeat,
    straddleSeat: null,
  });

  return {
    handNumber,
    buttonSeat,
    ...cards,
    actions: baseActions,
    street: 'preflop',
    actionSeatId: firstActor,
    history: [],
    phase: 'playing',
    result: `Pre-flop action starts with ${firstActor === null ? 'no one' : playerNames[firstActor]}.`,
    actionLog: [`Hand ${handNumber}: ${playerNames[HERO_SEAT]} is dealt ${playerCardsLabel(cards.heroCards)}.`],
  };
}

function simulatorProfileForSeat(seatId: SeatId): SimulatorProfile {
  return SIMULATOR_PROFILES[SIMULATOR_PROFILE_BY_SEAT[seatId] ?? 'chart_baseline'];
}

function handProfile(cards: [Card, Card]): HandProfile {
  const [first, second] = cards;
  const high = Math.max(RANK_VALUE[first.rank], RANK_VALUE[second.rank]);
  const low = Math.min(RANK_VALUE[first.rank], RANK_VALUE[second.rank]);
  const isPair = first.rank === second.rank;
  const gap = isPair ? 0 : high - low - 1;
  const isSuited = first.suit === second.suit;
  const isBroadway = high >= 12 && low >= 10;
  const hasAce = high === 14;
  const isConnector = !isPair && gap <= 1 && low >= 5;
  const isSmallPair = isPair && high <= 9;
  const isSpeculative = isPair || (isSuited && (isConnector || hasAce || low >= 8));

  return {
    high,
    low,
    gap,
    isPair,
    isSuited,
    isBroadway,
    hasAce,
    isConnector,
    isSmallPair,
    isSpeculative,
  };
}

function preflopRangeScore(cards: [Card, Card]): number {
  const profile = handProfile(cards);
  const pairBonus = profile.isPair ? 0.34 + profile.high / 45 : 0;
  const suitedBonus = profile.isSuited ? 0.08 : 0;
  const broadwayBonus = profile.isBroadway ? 0.11 : 0;
  const aceBonus = profile.hasAce ? 0.1 : 0;
  const gapPenalty = profile.isPair ? 0 : Math.min(0.18, Math.max(0, profile.gap) * 0.026);
  return Math.max(0, Math.min(1, (profile.high + profile.low) / 28 + pairBonus + suitedBonus + broadwayBonus + aceBonus - gapPenalty - 0.2));
}

function liveSeatIds(game: GameState): SeatId[] {
  return unfoldedSeats(game.actions, SEATED_PLAYERS);
}

function deepestOpponentRemainingBB(game: GameState, seatId: SeatId): number {
  return Math.max(
    0,
    ...liveSeatIds(game)
      .filter(item => item !== seatId)
      .map(item => remainingStackBB(game.actions, item)),
  );
}

function hasVoluntaryRaise(actions: LiveHandAction[]): boolean {
  return actions.some(action => (
    action.street === 'preflop'
    && (action.action === 'raise' || action.action === 'bet' || action.action === 'all-in')
  ));
}

function voluntaryRaiseCount(actions: LiveHandAction[]): number {
  return actions.filter(action => (
    action.street === 'preflop'
    && (action.action === 'raise' || action.action === 'bet' || action.action === 'all-in')
  )).length;
}

function seatsMatchedCurrentBet(game: GameState, currentBetBB: number, seatId: SeatId): number {
  if (currentBetBB <= 0) return 0;
  return liveSeatIds(game).filter(item => (
    item !== seatId
    && actionSummary(game.actions, game.street, item).seatContributionBB >= currentBetBB
  )).length;
}

function preflopPositionAdjustment(game: GameState, seatId: SeatId): number {
  const position = derivePositions(game.buttonSeat, SEATED_PLAYERS, TABLE_SIZE).get(seatId) ?? '';
  return PREFLOP_OPEN_ADJUSTMENT[position] ?? 0;
}

function defaultAggressiveAmountBB(game: GameState, seatId: SeatId): number {
  const summary = actionSummary(game.actions, game.street, seatId);
  const remaining = remainingStackBB(game.actions, seatId);
  const unopened = !hasVoluntaryRaise(game.actions);
  const targetTotal = unopened ? 3 : Math.max(summary.currentBetBB * 2.6, summary.currentBetBB + 2.5);
  const raiseTo = Math.max(targetTotal, summary.currentBetBB + 1);
  return Math.min(remaining, Math.max(summary.toCallBB + 1, raiseTo - summary.seatContributionBB));
}

function preflopContinueFloor(
  style: SimulatorProfile,
  profile: HandProfile | null,
  positionAdjustment: number,
  raiseCount: number,
  currentBetBB: number,
  matchedCurrentBet: number,
): number {
  let floor = style.rangeFloor + positionAdjustment;
  const facingThreeBet = raiseCount >= 2;

  if (currentBetBB >= 5) floor += 0.08;
  if (facingThreeBet) {
    const threeBetFloorByStyle: Record<SimulatorProfileKey, number> = {
      chart_tightener: 0.82,
      chart_baseline: 0.72,
      chart_expander: 0.64,
      sticky_defender: 0.56,
      pressure_3bettor: 0.58,
    };
    floor = Math.max(floor, threeBetFloorByStyle[style.key]);
  }
  if (raiseCount >= 3) floor += 0.16;
  if (matchedCurrentBet >= 2 && !profile?.isSpeculative) floor += 0.06;
  if (profile?.isSmallPair && matchedCurrentBet >= 1) floor -= 0.06;
  if (profile?.isSuited && profile.isConnector && matchedCurrentBet >= 1 && !facingThreeBet) floor -= 0.04;

  return Math.max(0.12, Math.min(0.96, floor));
}

function adjustedImpliedRequired(
  callBB: number,
  potBB: number,
  rawFutureBB: number,
  profile: HandProfile | null,
  raiseCount: number,
): number {
  if (callBB <= 0) return 0;
  const impliedCap = profile?.isSpeculative
    ? callBB * (raiseCount >= 2 ? 5 : 8)
    : callBB * 1.5;
  const futureBB = Math.min(rawFutureBB, impliedCap);
  return callBB / Math.max(0.01, potBB + callBB + futureBB);
}

function botDecision(game: GameState, seatId: SeatId): BotDecision {
  const style = simulatorProfileForSeat(seatId);
  const summary = actionSummary(game.actions, game.street, seatId);
  const cards = game.holeCardsBySeat.get(seatId);
  const profile = cards ? handProfile(cards) : null;
  const rangeScore = cards ? preflopRangeScore(cards) : 0;
  const equity = rangeScore;
  const callBB = summary.toCallBB;
  const unopened = !hasVoluntaryRaise(game.actions);
  const raiseCount = voluntaryRaiseCount(game.actions);
  const matchedCurrentBet = seatsMatchedCurrentBet(game, summary.currentBetBB, seatId);
  const rawImpliedFutureBB = Math.min(
    remainingStackBB(game.actions, seatId),
    deepestOpponentRemainingBB(game, seatId),
  ) * style.impliedOddsFactor;
  const rawRequired = callBB > 0 ? callBB / Math.max(0.01, summary.potBB + callBB) : 0;
  const impliedRequired = adjustedImpliedRequired(callBB, summary.potBB, rawImpliedFutureBB, profile, raiseCount);
  const random = Math.random();
  const bluffing = random < style.bluffRate;
  const handLabel = cards ? handNotationFromCards(cards) ?? playerCardsLabel(cards) : 'unknown';
  const positionAdjustment = preflopPositionAdjustment(game, seatId);
  const openFloor = Math.max(0.12, style.openRaiseFloor + positionAdjustment);
  const continueFloor = preflopContinueFloor(
    style,
    profile,
    positionAdjustment,
    raiseCount,
    summary.currentBetBB,
    matchedCurrentBet,
  );
  const threeBetFloor = Math.max(0.18, style.threeBetFloor + positionAdjustment);
  const effectiveSlack = profile?.isSpeculative ? style.callSlack : style.callSlack * 0.35;

  if (callBB > 0) {
    if (unopened && (rangeScore >= openFloor || bluffing) && summary.canRaise) {
      return {
        action: 'raise',
        amountBB: defaultAggressiveAmountBB(game, seatId),
        reason: `${style.label} opens ${handLabel}: range score ${formatNumber(rangeScore * 100)}% clears ${formatNumber(openFloor * 100)}%.`,
      };
    }
    if (!unopened && (rangeScore >= threeBetFloor || bluffing) && summary.canRaise) {
      return {
        action: 'raise',
        amountBB: defaultAggressiveAmountBB(game, seatId),
        reason: `${style.label} 3-bets ${handLabel}: range score ${formatNumber(rangeScore * 100)}% clears ${formatNumber(threeBetFloor * 100)}%.`,
      };
    }
    if (rangeScore < continueFloor && !bluffing) {
      return {
        action: 'fold',
        amountBB: 0,
        reason: `${style.label} folds ${handLabel}: range score ${formatNumber(rangeScore * 100)}% below continue floor ${formatNumber(continueFloor * 100)}%.`,
      };
    }
    if (equity + effectiveSlack < impliedRequired && !bluffing) {
      return {
        action: 'fold',
        amountBB: 0,
        reason: `${style.label} folds ${handLabel}: hand score ${formatNumber(equity * 100)}% below adjusted price ${formatNumber(impliedRequired * 100)}%.`,
      };
    }
    return {
      action: 'call',
      amountBB: callBB,
      reason: `${style.label} calls ${handLabel}: price ${formatNumber(rawRequired * 100)}%, adjusted price ${formatNumber(impliedRequired * 100)}%, range score ${formatNumber(rangeScore * 100)}% clears ${formatNumber(continueFloor * 100)}%.`,
    };
  }

  return {
    action: 'check',
    amountBB: 0,
    reason: `${style.label} checks ${handLabel}: no raise to call.`,
  };
}

function finishFoldedPot(game: GameState, winnerSeat: SeatId, playerNames: string[]): GameState {
  return {
    ...game,
    phase: 'hand_over',
    actionSeatId: null,
    result: `${playerNames[winnerSeat]} wins ${formatNumber(totalPotBB(game.actions))}BB without showdown.`,
    actionLog: [
      ...game.actionLog,
      `${playerNames[winnerSeat]} wins the pot uncontested.`,
    ],
  };
}

function finishPreflop(game: GameState, playerNames: string[]): GameState {
  const liveSeats = liveSeatIds(game);
  const liveNames = liveSeats.map(seatId => playerNames[seatId]).join(', ');
  return {
    ...game,
    phase: 'preflop_complete',
    street: 'preflop',
    actionSeatId: null,
    result: `Pre-flop complete: ${liveSeats.length} player${liveSeats.length === 1 ? '' : 's'} continue${liveSeats.length === 1 ? 's' : ''}.`,
    actionLog: [
      ...game.actionLog,
      `Pre-flop closes. Continuing players: ${liveNames || 'none'}.`,
    ],
  };
}

function applyActionAndAdvance(
  game: GameState,
  seatId: SeatId,
  action: 'check' | 'call' | 'fold' | 'bet' | 'raise',
  amountBB: number,
  playerNames: string[],
  logLine: string,
): GameState {
  const nextActions = appendLiveAction({
    actions: game.actions,
    street: 'preflop',
    seatId,
    playerProfileId: playerIdBySeat().get(seatId),
    action,
    ...(amountBB > 0 ? { amountBB, amount: amountBB * BLINDS.bigBlind } : {}),
  });
  const nextGame: GameState = {
    ...game,
    actions: nextActions,
    actionLog: [...game.actionLog, logLine],
  };
  const guided = nextGuidedActionState({
    actions: nextActions,
    street: 'preflop',
    actedSeat: seatId,
    seatedPlayers: SEATED_PLAYERS,
    tableSize: TABLE_SIZE,
    buttonSeat: game.buttonSeat,
  });
  if (guided.handActionClosed) {
    const liveSeats = liveSeatIds(nextGame);
    if (liveSeats.length === 1) return finishFoldedPot({ ...nextGame, actionSeatId: null }, liveSeats[0], playerNames);
    return finishPreflop({ ...nextGame, actionSeatId: null }, playerNames);
  }
  if (guided.roundClosed && guided.street !== 'preflop') {
    return finishPreflop({ ...nextGame, actionSeatId: null }, playerNames);
  }
  const nextActor = guided.seatId;
  return {
    ...nextGame,
    street: 'preflop',
    actionSeatId: nextActor,
    result: nextActor === null
      ? 'Pre-flop action closed.'
      : nextActor === HERO_SEAT
        ? 'Action is on Hero.'
        : `Action is on ${playerNames[nextActor]}.`,
  };
}

function committedBB(actions: LiveHandAction[], seatId: SeatId): number {
  return actions
    .filter(action => action.seatId === seatId)
    .reduce((sum, action) => sum + (action.amountBB ?? 0), 0);
}

function remainingStackBB(actions: LiveHandAction[], seatId: SeatId): number {
  return Math.max(0, 100 - committedBB(actions, seatId));
}

function defaultBetAmountBB(actions: LiveHandAction[], street: LiveStreet, seatId: SeatId): number {
  const summary = actionSummary(actions, street, seatId);
  const remaining = remainingStackBB(actions, seatId);
  if (street === 'preflop') {
    const unopened = !hasVoluntaryRaise(actions);
    const targetTotal = unopened ? 3 : Math.max(summary.currentBetBB * 2.6, summary.currentBetBB + 2.5);
    return Math.min(remaining, Math.max(summary.toCallBB + 1, targetTotal - summary.seatContributionBB));
  }
  const raiseTo = Math.max(summary.currentBetBB * 2, summary.currentBetBB + 1);
  return Math.min(remaining, Math.max(summary.toCallBB + 1, raiseTo - summary.seatContributionBB));
}

function streetBets(actions: LiveHandAction[], street: LiveStreet): Map<SeatId, number> {
  const bets = new Map<SeatId, number>();
  for (const action of actions) {
    if (action.street !== street || !action.amountBB) continue;
    bets.set(action.seatId, (bets.get(action.seatId) ?? 0) + action.amountBB);
  }
  return bets;
}

function actionOddsFor(game: GameState): LiveActionOdds | null {
  if (game.phase !== 'playing' || game.actionSeatId !== HERO_SEAT) return null;
  const summary = actionSummary(game.actions, game.street, HERO_SEAT);
  const callBB = summary.toCallBB;
  const potBB = summary.potBB;
  const actorRemainingBB = remainingStackBB(game.actions, HERO_SEAT);
  const actorRemainingAfterCallBB = Math.max(0, actorRemainingBB - callBB);
  const biggestOpponentRemainingBB = Math.max(
    0,
    ...SEATED_PLAYERS.filter(seatId => seatId !== HERO_SEAT).map(seatId => remainingStackBB(game.actions, seatId)),
  );
  const impliedFutureBB = callBB > 0 ? Math.min(actorRemainingAfterCallBB, biggestOpponentRemainingBB) : 0;
  const potDenominatorBB = potBB + callBB;
  const impliedDenominatorBB = potDenominatorBB + impliedFutureBB;
  return {
    callBB,
    potBB,
    actorRemainingAfterCallBB,
    biggestOpponentRemainingBB,
    impliedFutureBB,
    potRequiredEquityPct: callBB > 0 && potDenominatorBB > 0 ? (callBB / potDenominatorBB) * 100 : 0,
    impliedRequiredEquityPct: callBB > 0 && impliedDenominatorBB > 0 ? (callBB / impliedDenominatorBB) * 100 : 0,
    potOddsRatio: formatOddsRatio(potBB, callBB),
    impliedOddsRatio: formatOddsRatio(potBB + impliedFutureBB, callBB),
    stackLabel: `${formatNumber(actorRemainingBB)}BB left`,
  };
}

function playerCardsLabel(cards: [Card, Card]): string {
  return cards.map(formatCard).join(' ');
}

export function DealSimulator({ profiles, onBack }: DealSimulatorProps) {
  const playerNames = useMemo(() => buildPlayerNames(profiles), [profiles]);
  const [nextButtonSeat, setNextButtonSeat] = useState<SeatId>(0);
  const [game, setGame] = useState<GameState>(() => createGame(1, 0, playerNames));
  const positions = useMemo(() => derivePositions(game.buttonSeat, SEATED_PLAYERS, TABLE_SIZE), [game.buttonSeat]);
  const stackInfo = useMemo(() => stackInfoBySeat(), []);
  const activeSummary = game.phase === 'playing' && game.actionSeatId === HERO_SEAT
    ? actionSummary(game.actions, game.street, HERO_SEAT)
    : null;
  const boardForDisplay = visibleBoardCards(game.boardCards, 0);
  const potBB = totalPotBB(game.actions);
  const actionOdds = actionOddsFor(game);
  const heroCanAct = game.phase === 'playing' && game.actionSeatId === HERO_SEAT && Boolean(activeSummary);
  const waitingOnBot = game.phase === 'playing' && game.actionSeatId !== null && game.actionSeatId !== HERO_SEAT;

  const startNewHand = () => {
    const buttonSeat = (nextButtonSeat + 1) % TABLE_SIZE;
    setNextButtonSeat(buttonSeat);
    setGame(prev => createGame(prev.handNumber + 1, buttonSeat, playerNames));
  };

  const advanceBotAction = () => {
    setGame(current => {
      if (current.phase !== 'playing' || current.actionSeatId === null || current.actionSeatId === HERO_SEAT) return current;
      const seatId = current.actionSeatId;
      const decision = botDecision(current, seatId);
      return applyActionAndAdvance(
        { ...current, history: [...current.history, { ...current, history: [] }] },
        seatId,
        decision.action,
        decision.amountBB,
        playerNames,
        `${playerNames[seatId]} ${decision.action}s${decision.amountBB > 0 ? ` ${formatNumber(decision.amountBB)}BB` : ''}. ${decision.reason}`,
      );
    });
  };

  const recordHeroAction = (action: 'check' | 'call' | 'fold' | 'bet' | 'raise') => {
    setGame(current => {
      if (current.phase !== 'playing' || current.actionSeatId !== HERO_SEAT) return current;
      const summary = actionSummary(current.actions, current.street, HERO_SEAT);
      const amountBB = action === 'check' || action === 'fold'
        ? 0
        : action === 'call'
          ? summary.toCallBB
          : defaultBetAmountBB(current.actions, current.street, HERO_SEAT);
      const checkpoint = { ...current, history: [] };
      return applyActionAndAdvance(
        { ...current, history: [...current.history, checkpoint] },
        HERO_SEAT,
        action,
        amountBB,
        playerNames,
        `${playerNames[HERO_SEAT]} ${action}s${amountBB > 0 ? ` ${formatNumber(amountBB)}BB` : ''}.`,
      );
    });
  };

  const undo = () => {
    const previous = game.history[game.history.length - 1];
    if (previous) {
      setGame({ ...previous, history: game.history.slice(0, -1) });
      return;
    }
    const result = undoLastAction(game.actions);
    if (result.undone) setGame({ ...game, actions: result.actions, street: result.undone.street, actionSeatId: HERO_SEAT });
  };

  return (
    <div className="deal-simulator">
      <div className="live-active-header deal-simulator-header">
        <button className="back-btn" onClick={onBack}>← Poker</button>
        <div className="live-active-title-block">
          <h1 className="live-active-title">Deal Simulator</h1>
        </div>
      </div>

      <div className="live-active-actions live-quick-context">
        <span className="live-active-ended-tag">Hand {game.handNumber}</span>
        <span className="live-active-ended-tag">Blinds {BLINDS.currency}{formatNumber(BLINDS.smallBlind)}/{formatNumber(BLINDS.bigBlind)}</span>
        <span className="live-active-ended-tag">Pre-flop only</span>
        {game.actionSeatId !== null && <span className="live-active-ended-tag">Action: {playerNames[game.actionSeatId]}</span>}
      </div>

      <PokerTable
        tableSize={TABLE_SIZE}
        playerNames={playerNames}
        buttonSeat={game.buttonSeat}
        actionSeat={game.phase === 'playing' ? game.actionSeatId : null}
        positions={positions}
        stackInfo={stackInfo}
        streetBets={streetBets(game.actions, game.street)}
        centerContent={(
          <LiveTableCenter
            potBB={potBB}
            bigBlind={BLINDS.bigBlind}
            currency={BLINDS.currency}
            boardCards={boardForDisplay}
            boardDisabled
            status={game.phase === 'preflop_complete'
              ? <>Pre-flop closed<br /><span className="live-table-center-sub">{game.result}</span></>
              : game.phase === 'hand_over'
                ? <>Hand over<br /><span className="live-table-center-sub">{game.result}</span></>
                : waitingOnBot
                  ? <>Waiting<br /><span className="live-table-center-sub">{game.result}</span></>
                  : <>Hero decision<br /><span className="live-table-center-sub">{game.result}</span></>}
          />
        )}
        isSeatDisabled={() => true}
      />

      <section className="deal-simulator-hero">
        <div>
          <div className="live-card-modal-kicker">Hero hole cards</div>
          <div className="deal-simulator-hero-cards">
            {game.heroCards.map(card => <PlayingCard key={`${card.rank}${card.suit}`} card={card} size="md" />)}
          </div>
        </div>
        <div className="deal-simulator-status">
          <strong>{game.result}</strong>
          <span>
            {game.phase === 'preflop_complete'
              ? 'Stop here for now. The next design pass can handle flop entry.'
              : game.phase === 'hand_over'
                ? 'No flop. The pot was won uncontested.'
                : `Hero has ${playerCardsLabel(game.heroCards)} with ${formatNumber(remainingStackBB(game.actions, HERO_SEAT))}BB behind.`}
          </span>
        </div>
        {waitingOnBot ? (
          <button type="button" className="btn-primary" onClick={advanceBotAction}>
            Next Bot Action
          </button>
        ) : (
          <button type="button" className="btn-secondary" onClick={startNewHand}>
            New Hand
          </button>
        )}
      </section>

      {heroCanAct && (
        <LiveActionBar
          street={game.street}
          actorName={playerNames[HERO_SEAT]}
          actionSummary={activeSummary}
          actionOdds={actionOdds}
          disabled={false}
          hasUserActions={game.history.length > 0}
          onFold={() => recordHeroAction('fold')}
          onCheckOrCall={() => activeSummary && recordHeroAction(activeSummary.canCheck ? 'check' : 'call')}
          onBetOrRaise={() => activeSummary && recordHeroAction(activeSummary.canBet ? 'bet' : 'raise')}
          onWinner={() => {}}
          onUndo={undo}
          showWinner={false}
        />
      )}

      <section className="deal-simulator-showdown" aria-label="Pre-flop seats">
        {SEATED_PLAYERS.map(seatId => {
          const isLive = liveSeatIds(game).includes(seatId);
          const simulatorProfile = simulatorProfileForSeat(seatId);
          return (
            <div key={seatId} className={seatId === HERO_SEAT ? 'hero' : ''}>
              <span title={seatId === HERO_SEAT ? 'Hero' : simulatorProfile.description}>
                {playerNames[seatId]} · {positions.get(seatId)} · {seatId === HERO_SEAT ? 'Hero' : simulatorProfile.label}
              </span>
              <strong>{seatId === HERO_SEAT ? playerCardsLabel(game.heroCards) : isLive ? 'In hand' : 'Folded'}</strong>
              <small>{stackDepthLabel(remainingStackBB(game.actions, seatId))} · {formatNumber(remainingStackBB(game.actions, seatId))}BB</small>
            </div>
          );
        })}
      </section>

      <section className="deal-simulator-log" aria-label="Action log">
        <div className="live-card-modal-kicker">Action log</div>
        {game.actionLog.slice(-8).map((item, index) => (
          <p key={`${item}-${index}`}>{item}</p>
        ))}
      </section>
    </div>
  );
}
