import type {
  BlindLevel,
  LiveHand,
  LiveHandAction,
  LivePosition,
  LiveStackSnapshot,
  LiveStreet,
  SeatId,
} from '../types/liveSession';
import type { Card } from '../types/poker';
import { calculateSpecificHoldemEquity, buildDeck } from './holdemEquity';
import {
  actionSummary,
  appendLiveAction,
  applyActionCostsToStacks,
  createForcedBlindActions,
  distributePotToWinners,
  firstPreflopActor,
  totalPotBB,
} from './liveHandEngine';
import { derivePositions, nextOccupiedClockwise } from './livePoker';

type Rng = () => number;

export interface SimulateTrackedHoldemHandInput {
  handIndex: number;
  tableSize: number;
  buttonSeat: SeatId;
  seatedPlayers: SeatId[];
  playerIdBySeat: Map<SeatId, string>;
  blindLevel: BlindLevel;
  startingStacks: LiveStackSnapshot[];
  heroSeatId?: SeatId | null;
  playerNameBySeat?: Map<SeatId, string>;
  startedAt?: string;
  rng?: Rng;
}

export interface SimulatedTrackedHand {
  hand: LiveHand;
  heroCards: [Card, Card] | null;
  boardCards: [Card, Card, Card, Card, Card];
  holeCardsBySeat: Map<SeatId, [Card, Card]>;
  winnerSeats: SeatId[];
}

export function shuffleDeck(deck: Card[], rng: Rng = Math.random): Card[] {
  const next = [...deck];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function dealHoldemBoardWithBurns(deck: Card[]): [Card, Card, Card, Card, Card] {
  const burn = () => {
    if (!deck.shift()) throw new Error('Not enough cards to burn before dealing the board.');
  };
  const draw = () => {
    const card = deck.shift();
    if (!card) throw new Error('Not enough cards to deal the board.');
    return card;
  };

  burn();
  const flop = [draw(), draw(), draw()] as [Card, Card, Card];
  burn();
  const turn = draw();
  burn();
  const river = draw();

  return [...flop, turn, river];
}

function seatProfileSnapshot(seatedPlayers: SeatId[], playerIdBySeat: Map<SeatId, string>): Record<string, string> {
  return Object.fromEntries(
    seatedPlayers.flatMap(seatId => {
      const profileId = playerIdBySeat.get(seatId);
      return profileId ? [[String(seatId), profileId]] : [];
    }),
  );
}

function orderedFrom(startSeat: SeatId | null, seatedPlayers: SeatId[], tableSize: number): SeatId[] {
  if (startSeat === null || seatedPlayers.length === 0) return [];
  const ordered: SeatId[] = [];
  const set = new Set(seatedPlayers);
  for (let step = 0; step < tableSize && ordered.length < seatedPlayers.length; step++) {
    const seatId = (startSeat + step) % tableSize;
    if (set.has(seatId)) ordered.push(seatId);
  }
  return ordered;
}

function postflopOrder(buttonSeat: SeatId, seatedPlayers: SeatId[], tableSize: number): SeatId[] {
  return orderedFrom(nextOccupiedClockwise(buttonSeat, seatedPlayers, tableSize), seatedPlayers, tableSize);
}

function smallBlindSeat(positions: Map<SeatId, LivePosition>, seatedPlayers: SeatId[]): SeatId | null {
  const sb = seatedPlayers.find(seatId => positions.get(seatId) === 'SB');
  if (sb !== undefined) return sb;
  return seatedPlayers.find(seatId => positions.get(seatId) === 'BTN') ?? null;
}

function bigBlindSeat(positions: Map<SeatId, LivePosition>, seatedPlayers: SeatId[]): SeatId | null {
  return seatedPlayers.find(seatId => positions.get(seatId) === 'BB') ?? null;
}

function addAction({
  actions,
  street,
  seatId,
  playerIdBySeat,
  action,
  amountBB,
  blindLevel,
}: {
  actions: LiveHandAction[];
  street: LiveStreet;
  seatId: SeatId;
  playerIdBySeat: Map<SeatId, string>;
  action: 'check' | 'call';
  amountBB: number;
  blindLevel: BlindLevel;
}): LiveHandAction[] {
  return appendLiveAction({
    actions,
    street,
    seatId,
    playerProfileId: playerIdBySeat.get(seatId),
    action,
    ...(amountBB > 0 ? {
      amountBB,
      amount: amountBB * blindLevel.bigBlind,
    } : {}),
  });
}

function addCallOrCheckRound({
  actions,
  street,
  orderedSeats,
  playerIdBySeat,
  blindLevel,
}: {
  actions: LiveHandAction[];
  street: LiveStreet;
  orderedSeats: SeatId[];
  playerIdBySeat: Map<SeatId, string>;
  blindLevel: BlindLevel;
}): LiveHandAction[] {
  let next = actions;
  for (const seatId of orderedSeats) {
    const summary = actionSummary(next, street, seatId);
    const amountBB = summary.toCallBB;
    next = addAction({
      actions: next,
      street,
      seatId,
      playerIdBySeat,
      action: amountBB > 0 ? 'call' : 'check',
      amountBB,
      blindLevel,
    });
  }
  return next;
}

function dealHoleCards(deck: Card[], seatedPlayers: SeatId[]): Map<SeatId, [Card, Card]> {
  const holeCards = new Map<SeatId, [Card, Card]>();
  for (const seatId of seatedPlayers) {
    const first = deck.shift();
    const second = deck.shift();
    if (!first || !second) throw new Error('Not enough cards to deal hole cards.');
    holeCards.set(seatId, [first, second]);
  }
  return holeCards;
}

function findWinnerSeats({
  seatedPlayers,
  holeCardsBySeat,
  boardCards,
  playerNameBySeat,
}: {
  seatedPlayers: SeatId[];
  holeCardsBySeat: Map<SeatId, [Card, Card]>;
  boardCards: Card[];
  playerNameBySeat: Map<SeatId, string>;
}): SeatId[] {
  const result = calculateSpecificHoldemEquity(
    seatedPlayers.flatMap(seatId => {
      const cards = holeCardsBySeat.get(seatId);
      return cards ? [{
        id: String(seatId),
        name: playerNameBySeat.get(seatId) ?? `Seat ${seatId + 1}`,
        cards,
      }] : [];
    }),
    boardCards,
  );

  const winners = result.players
    .filter(player => player.winPct > 0 || player.tiePct > 0)
    .map(player => Number(player.id))
    .filter(seatId => Number.isFinite(seatId));

  return winners.length > 0 ? winners : seatedPlayers.slice(0, 1);
}

export function simulateTrackedHoldemHand(input: SimulateTrackedHoldemHandInput): SimulatedTrackedHand {
  if (input.seatedPlayers.length < 2) {
    throw new Error('A simulated hand needs at least two seated players.');
  }

  const startedAt = input.startedAt ?? new Date().toISOString();
  const deck = shuffleDeck(buildDeck(), input.rng);
  const holeCardsBySeat = dealHoleCards(deck, input.seatedPlayers);
  const completeBoard = dealHoldemBoardWithBurns(deck);

  const positions = derivePositions(input.buttonSeat, input.seatedPlayers, input.tableSize);
  const sbSeat = smallBlindSeat(positions, input.seatedPlayers);
  const bbSeat = bigBlindSeat(positions, input.seatedPlayers);
  let actions = createForcedBlindActions({
    baseActions: [],
    smallBlindSeat: sbSeat,
    bigBlindSeat: bbSeat,
    smallBlind: input.blindLevel.smallBlind,
    bigBlind: input.blindLevel.bigBlind,
    currency: input.blindLevel.currency ?? '$',
    playerIdBySeat: input.playerIdBySeat,
  });

  const firstPreflopSeat = firstPreflopActor({
    seatedPlayers: input.seatedPlayers,
    tableSize: input.tableSize,
    bigBlindSeat: bbSeat,
    straddleSeat: null,
  });
  actions = addCallOrCheckRound({
    actions,
    street: 'preflop',
    orderedSeats: orderedFrom(firstPreflopSeat, input.seatedPlayers, input.tableSize),
    playerIdBySeat: input.playerIdBySeat,
    blindLevel: input.blindLevel,
  });

  const postflopSeats = postflopOrder(input.buttonSeat, input.seatedPlayers, input.tableSize);
  for (const street of ['flop', 'turn', 'river'] as const) {
    actions = addCallOrCheckRound({
      actions,
      street,
      orderedSeats: postflopSeats,
      playerIdBySeat: input.playerIdBySeat,
      blindLevel: input.blindLevel,
    });
  }

  const winnerSeats = findWinnerSeats({
    seatedPlayers: input.seatedPlayers,
    holeCardsBySeat,
    boardCards: completeBoard,
    playerNameBySeat: input.playerNameBySeat ?? new Map(),
  });
  const finalPotBB = totalPotBB(actions);
  const afterCosts = applyActionCostsToStacks(input.startingStacks, actions);
  const stackSnapshots = distributePotToWinners({
    snapshots: afterCosts,
    winnerSeats,
    potBB: finalPotBB,
  });
  const firstWinnerSeat = winnerSeats[0];
  const firstWinnerPosition = positions.get(firstWinnerSeat);
  const firstWinnerCards = holeCardsBySeat.get(firstWinnerSeat) ?? null;

  const hand: LiveHand = {
    index: input.handIndex,
    startedAt,
    endedAt: new Date().toISOString(),
    buttonSeat: input.buttonSeat,
    tableSize: input.tableSize,
    seatedPlayers: [...input.seatedPlayers],
    seatedPlayerProfileIds: seatProfileSnapshot(input.seatedPlayers, input.playerIdBySeat),
    actions,
    stackSnapshots,
    board: {
      flop: [completeBoard[0], completeBoard[1], completeBoard[2]],
      turn: completeBoard[3],
      river: completeBoard[4],
    },
    showdown: input.seatedPlayers.flatMap(seatId => {
      const cards = holeCardsBySeat.get(seatId);
      return cards ? [{ seatId, cards }] : [];
    }),
    finalPotBB,
    potBB: finalPotBB,
    notes: 'Simulated hand',
    ...(winnerSeats.length > 1 ? {
      chopped: true,
      chopSeats: winnerSeats,
      chopPlayerProfileIds: winnerSeats.flatMap(seatId => {
        const profileId = input.playerIdBySeat.get(seatId);
        return profileId ? [profileId] : [];
      }),
      chopPositions: winnerSeats.flatMap(seatId => {
        const position = positions.get(seatId);
        return position ? [position] : [];
      }),
    } : {
      winnerSeat: firstWinnerSeat,
      ...(input.playerIdBySeat.get(firstWinnerSeat) ? { winnerPlayerProfileId: input.playerIdBySeat.get(firstWinnerSeat) } : {}),
      ...(firstWinnerPosition ? { winnerPosition: firstWinnerPosition } : {}),
      winningCards: firstWinnerCards,
    }),
  };

  const heroCards = input.heroSeatId === null || input.heroSeatId === undefined
    ? null
    : holeCardsBySeat.get(input.heroSeatId) ?? null;

  return {
    hand,
    heroCards,
    boardCards: completeBoard,
    holeCardsBySeat,
    winnerSeats,
  };
}
