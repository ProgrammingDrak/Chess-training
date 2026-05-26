import { actionSummary } from './pokerGameplay.js';

function integerOrNull(value) {
  return Number.isInteger(value) ? value : null;
}

export function normalizeAsyncPokerQueuedAction(queuedAction) {
  if (!queuedAction || typeof queuedAction !== 'object') return null;

  const legacyAction = ['call', 'raise'].includes(queuedAction.action) ? queuedAction.action : null;
  const legacyAmount = integerOrNull(queuedAction.amountChips);
  const explicitRaiseTo = integerOrNull(queuedAction.raiseToChips);
  const explicitCallCap = integerOrNull(queuedAction.callCapChips);
  const callCapMode = queuedAction.callCapMode === 'all_in' ? 'all_in' : 'amount';

  const raiseToChips = explicitRaiseTo ?? (legacyAction === 'raise' && legacyAmount !== null ? legacyAmount : null);
  const callCapChips = explicitCallCap ?? (
    legacyAction && legacyAmount !== null ? legacyAmount : null
  );

  if ((raiseToChips === null || raiseToChips <= 0) && callCapMode !== 'all_in' && (callCapChips === null || callCapChips < 0)) {
    return null;
  }

  return {
    ...queuedAction,
    action: raiseToChips !== null && raiseToChips > 0 ? 'raise' : 'call',
    amountChips: legacyAmount ?? raiseToChips ?? callCapChips ?? null,
    raiseToChips: raiseToChips !== null && raiseToChips > 0 ? raiseToChips : null,
    callCapChips: callCapChips !== null && callCapChips >= 0 ? callCapChips : null,
    callCapMode,
  };
}

export function prepareAsyncPokerQueuedAction({ game, state, actor, queuedAction }) {
  const normalized = normalizeAsyncPokerQueuedAction(queuedAction);
  if (!normalized) return null;
  if (normalized.handNumber !== game.hand_number || normalized.street !== state.street) return null;

  const folded = new Set((state.foldedUserIds ?? []).map(Number));
  if (folded.has(Number(actor.user_id))) return null;

  const summary = actionSummary(state.actions, state.street, actor.seat_index);
  const stackChips = Math.max(0, Number(actor.stack_chips ?? 0));
  const toCallChips = Math.max(0, Math.round(summary.toCallBB * game.big_blind_chips));
  const contributionChips = Math.max(0, Math.round(summary.seatContributionBB * game.big_blind_chips));
  const minRaiseToChips = Math.max(0, Math.round(summary.minRaiseToBB * game.big_blind_chips));

  if (normalized.raiseToChips !== null) {
    if (summary.canBet && normalized.raiseToChips <= stackChips) {
      return { action: 'bet', amountChips: normalized.raiseToChips };
    }

    const commitChips = normalized.raiseToChips - contributionChips;
    if (
      summary.canRaise
      && normalized.raiseToChips >= minRaiseToChips
      && commitChips > toCallChips
      && commitChips <= stackChips
    ) {
      return { action: 'raise', amountChips: commitChips };
    }
  }

  if (summary.canCheck) return { action: 'check', amountChips: null };

  const callCapAllowsCall = normalized.callCapMode === 'all_in'
    || (normalized.callCapChips !== null && toCallChips <= normalized.callCapChips);
  if (summary.canCall && toCallChips > 0 && callCapAllowsCall) {
    const callAmountChips = normalized.callCapMode === 'all_in'
      ? Math.min(stackChips, toCallChips)
      : toCallChips;
    if (callAmountChips > 0 && callAmountChips <= stackChips) {
      return { action: 'call', amountChips: callAmountChips };
    }
  }

  return { action: 'fold', amountChips: null };
}

export function asyncPokerQueuedActionNote(queuedAction) {
  const normalized = normalizeAsyncPokerQueuedAction(queuedAction);
  if (!normalized) return 'Pre-decided action';

  const parts = [];
  if (normalized.raiseToChips !== null) parts.push(`raise to ${normalized.raiseToChips} chips`);
  if (normalized.callCapMode === 'all_in') {
    parts.push('call up to all in');
  } else if (normalized.callCapChips !== null) {
    parts.push(normalized.callCapChips === 0 ? 'check if free' : `call up to ${normalized.callCapChips} chips`);
  }

  const suffix = normalized.note ? ` · ${normalized.note}` : '';
  return `Pre-decided: ${parts.join('; ') || 'action'}${suffix}`;
}
