import { useCallback, useMemo, useState } from 'react';
import type {
  BankrollLog,
  BlindLevel,
  ExposedCards,
  LiveBetSizing,
  LiveCardPickerMode,
  LiveHand,
  LiveHandDecisionSnapshot,
  LiveHandAction,
  LivePosition,
  LiveSessionActiveTab,
  LiveStreet,
  LiveSeat,
  LiveSession,
  LiveStackSnapshot,
  LiveStraddle,
  SeatId,
} from '../../../types/liveSession';
import type { Card } from '../../../types/poker';
import type { PlayerProfile } from '../../../types/profiles';
import { DEFAULT_ACTION_CONTEXT } from '../../../types/profiles';
import { occupiedSeatsAt, advanceButton, derivePositions } from '../../../utils/livePoker';
import { getLiveHandRecommendation } from '../../../utils/pokerHandRecommendation';
import { cardKey } from '../../../utils/cardInput';
import { PokerTable } from './PokerTable';
import { LiveSessionStats } from './LiveSessionStats';
import { LiveHandAdvisor } from './LiveHandAdvisor';
import { SeatPlayerPicker } from './SeatPlayerPicker';
import { CardPicker } from '../CardPicker';
import { PlayingCard } from '../HandDisplay';
import { ProfileRangeChart } from '../profiles/ProfileRangeChart';
import {
  activeBlindLevelForHand as getActiveBlindLevelForHand,
  bankrollNet,
  convertBetSizing as convertLiveBetSizing,
  convertPotSize as convertLivePotSize,
  convertStraddle as convertLiveStraddle,
  formatLiveNumber,
  stackDepthLabel,
  type LiveAmountMode,
} from '../../../utils/liveMoney';
import {
  actionSummary,
  appendLiveAction,
  applyActionCostsToStacks,
  createForcedBlindActions,
  currentStacksForNextHand,
  deriveHeroPlayedAction,
  distributePotToWinners,
  firstPreflopActor,
  followedAdviceBucket,
  nextGuidedActionState,
  totalPotBB,
  undoLastAction,
} from '../../../utils/liveHandEngine';

interface LiveSessionActiveProps {
  session: LiveSession;
  profiles: PlayerProfile[];
  onSave: (session: LiveSession) => LiveSession;
  onCreateProfile: (name: string, tableSize: number) => Promise<PlayerProfile>;
  onExit: () => void;
}

type PanelMode = 'idle' | 'remove-player' | 'end-confirm';
type BoardSelection = 'flop' | 'turn' | 'river';
type BetPreset = 'none' | 'quarter' | 'third' | 'half' | 'twoThirds' | 'pot' | 'custom';
type AmountMode = LiveAmountMode;
type CustomActionInputMode = AmountMode | 'potPct';
type ActionAmountPreset = 'min' | 'twoHalf' | 'three' | 'four' | 'thirdPot' | 'halfPot' | 'twoThirdsPot' | 'pot' | 'allIn' | 'custom';

type ShownHand = { seatId: SeatId; cards: ExposedCards };
type BoardCards = [Card | null, Card | null, Card | null, Card | null, Card | null];

interface PendingWinner {
  seatId: SeatId;
  startedAt: string;
  buttonSeat: SeatId;
  seatedPlayers: SeatId[];
  seatedPlayerProfileIds: Record<string, string>;
  winnerPlayerProfileId: string;
  winnerPosition: LivePosition;
  betSizing?: LiveBetSizing;
  finalPotAmount?: number;
  finalPotBB?: number;
  straddle?: LiveStraddle;
}

const EMPTY_BOARD: BoardCards = [null, null, null, null, null];
const BOARD_SELECTION_LABELS: Record<BoardSelection, string> = {
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

const BET_PRESETS: { key: BetPreset; label: string; fraction: number | null }[] = [
  { key: 'none', label: 'No bet', fraction: null },
  { key: 'quarter', label: '¼ pot', fraction: 0.25 },
  { key: 'third', label: '⅓ pot', fraction: 1 / 3 },
  { key: 'half', label: '½ pot', fraction: 0.5 },
  { key: 'twoThirds', label: '⅔ pot', fraction: 2 / 3 },
  { key: 'pot', label: 'Pot', fraction: 1 },
  { key: 'custom', label: 'Custom', fraction: null },
];

const PREFLOP_ACTION_PRESETS: { key: ActionAmountPreset; label: string }[] = [
  { key: 'min', label: 'Min' },
  { key: 'twoHalf', label: '2.5BB' },
  { key: 'three', label: '3BB' },
  { key: 'four', label: '4BB' },
  { key: 'allIn', label: 'All-in' },
  { key: 'custom', label: 'Custom' },
];
const POSTFLOP_ACTION_PRESETS: { key: ActionAmountPreset; label: string }[] = [
  { key: 'min', label: 'Min' },
  { key: 'thirdPot', label: '1/3 pot' },
  { key: 'halfPot', label: '1/2 pot' },
  { key: 'twoThirdsPot', label: '2/3 pot' },
  { key: 'pot', label: 'Pot' },
  { key: 'allIn', label: 'All-in' },
  { key: 'custom', label: 'Custom' },
];

function snapshotPlayerIdsForSeats(seatIds: SeatId[], seats: LiveSeat[]): Record<string, string> {
  return Object.fromEntries(
    seatIds.flatMap(seatId => {
      const playerId = seats.find(s => s.seatId === seatId)?.player?.playerProfileId;
      return playerId ? [[String(seatId), playerId]] : [];
    }),
  );
}

function snapshotHandsForCurrentTable(session: LiveSession): LiveHand[] {
  return session.hands.map(hand => ({
    ...hand,
    tableSize: hand.tableSize ?? session.tableSize,
    seatedPlayerProfileIds: hand.seatedPlayerProfileIds
      ?? snapshotPlayerIdsForSeats(hand.seatedPlayers, session.seats),
  }));
}

function buildBoard(cards: BoardCards): LiveHand['board'] | undefined {
  if (cards.every(card => card === null)) return undefined;
  const [flop1, flop2, flop3, turn, river] = cards;
  return {
    ...(flop1 || flop2 || flop3 ? { flop: [flop1, flop2, flop3] } : {}),
    ...(turn ? { turn } : {}),
    ...(river ? { river } : {}),
  };
}

function formatNumber(value: number): string {
  return formatLiveNumber(value);
}

function toNumber(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function toExposedCards(cards: Card[]): ExposedCards | null {
  if (cards.length === 1) return [cards[0]];
  if (cards.length >= 2) return [cards[0], cards[1]];
  return null;
}

function upsertBlindLevel(session: LiveSession, handIndex: number, level: Omit<BlindLevel, 'effectiveFromHandIndex'>): BlindLevel[] {
  return [
    ...(session.blindLevels ?? []).filter(item => item.effectiveFromHandIndex !== handIndex),
    {
      effectiveFromHandIndex: handIndex,
      smallBlind: Math.max(0, level.smallBlind),
      bigBlind: Math.max(0.01, level.bigBlind),
      currency: level.currency || '$',
    },
  ].sort((a, b) => a.effectiveFromHandIndex - b.effectiveFromHandIndex);
}

export function LiveSessionActive({
  session,
  profiles,
  onSave,
  onCreateProfile,
  onExit,
}: LiveSessionActiveProps) {
  const [mode, setMode] = useState<PanelMode>('idle');
  const [addingAtSeat, setAddingAtSeat] = useState<SeatId | null>(null);
  const [draggedSeat, setDraggedSeat] = useState<SeatId | null>(null);
  const [outcomeSeatId, setOutcomeSeatId] = useState<SeatId | null>(null);
  const [betPreset, setBetPreset] = useState<BetPreset>('none');
  const [betInputMode, setBetInputMode] = useState<AmountMode>('bb');
  const [potInputMode, setPotInputMode] = useState<AmountMode>('bb');
  const [customPotRaw, setCustomPotRaw] = useState('10');
  const [customBetRaw, setCustomBetRaw] = useState('5');
  const [finalPotRaw, setFinalPotRaw] = useState('');
  const [finalPotInputMode, setFinalPotInputMode] = useState<AmountMode>('bb');
  const [straddleEnabled, setStraddleEnabled] = useState(false);
  const [straddleSeatId, setStraddleSeatId] = useState<SeatId | null>(null);
  const [straddleRaw, setStraddleRaw] = useState('2');
  const [straddleInputMode, setStraddleInputMode] = useState<AmountMode>('bb');
  const [currentStreet, setCurrentStreet] = useState<LiveStreet>('preflop');
  const [handActions, setHandActions] = useState<LiveHandAction[]>([]);
  const [actionSeatId, setActionSeatId] = useState<SeatId | null>(null);
  const [actionAmountPreset, setActionAmountPreset] = useState<ActionAmountPreset>('three');
  const [customActionRaw, setCustomActionRaw] = useState('');
  const [customActionInputMode, setCustomActionInputMode] = useState<CustomActionInputMode>('bb');
  const [betSheetOpen, setBetSheetOpen] = useState(false);
  const [handNote, setHandNote] = useState('');
  const [chopSeatIds, setChopSeatIds] = useState<SeatId[]>([]);
  const [showBlindChange, setShowBlindChange] = useState(false);
  const [pendingWinner, setPendingWinner] = useState<PendingWinner | null>(null);
  const [winningCards, setWinningCards] = useState<Card[]>([]);
  const [shownHands, setShownHands] = useState<ShownHand[]>([]);
  const [shownPickerOpen, setShownPickerOpen] = useState(false);
  const [shownSeatId, setShownSeatId] = useState<SeatId | null>(null);
  const [shownCards, setShownCards] = useState<Card[]>([]);
  const [boardCards, setBoardCards] = useState<BoardCards>(EMPTY_BOARD);
  const [boardSelection, setBoardSelection] = useState<BoardSelection | null>(null);
  const [boardSlotCards, setBoardSlotCards] = useState<Card[]>([]);
  const [heroCards, setHeroCards] = useState<Card[]>([]);
  const [heroCardPromptOpen, setHeroCardPromptOpen] = useState(true);
  const [showLiveAdviceChart, setShowLiveAdviceChart] = useState(false);
  const [heroDecisionSnapshot, setHeroDecisionSnapshot] = useState<LiveHandDecisionSnapshot | null>(null);
  const [activeTabLocal, setActiveTabLocal] = useState<LiveSessionActiveTab>(session.uiPreferences?.activeTab ?? 'live');
  const [cardPickerModeLocal, setCardPickerModeLocal] = useState<LiveCardPickerMode | undefined>(session.uiPreferences?.cardPickerMode);

  const nextHandIndex = session.hands.length;
  const currentBlindLevel = getActiveBlindLevelForHand(session, nextHandIndex);
  const [smallBlindRaw, setSmallBlindRaw] = useState(String(currentBlindLevel.smallBlind));
  const [bigBlindRaw, setBigBlindRaw] = useState(String(currentBlindLevel.bigBlind));
  const [currencyRaw, setCurrencyRaw] = useState(currentBlindLevel.currency ?? '$');
  const [buyInsRaw, setBuyInsRaw] = useState<string[]>(session.bankroll?.buyIns.map(String) ?? ['']);
  const [cashOutRaw, setCashOutRaw] = useState(session.bankroll ? String(session.bankroll.cashOut) : '');

  const currentButton: SeatId = session.nextButtonSeat ?? (session.hands.length > 0
    ? (() => {
        const lastHand = session.hands[session.hands.length - 1];
        const occupiedNext = occupiedSeatsAt(session.seats, nextHandIndex);
        return advanceButton(lastHand.buttonSeat, occupiedNext, session.tableSize) ?? lastHand.buttonSeat;
      })()
    : session.initialButtonSeat);

  const occupiedNow = occupiedSeatsAt(session.seats, nextHandIndex);
  const positions = useMemo(
    () => derivePositions(currentButton, occupiedNow, session.tableSize),
    [currentButton, occupiedNow, session.tableSize],
  );
  const defaultStraddleSeatId = useMemo(() => {
    const utg = occupiedNow.find(seatId => positions.get(seatId) === 'UTG');
    if (utg !== undefined) return utg;
    const firstNonBlind = occupiedNow.find(seatId => {
      const position = positions.get(seatId);
      return position && position !== 'BTN' && position !== 'SB' && position !== 'BB';
    });
    return firstNonBlind ?? null;
  }, [occupiedNow, positions]);

  const playerNames = useMemo(() => session.seats.map(s => {
    if (!s.player || !occupiedNow.includes(s.seatId)) return null;
    const p = profiles.find(pr => pr.id === s.player!.playerProfileId);
    return p?.name ?? `Player ${s.player.playerProfileId.slice(0, 6)}`;
  }), [session.seats, profiles, occupiedNow]);
  const playerIdBySeat = useMemo(() => {
    const map = new Map<SeatId, string>();
    for (const seat of session.seats) {
      if (seat.player && occupiedNow.includes(seat.seatId)) {
        map.set(seat.seatId, seat.player.playerProfileId);
      }
    }
    return map;
  }, [occupiedNow, session.seats]);
  const currentStacks = useMemo(() => currentStacksForNextHand(session), [session]);
  const currentStackBySeat = useMemo(() => {
    const map = new Map<SeatId, LiveStackSnapshot>();
    for (const snapshot of currentStacks) map.set(snapshot.seatId, snapshot);
    return map;
  }, [currentStacks]);
  const heroSeatId = useMemo<SeatId | null>(() => (
    occupiedNow.find(seatId => {
      const profileId = session.seats[seatId]?.player?.playerProfileId;
      return profiles.find(profile => profile.id === profileId)?.type === 'self';
    }) ?? occupiedNow[0] ?? null
  ), [occupiedNow, profiles, session.seats]);
  const heroProfileId = heroSeatId === null ? null : session.seats[heroSeatId]?.player?.playerProfileId ?? null;
  const heroProfile = heroProfileId ? profiles.find(profile => profile.id === heroProfileId) ?? null : null;
  const heroPosition = heroSeatId === null ? null : positions.get(heroSeatId) ?? null;
  const heroSituation = heroProfile && heroPosition
    ? heroProfile.positions.find(position => position.position === heroPosition)?.situations[DEFAULT_ACTION_CONTEXT] ?? null
    : null;
  const heroRecommendation = heroDecisionSnapshot && heroPosition
    ? getLiveHandRecommendation({
        handNotation: heroDecisionSnapshot.handNotation,
        tableSize: session.tableSize,
        position: heroPosition,
        profile: heroProfile,
      })
    : null;

  const isEnded = session.endedAt !== null;
  const activePause = [...(session.pauses ?? [])].reverse().find(pause => pause.endedAt === null) ?? null;
  const isPaused = !isEnded && activePause !== null;
  const startedAtForCurrentHand = () => session.hands.length > 0
    ? session.hands[session.hands.length - 1].endedAt
    : session.startedAt;
  const currentSeatedSnapshot = () => snapshotPlayerIdsForSeats(occupiedNow, session.seats);
  const currentBoard = () => buildBoard(boardCards);
  const activeTab = session.uiPreferences?.activeTab ?? activeTabLocal;
  const cardPickerMode = session.uiPreferences?.cardPickerMode ?? cardPickerModeLocal;
  const knownCards = useMemo(() => {
    const byKey = new Map<string, Card>();
    const addCard = (card: Card | null | undefined) => {
      if (card) byKey.set(cardKey(card), card);
    };

    boardCards.forEach(addCard);
    heroCards.forEach(addCard);
    winningCards.forEach(addCard);
    shownCards.forEach(addCard);
    shownHands.forEach(hand => hand.cards.forEach(addCard));

    return Array.from(byKey.values());
  }, [boardCards, heroCards, shownCards, shownHands, winningCards]);

  const saveUiPreferences = (updates: NonNullable<LiveSession['uiPreferences']>) => {
    onSave({
      ...session,
      uiPreferences: {
        ...session.uiPreferences,
        ...updates,
      },
    });
  };

  const setActiveTab = (tab: LiveSessionActiveTab) => {
    setActiveTabLocal(tab);
    saveUiPreferences({ activeTab: tab });
  };

  const setCardPickerMode = (mode: LiveCardPickerMode) => {
    setCardPickerModeLocal(mode);
    saveUiPreferences({ cardPickerMode: mode });
  };

  const handleHeroCardsChange = (cards: Card[]) => {
    setHeroCards(cards);
    if (cards.length === 2) setHeroCardPromptOpen(false);
  };

  const selectedBetSizing = useMemo(() => {
    if (outcomeSeatId === null || betPreset === 'none') return undefined;
    const preset = BET_PRESETS.find(item => item.key === betPreset);
    const potValue = Math.max(0, toNumber(customPotRaw));
    const potAmount = potInputMode === 'bb' ? potValue * currentBlindLevel.bigBlind : potValue;
    const betValue = betPreset === 'custom'
      ? Math.max(0, toNumber(customBetRaw))
      : preset?.fraction && potAmount > 0
        ? betInputMode === 'bb'
          ? (potAmount * preset.fraction) / currentBlindLevel.bigBlind
          : potAmount * preset.fraction
        : 0;

    return convertLiveBetSizing({
      session,
      handIndex: nextHandIndex,
      seatId: outcomeSeatId,
      inputMode: betInputMode,
      betValue,
      potValue,
      potInputMode,
    });
  }, [betPreset, betInputMode, customBetRaw, customPotRaw, currentBlindLevel.bigBlind, nextHandIndex, outcomeSeatId, potInputMode, session]);
  const selectedFinalPot = useMemo(() => convertLivePotSize({
    session,
    handIndex: nextHandIndex,
    value: Math.max(0, toNumber(finalPotRaw)),
    inputMode: finalPotInputMode,
  }), [finalPotInputMode, finalPotRaw, nextHandIndex, session]);
  const activeStraddleSeatId = straddleSeatId !== null && occupiedNow.includes(straddleSeatId)
    ? straddleSeatId
    : defaultStraddleSeatId;
  const selectedStraddle = useMemo(() => (
    straddleEnabled && activeStraddleSeatId !== null
      ? convertLiveStraddle({
          session,
          handIndex: nextHandIndex,
          seatId: activeStraddleSeatId,
          value: Math.max(0, toNumber(straddleRaw)),
          inputMode: straddleInputMode,
        })
      : undefined
  ), [activeStraddleSeatId, nextHandIndex, session, straddleEnabled, straddleInputMode, straddleRaw]);
  const smallBlindSeat = useMemo(() => {
    const sb = occupiedNow.find(seatId => positions.get(seatId) === 'SB');
    if (sb !== undefined) return sb;
    return occupiedNow.find(seatId => positions.get(seatId) === 'BTN') ?? null;
  }, [occupiedNow, positions]);
  const bigBlindSeat = useMemo(
    () => occupiedNow.find(seatId => positions.get(seatId) === 'BB') ?? null,
    [occupiedNow, positions],
  );
  const baseActionsForCurrentHand = useCallback((actions: LiveHandAction[]): LiveHandAction[] => {
    let next = actions;
    if (!next.some(action => action.action === 'post-blind')) {
      next = createForcedBlindActions({
        baseActions: next,
        smallBlindSeat,
        bigBlindSeat,
        smallBlind: currentBlindLevel.smallBlind,
        bigBlind: currentBlindLevel.bigBlind,
        currency: currentBlindLevel.currency ?? '$',
        playerIdBySeat,
      });
    }
    if (selectedStraddle && !next.some(action => action.action === 'post-straddle')) {
      next = appendLiveAction({
        actions: next,
        street: 'preflop',
        seatId: selectedStraddle.seatId,
        playerProfileId: playerIdBySeat.get(selectedStraddle.seatId),
        action: 'post-straddle',
        amount: selectedStraddle.amount,
        amountBB: selectedStraddle.amountBB,
      });
    }
    return next;
  }, [bigBlindSeat, currentBlindLevel.bigBlind, currentBlindLevel.currency, currentBlindLevel.smallBlind, playerIdBySeat, selectedStraddle, smallBlindSeat]);
  const currentHandActions = useMemo(
    () => baseActionsForCurrentHand(handActions),
    [baseActionsForCurrentHand, handActions],
  );
  const initialActionSeatId = currentStreet === 'preflop'
    ? firstPreflopActor({
        seatedPlayers: occupiedNow,
        tableSize: session.tableSize,
        bigBlindSeat,
        straddleSeat: selectedStraddle?.seatId ?? null,
      })
    : null;
  const effectiveActionSeatId = actionSeatId ?? initialActionSeatId;
  const activeActionSummary = effectiveActionSeatId === null
    ? null
    : actionSummary(currentHandActions, currentStreet, effectiveActionSeatId);
  const actionSeatStack = effectiveActionSeatId === null ? null : currentStackBySeat.get(effectiveActionSeatId) ?? null;

  const resetOutcomeModal = () => {
    setOutcomeSeatId(null);
    setBetPreset('none');
    setBetInputMode('bb');
    setPotInputMode('bb');
    setFinalPotRaw('');
    setFinalPotInputMode('bb');
    setHandNote('');
    setChopSeatIds([]);
  };

  const resetHandInputs = () => {
    setBoardCards(EMPTY_BOARD);
    setBoardSelection(null);
    setBoardSlotCards([]);
    setHeroCards([]);
    setHeroCardPromptOpen(true);
    setShowLiveAdviceChart(false);
    setHeroDecisionSnapshot(null);
    setCurrentStreet('preflop');
    setHandActions([]);
    setActionSeatId(null);
    setBetSheetOpen(false);
  };

  const handleAdvisorSnapshotChange = useCallback((snapshot: LiveHandDecisionSnapshot | null) => {
    setHeroDecisionSnapshot(snapshot);
  }, []);

  const remainingStackBBForSeat = (seatId: SeatId): number | null => {
    const snapshot = currentStackBySeat.get(seatId);
    if (!snapshot) return null;
    const committed = currentHandActions
      .filter(action => action.seatId === seatId)
      .reduce((sum, action) => sum + (action.amountBB ?? 0), 0);
    return Math.max(0, snapshot.startingStackBB - committed);
  };

  const minRaiseAmountBB = (seatId: SeatId): number => {
    const summary = actionSummary(currentHandActions, currentStreet, seatId);
    if (summary.currentBetBB <= 0) return 1;

    const streetActions = currentHandActions
      .filter(action => action.street === currentStreet)
      .slice()
      .sort((a, b) => a.order - b.order);
    const hasVoluntaryBetOrRaise = streetActions.some(action => action.action === 'bet' || action.action === 'raise' || action.action === 'all-in');
    const contributions = new Map<SeatId, number>();
    let currentMax = 0;
    let lastFullRaiseIncrement = hasVoluntaryBetOrRaise ? 1 : Math.max(summary.currentBetBB, 1);

    for (const action of streetActions) {
      const amountBB = action.amountBB ?? 0;
      if (amountBB <= 0) continue;
      const nextContribution = (contributions.get(action.seatId) ?? 0) + amountBB;
      contributions.set(action.seatId, nextContribution);
      if (nextContribution <= currentMax) continue;

      const increment = nextContribution - currentMax;
      currentMax = nextContribution;
      if (!hasVoluntaryBetOrRaise) continue;
      if (action.action !== 'all-in' || increment >= lastFullRaiseIncrement) {
        lastFullRaiseIncrement = Math.max(increment, 1);
      }
    }

    return Math.max(0, summary.currentBetBB + lastFullRaiseIncrement - summary.seatContributionBB);
  };

  const actionAmountBB = (preset: ActionAmountPreset, seatId: SeatId): number => {
    const summary = actionSummary(currentHandActions, currentStreet, seatId);
    const remaining = remainingStackBBForSeat(seatId) ?? Number.POSITIVE_INFINITY;
    const contribution = summary.seatContributionBB;
    const pot = Math.max(1, summary.potBB);
    const targetTotal = (bb: number) => Math.max(0, bb - contribution);
    let amountBB = 0;

    if (preset === 'allIn') amountBB = remaining;
    else if (preset === 'min') amountBB = minRaiseAmountBB(seatId);
    else if (preset === 'custom') {
      const raw = Math.max(0, toNumber(customActionRaw));
      if (customActionInputMode === 'bb') amountBB = raw;
      else if (customActionInputMode === 'amount') amountBB = raw / Math.max(0.01, currentBlindLevel.bigBlind);
      else amountBB = pot * (raw / 100);
    } else if (currentStreet === 'preflop') {
      if (preset === 'twoHalf') amountBB = targetTotal(2.5);
      else if (preset === 'three') amountBB = targetTotal(3);
      else if (preset === 'four') amountBB = targetTotal(4);
      else amountBB = minRaiseAmountBB(seatId);
    } else {
      if (preset === 'thirdPot') amountBB = pot / 3;
      else if (preset === 'halfPot') amountBB = pot / 2;
      else if (preset === 'twoThirdsPot') amountBB = pot * (2 / 3);
      else if (preset === 'pot') amountBB = pot;
      else amountBB = minRaiseAmountBB(seatId);
    }

    return Math.max(0, Math.min(amountBB, remaining));
  };

  const openActionSizingSheet = () => {
    if (!activeActionSummary) return;
    setActionAmountPreset(activeActionSummary.canRaise ? 'min' : currentStreet === 'preflop' ? 'three' : 'halfPot');
    setBetSheetOpen(true);
  };

  const recordAction = (seatId: SeatId, action: 'check' | 'call' | 'fold' | 'bet' | 'raise' | 'all-in') => {
    const profileId = playerIdBySeat.get(seatId);
    const summary = actionSummary(currentHandActions, currentStreet, seatId);
    const amountBB = action === 'check' || action === 'fold'
      ? 0
      : action === 'call'
        ? summary.toCallBB
        : actionAmountBB(action === 'all-in' ? 'allIn' : actionAmountPreset, seatId);
    const amount = amountBB * currentBlindLevel.bigBlind;

    const nextActions = appendLiveAction({
      actions: currentHandActions,
      street: currentStreet,
      seatId,
      playerProfileId: profileId,
      action,
      ...(amountBB > 0 ? { amount, amountBB } : {}),
    });
    const nextGuided = nextGuidedActionState({
      actions: nextActions,
      street: currentStreet,
      actedSeat: seatId,
      seatedPlayers: occupiedNow,
      tableSize: session.tableSize,
      buttonSeat: currentButton,
    });
    setHandActions(nextActions);
    setCurrentStreet(nextGuided.street);
    setActionSeatId(nextGuided.seatId);
    if (nextGuided.street !== currentStreet) {
      setActionAmountPreset('halfPot');
      if (nextGuided.street === 'flop' || nextGuided.street === 'turn' || nextGuided.street === 'river') {
        openBoardSelection(nextGuided.street);
      }
    }
    setBetSheetOpen(false);
  };

  const undoAction = () => {
    const result = undoLastAction(currentHandActions);
    if (!result.undone) return;
    setHandActions(result.actions);
    setCurrentStreet(result.undone.street);
    setActionSeatId(result.undone.seatId);
    setBetSheetOpen(false);
  };

  const openOutcomeForSeat = (seatId: SeatId) => {
    setOutcomeSeatId(seatId);
    setChopSeatIds([seatId]);
    setActionSeatId(null);
  };

  const startingStackSnapshotsForCurrentHand = (): LiveStackSnapshot[] => occupiedNow.flatMap(seatId => {
    const profileId = playerIdBySeat.get(seatId);
    if (!profileId) return [];
    const existing = currentStackBySeat.get(seatId);
    if (existing) return [{ ...existing }];
    const fallbackBB = 100;
    return [{
      seatId,
      playerProfileId: profileId,
      startingStack: fallbackBB * currentBlindLevel.bigBlind,
      startingStackBB: fallbackBB,
      endingStack: fallbackBB * currentBlindLevel.bigBlind,
      endingStackBB: fallbackBB,
    }];
  });

  const completeStackSnapshots = (winnerSeats: SeatId[], actions: LiveHandAction[], finalPotBB?: number): LiveStackSnapshot[] => {
    const afterCosts = applyActionCostsToStacks(startingStackSnapshotsForCurrentHand(), actions);
    return distributePotToWinners({
      snapshots: afterCosts,
      winnerSeats,
      potBB: finalPotBB ?? totalPotBB(actions),
    });
  };

  const heroDecisionForActions = (actions: LiveHandAction[]): LiveHandDecisionSnapshot | undefined => {
    if (!heroDecisionSnapshot) return undefined;
    const heroAction = deriveHeroPlayedAction(actions, heroDecisionSnapshot.seatId);
    const followedAdvice = followedAdviceBucket({
      recommendedKind: heroDecisionSnapshot.recommendedBucketKind,
      recommendedMaxBB: heroDecisionSnapshot.recommendedBucketMaxBB,
      action: heroAction,
    });
    return {
      ...heroDecisionSnapshot,
      ...(heroAction ? {
        playedActionType: heroAction.action,
        playedActionAmountBB: heroAction.amountBB ?? 0,
      } : {}),
      ...(followedAdvice !== undefined ? { followedAdvice } : {}),
    };
  };

  const handleSeatTap = (seatId: SeatId) => {
    if (isEnded) return;
    if (mode === 'remove-player') {
      const seat = session.seats[seatId];
      if (!seat?.player || !occupiedNow.includes(seatId)) return;
      handleRemovePlayer(seatId);
      return;
    }
    if (!occupiedNow.includes(seatId)) return;
    setActionSeatId(prev => prev === seatId ? null : seatId);
  };

  const startWinnerFlow = (seatId: SeatId) => {
    const seat = session.seats[seatId];
    const winnerPosition = positions.get(seatId);
    if (!seat?.player || !winnerPosition) return;

    const advisedCards = heroDecisionSnapshot?.seatId === seatId
      ? [...heroDecisionSnapshot.cards]
      : heroSeatId === seatId && heroCards.length > 0
        ? [...heroCards]
        : [];
    setWinningCards(advisedCards);
    setShownHands([]);
    setShownPickerOpen(false);
    setShownSeatId(null);
    setShownCards([]);
    setPendingWinner({
      seatId,
      startedAt: startedAtForCurrentHand(),
      buttonSeat: currentButton,
      seatedPlayers: [...occupiedNow],
      seatedPlayerProfileIds: currentSeatedSnapshot(),
      winnerPlayerProfileId: seat.player.playerProfileId,
      winnerPosition,
      ...(selectedBetSizing ? { betSizing: selectedBetSizing } : {}),
      ...(selectedFinalPot ? selectedFinalPot : {}),
      ...(selectedStraddle ? { straddle: selectedStraddle } : {}),
    });
    resetOutcomeModal();
  };

  const saveSkippedHand = () => {
    if (occupiedNow.length < 2) return;
    const now = new Date().toISOString();
    const actions = currentHandActions;
    const hand: LiveHand = {
      index: nextHandIndex,
      startedAt: startedAtForCurrentHand(),
      endedAt: now,
      buttonSeat: currentButton,
      tableSize: session.tableSize,
      seatedPlayers: [...occupiedNow],
      seatedPlayerProfileIds: currentSeatedSnapshot(),
      skipped: true,
      skippedReason: 'Skipped / missed hand',
      actions,
      stackSnapshots: completeStackSnapshots([], actions, totalPotBB(actions)),
      ...(handNote.trim() ? { notes: handNote.trim() } : {}),
      ...(selectedStraddle ? { straddle: selectedStraddle } : {}),
    };
    onSave({ ...session, nextButtonSeat: undefined, hands: [...session.hands, hand] });
    resetHandInputs();
    resetOutcomeModal();
  };

  const toggleChopSeat = (seatId: SeatId) => {
    setChopSeatIds(prev => prev.includes(seatId) ? prev.filter(id => id !== seatId) : [...prev, seatId]);
  };

  const saveChop = () => {
    if (occupiedNow.length < 2 || chopSeatIds.length < 2) return;
    const now = new Date().toISOString();
    const board = currentBoard();
    const actions = currentHandActions;
    const finalPotBB = selectedFinalPot?.finalPotBB ?? totalPotBB(actions);
    const hand: LiveHand = {
      index: nextHandIndex,
      startedAt: startedAtForCurrentHand(),
      endedAt: now,
      buttonSeat: currentButton,
      tableSize: session.tableSize,
      seatedPlayers: [...occupiedNow],
      seatedPlayerProfileIds: currentSeatedSnapshot(),
      chopped: true,
      chopSeats: [...chopSeatIds],
      chopPlayerProfileIds: chopSeatIds.flatMap(seatId => session.seats[seatId]?.player?.playerProfileId ?? []),
      chopPositions: chopSeatIds.flatMap(seatId => positions.get(seatId) ?? []),
      actions,
      stackSnapshots: completeStackSnapshots(chopSeatIds, actions, finalPotBB),
      ...(handNote.trim() ? { notes: handNote.trim() } : {}),
      ...(board ? { board } : {}),
      ...(selectedFinalPot ? selectedFinalPot : { finalPotBB }),
      ...(selectedStraddle ? { straddle: selectedStraddle } : {}),
      ...(selectedBetSizing ? { betSizing: selectedBetSizing, potBB: selectedBetSizing.potBB, bets: [{ seatId: selectedBetSizing.seatId, betBB: selectedBetSizing.amountBB }] } : {}),
      ...(heroDecisionForActions(actions) ? { heroDecision: heroDecisionForActions(actions) } : {}),
    };
    onSave({ ...session, nextButtonSeat: undefined, hands: [...session.hands, hand] });
    resetHandInputs();
    resetOutcomeModal();
  };

  const cancelWinningCards = () => {
    setPendingWinner(null);
    setWinningCards([]);
    setShownHands([]);
    setShownPickerOpen(false);
    setShownSeatId(null);
    setShownCards([]);
  };

  const savePendingHand = (cards: Card[] | 'no-show') => {
    if (!pendingWinner) return;
    const exposed = cards === 'no-show' ? null : toExposedCards(cards);
    if (cards !== 'no-show' && !exposed) return;
    const now = new Date().toISOString();
    const board = currentBoard();
    const actions = currentHandActions;
    const finalPotBB = pendingWinner.finalPotBB ?? totalPotBB(actions);
    const hand: LiveHand = {
      index: nextHandIndex,
      startedAt: pendingWinner.startedAt,
      endedAt: now,
      buttonSeat: pendingWinner.buttonSeat,
      tableSize: session.tableSize,
      seatedPlayers: pendingWinner.seatedPlayers,
      seatedPlayerProfileIds: pendingWinner.seatedPlayerProfileIds,
      winnerSeat: pendingWinner.seatId,
      winnerPlayerProfileId: pendingWinner.winnerPlayerProfileId,
      winnerPosition: pendingWinner.winnerPosition,
      actions,
      stackSnapshots: completeStackSnapshots([pendingWinner.seatId], actions, finalPotBB),
      ...(handNote.trim() ? { notes: handNote.trim() } : {}),
      ...(board ? { board } : {}),
      winningCards: exposed,
      ...(pendingWinner.finalPotBB ? { finalPotBB: pendingWinner.finalPotBB, finalPotAmount: pendingWinner.finalPotAmount } : { finalPotBB }),
      ...(pendingWinner.straddle ? { straddle: pendingWinner.straddle } : {}),
      ...(pendingWinner.betSizing ? { betSizing: pendingWinner.betSizing, potBB: pendingWinner.betSizing.potBB, bets: [{ seatId: pendingWinner.seatId, betBB: pendingWinner.betSizing.amountBB }] } : {}),
      ...(heroDecisionForActions(actions) ? { heroDecision: heroDecisionForActions(actions) } : {}),
      ...(shownHands.length > 0 ? { showdown: shownHands } : {}),
    };
    onSave({ ...session, nextButtonSeat: undefined, hands: [...session.hands, hand] });
    resetHandInputs();
    cancelWinningCards();
  };

  const openBoardSelection = (selection: BoardSelection) => {
    setBoardSelection(selection);
    if (selection === 'flop') {
      setBoardSlotCards(boardCards.slice(0, 3).filter((card): card is Card => card !== null));
      return;
    }
    const index = selection === 'turn' ? 3 : 4;
    setBoardSlotCards(boardCards[index] ? [boardCards[index]] : []);
  };

  const saveBoardSelection = () => {
    if (boardSelection === null) return;
    setBoardCards(prev => {
      const next = [...prev] as BoardCards;
      if (boardSelection === 'flop') {
        next[0] = boardSlotCards[0] ?? null;
        next[1] = boardSlotCards[1] ?? null;
        next[2] = boardSlotCards[2] ?? null;
      } else {
        next[boardSelection === 'turn' ? 3 : 4] = boardSlotCards[0] ?? null;
      }
      return next;
    });
    setBoardSelection(null);
    setBoardSlotCards([]);
  };

  const shownPlayerCandidates = pendingWinner ? pendingWinner.seatedPlayers.filter(seatId => seatId !== pendingWinner.seatId) : [];

  const handleShownCardsChange = (cards: Card[]) => {
    setShownCards(cards);
    if (shownSeatId === null) return;
    const exposed = toExposedCards(cards);
    setShownHands(prev => exposed
      ? [...prev.filter(hand => hand.seatId !== shownSeatId), { seatId: shownSeatId, cards: exposed }]
      : prev.filter(hand => hand.seatId !== shownSeatId));
  };

  const closeShownPlayerPicker = () => {
    setShownPickerOpen(false);
    setShownSeatId(null);
    setShownCards([]);
  };

  const startShownPlayerHand = (seatId?: SeatId) => {
    const existing = typeof seatId === 'number' ? shownHands.find(hand => hand.seatId === seatId) : null;
    setShownPickerOpen(true);
    setShownSeatId(seatId ?? null);
    setShownCards(existing ? [...existing.cards] : []);
  };

  const handleSeatDrop = (fromSeatId: SeatId, toSeatId: SeatId) => {
    if (isEnded || fromSeatId === toSeatId || mode !== 'idle') return;
    const fromSeat = session.seats[fromSeatId];
    const toSeat = session.seats[toSeatId];
    if (!fromSeat?.player || !toSeat) return;
    const hands = snapshotHandsForCurrentTable(session);
    const nextSeats = session.seats.map(seat => {
      if (seat.seatId === fromSeatId) return { ...seat, player: toSeat.player };
      if (seat.seatId === toSeatId) return { ...seat, player: fromSeat.player };
      return seat;
    });
    const nextInitialButtonSeat = session.hands.length === 0 && session.initialButtonSeat === fromSeatId
      ? toSeatId
      : session.hands.length === 0 && session.initialButtonSeat === toSeatId
        ? fromSeatId
        : session.initialButtonSeat;
    onSave({ ...session, seats: nextSeats, hands, initialButtonSeat: nextInitialButtonSeat });
  };

  const handleRemovePlayer = (seatId: SeatId) => {
    const seat = session.seats[seatId];
    if (!seat?.player || !occupiedNow.includes(seatId)) return;
    const remainingOldSeats = session.seats.filter(s => s.player && occupiedNow.includes(s.seatId) && s.seatId !== seatId);
    const nextTableSize = Math.max(2, remainingOldSeats.length);
    const nextSeats: LiveSeat[] = Array.from({ length: nextTableSize }, (_, index) => ({
      seatId: index,
      player: remainingOldSeats[index]?.player ? { ...remainingOldSeats[index].player!, leftAtHandIndex: null } : null,
    }));
    const profileIdToSeat = new Map(nextSeats.flatMap(s => s.player ? [[s.player.playerProfileId, s.seatId] as const] : []));
    const currentButtonProfileId = session.seats.find(s => s.seatId === currentButton)?.player?.playerProfileId;
    const nextClockwiseOldSeat = advanceButton(currentButton, remainingOldSeats.map(s => s.seatId), session.tableSize);
    const nextClockwiseProfileId = nextClockwiseOldSeat === null ? null : session.seats.find(s => s.seatId === nextClockwiseOldSeat)?.player?.playerProfileId ?? null;
    const nextButtonSeat = (currentButtonProfileId ? profileIdToSeat.get(currentButtonProfileId) : undefined)
      ?? (nextClockwiseProfileId ? profileIdToSeat.get(nextClockwiseProfileId) : undefined)
      ?? nextSeats.find(s => s.player)?.seatId
      ?? 0;
    onSave({
      ...session,
      tableSize: nextTableSize,
      initialButtonSeat: session.hands.length === 0 ? nextButtonSeat : session.initialButtonSeat,
      nextButtonSeat,
      seats: nextSeats,
      hands: snapshotHandsForCurrentTable(session),
    });
    setMode('idle');
  };

  const handleAddPlayer = (profileId: string) => {
    if (addingAtSeat === null) return;
    const seatId = addingAtSeat;
    const player = { playerProfileId: profileId, joinedAtHandIndex: nextHandIndex, leftAtHandIndex: null };
    const fillsExistingSeat = seatId < session.tableSize;
    const nextTableSize = fillsExistingSeat ? session.tableSize : Math.min(9, session.tableSize + 1);
    const nextSeats: LiveSeat[] = fillsExistingSeat
      ? session.seats.map(s => s.seatId === seatId ? { ...s, player } : s)
      : [...session.seats, { seatId: session.tableSize, player }];
    onSave({ ...session, tableSize: nextTableSize, nextButtonSeat: currentButton, seats: nextSeats, hands: snapshotHandsForCurrentTable(session) });
    setAddingAtSeat(null);
    setMode('idle');
  };

  const startAddPlayer = () => {
    if (session.tableSize >= 9 && occupiedNow.length >= session.tableSize) return;
    const emptySeat = session.seats.find(s => !s.player || !occupiedNow.includes(s.seatId));
    setAddingAtSeat(emptySeat?.seatId ?? session.tableSize);
    setMode('idle');
  };

  const saveBlindChange = () => {
    const smallBlind = Math.max(0, toNumber(smallBlindRaw));
    const bigBlind = Math.max(0.01, toNumber(bigBlindRaw));
    const nextLevels = upsertBlindLevel(session, nextHandIndex, { smallBlind, bigBlind, currency: currencyRaw.trim() || '$' });
    onSave({ ...session, blindLevels: nextLevels, stakes: { sbBB: smallBlind, bbBB: bigBlind, currency: currencyRaw.trim() || '$' } });
    setShowBlindChange(false);
  };

  const togglePause = () => {
    const now = new Date().toISOString();
    const pauses = session.pauses ?? [];
    if (isPaused) {
      let closed = false;
      const nextPauses = [...pauses].reverse().map(pause => {
        if (!closed && pause.endedAt === null) {
          closed = true;
          return { ...pause, endedAt: now };
        }
        return pause;
      }).reverse();
      onSave({ ...session, pauses: nextPauses });
      return;
    }
    onSave({ ...session, pauses: [...pauses, { startedAt: now, endedAt: null }] });
  };

  const handleEndSession = () => {
    const buyIns = buyInsRaw.map(toNumber).filter(value => value > 0);
    const cashOut = Math.max(0, toNumber(cashOutRaw));
    const recordedAt = new Date().toISOString();
    const pauses = (session.pauses ?? []).map(pause => (
      pause.endedAt === null ? { ...pause, endedAt: recordedAt } : pause
    ));
    const bankroll: BankrollLog = {
      buyIns,
      cashOut,
      currency: currentBlindLevel.currency ?? '$',
      net: bankrollNet(buyIns, cashOut),
      recordedAt,
    };
    onSave({ ...session, endedAt: recordedAt, pauses, bankroll });
    setMode('idle');
  };

  if (addingAtSeat !== null) {
    return (
      <SeatPlayerPicker
        profiles={profiles}
        excludeIds={session.seats.filter(s => s.player !== null && occupiedNow.includes(s.seatId)).map(s => s.player!.playerProfileId)}
        onCancel={() => { setAddingAtSeat(null); setMode('idle'); }}
        onPickExisting={handleAddPlayer}
        onCreateNew={(name) => onCreateProfile(name, Math.max(session.tableSize, addingAtSeat + 1))}
        tableSize={Math.max(session.tableSize, addingAtSeat + 1)}
        title={`Add player to seat ${addingAtSeat + 1}`}
        helperText="The table grows by one seat when the current table is full."
      />
    );
  }

  const currentPotBB = totalPotBB(currentHandActions);
  const currentPotAmount = currentPotBB * currentBlindLevel.bigBlind;
  const currentStreetBets = useMemo(() => {
    const bets = new Map<SeatId, number>();
    for (const action of currentHandActions) {
      if (action.street !== currentStreet || !action.amountBB) continue;
      bets.set(action.seatId, (bets.get(action.seatId) ?? 0) + action.amountBB);
    }
    return bets;
  }, [currentHandActions, currentStreet]);

  const centerContent = (
    <div className="live-table-center-stack">
      <div className="live-table-pot" aria-label="Current pot">
        <span className="live-table-pot-label">Pot</span>
        <strong>{formatNumber(currentPotBB)}BB</strong>
        <span className="live-table-pot-amount">
          {currentBlindLevel.currency ?? '$'}{formatNumber(currentPotAmount)}
        </span>
      </div>
      <div className="live-board">
        <div className="live-board-group live-board-flop" aria-label="Flop">
          {[0, 1, 2].map(index => (
            <button key={index} type="button" className={`live-board-slot ${boardCards[index] ? 'filled' : ''}`} onClick={() => !isEnded && openBoardSelection('flop')} disabled={isEnded} aria-label="Flop">
              {boardCards[index] ? <PlayingCard card={boardCards[index]} size="sm" /> : <span>{index + 1}</span>}
            </button>
          ))}
        </div>
        {(['turn', 'river'] as BoardSelection[]).map(selection => {
          const index = selection === 'turn' ? 3 : 4;
          return (
            <div key={selection} className="live-board-group" aria-label={BOARD_SELECTION_LABELS[selection]}>
              <button type="button" className={`live-board-slot ${boardCards[index] ? 'filled' : ''}`} onClick={() => !isEnded && openBoardSelection(selection)} disabled={isEnded} aria-label={BOARD_SELECTION_LABELS[selection]}>
                {boardCards[index] ? <PlayingCard card={boardCards[index]} size="sm" /> : <span>{selection === 'turn' ? 'T' : 'R'}</span>}
              </button>
            </div>
          );
        })}
      </div>
      <div className="live-table-center-text">
        {isEnded ? <>Session ended<br /><span className="live-table-center-sub">Read-only</span></>
          : isPaused ? <>Timer paused<br /><span className="live-table-center-sub">Tap Resume when play starts</span></>
          : mode === 'remove-player' ? 'Tap a seated player to remove'
          : occupiedNow.length < 2 ? 'Need at least 2 seated players'
          : <>Hand {nextHandIndex + 1}<br /><span className="live-table-center-sub">Tap a player for outcome</span></>}
      </div>
    </div>
  );

  const actionActorName = effectiveActionSeatId === null ? 'Action closed' : playerNames[effectiveActionSeatId] ?? `Seat ${effectiveActionSeatId + 1}`;
  const hasUserActions = currentHandActions.some(action => action.action !== 'post-blind' && action.action !== 'post-straddle');
  const actionBarDisabled = isEnded || isPaused || effectiveActionSeatId === null || !activeActionSummary;
  const actionBar = !isEnded && (
    <section className="live-sticky-action-bar" aria-label="Live action controls">
      <div className="live-sticky-action-main">
        <div>
          <div className="live-card-modal-kicker">{currentStreet}</div>
          <h3>{actionActorName}</h3>
        </div>
        <div className="live-action-panel-meta">
          {activeActionSummary && <span>Pot {formatNumber(activeActionSummary.potBB)}BB</span>}
          {activeActionSummary && <span>To call {formatNumber(activeActionSummary.toCallBB)}BB</span>}
          {effectiveActionSeatId !== null && actionSeatStack && <span>{stackDepthLabel(actionSeatStack.startingStackBB)} · {formatNumber(remainingStackBBForSeat(effectiveActionSeatId) ?? actionSeatStack.startingStackBB)}BB</span>}
        </div>
      </div>
      <div className="live-sticky-action-buttons">
        <button type="button" className="hl-po-chip" onClick={() => effectiveActionSeatId !== null && recordAction(effectiveActionSeatId, 'fold')} disabled={actionBarDisabled}>Fold</button>
        <button
          type="button"
          className="hl-po-chip"
          onClick={() => effectiveActionSeatId !== null && activeActionSummary && recordAction(effectiveActionSeatId, activeActionSummary.canCheck ? 'check' : 'call')}
          disabled={actionBarDisabled || (!activeActionSummary?.canCheck && !activeActionSummary?.canCall)}
        >
          {activeActionSummary?.canCheck ? 'Check' : 'Call'}
        </button>
        <button type="button" className="hl-po-chip" onClick={openActionSizingSheet} disabled={actionBarDisabled}>
          {activeActionSummary?.canBet ? 'Bet' : 'Raise'}
        </button>
        <button type="button" className="hl-po-chip" onClick={() => effectiveActionSeatId !== null && openOutcomeForSeat(effectiveActionSeatId)} disabled={effectiveActionSeatId === null}>Winner</button>
        <button type="button" className="hl-po-chip" onClick={undoAction} disabled={!hasUserActions}>Undo</button>
      </div>
    </section>
  );

  const betSizingSheet = betSheetOpen && effectiveActionSeatId !== null && activeActionSummary && (
    <div className="live-bottom-sheet-backdrop" role="presentation" onClick={() => setBetSheetOpen(false)}>
      <section className="live-bottom-sheet" role="dialog" aria-modal="true" aria-label="Bet sizing" onClick={event => event.stopPropagation()}>
        <div className="live-card-modal-header">
          <div>
            <div className="live-card-modal-kicker">{currentStreet} sizing</div>
            <h2 className="live-card-modal-title">{activeActionSummary.canBet ? 'Bet' : 'Raise'} · {actionActorName}</h2>
          </div>
          <button type="button" className="live-card-modal-close" onClick={() => setBetSheetOpen(false)}>×</button>
        </div>
        <div className="hl-po-chips">
          {(currentStreet === 'preflop' ? PREFLOP_ACTION_PRESETS : POSTFLOP_ACTION_PRESETS).map(preset => (
            <button
              key={preset.key}
              type="button"
              className={`hl-po-chip ${actionAmountPreset === preset.key ? 'active' : ''}`}
              onClick={() => setActionAmountPreset(preset.key)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {actionAmountPreset === 'custom' && (
          <div className="hl-po-custom-row">
            <label className="hl-sit-field">
              <span className="hl-label">Custom</span>
              <input type="number" min={0} step={0.5} className="hl-num-input" value={customActionRaw} onChange={e => setCustomActionRaw(e.target.value)} />
            </label>
            <label className="hl-sit-field">
              <span className="hl-label">Unit</span>
              <select className="hl-num-input" value={customActionInputMode} onChange={e => setCustomActionInputMode(e.target.value as CustomActionInputMode)}>
                <option value="bb">BB</option>
                <option value="amount">$</option>
                <option value="potPct">% pot</option>
              </select>
            </label>
          </div>
        )}
        <div className="hl-po-result">
          <span className="hl-po-label">Amount</span>
          <span className="hl-po-value">{formatNumber(actionAmountBB(actionAmountPreset, effectiveActionSeatId))}BB</span>
        </div>
        <div className="live-card-modal-actions">
          <button type="button" className="btn-secondary" onClick={() => setBetSheetOpen(false)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => recordAction(effectiveActionSeatId, activeActionSummary.canBet ? 'bet' : 'raise')}>
            Save {activeActionSummary.canBet ? 'bet' : 'raise'}
          </button>
        </div>
      </section>
    </div>
  );

  const liveGamePanel = (
    <div className="live-tab-panel">
      <div className="live-active-actions live-quick-context">
        <span className="live-active-ended-tag">Blinds {currentBlindLevel.currency ?? '$'}{formatNumber(currentBlindLevel.smallBlind)}/{formatNumber(currentBlindLevel.bigBlind)}</span>
        {selectedStraddle && <span className="live-active-ended-tag">Straddle {formatNumber(selectedStraddle.amountBB)}BB</span>}
        {isPaused && <span className="live-active-ended-tag live-active-paused-tag">Paused</span>}
        {!isEnded && <button type="button" className={`btn-secondary ${isPaused ? 'active' : ''}`} onClick={togglePause}>{isPaused ? 'Resume timer' : 'Pause timer'}</button>}
      </div>
      <PokerTable
        tableSize={session.tableSize}
        playerNames={playerNames}
        buttonSeat={currentButton}
        actionSeat={!isEnded && !isPaused ? effectiveActionSeatId : null}
        positions={positions}
        stackInfo={currentStackBySeat}
        streetBets={currentStreetBets}
        centerContent={centerContent}
        isSeatDisabled={(seatId) => isEnded || !occupiedNow.includes(seatId)}
        onSeatTap={handleSeatTap}
        draggableSeats={mode === 'idle' && !isEnded && outcomeSeatId === null}
        draggedSeat={draggedSeat}
        onSeatDragStart={setDraggedSeat}
        onSeatDragEnd={() => setDraggedSeat(null)}
        onSeatDrop={handleSeatDrop}
      />
      {!isEnded && (
        <LiveHandAdvisor
          session={session}
          profiles={profiles}
          occupiedNow={occupiedNow}
          positions={positions}
          cards={heroCards}
          disabled={pendingWinner !== null || outcomeSeatId !== null}
          showChart={showLiveAdviceChart}
          showDetail={showLiveAdviceChart}
          onRequestCards={() => setHeroCardPromptOpen(true)}
          onRequestAdvice={() => setShowLiveAdviceChart(value => !value)}
          onSnapshotChange={handleAdvisorSnapshotChange}
        />
      )}
      {actionBar}
    </div>
  );

  const statsAdvicePanel = (
    <div className="live-tab-panel">
      <section className="live-stats-section">
        <h3 className="live-stats-section-title">Hero advice</h3>
        {heroProfile && heroSituation && (
          <ProfileRangeChart
            situation={heroSituation}
            profileName={heroProfile.name}
            position={heroPosition ?? 'BTN'}
            tableSize={session.tableSize}
            highlightedHand={heroDecisionSnapshot?.handNotation ?? null}
          />
        )}
        {heroRecommendation ? (
          <div className="live-hand-advisor-detail">
            <div><span className="live-hand-advisor-label">Current hand</span><strong>{heroDecisionSnapshot?.handNotation}</strong></div>
            <div><span className="live-hand-advisor-label">Profile advice</span><strong>{heroRecommendation.actionLabel}</strong></div>
            <div><span className="live-hand-advisor-label">GTO compare</span><strong>{heroRecommendation.gtoActionLabel}</strong></div>
            <p>{heroRecommendation.gtoNote}</p>
          </div>
        ) : (
          <p className="live-stats-empty">Pick Hero hole cards in Live Game to see the exact recommendation and highlighted chart cell.</p>
        )}
      </section>
      <LiveSessionStats session={session} profiles={profiles} liveTicker={!isEnded && !isPaused} />
    </div>
  );

  const venuePanel = (
    <div className="live-tab-panel">
      <section className="live-stats-section">
        <h3 className="live-stats-section-title">Venue info</h3>
        <div className="live-venue-grid">
          <div><span className="live-hand-advisor-label">Venue</span><strong>{session.details?.venue || session.name || 'Not set'}</strong></div>
          <div><span className="live-hand-advisor-label">Address</span><strong>{session.details?.address || 'Not set'}</strong></div>
          <div><span className="live-hand-advisor-label">Group</span><strong>{session.details?.groupTag || 'Not set'}</strong></div>
          <div><span className="live-hand-advisor-label">Notes</span><strong>{session.details?.notes || 'None'}</strong></div>
          <div><span className="live-hand-advisor-label">Blinds</span><strong>{currentBlindLevel.currency ?? '$'}{formatNumber(currentBlindLevel.smallBlind)}/{formatNumber(currentBlindLevel.bigBlind)}</strong></div>
          <div><span className="live-hand-advisor-label">Players</span><strong>{occupiedNow.length}/{session.tableSize}</strong></div>
        </div>
      </section>
      {!isEnded && (
        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Session controls</h3>
          <div className="live-active-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowBlindChange(true)}>Change blinds</button>
            <button type="button" className={`btn-secondary ${straddleEnabled ? 'active' : ''}`} onClick={() => setStraddleEnabled(value => !value)} disabled={defaultStraddleSeatId === null}>{straddleEnabled ? 'Straddle on' : 'Straddle'}</button>
            <button type="button" className="btn-secondary" onClick={startAddPlayer} disabled={session.tableSize >= 9 && occupiedNow.length >= session.tableSize}>+ Add player</button>
            <button type="button" className={`btn-secondary ${mode === 'remove-player' ? 'active' : ''}`} onClick={() => setMode(m => m === 'remove-player' ? 'idle' : 'remove-player')} disabled={occupiedNow.length === 0}>{mode === 'remove-player' ? 'Cancel remove' : '− Remove player'}</button>
            <button type="button" className="btn-secondary" onClick={saveSkippedHand} disabled={occupiedNow.length < 2 || pendingWinner !== null}>↷ Skip hand / move button</button>
            <button type="button" className="btn-secondary live-active-end-btn" onClick={() => setMode('end-confirm')}>End session</button>
          </div>
          {straddleEnabled && activeStraddleSeatId !== null && (
            <div className="hl-po-custom-row">
              <label className="hl-sit-field">
                <span className="hl-label">Straddle seat</span>
                <select className="hl-num-input" value={activeStraddleSeatId} onChange={e => setStraddleSeatId(Number(e.target.value))}>
                  {occupiedNow.map(seatId => <option key={seatId} value={seatId}>{playerNames[seatId] ?? `Seat ${seatId + 1}`} · {positions.get(seatId) ?? '—'}</option>)}
                </select>
              </label>
              <label className="hl-sit-field"><span className="hl-label">Amount</span><input type="number" min={0} step={0.5} className="hl-num-input" value={straddleRaw} onChange={e => setStraddleRaw(e.target.value)} /></label>
              <label className="hl-sit-field"><span className="hl-label">Unit</span><select className="hl-num-input" value={straddleInputMode} onChange={e => setStraddleInputMode(e.target.value as AmountMode)}><option value="bb">BB</option><option value="amount">$</option></select></label>
            </div>
          )}
        </section>
      )}
      <section className="live-stats-section">
        <h3 className="live-stats-section-title">Stacks</h3>
        <div className="live-venue-stack-list">
          {currentStacks.map(stack => (
            <div key={stack.seatId} className="live-venue-stack-row">
              <span>{playerNames[stack.seatId] ?? `Seat ${stack.seatId + 1}`}</span>
              <strong>{stackDepthLabel(stack.startingStackBB)} · {formatNumber(stack.startingStackBB)}BB · {currentBlindLevel.currency ?? '$'}{formatNumber(stack.startingStack)}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <div className="live-active">
      <div className="live-active-header">
        <button className="back-btn" onClick={onExit}>← Live Sessions</button>
        <div className="live-active-title-block">
          <h1 className="live-active-title">{session.name ?? 'Live session'}</h1>
          {isEnded && <span className="live-active-ended-tag">Ended</span>}
        </div>
      </div>

      <div className="live-active-tabs" role="tablist" aria-label="Live session sections">
        <button type="button" className={`live-active-tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>Live Game</button>
        <button type="button" className={`live-active-tab ${activeTab === 'statsAdvice' ? 'active' : ''}`} onClick={() => setActiveTab('statsAdvice')}>Stats & Advice</button>
        <button type="button" className={`live-active-tab ${activeTab === 'venue' ? 'active' : ''}`} onClick={() => setActiveTab('venue')}>Venue Info</button>
      </div>

      {activeTab === 'live' && liveGamePanel}
      {activeTab === 'statsAdvice' && statsAdvicePanel}
      {activeTab === 'venue' && venuePanel}
      {betSizingSheet}

      {showBlindChange && (
        <div className="live-card-modal-backdrop" role="presentation">
          <div className="live-card-modal" role="dialog" aria-modal="true" aria-label="Change blinds">
            <div className="live-card-modal-header">
              <div><div className="live-card-modal-kicker">Effective hand {nextHandIndex + 1}</div><h2 className="live-card-modal-title">Change blinds</h2></div>
              <button type="button" className="live-card-modal-close" onClick={() => setShowBlindChange(false)}>×</button>
            </div>
            <div className="hl-po-custom-row">
              <label className="hl-sit-field"><span className="hl-label">Money symbol</span><input className="hl-num-input" value={currencyRaw} placeholder="$" title="Symbol shown before money amounts, like $ or €" onChange={e => setCurrencyRaw(e.target.value)} /></label>
              <label className="hl-sit-field"><span className="hl-label">Small blind</span><input type="number" min={0} step={0.5} className="hl-num-input" value={smallBlindRaw} onChange={e => setSmallBlindRaw(e.target.value)} /></label>
              <label className="hl-sit-field"><span className="hl-label">Big blind</span><input type="number" min={0.01} step={0.5} className="hl-num-input" value={bigBlindRaw} onChange={e => setBigBlindRaw(e.target.value)} /></label>
            </div>
            <div className="live-card-modal-actions"><button className="btn-secondary" onClick={() => setShowBlindChange(false)}>Cancel</button><button className="btn-primary" onClick={saveBlindChange}>Save blinds</button></div>
          </div>
        </div>
      )}

      {mode === 'end-confirm' && (
        <div className="live-confirm">
          <p className="live-confirm-text">End this session and log bankroll?</p>
          {buyInsRaw.map((raw, index) => (
            <label key={index} className="hl-sit-field"><span className="hl-label">Buy-in {index + 1}</span><input type="number" min={0} step={1} className="hl-num-input" value={raw} onChange={e => setBuyInsRaw(prev => prev.map((value, i) => i === index ? e.target.value : value))} /></label>
          ))}
          <button className="btn-secondary" onClick={() => setBuyInsRaw(prev => [...prev, ''])}>+ Add buy-in</button>
          <label className="hl-sit-field"><span className="hl-label">Cash out</span><input type="number" min={0} step={1} className="hl-num-input" value={cashOutRaw} onChange={e => setCashOutRaw(e.target.value)} /></label>
          <p className="live-confirm-text">Net: {currentBlindLevel.currency ?? '$'}{formatNumber(bankrollNet(buyInsRaw.map(toNumber).filter(value => value > 0), Math.max(0, toNumber(cashOutRaw))))}</p>
          <div className="live-confirm-actions"><button className="btn-secondary" onClick={() => setMode('idle')}>Cancel</button><button className="btn-primary" onClick={handleEndSession}>End session</button></div>
        </div>
      )}

      {heroCardPromptOpen && !isEnded && !isPaused && outcomeSeatId === null && pendingWinner === null && boardSelection === null && occupiedNow.length >= 2 && heroSeatId !== null && (
        <div className="live-card-modal-backdrop" role="presentation">
          <div className="live-card-modal" role="dialog" aria-modal="true" aria-labelledby="hero-card-title">
            <div className="live-card-modal-header">
              <div>
                <div className="live-card-modal-kicker">Hand {nextHandIndex + 1}</div>
                <h2 id="hero-card-title" className="live-card-modal-title">{playerNames[heroSeatId] ?? `Seat ${heroSeatId + 1}`} cards</h2>
              </div>
              <button type="button" className="live-card-modal-close" onClick={() => setHeroCardPromptOpen(false)}>×</button>
            </div>
            <CardPicker
              value={heroCards}
              onChange={handleHeroCardsChange}
              maxCards={2}
              label="Hero cards"
              mode={cardPickerMode}
              onModeChange={setCardPickerMode}
              unavailableCards={knownCards}
            />
            <div className="live-card-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setHeroCards([])}>Clear</button>
              <button type="button" className="btn-primary" disabled={heroCards.length < 2} onClick={() => setHeroCardPromptOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {outcomeSeatId !== null && (
        <div className="live-card-modal-backdrop" role="presentation">
          <div className="live-card-modal" role="dialog" aria-modal="true" aria-labelledby="hand-outcome-title">
            <div className="live-card-modal-header"><div><div className="live-card-modal-kicker">Hand outcome</div><h2 id="hand-outcome-title" className="live-card-modal-title">{playerNames[outcomeSeatId] ?? `Seat ${outcomeSeatId + 1}`}</h2></div><button type="button" className="live-card-modal-close" onClick={resetOutcomeModal}>×</button></div>
            <div className="live-outcome-bet-panel">
              <div className="card-picker-label">Final pot</div>
              <div className="hl-po-custom-row">
                <label className="hl-sit-field"><span className="hl-label">Pot won</span><input type="number" min={0} step={0.5} className="hl-num-input" value={finalPotRaw} onChange={e => setFinalPotRaw(e.target.value)} /></label>
                <label className="hl-sit-field"><span className="hl-label">Pot unit</span><select className="hl-num-input" value={finalPotInputMode} onChange={e => setFinalPotInputMode(e.target.value as AmountMode)}><option value="bb">BB</option><option value="amount">$</option></select></label>
              </div>
              {selectedFinalPot && <div className="hl-po-result"><span className="hl-po-label">Recording pot</span><span className="hl-po-value">{formatNumber(selectedFinalPot.finalPotBB)}BB / {currentBlindLevel.currency ?? '$'}{formatNumber(selectedFinalPot.finalPotAmount)}</span></div>}
            </div>
            <div className="live-outcome-bet-panel">
              <div className="card-picker-label">Bet sizing</div>
              <div className="hl-po-chips">{BET_PRESETS.map(preset => <button key={preset.key} type="button" className={`hl-po-chip ${betPreset === preset.key ? 'active' : ''}`} onClick={() => setBetPreset(preset.key)}>{preset.label}</button>)}</div>
              {betPreset !== 'none' && (
                <>
                  <div className="hl-po-custom-row">
                    <label className="hl-sit-field"><span className="hl-label">Pot</span><input type="number" min={0} step={0.5} className="hl-num-input" value={customPotRaw} onChange={e => setCustomPotRaw(e.target.value)} /></label>
                    <label className="hl-sit-field"><span className="hl-label">Pot unit</span><select className="hl-num-input" value={potInputMode} onChange={e => setPotInputMode(e.target.value as AmountMode)}><option value="bb">BB</option><option value="amount">$</option></select></label>
                    {betPreset === 'custom' && <><label className="hl-sit-field"><span className="hl-label">Bet</span><input type="number" min={0} step={0.5} className="hl-num-input" value={customBetRaw} onChange={e => setCustomBetRaw(e.target.value)} /></label><label className="hl-sit-field"><span className="hl-label">Bet unit</span><select className="hl-num-input" value={betInputMode} onChange={e => setBetInputMode(e.target.value as AmountMode)}><option value="bb">BB</option><option value="amount">$</option></select></label></>}
                  </div>
                  {selectedBetSizing && <div className="hl-po-result"><span className="hl-po-label">Recording</span><span className="hl-po-value">{formatNumber(selectedBetSizing.amountBB)}BB / {currentBlindLevel.currency ?? '$'}{formatNumber(selectedBetSizing.amount)}</span>{selectedBetSizing.potFraction !== undefined && <span className="hl-po-formula">{formatNumber(selectedBetSizing.potFraction)}x pot</span>}</div>}
                </>
              )}
            </div>
            <label className="hl-sit-field">
              <span className="hl-label">Hand note</span>
              <input className="hl-num-input" value={handNote} onChange={e => setHandNote(e.target.value)} placeholder="Read, tell, tilt, weird sizing..." />
            </label>
            <div className="live-card-player-select">{occupiedNow.map(seatId => <button key={seatId} type="button" className={`live-card-player-btn ${chopSeatIds.includes(seatId) ? 'active' : ''}`} onClick={() => toggleChopSeat(seatId)}><span>{playerNames[seatId] ?? `Seat ${seatId + 1}`}</span><small>{positions.get(seatId) ?? `Seat ${seatId + 1}`}{chopSeatIds.includes(seatId) ? ' · chop' : ''}</small></button>)}</div>
            <div className="live-card-modal-actions"><button type="button" className="btn-secondary" onClick={saveSkippedHand}>Skip / move button</button><button type="button" className="btn-secondary" onClick={saveChop} disabled={chopSeatIds.length < 2}>Save chop</button><button type="button" className="btn-primary" onClick={() => startWinnerFlow(outcomeSeatId)}>Winner</button></div>
          </div>
        </div>
      )}

      {pendingWinner && (
        <div className="live-card-modal-backdrop" role="presentation">
          <div className={`live-card-modal ${shownPickerOpen ? 'live-card-modal-stacked' : ''}`} role="dialog" aria-modal="true" aria-labelledby="winning-hand-title">
            <div className="live-card-modal-base" aria-hidden={shownPickerOpen}>
              <div className="live-card-modal-header"><div><div className="live-card-modal-kicker">Winning hand</div><h2 id="winning-hand-title" className="live-card-modal-title">{playerNames[pendingWinner.seatId] ?? `Seat ${pendingWinner.seatId + 1}`}</h2></div><button type="button" className="live-card-modal-close" onClick={cancelWinningCards}>×</button></div>
              <CardPicker value={winningCards} onChange={setWinningCards} maxCards={2} label="Winner cards" mode={cardPickerMode} onModeChange={setCardPickerMode} unavailableCards={knownCards} />
              {shownHands.length > 0 && <div className="live-card-shown-list">{shownHands.map(hand => <div key={hand.seatId} className="live-card-shown-row"><button type="button" className="live-card-shown-main" onClick={() => startShownPlayerHand(hand.seatId)}><span className="live-card-shown-name">{playerNames[hand.seatId] ?? `Seat ${hand.seatId + 1}`}<small>Shown</small></span><strong>{hand.cards.map(card => `${card.rank}${card.suit.toUpperCase()}`).join(' ')}</strong></button><button type="button" className="live-card-shown-remove" onClick={() => setShownHands(prev => prev.filter(item => item.seatId !== hand.seatId))}>×</button></div>)}</div>}
              <div className="live-card-modal-actions"><button type="button" className="btn-secondary" onClick={() => startShownPlayerHand()}>+ Player</button><button type="button" className="btn-secondary" onClick={() => savePendingHand('no-show')}>No show</button><button type="button" className="btn-primary" disabled={winningCards.length < 1} onClick={() => savePendingHand(winningCards)}>Save hand</button></div>
            </div>
            {shownPickerOpen && (
              <div className="live-card-player-submodal" role="dialog" aria-modal="true" aria-label="Shown losing player hand">
                <div className="live-card-modal-header"><div><div className="live-card-modal-kicker">Shown losing hand</div><h3 className="live-card-modal-title">{shownSeatId === null ? 'Select player' : playerNames[shownSeatId] ?? `Seat ${shownSeatId + 1}`}</h3></div><button type="button" className="live-card-modal-close" onClick={closeShownPlayerPicker}>×</button></div>
                <div className="live-card-player-select">{shownPlayerCandidates.map(seatId => <button key={seatId} type="button" className={`live-card-player-btn ${shownSeatId === seatId ? 'active' : ''}`} onClick={() => startShownPlayerHand(seatId)}><span>{playerNames[seatId] ?? `Seat ${seatId + 1}`}</span>{shownHands.some(hand => hand.seatId === seatId) && <small>Shown</small>}</button>)}</div>
                {shownSeatId !== null && <CardPicker value={shownCards} onChange={handleShownCardsChange} maxCards={2} label={`${playerNames[shownSeatId] ?? `Seat ${shownSeatId + 1}`} cards`} mode={cardPickerMode} onModeChange={setCardPickerMode} unavailableCards={knownCards} />}
                <div className="live-card-player-actions"><button type="button" className="btn-secondary" onClick={() => { if (shownSeatId !== null) setShownHands(prev => prev.filter(hand => hand.seatId !== shownSeatId)); setShownCards([]); }} disabled={shownSeatId === null}>Clear selected</button><button type="button" className="btn-primary" onClick={closeShownPlayerPicker}>Done</button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {boardSelection !== null && (
        <div className="live-card-modal-backdrop" role="presentation">
          <div className="live-card-modal live-board-modal" role="dialog" aria-modal="true" aria-labelledby="board-card-title">
            <div className="live-card-modal-header"><div><div className="live-card-modal-kicker">Board card</div><h2 id="board-card-title" className="live-card-modal-title">{BOARD_SELECTION_LABELS[boardSelection]}</h2></div><button type="button" className="live-card-modal-close" onClick={() => { setBoardSelection(null); setBoardSlotCards([]); }}>×</button></div>
            <CardPicker value={boardSlotCards} onChange={setBoardSlotCards} maxCards={boardSelection === 'flop' ? 3 : 1} label={boardSelection === 'flop' ? 'Flop cards' : 'Board card'} mode={cardPickerMode} onModeChange={setCardPickerMode} unavailableCards={knownCards} />
            <div className="live-card-modal-actions"><button type="button" className="btn-secondary" onClick={() => { setBoardSlotCards([]); setBoardCards(prev => { const next = [...prev] as BoardCards; if (boardSelection === 'flop') { next[0] = null; next[1] = null; next[2] = null; } else { next[boardSelection === 'turn' ? 3 : 4] = null; } return next; }); setBoardSelection(null); }}>Clear</button><button type="button" className="btn-primary" onClick={saveBoardSelection}>Save {boardSelection === 'flop' ? 'flop' : 'card'}</button></div>
          </div>
        </div>
      )}

    </div>
  );
}
