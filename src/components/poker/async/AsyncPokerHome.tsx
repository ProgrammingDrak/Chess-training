import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncPoker } from '../../../hooks/useAsyncPoker';
import type { AsyncPokerAction, AsyncPokerGame, AsyncPokerHandState, AsyncPokerQueuedAction, AsyncPokerQueuedActionInput, AsyncPokerRecentAction, AsyncPokerStreet, NotificationPreference } from '../../../types/asyncPoker';
import type { LiveActionType, LiveHandAction, LiveStackSnapshot, LiveStreet, SeatId } from '../../../types/liveSession';
import { derivePositions } from '../../../utils/livePoker';
import { actionSummary, totalPotBB } from '../../../utils/liveHandEngine';
import { formatLiveNumber, stackDepthLabel } from '../../../utils/liveMoney';
import { PlayingCard } from '../HandDisplay';
import { PokerTable, type TableActionAnimation } from '../live/PokerTable';
import { LiveActionBar, type LiveActionOdds } from '../live/LiveActionBar';
import { LiveTableCenter, type LiveBoardCards, visibleBoardCards, visibleBoardCountForStreet } from '../live/LiveTableCenter';
import type { PlayerProfile } from '../../../types/profiles';
import type { Card } from '../../../types/poker';

const TURN_OPTIONS = [
  { label: '5 sec', value: 5 },
  { label: '1 min', value: 60 },
  { label: '15 min', value: 15 * 60 },
  { label: '1 day', value: 24 * 60 * 60 },
  { label: '5 days', value: 5 * 24 * 60 * 60 },
];

const LIVE_STREETS = new Set<LiveStreet>(['preflop', 'flop', 'turn', 'river']);
const BETTING_STREETS = ['preflop', 'flop', 'turn', 'river'] as const;
const BETTING_ACTIONS = new Set<AsyncPokerRecentAction['action']>(['post-blind', 'post-straddle', 'check', 'call', 'bet', 'raise', 'fold', 'pass', 'timeout']);

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function formatTimeLeft(expiresAt: string | null) {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Overdue';
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `${hours}h left`;
  return `${Math.ceil(hours / 24)}d left`;
}

function formatRelativeTime(value: string) {
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getInviteGameId() {
  try {
    return new URLSearchParams(window.location.search).get('asyncPokerGame') ?? '';
  } catch {
    return '';
  }
}

function clearInviteGameId() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('asyncPokerGame');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // ignore URL cleanup failures
  }
}

function buildShareLink(gameId: string) {
  return `${window.location.origin}${window.location.pathname}?asyncPokerGame=${encodeURIComponent(gameId)}`;
}

function actionLabel(action: AsyncPokerRecentAction['action']) {
  if (action === 'post-blind') return 'Blind';
  if (action === 'post-straddle') return 'Straddle';
  if (action === 'join') return 'joined';
  if (action === 'leave') return 'left table';
  if (action === 'start') return 'started game';
  if (action === 'end') return 'ended table';
  if (action === 'ready_next') return 'ready next';
  if (action === 'show') return 'showed cards';
  if (action === 'timeout') return 'timed out';
  if (action === 'pass') return 'passed';
  return action;
}

function actionTone(action: AsyncPokerRecentAction['action']) {
  if (action === 'join' || action === 'leave' || action === 'start' || action === 'end') return 'table';
  if (action === 'fold' || action === 'timeout') return 'quiet';
  if (action === 'bet' || action === 'raise') return 'aggressive';
  return 'neutral';
}

function actionDetail(item: AsyncPokerRecentAction, bigBlindChips: number): string {
  if (item.amountChips === null) {
    if (item.action === 'check') return 'No chips committed';
    if (item.action === 'fold') return 'Folded hand';
    return 'No amount';
  }
  const amountBB = item.amountChips / Math.max(1, bigBlindChips);
  return `${item.amountChips} chips · ${formatLiveNumber(amountBB)}BB`;
}

function actionAnimationLabel(action: AsyncPokerRecentAction['action']): string {
  if (action === 'check') return 'Check';
  if (action === 'call') return 'Call';
  if (action === 'bet') return 'Bet';
  if (action === 'raise') return 'Raise';
  if (action === 'fold') return 'Fold';
  if (action === 'timeout') return 'Time';
  if (action === 'pass') return 'Pass';
  return actionLabel(action);
}

function queuedActionDescription(action: AsyncPokerQueuedAction): string {
  if (action.action === 'fold') return `Fold on ${streetLabel(action.street).toLowerCase()}`;

  const parts: string[] = [];
  const raiseToChips = typeof action.raiseToChips === 'number' && Number.isInteger(action.raiseToChips)
    ? action.raiseToChips
    : action.action === 'raise' && typeof action.amountChips === 'number' && Number.isInteger(action.amountChips)
      ? action.amountChips
      : null;
  const callCapChips = typeof action.callCapChips === 'number' && Number.isInteger(action.callCapChips)
    ? action.callCapChips
    : action.amountChips;

  if (raiseToChips !== null && raiseToChips > 0) parts.push(`Raise to ${raiseToChips} chips`);
  if (action.callCapMode === 'all_in') {
    parts.push('call up to all in');
  } else if (typeof callCapChips === 'number' && Number.isInteger(callCapChips)) {
    parts.push(callCapChips === 0 ? 'check if free' : `call up to ${callCapChips} chips`);
  }
  const description = parts.length > 0 ? parts.join('; ') : actionLabel(action.action);
  return `${description} on ${streetLabel(action.street).toLowerCase()}`;
}

type AsyncHandResultSummary = {
  winnerIds: number[];
  winnerNames: string[];
  cards: Card[] | null;
  potChips: number | null;
  showdownLabel: string | null;
};

type AsyncResolvedHandResult = NonNullable<AsyncPokerHandState['previousHandResult']> | AsyncPokerHandState;

type AsyncHandParticipantSummary = {
  userId: number;
  username: string;
  seatIndex: number | null;
  position: string | null;
  isNpc: boolean;
  contributionChips: number;
  cards: Card[] | null;
  isWinner: boolean;
  showdownLabel: string | null;
  statusLabel: string;
};

type AsyncBoardStreetSummary = {
  label: 'Flop' | 'Turn' | 'River';
  cards: Card[];
};

function resultForHand(game: AsyncPokerGame, handNumber: number): AsyncResolvedHandResult | null {
  return game.state.previousHandResult?.handNumber === handNumber
    ? game.state.previousHandResult
    : game.state.resolvedAt && game.handNumber === handNumber
      ? game.state
      : null;
}

function boardStreetSummaries(result: AsyncResolvedHandResult | null): AsyncBoardStreetSummary[] {
  const board = result?.board ?? [];
  return [
    { label: 'Flop', cards: board.slice(0, 3) },
    { label: 'Turn', cards: board.slice(3, 4) },
    { label: 'River', cards: board.slice(4, 5) },
  ];
}

function resultSummaryForHand(
  game: AsyncPokerGame,
  handNumber: number,
  fallbackPotChips: number,
): AsyncHandResultSummary | null {
  const result = resultForHand(game, handNumber);
  if (!result) return null;

  const winnerIds = result.winnerUserIds ?? (result.winnerUserId ? [result.winnerUserId] : []);
  const winnerNames = winnerIds
    .map((id) => game.players.find((player) => player.userId === id)?.username ?? `Player ${id}`)
    .filter(Boolean);
  const primaryWinnerId = winnerIds[0];
  const cards = primaryWinnerId ? result.holeCards?.[String(primaryWinnerId)] ?? null : null;
  const showdownLabel = primaryWinnerId ? result.showdown?.[String(primaryWinnerId)]?.label ?? null : null;
  return {
    winnerIds,
    winnerNames,
    cards: cards && cards.length > 0 ? cards : null,
    potChips: result.potChips ?? fallbackPotChips,
    showdownLabel,
  };
}

function participantSummariesForHand(
  game: AsyncPokerGame,
  actions: AsyncPokerRecentAction[],
  result: AsyncResolvedHandResult | null,
  positions: Map<SeatId, string>,
): AsyncHandParticipantSummary[] {
  const participantIds = new Set<number>();
  for (const item of actions) participantIds.add(item.userId);
  for (const id of result?.winnerUserIds ?? []) participantIds.add(id);
  if (result?.winnerUserId) participantIds.add(result.winnerUserId);
  for (const userId of Object.keys(result?.holeCards ?? {})) {
    const parsed = Number(userId);
    if (Number.isFinite(parsed)) participantIds.add(parsed);
  }

  const winnerIds = new Set(result?.winnerUserIds ?? (result?.winnerUserId ? [result.winnerUserId] : []));
  return [...participantIds]
    .map((userId) => {
      const player = game.players.find((item) => item.userId === userId) ?? null;
      const playerActions = actions.filter((item) => item.userId === userId);
      const contributionChips = playerActions.reduce((sum, item) => sum + (item.amountChips ?? 0), 0);
      const foldAction = playerActions.find((item) => item.action === 'fold');
      const timeoutAction = playerActions.find((item) => item.action === 'timeout');
      const isWinner = winnerIds.has(userId);
      const cards = result?.holeCards?.[String(userId)] ?? null;
      const showdownLabel = result?.showdown?.[String(userId)]?.label ?? null;
      let statusLabel = result ? 'Reached showdown' : 'No result recorded';
      if (foldAction) statusLabel = `Folded ${streetLabel(foldAction.street).toLowerCase()}`;
      else if (timeoutAction) statusLabel = `Timed out ${streetLabel(timeoutAction.street).toLowerCase()}`;
      else if (isWinner) statusLabel = 'Won';

      return {
        userId,
        username: player?.username ?? playerActions[0]?.username ?? `Player ${userId}`,
        seatIndex: player?.seatIndex ?? null,
        position: player ? positions.get(player.seatIndex) ?? null : null,
        isNpc: Boolean(player?.isNpc || playerActions.some((item) => item.note?.toLowerCase().includes('npc acted automatically'))),
        contributionChips,
        cards: cards && cards.length > 0 ? cards : null,
        isWinner,
        showdownLabel,
        statusLabel,
      };
    })
    .sort((a, b) => {
      const seatA = a.seatIndex ?? Number.MAX_SAFE_INTEGER;
      const seatB = b.seatIndex ?? Number.MAX_SAFE_INTEGER;
      return seatA - seatB || a.username.localeCompare(b.username);
    });
}

function formatOddsRatio(rewardBB: number, riskBB: number): string {
  if (riskBB <= 0) return 'Free';
  return `${formatLiveNumber(rewardBB / riskBB)}:1`;
}

function liveStreetForGame(game: AsyncPokerGame): LiveStreet {
  const street = game.state.street;
  return street && LIVE_STREETS.has(street as LiveStreet) ? street as LiveStreet : 'preflop';
}

function streetLabel(street: AsyncPokerStreet | LiveStreet | undefined): string {
  if (street === 'preflop') return 'Preflop';
  if (street === 'flop') return 'Flop';
  if (street === 'turn') return 'Turn';
  if (street === 'river') return 'River';
  if (street === 'showdown') return 'Showdown';
  return 'Preflop';
}

function boardCardsForGame(game: AsyncPokerGame): LiveBoardCards {
  const street = game.state.street ?? 'preflop';
  return visibleBoardCards(game.state.board ?? [], visibleBoardCountForStreet(street));
}

function previousWinnerText(game: AsyncPokerGame): string {
  const result = game.state.previousHandResult;
  const winnerIds = result?.winnerUserIds ?? (result?.winnerUserId ? [result.winnerUserId] : []);
  const names = winnerIds
    .map((id) => game.players.find((player) => player.userId === id)?.username)
    .filter(Boolean);
  if (names.length === 0) return 'Previous hand resolved';
  return `${names.join(', ')} won hand ${result?.handNumber ?? ''}`.trim();
}

function asyncActionsToLiveActions(game: AsyncPokerGame): LiveHandAction[] {
  if (Array.isArray(game.state.actions) && game.state.actions.length > 0) {
    return game.state.actions;
  }

  const liveActionTypes = new Set(['check', 'call', 'bet', 'raise', 'fold', 'pass']);
  return [...game.recentActions]
    .reverse()
    .filter((item) => liveActionTypes.has(item.action))
    .map((item, order) => {
      const seatId = game.players.find((player) => player.userId === item.userId)?.seatIndex ?? 0;
      const amountBB = item.amountChips ? item.amountChips / Math.max(1, game.bigBlindChips) : 0;
      const potBeforeBB = game.recentActions
        .filter((prior) => prior.id < item.id && prior.amountChips)
        .reduce((sum, prior) => sum + (prior.amountChips ?? 0) / Math.max(1, game.bigBlindChips), 0);
      const action = (item.action === 'pass' ? 'check' : item.action) as LiveActionType;
      const street = LIVE_STREETS.has(item.street as LiveStreet) ? item.street as LiveStreet : 'preflop';
      return {
        street,
        seatId,
        action,
        ...(item.amountChips !== null ? { amount: item.amountChips, amountBB } : {}),
        potBeforeBB,
        potAfterBB: potBeforeBB + amountBB,
        order,
        createdAt: item.createdAt,
      };
    });
}

function fullHistoryActionsForGame(game: AsyncPokerGame): AsyncPokerRecentAction[] {
  const chronological = [...game.recentActions].reverse();
  const forcedActions = (game.state.actions ?? [])
    .filter((action) => action.street === 'preflop' && (action.action === 'post-blind' || action.action === 'post-straddle'))
    .map((action, index): AsyncPokerRecentAction | null => {
      const forcedAction = action.action as 'post-blind' | 'post-straddle';
      const player = game.players.find((item) => item.seatIndex === action.seatId);
      if (!player) return null;
      const amountChips = Math.round((action.amountBB ?? 0) * Math.max(1, game.bigBlindChips));
      const existing = chronological.some((item) => (
        item.handNumber === game.handNumber
        && item.userId === player.userId
        && item.action === forcedAction
        && item.street === action.street
        && (item.amountChips ?? 0) === amountChips
      ));
      if (existing) return null;
      const label = forcedAction === 'post-straddle'
        ? 'Straddle'
        : action.seatId === game.state.smallBlindSeat
          ? 'Small blind'
          : action.seatId === game.state.bigBlindSeat
            ? 'Big blind'
            : 'Blind';
      return {
        id: -1000 - index,
        userId: player.userId,
        username: player.username,
        handNumber: game.handNumber,
        action: forcedAction,
        street: 'preflop',
        amountChips,
        note: label,
        createdAt: action.createdAt ?? game.updatedAt,
      };
    })
    .filter((action): action is AsyncPokerRecentAction => action !== null);
  return [...forcedActions, ...chronological];
}

function stackInfoForGame(game: AsyncPokerGame): Map<SeatId, LiveStackSnapshot> {
  const map = new Map<SeatId, LiveStackSnapshot>();
  for (const player of game.players) {
    map.set(player.seatIndex, {
      seatId: player.seatIndex,
      playerProfileId: String(player.userId),
      startingStack: player.stackChips,
      startingStackBB: player.stackChips / Math.max(1, game.bigBlindChips),
      endingStack: player.stackChips,
      endingStackBB: player.stackChips / Math.max(1, game.bigBlindChips),
    });
  }
  return map;
}

function streetBetsForActions(actions: LiveHandAction[], street: LiveStreet): Map<SeatId, number> {
  const bets = new Map<SeatId, number>();
  for (const action of actions) {
    if (action.street !== street || !action.amountBB) continue;
    bets.set(action.seatId, (bets.get(action.seatId) ?? 0) + action.amountBB);
  }
  return bets;
}

function actionOddsForGame(game: AsyncPokerGame, street: LiveStreet, actorSeatId: SeatId | null, actions: LiveHandAction[]): LiveActionOdds | null {
  if (actorSeatId === null) return null;
  const summary = actionSummary(actions, street, actorSeatId);
  const stackInfo = stackInfoForGame(game);
  const actionSeatStack = stackInfo.get(actorSeatId) ?? null;
  const committedByActor = actions
    .filter((action) => action.seatId === actorSeatId)
    .reduce((sum, action) => sum + (action.amountBB ?? 0), 0);
  const actorRemainingBB = Math.max(0, (actionSeatStack?.startingStackBB ?? 0) - committedByActor);
  const actorRemainingAfterCallBB = Math.max(0, actorRemainingBB - summary.toCallBB);
  const foldedSeats = new Set(actions.filter((action) => action.action === 'fold').map((action) => action.seatId));
  const biggestOpponentRemainingBB = Math.max(
    0,
    ...game.players
      .filter((player) => player.seatIndex !== actorSeatId && !foldedSeats.has(player.seatIndex))
      .map((player) => {
        const committed = actions
          .filter((action) => action.seatId === player.seatIndex)
          .reduce((sum, action) => sum + (action.amountBB ?? 0), 0);
        return Math.max(0, player.stackChips / Math.max(1, game.bigBlindChips) - committed);
      })
  );
  const impliedFutureBB = summary.toCallBB > 0 ? Math.min(actorRemainingAfterCallBB, biggestOpponentRemainingBB) : 0;
  const potDenominatorBB = summary.potBB + summary.toCallBB;
  const impliedDenominatorBB = potDenominatorBB + impliedFutureBB;

  return {
    callBB: summary.toCallBB,
    potBB: summary.potBB,
    actorRemainingAfterCallBB,
    biggestOpponentRemainingBB,
    impliedFutureBB,
    potRequiredEquityPct: summary.toCallBB > 0 && potDenominatorBB > 0 ? (summary.toCallBB / potDenominatorBB) * 100 : 0,
    impliedRequiredEquityPct: summary.toCallBB > 0 && impliedDenominatorBB > 0 ? (summary.toCallBB / impliedDenominatorBB) * 100 : 0,
    potOddsRatio: formatOddsRatio(summary.potBB, summary.toCallBB),
    impliedOddsRatio: formatOddsRatio(summary.potBB + impliedFutureBB, summary.toCallBB),
    stackLabel: actionSeatStack
      ? `${stackDepthLabel(actionSeatStack.startingStackBB)} · ${formatLiveNumber(actorRemainingBB)}BB left`
      : `${formatLiveNumber(actorRemainingBB)}BB left`,
  };
}

function AsyncActionHistory({ game }: { game: AsyncPokerGame }) {
  const chronologicalActions = fullHistoryActionsForGame(game);
  const playersById = new Map(game.players.map((player) => [player.userId, player]));
  const occupiedSeats = game.players.map((player) => player.seatIndex);
  const buttonSeat = game.state.buttonSeat ?? game.players[0]?.seatIndex ?? 0;
  const positions = derivePositions(buttonSeat, occupiedSeats, game.tableSize);
  const currentStreet = liveStreetForGame(game);
  const actionsByHand = chronologicalActions.reduce<Map<number, AsyncPokerRecentAction[]>>((groups, item) => {
    const handNumber = Number.isFinite(item.handNumber) ? item.handNumber : game.handNumber;
    const group = groups.get(handNumber) ?? [];
    group.push(item);
    groups.set(handNumber, group);
    return groups;
  }, new Map());
  if (game.status === 'active' && !actionsByHand.has(game.handNumber)) {
    actionsByHand.set(game.handNumber, []);
  }
  const handGroups = [...actionsByHand.entries()]
    .map(([handNumber, actions]) => {
      const tableEvents = actions.filter((item) => !BETTING_ACTIONS.has(item.action));
      const bettingActions = actions.filter((item) => BETTING_ACTIONS.has(item.action));
      const groupedActions = BETTING_STREETS.map((street) => ({
        street,
        actions: bettingActions.filter((item) => item.street === street),
      })).filter((group) => group.actions.length > 0 || (handNumber === game.handNumber && group.street === currentStreet));
      return { handNumber, actions, tableEvents, bettingActions, groupedActions };
    })
    .sort((a, b) => b.handNumber - a.handNumber);
  const totalBettingActions = handGroups.reduce((sum, group) => sum + group.bettingActions.length, 0);
  const totalTableEvents = handGroups.reduce((sum, group) => sum + group.tableEvents.length, 0);

  if (handGroups.length === 0) return null;

  const visibleHandGroups = handGroups.slice(0, 3);
  const extraHandGroups = handGroups.slice(3);
  const renderHandGroup = (hand: (typeof handGroups)[number], index: number) => {
    const handChips = hand.bettingActions.reduce((sum, item) => sum + (item.amountChips ?? 0), 0);
    const handBB = handChips / Math.max(1, game.bigBlindChips);
    const handResult = resultForHand(game, hand.handNumber);
    const resultSummary = resultSummaryForHand(game, hand.handNumber, handChips);
    const isHandOver = hand.handNumber < game.handNumber || Boolean(game.state.resolvedAt && hand.handNumber === game.handNumber) || Boolean(resultSummary?.winnerIds.length);
    const resultPotChips = resultSummary?.potChips ?? handChips;
    const resultPotBB = resultPotChips / Math.max(1, game.bigBlindChips);
    const boardSummary = boardStreetSummaries(handResult);
    const participantSummaries = isHandOver
      ? participantSummariesForHand(game, hand.bettingActions, handResult, positions)
      : [];
    const knownHandCount = participantSummaries.filter((player) => player.cards).length;
    return (
      <details key={hand.handNumber} className="async-hand-group" open={hand.handNumber === game.handNumber || index === 0}>
        <summary className="async-hand-summary">
          <div>
            <strong>Hand {hand.handNumber}</strong>
            {hand.handNumber === game.handNumber && <span>Current</span>}
          </div>
          <span>
            {hand.bettingActions.length} betting · {hand.tableEvents.length} table
            {handChips > 0 ? ` · ${formatLiveNumber(handBB)}BB committed` : ''}
          </span>
        </summary>

        {isHandOver && (
          <section className="async-hand-complete-summary" aria-label={`Hand ${hand.handNumber} summary`}>
            <div className="async-hand-complete-head">
              <div>
                <span>Summary</span>
                <strong>
                  {resultSummary?.winnerNames.length
                    ? `${resultSummary.winnerNames.join(', ')} won`
                    : 'Winner not recorded'}
                </strong>
                {resultSummary?.showdownLabel && <em>{resultSummary.showdownLabel}</em>}
              </div>
              <div className="async-hand-board-summary" aria-label={`Hand ${hand.handNumber} board`}>
                <span>Board</span>
                <div className="async-hand-board-streets">
                  {boardSummary.map((street) => (
                    <div key={`${hand.handNumber}-${street.label}`} className="async-hand-board-street">
                      <small>{street.label}</small>
                      <div className="async-hand-board-cards">
                        {street.cards.length > 0
                          ? street.cards.map((card, cardIndex) => (
                            <PlayingCard
                              key={`${hand.handNumber}-${street.label}-${card.rank}${card.suit}-${cardIndex}`}
                              card={card}
                              size="sm"
                            />
                          ))
                          : <em>Not dealt</em>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="async-hand-complete-pot">
                <span>Pot won</span>
                <strong>{formatLiveNumber(resultPotBB)}BB</strong>
                <small>{resultPotChips} chips · {knownHandCount} known hand{knownHandCount === 1 ? '' : 's'}</small>
              </div>
            </div>

            <div className="async-hand-summary-grid">
              {participantSummaries.map((player) => {
                const contributionBB = player.contributionChips / Math.max(1, game.bigBlindChips);
                return (
                  <article key={player.userId} className={`async-hand-summary-player${player.isWinner ? ' is-winner' : ''}`}>
                    <div className="async-summary-player-main">
                      <strong>{player.username}</strong>
                      <span>
                        {player.position ? `${player.position} · ` : ''}
                        {player.seatIndex !== null ? `Seat ${player.seatIndex + 1}` : 'Seat unknown'}
                        {player.isNpc ? ' · NPC' : ''}
                      </span>
                    </div>
                    <div className="async-summary-cards" aria-label={`${player.username} hand`}>
                      {player.cards
                        ? player.cards.slice(0, 2).map((card, cardIndex) => (
                          <PlayingCard key={`${player.userId}-${card.rank}${card.suit}-${cardIndex}`} card={card} size="sm" />
                        ))
                        : (
                          <>
                            <span className="async-result-card-back" aria-label="Face-down card" />
                            <span className="async-result-card-back" aria-label="Face-down card" />
                          </>
                        )}
                    </div>
                    <div className="async-summary-stat">
                      <span>Contributed</span>
                      <strong>{player.contributionChips} chips · {formatLiveNumber(contributionBB)}BB</strong>
                    </div>
                    <div className="async-summary-stat">
                      <span>Status</span>
                      <strong>{player.statusLabel}</strong>
                      {player.showdownLabel && <small>{player.showdownLabel}</small>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {hand.groupedActions.length > 0 && (
          <div className="async-street-ledger">
            {hand.groupedActions.map(({ street, actions }) => {
              const streetChips = actions.reduce((sum, item) => sum + (item.amountChips ?? 0), 0);
              const streetBB = streetChips / Math.max(1, game.bigBlindChips);
              return (
                <details
                  key={`${hand.handNumber}-${street}`}
                  className={`async-street-group is-${street}`}
                  open={hand.handNumber === game.handNumber && street === currentStreet}
                >
                  <summary className="async-street-header">
                    <div>
                      <strong>{streetLabel(street)}</strong>
                      <span>{actions.length === 0 ? 'No actions yet' : `${actions.length} action${actions.length === 1 ? '' : 's'}`}</span>
                    </div>
                    {streetChips > 0 && <span>{streetChips} chips · {formatLiveNumber(streetBB)}BB in street</span>}
                  </summary>
                  {actions.length > 0 ? (
                    <div className="async-street-actions">
                      {actions.map((item, index) => {
                        const player = playersById.get(item.userId);
                        const position = player ? positions.get(player.seatIndex) : null;
                        const isNpc = Boolean(player?.isNpc || item.note?.toLowerCase().includes('npc acted automatically'));
                        return (
                          <article key={item.id} className={`async-history-row tone-${actionTone(item.action)}`}>
                            <div className="async-history-order">{index + 1}</div>
                            <div className="async-history-actor">
                              <strong>{item.username}</strong>
                              <span>
                                {position ? `${position} · ` : ''}
                                {player ? `Seat ${player.seatIndex + 1}` : 'Seat unknown'}
                                {isNpc ? ' · NPC' : ''}
                              </span>
                            </div>
                            <div className="async-history-decision">
                              <span className="async-history-action">{actionLabel(item.action)}</span>
                              <strong>{actionDetail(item, game.bigBlindChips)}</strong>
                            </div>
                            <div className="async-history-context">
                              {item.note && <span>{item.note}</span>}
                              <time dateTime={item.createdAt}>{formatRelativeTime(item.createdAt)}</time>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="async-history-empty">Waiting for the first {streetLabel(street).toLowerCase()} action.</p>
                  )}
                </details>
              );
            })}
          </div>
        )}

        {hand.tableEvents.length > 0 && (
          <section className="async-table-events" aria-label={`Hand ${hand.handNumber} table updates`}>
            <div className="async-table-events-header">
              <strong>Table updates</strong>
              <span>{hand.tableEvents.length}</span>
            </div>
            <div className="async-table-event-list">
              {hand.tableEvents.map((item) => {
                const player = playersById.get(item.userId);
                const isNpc = Boolean(player?.isNpc || item.note?.toLowerCase().includes('npc'));
                return (
                  <article key={item.id} className={`async-table-event tone-${actionTone(item.action)}`}>
                    <span className="async-history-action">{actionLabel(item.action)}</span>
                    <strong>{item.username}</strong>
                    {isNpc && <span>NPC</span>}
                    {item.note && <span>{item.note}</span>}
                    <time dateTime={item.createdAt}>{formatRelativeTime(item.createdAt)}</time>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </details>
    );
  };

  return (
    <section className="async-action-history" aria-label="Table activity">
      <div className="async-history-header">
        <div>
          <h4>Table activity</h4>
          <span>Grouped by hand and betting street</span>
        </div>
        <span>{handGroups.length} hand{handGroups.length === 1 ? '' : 's'} · {totalBettingActions} betting · {totalTableEvents} table</span>
      </div>

      <div className="async-hand-history">
        {visibleHandGroups.map(renderHandGroup)}
        {extraHandGroups.length > 0 && (
          <details className="async-hand-more">
            <summary>
              <span>Older hands</span>
              <strong>{extraHandGroups.length} more</strong>
            </summary>
            <div className="async-hand-more-list">
              {extraHandGroups.map((hand, index) => renderHandGroup(hand, visibleHandGroups.length + index))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

function pastTableEndedAt(game: AsyncPokerGame): string {
  const endedAction = game.recentActions.find((item) => item.action === 'end');
  return game.state.endedAt ?? endedAction?.createdAt ?? game.updatedAt;
}

function PastTablesCard({ games }: { games: AsyncPokerGame[] }) {
  const pastTables = games.filter((game) => game.status === 'finished');
  const visiblePastTables = pastTables.slice(0, 5);
  const extraPastTables = pastTables.slice(5);
  const renderPastTableRow = (game: AsyncPokerGame) => (
    <div key={game.id} className="async-past-table-row">
      <div>
        <strong>{game.name}</strong>
        <span>{game.players.length}/{game.tableSize} seated · hosted by {game.hostUsername}</span>
      </div>
      <time dateTime={pastTableEndedAt(game)}>{formatRelativeTime(pastTableEndedAt(game))}</time>
    </div>
  );

  return (
    <section className="async-side-panel async-past-tables-card">
      <div className="async-side-panel-header">
        <h2>Past Tables</h2>
        {pastTables.length > 0 && <span>{pastTables.length}</span>}
      </div>
      {pastTables.length === 0 ? (
        <p className="async-muted">No past tables yet.</p>
      ) : (
        <div className="async-past-table-list">
          {visiblePastTables.map(renderPastTableRow)}
          {extraPastTables.length > 0 && (
            <details className="async-past-table-more">
              <summary>Show {extraPastTables.length} older table{extraPastTables.length === 1 ? '' : 's'}</summary>
              <div className="async-past-table-more-list">
                {extraPastTables.map(renderPastTableRow)}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function AsyncTableLobbyCard({
  game,
  currentUserId,
  onOpen,
}: {
  game: AsyncPokerGame;
  currentUserId: number;
  onOpen: () => void;
}) {
  const currentUserTurn = game.currentPlayerUserId === currentUserId;
  const seatedText = `${game.players.length}/${game.tableSize} seated`;
  const statusText = game.status === 'active'
    ? currentUserTurn
      ? 'Your turn'
      : game.currentPlayerIsNpc
        ? `${game.currentPlayerUsername ?? 'NPC'} NPC to act`
        : `${game.currentPlayerUsername ?? 'Player'} to act`
    : 'Waiting to start';

  return (
    <button type="button" className={`async-table-lobby-card is-${game.status}`} onClick={onOpen}>
      <div>
        <span className="async-game-kicker">
          {game.status} · {seatedText} · {formatDuration(game.turnSeconds)} turns
        </span>
        <strong>{game.name}</strong>
        <small>Hosted by {game.hostUsername}</small>
      </div>
      <div className={`async-lobby-status ${currentUserTurn ? 'is-current-user' : ''}`}>
        <span>{statusText}</span>
        {game.status === 'active' && <strong>{formatTimeLeft(game.currentTurnExpiresAt)}</strong>}
      </div>
    </button>
  );
}

function AsyncSeatPicker({
  seatIndex,
  tableSize,
  profiles,
  onCancel,
  onAddNpc,
  onCreateProfile,
}: {
  seatIndex: number;
  tableSize: number;
  profiles: PlayerProfile[];
  onCancel: () => void;
  onAddNpc: (input: { name?: string; seatIndex: number }) => Promise<void>;
  onCreateProfile: (name: string, tableSize: number) => Promise<PlayerProfile>;
}) {
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const villainProfiles = profiles.filter((profile) => profile.type !== 'self');

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await task();
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not seat player');
    } finally {
      setBusy('');
    }
  }

  const seatProfile = (profile: PlayerProfile) => run(`profile-${profile.id}`, () => onAddNpc({
    name: profile.name,
    seatIndex,
  }));

  const createAndSeat = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Profile name required');
      return;
    }
    void run('create', async () => {
      const profile = await onCreateProfile(trimmed, tableSize);
      await onAddNpc({ name: profile.name, seatIndex });
    });
  };

  return (
    <div className="async-seat-picker">
      <div className="live-picker-header">
        <h3 className="live-picker-title">Seat {seatIndex + 1}</h3>
        <p className="live-picker-helper">Add a playable profile or NPC before the table starts.</p>
      </div>

      <button
        type="button"
        className="btn-secondary async-seat-picker-npc"
        disabled={Boolean(busy)}
        onClick={() => void run('npc', () => onAddNpc({ seatIndex }))}
      >
        {busy === 'npc' ? 'Adding...' : 'Add NPC'}
      </button>

      {villainProfiles.length > 0 && (
        <div className="live-picker-section">
          <div className="live-picker-section-label">Existing profiles</div>
          <div className="live-picker-grid">
            {villainProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className="live-picker-profile"
                disabled={Boolean(busy)}
                onClick={() => void seatProfile(profile)}
              >
                <span className="live-picker-profile-name">{profile.name}</span>
                <span className="live-picker-profile-type">Profile</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="live-picker-section">
        <div className="live-picker-section-label">Create profile to play</div>
        <div className="live-picker-create">
          <input
            className="live-picker-input"
            type="text"
            placeholder="Player name"
            value={newName}
            onChange={(event) => {
              setNewName(event.target.value);
              setError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') createAndSeat();
            }}
            disabled={Boolean(busy)}
          />
          <button
            type="button"
            className="btn-primary live-picker-create-btn"
            onClick={createAndSeat}
            disabled={Boolean(busy) || !newName.trim()}
          >
            {busy === 'create' ? 'Creating...' : 'Create + Seat'}
          </button>
        </div>
      </div>

      {error && <p className="live-picker-error">{error}</p>}
      <button type="button" className="btn-secondary live-picker-cancel" onClick={onCancel} disabled={Boolean(busy)}>
        Cancel
      </button>
    </div>
  );
}

function GameCard({
  game,
  currentUserId,
  profiles,
  onJoin,
  onLeave,
  onAddNpc,
  onStart,
  onEnd,
  onShowCards,
  onAcknowledgeResult,
  onAction,
  onQueueAction,
  onClearQueuedAction,
  onCreateProfile,
}: {
  game: AsyncPokerGame;
  currentUserId: number;
  profiles: PlayerProfile[];
  onJoin: (gameId: string) => Promise<void>;
  onLeave: (gameId: string, input?: { foldAndLeave?: boolean }) => Promise<void>;
  onAddNpc: (gameId: string, input?: { name?: string; seatIndex?: number }) => Promise<void>;
  onStart: (gameId: string) => Promise<void>;
  onEnd: (gameId: string) => Promise<void>;
  onShowCards: (gameId: string) => Promise<void>;
  onAcknowledgeResult: (gameId: string) => Promise<void>;
  onAction: (gameId: string, action: AsyncPokerAction, amount?: number, note?: string) => Promise<void>;
  onQueueAction: (gameId: string, input: AsyncPokerQueuedActionInput) => Promise<void>;
  onClearQueuedAction: (gameId: string, actorUserId?: number) => Promise<void>;
  onCreateProfile: (name: string, tableSize: number) => Promise<PlayerProfile>;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [preDecisionCallAmount, setPreDecisionCallAmount] = useState('');
  const [preDecisionRaiseAmount, setPreDecisionRaiseAmount] = useState('');
  const [preDecisionCallAllIn, setPreDecisionCallAllIn] = useState(false);
  const [betSheetOpen, setBetSheetOpen] = useState(false);
  const [pickingSeat, setPickingSeat] = useState<number | null>(null);
  const [controlledNpcUserId, setControlledNpcUserId] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [actionAnimations, setActionAnimations] = useState<TableActionAnimation[]>([]);
  const seenActionIdsRef = useRef<Set<number> | null>(null);
  const isHost = game.hostUserId === currentUserId;
  const hostedNpcPlayers = game.players.filter((player) => player.isNpc);
  const controlledNpc = hostedNpcPlayers.find((player) => player.userId === controlledNpcUserId) ?? null;
  const effectiveUserId = controlledNpc?.userId ?? currentUserId;
  const isCurrentPlayer = game.currentPlayerUserId === effectiveUserId;
  const isHostControlledNpcTurn = isHost && game.currentPlayerIsNpc;
  const canActForCurrentPlayer = isCurrentPlayer && (!controlledNpc || isHost);
  const canJoin = game.status !== 'finished' && !game.isPlayer && game.players.length < game.tableSize;
  const canStart = game.status === 'waiting' && isHost && game.players.length >= 2;
  const canShare = game.status !== 'finished' && game.players.length < game.tableSize;
  const canEnd = isHost && game.status !== 'finished';
  const isTableEnded = game.status === 'finished';
  const previousHandResult = game.state.previousHandResult ?? null;
  const hasPreviousResult = Boolean(previousHandResult && !(previousHandResult.acknowledgedUserIds ?? []).includes(currentUserId));
  const shownUserIds = game.state.shownUserIds ?? [];
  const hasShownCards = shownUserIds.includes(currentUserId);
  const canAcknowledgeResult = hasPreviousResult && game.isPlayer;
  const playerNames = Array.from({ length: game.tableSize }, (_, seatIndex) =>
    game.players.find((player) => player.seatIndex === seatIndex)?.username ?? null
  );
  const occupiedSeats = game.players
    .filter((player) => player.status === 'active')
    .map((player) => player.seatIndex)
    .sort((a, b) => a - b);
  const currentHandUserIds = new Set((game.state.dealtUserIds ?? []).map(Number));
  const currentHandSeats = game.players
    .filter((player) => currentHandUserIds.has(player.userId))
    .map((player) => player.seatIndex)
    .sort((a, b) => a - b);
  const buttonSeat = game.status === 'active'
    ? game.state.buttonSeat ?? currentHandSeats[0] ?? null
    : game.players.find((player) => player.userId === game.hostUserId)?.seatIndex ?? occupiedSeats[0] ?? null;
  const currentActionSeat = game.currentPlayerUserId === null
    ? null
    : game.players.find((player) => player.userId === game.currentPlayerUserId)?.seatIndex ?? null;
  const positionSeats = game.status === 'active' ? currentHandSeats : occupiedSeats;
  const positions = buttonSeat === null
    ? undefined
    : derivePositions(buttonSeat, positionSeats, game.tableSize);
  const liveActions = asyncActionsToLiveActions(game);
  const currentStreet = liveStreetForGame(game);
  const displayStreet = game.state.street ?? currentStreet;
  const boardCards = boardCardsForGame(game);
  const heroHoleCards = game.state.holeCards?.[String(effectiveUserId)] ?? [];
  const canShowCards = hasPreviousResult && game.isPlayer && !controlledNpc && !hasShownCards && heroHoleCards.length === 2;
  const activeSummary = currentActionSeat === null ? null : actionSummary(liveActions, currentStreet, currentActionSeat);
  const actionOdds = actionOddsForGame(game, currentStreet, currentActionSeat, liveActions);
  const streetBets = streetBetsForActions(liveActions, currentStreet);
  const stackInfo = stackInfoForGame(game);
  const potBB = Math.max(game.potChips / Math.max(1, game.bigBlindChips), totalPotBB(liveActions));
  const heroPlayer = game.players.find((player) => player.userId === effectiveUserId) ?? null;
  const heroHasCards = heroHoleCards.length > 0;
  const canLeave = game.isPlayer && game.status !== 'finished';
  const heroSummary = heroPlayer && heroHasCards ? actionSummary(liveActions, currentStreet, heroPlayer.seatIndex) : null;
  const pendingAction = game.state.pendingActions?.[String(effectiveUserId)] ?? null;
  const foldedUserIds = new Set((game.state.foldedUserIds ?? []).map(Number));
  const pendingFoldUserIds = new Set(
    Object.entries(game.state.pendingActions ?? {})
      .filter(([, action]) => action.action === 'fold')
      .map(([userId]) => Number(userId))
      .filter(Number.isFinite)
  );
  const heroFolded = foldedUserIds.has(effectiveUserId);
  const heroPendingFold = pendingFoldUserIds.has(effectiveUserId);
  const canPreDecide = game.status === 'active' && heroHasCards && (game.isPlayer || Boolean(controlledNpc)) && !isCurrentPlayer && !heroFolded && Boolean(heroPlayer);
  const preDecisionCallDefaultAmount = heroSummary?.canCall
    ? Math.round(heroSummary.toCallBB * game.bigBlindChips)
    : 0;
  const preDecisionRaiseDefaultAmount = heroSummary?.canBet
    ? game.bigBlindChips * 3
    : Math.max(
      game.bigBlindChips,
      Math.round((heroSummary?.minRaiseToBB ?? 0) * game.bigBlindChips)
    );
  const foldedSeatIds = game.players
    .filter((player) => foldedUserIds.has(player.userId) || pendingFoldUserIds.has(player.userId))
    .map((player) => player.seatIndex);
  const dealtSeatIds = game.status === 'active' ? currentHandSeats : [];
  const burnPileCount = foldedSeatIds.length * 2;

  useEffect(() => {
    const ids = new Set(game.recentActions.map((item) => item.id));
    const seen = seenActionIdsRef.current;
    if (!seen) {
      seenActionIdsRef.current = ids;
      return;
    }

    const freshActions = [...game.recentActions]
      .reverse()
      .filter((item) => !seen.has(item.id) && BETTING_ACTIONS.has(item.action));
    seenActionIdsRef.current = ids;
    if (freshActions.length === 0) return undefined;

    const animations = freshActions.flatMap((item): TableActionAnimation[] => {
      const player = game.players.find((candidate) => candidate.userId === item.userId);
      if (!player) return [];
      return [{
        id: `${item.id}-${item.action}`,
        seatId: player.seatIndex,
        action: item.action,
        label: actionAnimationLabel(item.action),
      }];
    });
    if (animations.length === 0) return undefined;

    setActionAnimations((current) => [...current, ...animations].slice(-12));
    window.setTimeout(() => {
      const animationIds = new Set(animations.map((animation) => animation.id));
      setActionAnimations((current) => current.filter((animation) => !animationIds.has(animation.id)));
    }, 1500);
    return undefined;
  }, [game.players, game.recentActions]);

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await task();
      setAmount('');
      setNote('');
      setBetSheetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy('');
    }
  }

  async function copyShareLink() {
    setShareStatus('');
    const link = buildShareLink(game.id);
    try {
      await navigator.clipboard.writeText(link);
      setShareStatus('Link copied');
    } catch {
      setShareStatus(link);
    }
  }

  const submitAction = (action: AsyncPokerAction, amountOverride?: number) => {
    const amountChips = amountOverride ?? (amount ? Number.parseInt(amount, 10) : undefined);
    return run(action, () => onAction(game.id, action, amountChips, note || undefined));
  };

  const savePreDecision = () => {
    const raiseToChips = preDecisionRaiseAmount
      ? Number.parseInt(preDecisionRaiseAmount, 10)
      : null;
    const callCapChips = preDecisionCallAllIn
      ? null
      : Number.parseInt(preDecisionCallAmount || String(preDecisionCallDefaultAmount), 10);
    void run('pre-decision', async () => {
      await onQueueAction(game.id, {
        action: raiseToChips !== null && raiseToChips > 0 ? 'raise' : 'call',
        amountChips: raiseToChips !== null && raiseToChips > 0 ? raiseToChips : callCapChips,
        raiseToChips: raiseToChips !== null && raiseToChips > 0 ? raiseToChips : null,
        callCapChips,
        callCapMode: preDecisionCallAllIn ? 'all_in' : 'amount',
        note: null,
        ...(controlledNpc ? { actorUserId: controlledNpc.userId } : {}),
      });
    });
  };

  const savePreFold = () => {
    void run('pre-fold', async () => {
      await onQueueAction(game.id, {
        action: 'fold',
        amountChips: null,
        raiseToChips: null,
        callCapChips: null,
        callCapMode: 'amount',
        note: null,
        ...(controlledNpc ? { actorUserId: controlledNpc.userId } : {}),
      });
    });
  };

  const clearPreDecision = () => {
    void run('clear-pre-decision', () => onClearQueuedAction(game.id, controlledNpc?.userId));
  };

  const handleCheckOrCall = () => {
    if (!activeSummary) return;
    const amountChips = activeSummary.canCall
      ? Math.round(activeSummary.toCallBB * game.bigBlindChips)
      : undefined;
    void submitAction(activeSummary.canCheck ? 'check' : 'call', amountChips);
  };

  const handleBetOrRaise = () => {
    const defaultAmount = activeSummary?.canBet
      ? game.bigBlindChips * 3
      : Math.max(
        game.bigBlindChips,
        Math.round(((activeSummary?.minRaiseToBB ?? 0) - (activeSummary?.seatContributionBB ?? 0)) * game.bigBlindChips)
      );
    setAmount(String(defaultAmount));
    setBetSheetOpen(true);
  };

  const handleEndTable = () => {
    if (!window.confirm(`End ${game.name}? Players will no longer be able to act at this table.`)) return;
    void run('end', () => onEnd(game.id));
  };

  const handleLeaveTable = () => {
    const foldAndLeave = heroHasCards && !heroFolded && !heroPendingFold;
    const leaveMessage = foldAndLeave
      ? `Fold and leave ${game.name}? Your fold will post when your turn arrives, and your seat will open automatically.`
      : heroPendingFold
        ? `Leave ${game.name}? Your queued fold will post when your turn arrives.`
        : `Leave ${game.name}? Your seat will open up for another player.`;
    if (!window.confirm(leaveMessage)) return;
    void run('leave', () => onLeave(game.id, foldAndLeave ? { foldAndLeave: true } : undefined));
  };

  const handleSeatTap = (seatId: number) => {
    if (game.status !== 'waiting' || !isHost) return;
    if (occupiedSeats.includes(seatId)) return;
    setPickingSeat(seatId);
  };

  return (
    <article className={`async-game-card async-game-${game.status}`}>
      <div className="async-game-card-header">
        <div>
          <div className="async-game-kicker">
            {game.status} · {game.players.length}/{game.tableSize} seats · {formatDuration(game.turnSeconds)} turns
          </div>
          <h3>{game.name}</h3>
          <p>Hosted by {game.hostUsername}</p>
        </div>
        {isHost && hostedNpcPlayers.length > 0 && game.status === 'active' && (
          <label className="async-control-npc">
            <span>Test as</span>
            <select
              value={controlledNpcUserId ?? ''}
              onChange={(event) => setControlledNpcUserId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">You</option>
              {hostedNpcPlayers.map((player) => (
                <option key={player.userId} value={player.userId}>
                  {player.username}
                </option>
              ))}
            </select>
          </label>
        )}
        {game.status === 'active' && (
          <div className={`async-turn-pill ${isCurrentPlayer ? 'is-current-user' : ''}`}>
            <span>
              {isCurrentPlayer
                ? controlledNpc ? `${controlledNpc.username}'s turn` : 'Your turn'
                : game.currentPlayerIsNpc
                  ? `${game.currentPlayerUsername ?? 'NPC'} NPC`
                  : `${game.currentPlayerUsername ?? 'Player'} acts`}
            </span>
            <strong>{formatTimeLeft(game.currentTurnExpiresAt)}</strong>
          </div>
        )}
        {hasPreviousResult && (
          <div className="async-turn-pill">
            <span>Review</span>
            <strong>Hand {previousHandResult?.handNumber}</strong>
          </div>
        )}
      </div>

      <div className="async-game-actions">
        {canShare && (
          <button className="btn-secondary" type="button" onClick={copyShareLink}>
            Copy join link
          </button>
        )}
        {canJoin && (
          <button className="btn-primary" disabled={Boolean(busy)} onClick={() => run('join', () => onJoin(game.id))}>
            {busy === 'join' ? 'Joining...' : game.status === 'active' ? 'Join next hand' : 'Join'}
          </button>
        )}
        {canLeave && (
          <button className="btn-secondary" disabled={Boolean(busy)} onClick={handleLeaveTable}>
            {busy === 'leave' ? 'Leaving...' : 'Leave seat'}
          </button>
        )}
        {canStart && (
          <button className="btn-primary" disabled={Boolean(busy)} onClick={() => run('start', () => onStart(game.id))}>
            {busy === 'start' ? 'Starting...' : 'Start'}
          </button>
        )}
        {canEnd && (
          <button className="btn-secondary" disabled={Boolean(busy)} onClick={handleEndTable}>
            {busy === 'end' ? 'Ending...' : 'End table'}
          </button>
        )}
        {canShowCards && (
          <button className="btn-secondary" disabled={Boolean(busy)} onClick={() => run('show', () => onShowCards(game.id))}>
            {busy === 'show' ? 'Showing...' : 'Show cards'}
          </button>
        )}
        {canAcknowledgeResult && (
          <button className="btn-primary" disabled={Boolean(busy)} onClick={() => run('ack-result', () => onAcknowledgeResult(game.id))}>
            {busy === 'ack-result' ? 'Opening hand...' : 'Go to next hand'}
          </button>
        )}
        {game.status === 'finished' && <span className="async-muted">Finished</span>}
      </div>
      {error && <p className="auth-error async-action-error" role="alert">{error}</p>}
      {shareStatus && <p className="async-share-status">{shareStatus}</p>}

      <PokerTable
        tableSize={game.tableSize}
        playerNames={playerNames}
        buttonSeat={buttonSeat}
        actionSeat={game.status === 'active' ? currentActionSeat : null}
        positions={positions}
        stackInfo={stackInfo}
        streetBets={streetBets}
        potAmountBB={potBB}
        actionAnimations={actionAnimations}
        dealtSeatIds={dealtSeatIds}
        foldedSeatIds={foldedSeatIds}
        burnPileCount={burnPileCount}
        isSeatDisabled={(seatId) => !occupiedSeats.includes(seatId) && (game.status !== 'waiting' || !isHost)}
        onSeatTap={handleSeatTap}
        centerContent={
          <LiveTableCenter
            potBB={potBB}
            bigBlind={game.bigBlindChips}
            currency=""
            boardCards={boardCards}
            boardDisabled
            status={game.status === 'waiting'
              ? <>Waiting<br /><span className="live-table-center-sub">{game.players.length}/{game.tableSize} seated</span></>
              : isTableEnded
                ? <>Table ended<br /><span className="live-table-center-sub">Hand {game.handNumber}</span></>
                : hasPreviousResult
                  ? <>{previousWinnerText(game)}<br /><span className="live-table-center-sub">Current hand {game.handNumber} is dealt</span></>
                : <>{streetLabel(displayStreet)}<br /><span className="live-table-center-sub">{game.currentPlayerUsername ?? 'Player'} to act</span></>}
          />
        }
      />

      {heroHoleCards.length > 0 && (
        <div className="async-hole-cards" aria-label="Your hole cards">
          <span>{controlledNpc ? `${controlledNpc.username}'s hand` : 'Your hand'}</span>
          <div className="async-hole-card-row">
            {heroHoleCards.map((card, index) => (
              <PlayingCard key={`${card.rank}${card.suit}-${index}`} card={card} size="md" />
            ))}
          </div>
          {game.state.showdown?.[String(currentUserId)]?.label && (
            <strong>{game.state.showdown[String(currentUserId)].label}</strong>
          )}
        </div>
      )}

      {canPreDecide && (
        <section className="async-predecision-panel" aria-label="Pre-decide action">
          <div className="async-predecision-head">
            <div>
              <span>Pre-decide</span>
              <strong>{pendingAction ? queuedActionDescription(pendingAction) : `Plan ${controlledNpc ? `${controlledNpc.username}'s` : 'your'} ${streetLabel(currentStreet).toLowerCase()} action`}</strong>
            </div>
            {pendingAction && (
              <button
                type="button"
                className="btn-ghost async-predecision-clear"
                disabled={Boolean(busy)}
                onClick={clearPreDecision}
              >
                Clear
              </button>
            )}
          </div>

          <div className="async-predecision-controls">
            <div className="async-predecision-call">
              <label className="async-field">
                <span>Call up to</span>
                <input
                  type="number"
                  min="0"
                  value={preDecisionCallAmount}
                  onChange={(event) => setPreDecisionCallAmount(event.target.value)}
                  disabled={preDecisionCallAllIn}
                  placeholder={String(preDecisionCallDefaultAmount)}
                />
              </label>
              <label className="async-predecision-toggle">
                <input
                  type="checkbox"
                  checked={preDecisionCallAllIn}
                  onChange={(event) => setPreDecisionCallAllIn(event.target.checked)}
                />
                <span>All in</span>
              </label>
            </div>
            <label className="async-field">
              <span>Raise to</span>
              <input
                type="number"
                min="1"
                value={preDecisionRaiseAmount}
                onChange={(event) => setPreDecisionRaiseAmount(event.target.value)}
                placeholder={String(preDecisionRaiseDefaultAmount)}
              />
            </label>
          </div>

          <div className="async-predecision-actions">
            <span>
              {heroPendingFold
                ? 'Fold queued privately; it will post when your turn arrives'
                : [
                  preDecisionRaiseAmount ? `${heroSummary?.canBet ? 'Bet' : 'Raise'} to ${preDecisionRaiseAmount} chips` : null,
                  preDecisionCallAllIn
                    ? 'Call up to all in'
                    : preDecisionCallDefaultAmount > 0
                      ? `Call up to ${preDecisionCallAmount || preDecisionCallDefaultAmount} chips`
                      : 'Check if free',
                ].filter(Boolean).join('; ')}
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={Boolean(busy)}
              onClick={savePreFold}
            >
              {busy === 'pre-fold' ? 'Folding...' : 'Fold when turn arrives'}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={Boolean(busy)}
              onClick={savePreDecision}
            >
              Save plan
            </button>
          </div>
        </section>
      )}

      {game.status === 'active' && canActForCurrentPlayer && (
        <LiveActionBar
          street={currentStreet}
          actorName={isHostControlledNpcTurn ? `Play as ${game.currentPlayerUsername ?? 'NPC'}` : game.currentPlayerUsername ?? 'Your turn'}
          actionSummary={activeSummary}
          actionOdds={actionOdds}
          disabled={Boolean(busy) || !activeSummary}
          hasUserActions={liveActions.some((action) => !['post-blind', 'post-straddle'].includes(action.action))}
          onFold={() => void submitAction('fold')}
          onCheckOrCall={handleCheckOrCall}
          onBetOrRaise={handleBetOrRaise}
          onWinner={() => void submitAction('pass')}
          onUndo={() => {}}
          showWinner={false}
        />
      )}

      {pickingSeat !== null && (
        <AsyncSeatPicker
          seatIndex={pickingSeat}
          tableSize={game.tableSize}
          profiles={profiles}
          onCancel={() => setPickingSeat(null)}
          onAddNpc={(input) => onAddNpc(game.id, input)}
          onCreateProfile={onCreateProfile}
        />
      )}

      {betSheetOpen && (
        <div className="live-bottom-sheet-backdrop" role="presentation" onClick={() => setBetSheetOpen(false)}>
          <section className="live-bottom-sheet" role="dialog" aria-modal="true" aria-label="Async bet sizing" onClick={(event) => event.stopPropagation()}>
            <div className="live-card-modal-header">
              <div>
                <div className="live-card-modal-kicker">{streetLabel(currentStreet)} sizing</div>
                <h2 className="live-card-modal-title">{activeSummary?.canBet ? 'Bet' : 'Raise'} · {game.currentPlayerUsername ?? 'Player'}</h2>
              </div>
              <button type="button" className="live-card-modal-close" onClick={() => setBetSheetOpen(false)}>×</button>
            </div>
            <div className="async-action-panel">
              <label className="async-field">
                <span>Chips</span>
                <input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="chips"
                />
              </label>
              <label className="async-field">
                <span>Note</span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  placeholder="optional"
                />
              </label>
            </div>
            <div className="live-card-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setBetSheetOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                disabled={Boolean(busy) || !amount}
                onClick={() => void submitAction(activeSummary?.canBet ? 'bet' : 'raise')}
              >
                {busy ? 'Saving...' : `Save ${activeSummary?.canBet ? 'bet' : 'raise'}`}
              </button>
            </div>
          </section>
        </div>
      )}

      <AsyncActionHistory game={game} />
    </article>
  );
}

function NotificationSettings({
  preference,
  onSave,
}: {
  preference: NotificationPreference;
  onSave: (preference: NotificationPreference) => Promise<void>;
}) {
  const [draft, setDraft] = useState(preference);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setDraft(preference), [preference]);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      await onSave(draft);
      setMessage('Saved');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="async-side-panel">
      <h2>Turn Alerts</h2>
      <label className="async-toggle-row">
        <input
          type="checkbox"
          checked={draft.emailTurnNotifications}
          onChange={(e) => setDraft((value) => ({ ...value, emailTurnNotifications: e.target.checked }))}
        />
        <span>Email</span>
      </label>
      <label className="async-toggle-row">
        <input
          type="checkbox"
          checked={draft.discordTurnNotifications}
          onChange={(e) => setDraft((value) => ({ ...value, discordTurnNotifications: e.target.checked }))}
        />
        <span>Discord mention</span>
      </label>
      <label className="async-field">
        <span>Discord user ID</span>
        <input
          value={draft.discordUserId}
          onChange={(e) => setDraft((value) => ({ ...value, discordUserId: e.target.value }))}
          placeholder="123456789012345678"
        />
      </label>
      <p className="async-muted">
        Discord channel posting is {preference.discordConfigured ? 'configured' : 'waiting for DISCORD_TURN_WEBHOOK_URL'}.
      </p>
      <button className="btn-primary" disabled={saving} onClick={save}>
        {saving ? 'Saving...' : 'Save alerts'}
      </button>
      {message && <p className="async-muted">{message}</p>}
    </section>
  );
}

export function AsyncPokerHome({
  onBack,
  onRequireAuth,
  profiles,
  onCreateProfile,
}: {
  onBack: () => void;
  onRequireAuth: () => void;
  profiles: PlayerProfile[];
  onCreateProfile: (name: string, tableSize: number) => Promise<PlayerProfile>;
}) {
  const { user, refreshUser } = useAuth();
  const asyncPoker = useAsyncPoker(Boolean(user));
  const inviteGameId = getInviteGameId();
  const attemptedInviteRef = useRef('');
  const [name, setName] = useState('');
  const [tableSize, setTableSize] = useState(6);
  const [turnSeconds, setTurnSeconds] = useState(24 * 60 * 60);
  const [inviteUsernames, setInviteUsernames] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const openGames = asyncPoker.games.filter((game) => game.status !== 'finished');
  const activeGame = activeGameId ? openGames.find((game) => game.id === activeGameId) ?? null : null;

  const myTurnCount = asyncPoker.games.filter((game) => game.currentPlayerUserId === user?.id).length;
  const hasHostedNpcTurn = asyncPoker.games.some((game) => (
    game.status === 'active'
    && game.hostUserId === user?.id
    && game.currentPlayerIsNpc
  ));
  const needsLogin = asyncPoker.error === 'Not authenticated' || createError === 'Not authenticated';

  useEffect(() => {
    if (!user || !inviteGameId || asyncPoker.loading || attemptedInviteRef.current === inviteGameId) return;
    const invitedGame = asyncPoker.games.find((game) => game.id === inviteGameId);
    if (invitedGame?.isPlayer) {
      setInviteStatus(`You are already seated at ${invitedGame.name}.`);
      attemptedInviteRef.current = inviteGameId;
      clearInviteGameId();
      return;
    }

    attemptedInviteRef.current = inviteGameId;
    setInviteStatus('Joining table from invite link...');
    asyncPoker.joinGame(inviteGameId)
      .then(() => {
        setInviteStatus('You joined the table.');
        clearInviteGameId();
      })
      .catch((err) => {
        setInviteStatus(err instanceof Error ? err.message : 'Could not join from this invite link.');
      });
  }, [asyncPoker, inviteGameId, user]);

  useEffect(() => {
    if (!hasHostedNpcTurn) return undefined;
    const timer = window.setTimeout(() => {
      void asyncPoker.refresh();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [asyncPoker.refresh, hasHostedNpcTurn]);

  // When the soonest active turn timer is about to lapse, refresh so the server
  // posts the auto-fold promptly. Longer timers are covered by the 60s poll.
  useEffect(() => {
    const soonestExpiry = asyncPoker.games
      .filter((game) => game.status === 'active' && game.currentTurnExpiresAt)
      .reduce<number | null>((soonest, game) => {
        const expiresAt = new Date(game.currentTurnExpiresAt as string).getTime();
        if (!Number.isFinite(expiresAt)) return soonest;
        return soonest === null ? expiresAt : Math.min(soonest, expiresAt);
      }, null);
    if (soonestExpiry === null) return undefined;
    const msUntilExpiry = soonestExpiry - Date.now();
    if (msUntilExpiry > 60_000) return undefined;
    const delay = Math.max(1_000, msUntilExpiry + 500);
    const timer = window.setTimeout(() => {
      void asyncPoker.refresh();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [asyncPoker.refresh, asyncPoker.games]);

  useEffect(() => {
    if (!activeGameId) return;
    if (!openGames.some((game) => game.id === activeGameId)) {
      setActiveGameId(null);
    }
  }, [activeGameId, openGames]);

  useEffect(() => {
    if (!activeGame) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeGame]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await asyncPoker.createGame({
        name,
        tableSize,
        turnSeconds,
        inviteUsernames: inviteUsernames.split(',').map((item) => item.trim()).filter(Boolean),
      });
      setName('');
      setInviteUsernames('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create game';
      setCreateError(message);
      if (message === 'Not authenticated') {
        await refreshUser().catch(() => {});
      }
    } finally {
      setCreating(false);
    }
  }

  if (!user) {
    return (
      <div className="async-poker-home">
        <button className="btn-secondary" onClick={onBack}>Back</button>
        <section className="async-empty-state">
          <h1>Async Poker</h1>
          <p>
            {inviteGameId
              ? 'Log in to join this table from the invite link.'
              : 'Log in to host tables, join friends, and receive turn alerts.'}
          </p>
          <button className="btn-primary" onClick={onRequireAuth}>
            Log in
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="async-poker-home">
      <div className="async-poker-header">
        <button className="btn-secondary" onClick={onBack}>Back</button>
        <div>
          <h1>Async Poker</h1>
          <p>{myTurnCount > 0 ? `${myTurnCount} table${myTurnCount === 1 ? '' : 's'} waiting on you` : 'Host a table and let turns breathe.'}</p>
        </div>
        <button className="btn-secondary" onClick={asyncPoker.refresh} disabled={asyncPoker.loading}>
          {asyncPoker.loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="async-layout">
        <main className="async-main-column">
          <form className="async-create-panel" onSubmit={handleCreate}>
            <h2>Host Game</h2>
            <div className="async-form-grid">
              <label className="async-field">
                <span>Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${user.username}'s table`} />
              </label>
              <label className="async-field">
                <span>Seats</span>
                <input
                  type="number"
                  min="2"
                  max="9"
                  value={tableSize}
                  onChange={(e) => setTableSize(Number.parseInt(e.target.value, 10))}
                />
              </label>
              <label className="async-field">
                <span>Turn timer</span>
                <select value={turnSeconds} onChange={(e) => setTurnSeconds(Number.parseInt(e.target.value, 10))}>
                  {TURN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="async-field">
                <span>Invite usernames</span>
                <input
                  value={inviteUsernames}
                  onChange={(e) => setInviteUsernames(e.target.value)}
                  placeholder="drake, alex"
                />
              </label>
            </div>
            <button className="btn-primary" disabled={creating} type="submit">
              {creating ? 'Creating...' : 'Create table'}
            </button>
            {createError && <p className="auth-error">{createError}</p>}
          </form>

          {needsLogin ? (
            <section className="async-auth-warning">
              <strong>Log in again to use Async Poker.</strong>
              <span>Your local session is no longer recognized by the backend.</span>
              <button className="btn-primary" onClick={onRequireAuth}>Log in</button>
            </section>
          ) : asyncPoker.error ? (
            <p className="auth-error">{asyncPoker.error}</p>
          ) : null}
          {inviteStatus && <p className="async-invite-status">{inviteStatus}</p>}
          <section className="async-tables-panel">
            <div className="async-tables-panel-header">
              <div>
                <h2>Tables</h2>
                <span>{openGames.length} active or waiting</span>
              </div>
            </div>
            <div className="async-games-list">
              {openGames.length === 0 ? (
                <section className="async-empty-state">
                  <h2>{asyncPoker.games.length === 0 ? 'No tables yet' : 'No active tables'}</h2>
                  <p>
                    {asyncPoker.games.length === 0
                      ? 'Create the first async game, then invite people by username.'
                      : 'Create a table or wait for an invite to get back in action.'}
                  </p>
                </section>
              ) : (
                openGames.map((game) => (
                  <AsyncTableLobbyCard
                    key={game.id}
                    game={game}
                    currentUserId={user.id}
                    onOpen={() => setActiveGameId(game.id)}
                  />
                ))
              )}
            </div>
          </section>
        </main>

        <aside className="async-side-column">
          <NotificationSettings preference={asyncPoker.preference} onSave={asyncPoker.savePreference} />
          <section className="async-side-panel">
            <h2>Inbox</h2>
            {asyncPoker.notifications.length === 0 ? (
              <p className="async-muted">No notifications yet.</p>
            ) : (
              asyncPoker.notifications.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  className={`async-notification ${item.readAt ? '' : 'is-unread'}`}
                  onClick={() => asyncPoker.markNotificationRead(item.id)}
                >
                  <span className="async-notification-top">
                    <strong>{item.title}</strong>
                    <span aria-hidden="true">×</span>
                  </span>
                  <span>{item.body}</span>
                </button>
              ))
            )}
          </section>
          <PastTablesCard games={asyncPoker.games} />
        </aside>
      </div>

      {activeGame && (
        <div className="async-play-modal-backdrop" role="presentation">
          <section className="async-play-modal" role="dialog" aria-modal="true" aria-label={`Play ${activeGame.name}`}>
            <div className="async-play-modal-header">
              <div>
                <span>Playing table</span>
                <strong>{activeGame.name}</strong>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setActiveGameId(null)}>
                Leave table
              </button>
            </div>
            <GameCard
              game={activeGame}
              currentUserId={user.id}
              profiles={profiles}
              onJoin={asyncPoker.joinGame}
              onLeave={asyncPoker.leaveGame}
              onAddNpc={asyncPoker.addNpc}
              onStart={asyncPoker.startGame}
              onEnd={asyncPoker.endGame}
              onShowCards={asyncPoker.showCards}
              onAcknowledgeResult={asyncPoker.acknowledgeResult}
              onAction={asyncPoker.takeAction}
              onQueueAction={asyncPoker.queueAction}
              onClearQueuedAction={asyncPoker.clearQueuedAction}
              onCreateProfile={onCreateProfile}
            />
          </section>
        </div>
      )}
    </div>
  );
}
