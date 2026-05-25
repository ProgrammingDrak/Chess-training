const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'];
const FORCED_ACTIONS = new Set(['post-blind', 'post-straddle']);

export function nextActionOrder(actions) {
  return actions.reduce((max, action) => Math.max(max, action.order), -1) + 1;
}

export function totalPotBB(actions) {
  return actions.reduce((sum, action) => sum + (action.amountBB ?? 0), 0);
}

export function streetPotBB(actions, street) {
  return actions
    .filter(action => action.street === street)
    .reduce((sum, action) => sum + (action.amountBB ?? 0), 0);
}

export function seatStreetContributionBB(actions, street, seatId) {
  return actions
    .filter(action => action.street === street && action.seatId === seatId)
    .reduce((sum, action) => sum + (action.amountBB ?? 0), 0);
}

export function currentStreetBetBB(actions, street) {
  const bySeat = new Map();
  for (const action of actions.filter(action => action.street === street)) {
    bySeat.set(action.seatId, (bySeat.get(action.seatId) ?? 0) + (action.amountBB ?? 0));
  }
  return Math.max(0, ...bySeat.values());
}

function streetActionsInOrder(actions, street) {
  return actions
    .filter(action => action.street === street)
    .map((action, index) => ({ action, index }))
    .sort((a, b) => (a.action.order ?? a.index) - (b.action.order ?? b.index))
    .map(item => item.action);
}

export function minRaiseInfo(actions, street) {
  const bySeat = new Map();
  let currentBetBB = 0;
  let minRaiseDeltaBB = 0;

  for (const action of streetActionsInOrder(actions, street)) {
    const amountBB = action.amountBB ?? 0;
    if (amountBB <= 0) continue;
    const previousSeatContributionBB = bySeat.get(action.seatId) ?? 0;
    const nextSeatContributionBB = previousSeatContributionBB + amountBB;
    bySeat.set(action.seatId, nextSeatContributionBB);
    if (nextSeatContributionBB <= currentBetBB) continue;

    const raiseDeltaBB = FORCED_ACTIONS.has(action.action)
      ? nextSeatContributionBB
      : nextSeatContributionBB - currentBetBB;
    currentBetBB = nextSeatContributionBB;
    minRaiseDeltaBB = raiseDeltaBB;
  }

  return {
    currentBetBB,
    minRaiseDeltaBB: currentBetBB > 0 ? minRaiseDeltaBB : 0,
    minRaiseToBB: currentBetBB > 0 ? currentBetBB + minRaiseDeltaBB : 0,
  };
}

export function toCallBB(actions, street, seatId) {
  const currentBet = currentStreetBetBB(actions, street);
  const contribution = seatStreetContributionBB(actions, street, seatId);
  return Math.max(0, currentBet - contribution);
}

export function appendLiveAction(input) {
  const amountBB = input.amountBB ?? 0;
  const potBeforeBB = totalPotBB(input.actions);
  const action = {
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

export function actionSummary(actions, street, seatId) {
  const raiseInfo = minRaiseInfo(actions, street);
  const currentBetBB = raiseInfo.currentBetBB;
  const seatContributionBB = seatStreetContributionBB(actions, street, seatId);
  const callBB = Math.max(0, currentBetBB - seatContributionBB);
  return {
    potBB: totalPotBB(actions),
    streetPotBB: streetPotBB(actions, street),
    toCallBB: callBB,
    currentBetBB,
    seatContributionBB,
    minRaiseDeltaBB: raiseInfo.minRaiseDeltaBB,
    minRaiseToBB: raiseInfo.minRaiseToBB,
    canCheck: callBB === 0,
    canCall: callBB > 0,
    canBet: currentBetBB === 0,
    canRaise: currentBetBB > 0,
  };
}

export function nextClockwise(from, occupied, tableSize) {
  if (occupied.length === 0) return null;
  const set = new Set(occupied);
  for (let step = 1; step <= tableSize; step += 1) {
    const seatId = (from + step) % tableSize;
    if (set.has(seatId)) return seatId;
  }
  return null;
}

function actionSort(a, b) {
  return a.order - b.order;
}

export function foldedSeats(actions) {
  return new Set(actions.filter(action => action.action === 'fold').map(action => action.seatId));
}

export function unfoldedSeats(actions, seatedPlayers) {
  const folded = foldedSeats(actions);
  return seatedPlayers.filter(seatId => !folded.has(seatId));
}

export function allInSeats(actions) {
  return new Set(actions.filter(action => action.action === 'all-in').map(action => action.seatId));
}

export function liveActionSeats(actions, seatedPlayers) {
  const folded = foldedSeats(actions);
  const allIn = allInSeats(actions);
  return seatedPlayers.filter(seatId => !folded.has(seatId) && !allIn.has(seatId));
}

export function firstPreflopActor({
  seatedPlayers,
  tableSize,
  bigBlindSeat,
  straddleSeat,
}) {
  const anchor = straddleSeat ?? bigBlindSeat;
  if (anchor === null) return seatedPlayers[0] ?? null;
  return nextClockwise(anchor, seatedPlayers, tableSize);
}

export function firstPostflopActor({
  actions,
  seatedPlayers,
  tableSize,
  buttonSeat,
}) {
  return nextClockwise(buttonSeat, liveActionSeats(actions, seatedPlayers), tableSize);
}

export function blindSeatsForButton({ buttonSeat, seatedPlayers, tableSize }) {
  if (buttonSeat === null || seatedPlayers.length < 2) {
    return { smallBlindSeat: null, bigBlindSeat: null };
  }

  if (seatedPlayers.length === 2) {
    return {
      smallBlindSeat: buttonSeat,
      bigBlindSeat: nextClockwise(buttonSeat, seatedPlayers, tableSize),
    };
  }

  const smallBlindSeat = nextClockwise(buttonSeat, seatedPlayers, tableSize);
  return {
    smallBlindSeat,
    bigBlindSeat: smallBlindSeat === null ? null : nextClockwise(smallBlindSeat, seatedPlayers, tableSize),
  };
}

export function isBettingRoundClosed(actions, street, seatedPlayers) {
  const activeSeats = liveActionSeats(actions, seatedPlayers);
  if (activeSeats.length <= 1) return true;
  const streetActions = actions.filter(action => action.street === street).sort(actionSort);
  const voluntary = streetActions.filter(action => !FORCED_ACTIONS.has(action.action));
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
}) {
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
}) {
  const remainingUnfolded = unfoldedSeats(actions, seatedPlayers);
  if (remainingUnfolded.length <= 1) {
    return {
      street,
      seatId: remainingUnfolded[0] ?? null,
      roundClosed: true,
      handActionClosed: true,
    };
  }

  const nextSeat = nextActorAfter({ actions, street, actedSeat, seatedPlayers, tableSize });
  if (nextSeat !== null) {
    return { street, seatId: nextSeat, roundClosed: false, handActionClosed: false };
  }

  const index = STREET_ORDER.indexOf(street);
  if (index < 0 || index === STREET_ORDER.length - 1) {
    return { street, seatId: null, roundClosed: true, handActionClosed: true };
  }

  const nextStreet = STREET_ORDER[index + 1];
  return {
    street: nextStreet,
    seatId: firstPostflopActor({ actions, seatedPlayers, tableSize, buttonSeat }),
    roundClosed: true,
    handActionClosed: false,
  };
}

export function undoLastAction(actions) {
  const sorted = [...actions].sort((a, b) => b.order - a.order);
  const undone = sorted.find(action => !FORCED_ACTIONS.has(action.action)) ?? null;
  if (!undone) return { actions, undone: null };
  return {
    actions: actions.filter(action => action.order !== undone.order),
    undone,
  };
}

export function deriveHeroPlayedAction(actions, heroSeatId) {
  return [...actions]
    .sort(actionSort)
    .find(action => (
      action.seatId === heroSeatId
      && !FORCED_ACTIONS.has(action.action)
    )) ?? null;
}

export function followedAdviceBucket({
  recommendedKind,
  recommendedMaxBB,
  action,
}) {
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
}) {
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

export function applyActionCostsToStacks(startingStacks, actions) {
  const spentBySeat = new Map();
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
}) {
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
