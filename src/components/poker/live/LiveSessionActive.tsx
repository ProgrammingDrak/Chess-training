import { useCallback, useMemo, useState } from 'react';
import type {
  BankrollLog,
  BlindLevel,
  ExposedCards,
  LiveBetSizing,
  LiveHand,
  LiveHandDecisionSnapshot,
  LivePosition,
  LiveSeat,
  LiveSession,
  SeatId,
} from '../../../types/liveSession';
import type { Card } from '../../../types/poker';
import type { PlayerProfile } from '../../../types/profiles';
import { occupiedSeatsAt, advanceButton, derivePositions } from '../../../utils/livePoker';
import { PokerTable } from './PokerTable';
import { LiveSessionStats } from './LiveSessionStats';
import { LiveHandAdvisor } from './LiveHandAdvisor';
import { SeatPlayerPicker } from './SeatPlayerPicker';
import { CardPicker } from '../CardPicker';
import { PlayingCard } from '../HandDisplay';

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
type AmountMode = 'amount' | 'bb';

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
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
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

function activeBlindLevelForHand(session: LiveSession, handIndex: number): BlindLevel {
  const fallback: BlindLevel = {
    effectiveFromHandIndex: 0,
    smallBlind: session.stakes?.sbBB ?? 1,
    bigBlind: session.stakes?.bbBB ?? 2,
    currency: session.stakes?.currency ?? '$',
  };
  const levels = (session.blindLevels && session.blindLevels.length > 0 ? session.blindLevels : [fallback])
    .slice()
    .sort((a, b) => a.effectiveFromHandIndex - b.effectiveFromHandIndex);
  return levels.filter(level => level.effectiveFromHandIndex <= handIndex).at(-1) ?? fallback;
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

function convertBetSizing({
  session,
  handIndex,
  seatId,
  inputMode,
  betValue,
  potValue,
  potInputMode,
}: {
  session: LiveSession;
  handIndex: number;
  seatId: SeatId;
  inputMode: AmountMode;
  betValue: number;
  potValue?: number;
  potInputMode: AmountMode;
}): LiveBetSizing | undefined {
  const level = activeBlindLevelForHand(session, handIndex);
  const bigBlind = Math.max(0.01, level.bigBlind);
  const amount = inputMode === 'amount' ? betValue : betValue * bigBlind;
  const amountBB = inputMode === 'bb' ? betValue : amount / bigBlind;
  if (!Number.isFinite(amount) || !Number.isFinite(amountBB) || amount <= 0 || amountBB <= 0) return undefined;

  const potAmount = potValue && potValue > 0
    ? potInputMode === 'bb'
      ? potValue * bigBlind
      : potValue
    : undefined;
  const potBB = potAmount ? potAmount / bigBlind : undefined;
  const potFraction = potAmount ? amount / potAmount : undefined;

  return {
    seatId,
    amount,
    amountBB,
    ...(potAmount !== undefined ? { potAmount } : {}),
    ...(potBB !== undefined ? { potBB } : {}),
    ...(potFraction !== undefined ? { potFraction } : {}),
    bigBlindAtHand: bigBlind,
    smallBlindAtHand: level.smallBlind,
    inputMode,
  };
}

function bankrollNet(buyIns: number[], cashOut: number): number {
  return cashOut - buyIns.reduce((sum, buyIn) => sum + buyIn, 0);
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
  const [heroDecisionSnapshot, setHeroDecisionSnapshot] = useState<LiveHandDecisionSnapshot | null>(null);

  const nextHandIndex = session.hands.length;
  const currentBlindLevel = activeBlindLevelForHand(session, nextHandIndex);
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

  const playerNames = useMemo(() => session.seats.map(s => {
    if (!s.player || !occupiedNow.includes(s.seatId)) return null;
    const p = profiles.find(pr => pr.id === s.player!.playerProfileId);
    return p?.name ?? `Player ${s.player.playerProfileId.slice(0, 6)}`;
  }), [session.seats, profiles, occupiedNow]);

  const isEnded = session.endedAt !== null;
  const startedAtForCurrentHand = () => session.hands.length > 0
    ? session.hands[session.hands.length - 1].endedAt
    : session.startedAt;
  const currentSeatedSnapshot = () => snapshotPlayerIdsForSeats(occupiedNow, session.seats);
  const currentBoard = () => buildBoard(boardCards);

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

    return convertBetSizing({
      session,
      handIndex: nextHandIndex,
      seatId: outcomeSeatId,
      inputMode: betInputMode,
      betValue,
      potValue,
      potInputMode,
    });
  }, [betPreset, betInputMode, customBetRaw, customPotRaw, currentBlindLevel.bigBlind, nextHandIndex, outcomeSeatId, potInputMode, session]);

  const resetOutcomeModal = () => {
    setOutcomeSeatId(null);
    setBetPreset('none');
    setBetInputMode('bb');
    setPotInputMode('bb');
    setChopSeatIds([]);
  };

  const resetHandInputs = () => {
    setBoardCards(EMPTY_BOARD);
    setBoardSelection(null);
    setBoardSlotCards([]);
    setHeroDecisionSnapshot(null);
  };

  const handleAdvisorSnapshotChange = useCallback((snapshot: LiveHandDecisionSnapshot | null) => {
    setHeroDecisionSnapshot(snapshot);
  }, []);

  const handleSeatTap = (seatId: SeatId) => {
    if (isEnded) return;
    if (mode === 'remove-player') {
      const seat = session.seats[seatId];
      if (!seat?.player || !occupiedNow.includes(seatId)) return;
      handleRemovePlayer(seatId);
      return;
    }
    if (!occupiedNow.includes(seatId)) return;
    setOutcomeSeatId(seatId);
    setChopSeatIds([seatId]);
  };

  const startWinnerFlow = (seatId: SeatId) => {
    const seat = session.seats[seatId];
    const winnerPosition = positions.get(seatId);
    if (!seat?.player || !winnerPosition) return;

    const advisedCards = heroDecisionSnapshot?.seatId === seatId ? [...heroDecisionSnapshot.cards] : [];
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
    });
    resetOutcomeModal();
  };

  const saveSkippedHand = () => {
    if (occupiedNow.length < 2) return;
    const now = new Date().toISOString();
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
      ...(board ? { board } : {}),
      ...(selectedBetSizing ? { betSizing: selectedBetSizing, potBB: selectedBetSizing.potBB, bets: [{ seatId: selectedBetSizing.seatId, betBB: selectedBetSizing.amountBB }] } : {}),
      ...(heroDecisionSnapshot ? { heroDecision: heroDecisionSnapshot } : {}),
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
      ...(board ? { board } : {}),
      winningCards: exposed,
      ...(pendingWinner.betSizing ? { betSizing: pendingWinner.betSizing, potBB: pendingWinner.betSizing.potBB, bets: [{ seatId: pendingWinner.seatId, betBB: pendingWinner.betSizing.amountBB }] } : {}),
      ...(heroDecisionSnapshot ? { heroDecision: heroDecisionSnapshot } : {}),
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

  const handleEndSession = () => {
    const buyIns = buyInsRaw.map(toNumber).filter(value => value > 0);
    const cashOut = Math.max(0, toNumber(cashOutRaw));
    const recordedAt = new Date().toISOString();
    const bankroll: BankrollLog = {
      buyIns,
      cashOut,
      currency: currentBlindLevel.currency ?? '$',
      net: bankrollNet(buyIns, cashOut),
      recordedAt,
    };
    onSave({ ...session, endedAt: recordedAt, bankroll });
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

  const centerContent = (
    <div className="live-table-center-stack">
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
          : mode === 'remove-player' ? 'Tap a seated player to remove'
          : occupiedNow.length < 2 ? 'Need at least 2 seated players'
          : <>Hand {nextHandIndex + 1}<br /><span className="live-table-center-sub">Tap a player for outcome</span></>}
      </div>
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

      <div className="live-active-actions">
        <span className="live-active-ended-tag">Blinds {currentBlindLevel.currency ?? '$'}{formatNumber(currentBlindLevel.smallBlind)}/{formatNumber(currentBlindLevel.bigBlind)}</span>
        {!isEnded && <button type="button" className="btn-secondary" onClick={() => setShowBlindChange(true)}>Change blinds</button>}
      </div>

      <PokerTable
        tableSize={session.tableSize}
        playerNames={playerNames}
        buttonSeat={currentButton}
        positions={positions}
        centerContent={centerContent}
        isSeatDisabled={(seatId) => isEnded || (mode === 'remove-player' ? !occupiedNow.includes(seatId) : !occupiedNow.includes(seatId))}
        onSeatTap={handleSeatTap}
        draggableSeats={mode === 'idle' && !isEnded && outcomeSeatId === null}
        draggedSeat={draggedSeat}
        onSeatDragStart={setDraggedSeat}
        onSeatDragEnd={() => setDraggedSeat(null)}
        onSeatDrop={handleSeatDrop}
      />

      {!isEnded && (
        <LiveHandAdvisor session={session} profiles={profiles} occupiedNow={occupiedNow} positions={positions} playerNames={playerNames} handIndex={nextHandIndex} disabled={pendingWinner !== null || outcomeSeatId !== null} onSnapshotChange={handleAdvisorSnapshotChange} />
      )}

      {!isEnded && (
        <div className="live-active-actions">
          <button type="button" className="btn-secondary" onClick={startAddPlayer} disabled={session.tableSize >= 9 && occupiedNow.length >= session.tableSize}>+ Add player</button>
          <button type="button" className={`btn-secondary ${mode === 'remove-player' ? 'active' : ''}`} onClick={() => setMode(m => m === 'remove-player' ? 'idle' : 'remove-player')} disabled={occupiedNow.length === 0}>{mode === 'remove-player' ? 'Cancel remove' : '− Remove player'}</button>
          <button type="button" className="btn-secondary" onClick={saveSkippedHand} disabled={occupiedNow.length < 2 || pendingWinner !== null}>↷ Skip hand / move button</button>
          <button type="button" className="btn-secondary live-active-end-btn" onClick={() => setMode('end-confirm')}>End session</button>
        </div>
      )}

      {showBlindChange && (
        <div className="live-card-modal-backdrop" role="presentation">
          <div className="live-card-modal" role="dialog" aria-modal="true" aria-label="Change blinds">
            <div className="live-card-modal-header">
              <div><div className="live-card-modal-kicker">Effective hand {nextHandIndex + 1}</div><h2 className="live-card-modal-title">Change blinds</h2></div>
              <button type="button" className="live-card-modal-close" onClick={() => setShowBlindChange(false)}>×</button>
            </div>
            <div className="hl-po-custom-row">
              <label className="hl-sit-field"><span className="hl-label">Currency</span><input className="hl-num-input" value={currencyRaw} onChange={e => setCurrencyRaw(e.target.value)} /></label>
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

      {outcomeSeatId !== null && (
        <div className="live-card-modal-backdrop" role="presentation">
          <div className="live-card-modal" role="dialog" aria-modal="true" aria-labelledby="hand-outcome-title">
            <div className="live-card-modal-header"><div><div className="live-card-modal-kicker">Hand outcome</div><h2 id="hand-outcome-title" className="live-card-modal-title">{playerNames[outcomeSeatId] ?? `Seat ${outcomeSeatId + 1}`}</h2></div><button type="button" className="live-card-modal-close" onClick={resetOutcomeModal}>×</button></div>
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
              <CardPicker value={winningCards} onChange={setWinningCards} maxCards={2} label="Winner cards" />
              {shownHands.length > 0 && <div className="live-card-shown-list">{shownHands.map(hand => <div key={hand.seatId} className="live-card-shown-row"><button type="button" className="live-card-shown-main" onClick={() => startShownPlayerHand(hand.seatId)}><span className="live-card-shown-name">{playerNames[hand.seatId] ?? `Seat ${hand.seatId + 1}`}<small>Shown</small></span><strong>{hand.cards.map(card => `${card.rank}${card.suit.toUpperCase()}`).join(' ')}</strong></button><button type="button" className="live-card-shown-remove" onClick={() => setShownHands(prev => prev.filter(item => item.seatId !== hand.seatId))}>×</button></div>)}</div>}
              <div className="live-card-modal-actions"><button type="button" className="btn-secondary" onClick={() => startShownPlayerHand()}>+ Player</button><button type="button" className="btn-secondary" onClick={() => savePendingHand('no-show')}>No show</button><button type="button" className="btn-primary" disabled={winningCards.length < 1} onClick={() => savePendingHand(winningCards)}>Save hand</button></div>
            </div>
            {shownPickerOpen && (
              <div className="live-card-player-submodal" role="dialog" aria-modal="true" aria-label="Shown losing player hand">
                <div className="live-card-modal-header"><div><div className="live-card-modal-kicker">Shown losing hand</div><h3 className="live-card-modal-title">{shownSeatId === null ? 'Select player' : playerNames[shownSeatId] ?? `Seat ${shownSeatId + 1}`}</h3></div><button type="button" className="live-card-modal-close" onClick={closeShownPlayerPicker}>×</button></div>
                <div className="live-card-player-select">{shownPlayerCandidates.map(seatId => <button key={seatId} type="button" className={`live-card-player-btn ${shownSeatId === seatId ? 'active' : ''}`} onClick={() => startShownPlayerHand(seatId)}><span>{playerNames[seatId] ?? `Seat ${seatId + 1}`}</span>{shownHands.some(hand => hand.seatId === seatId) && <small>Shown</small>}</button>)}</div>
                {shownSeatId !== null && <CardPicker value={shownCards} onChange={handleShownCardsChange} maxCards={2} label={`${playerNames[shownSeatId] ?? `Seat ${shownSeatId + 1}`} cards`} />}
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
            <CardPicker value={boardSlotCards} onChange={setBoardSlotCards} maxCards={boardSelection === 'flop' ? 3 : 1} label={boardSelection === 'flop' ? 'Flop cards' : 'Board card'} />
            <div className="live-card-modal-actions"><button type="button" className="btn-secondary" onClick={() => { setBoardSlotCards([]); setBoardCards(prev => { const next = [...prev] as BoardCards; if (boardSelection === 'flop') { next[0] = null; next[1] = null; next[2] = null; } else { next[boardSelection === 'turn' ? 3 : 4] = null; } return next; }); setBoardSelection(null); }}>Clear</button><button type="button" className="btn-primary" onClick={saveBoardSelection}>Save {boardSelection === 'flop' ? 'flop' : 'card'}</button></div>
          </div>
        </div>
      )}

      <LiveSessionStats session={session} profiles={profiles} liveTicker={!isEnded} />
    </div>
  );
}
