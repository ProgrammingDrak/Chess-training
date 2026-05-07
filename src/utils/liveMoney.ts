import type {
  BlindLevel,
  LiveBetSizing,
  LiveSession,
  LiveStraddle,
  SeatId,
} from '../types/liveSession';

export type LiveAmountMode = 'amount' | 'bb';

export interface ConvertedAmount {
  amount: number;
  amountBB: number;
  bigBlindAtHand: number;
}

export interface ConvertedPot {
  finalPotAmount: number;
  finalPotBB: number;
}

export type StackDepthLabel = 'Short' | 'Medium' | 'Deep';

export function activeBlindLevelForHand(session: LiveSession, handIndex: number): BlindLevel {
  const fallback: BlindLevel = {
    effectiveFromHandIndex: 0,
    smallBlind: session.stakes?.sbBB ?? 1,
    bigBlind: session.stakes?.bbBB ?? 2,
    currency: session.stakes?.currency ?? '$',
  };
  const levels = (session.blindLevels && session.blindLevels.length > 0 ? session.blindLevels : [fallback])
    .slice()
    .sort((a, b) => a.effectiveFromHandIndex - b.effectiveFromHandIndex);
  const activeLevels = levels.filter(level => level.effectiveFromHandIndex <= handIndex);
  return activeLevels[activeLevels.length - 1] ?? fallback;
}

export function convertAmount({
  value,
  inputMode,
  bigBlind,
}: {
  value: number;
  inputMode: LiveAmountMode;
  bigBlind: number;
}): ConvertedAmount | undefined {
  const safeBigBlind = Math.max(0.01, bigBlind);
  const amount = inputMode === 'amount' ? value : value * safeBigBlind;
  const amountBB = inputMode === 'bb' ? value : amount / safeBigBlind;
  if (!Number.isFinite(amount) || !Number.isFinite(amountBB) || amount <= 0 || amountBB <= 0) return undefined;
  return { amount, amountBB, bigBlindAtHand: safeBigBlind };
}

export function convertPotSize({
  session,
  handIndex,
  value,
  inputMode,
}: {
  session: LiveSession;
  handIndex: number;
  value: number;
  inputMode: LiveAmountMode;
}): ConvertedPot | undefined {
  const level = activeBlindLevelForHand(session, handIndex);
  const converted = convertAmount({ value, inputMode, bigBlind: level.bigBlind });
  if (!converted) return undefined;
  return {
    finalPotAmount: converted.amount,
    finalPotBB: converted.amountBB,
  };
}

export function convertBetSizing({
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
  inputMode: LiveAmountMode;
  betValue: number;
  potValue?: number;
  potInputMode: LiveAmountMode;
}): LiveBetSizing | undefined {
  const level = activeBlindLevelForHand(session, handIndex);
  const converted = convertAmount({ value: betValue, inputMode, bigBlind: level.bigBlind });
  if (!converted) return undefined;

  const potConverted = potValue && potValue > 0
    ? convertAmount({ value: potValue, inputMode: potInputMode, bigBlind: level.bigBlind })
    : undefined;
  const potAmount = potConverted?.amount;
  const potBB = potConverted?.amountBB;
  const potFraction = potAmount ? converted.amount / potAmount : undefined;

  return {
    seatId,
    amount: converted.amount,
    amountBB: converted.amountBB,
    ...(potAmount !== undefined ? { potAmount } : {}),
    ...(potBB !== undefined ? { potBB } : {}),
    ...(potFraction !== undefined ? { potFraction } : {}),
    bigBlindAtHand: converted.bigBlindAtHand,
    smallBlindAtHand: level.smallBlind,
    inputMode,
  };
}

export function convertStraddle({
  session,
  handIndex,
  seatId,
  value,
  inputMode,
}: {
  session: LiveSession;
  handIndex: number;
  seatId: SeatId;
  value: number;
  inputMode: LiveAmountMode;
}): LiveStraddle | undefined {
  const level = activeBlindLevelForHand(session, handIndex);
  const converted = convertAmount({ value, inputMode, bigBlind: level.bigBlind });
  if (!converted) return undefined;
  return {
    seatId,
    amount: converted.amount,
    amountBB: converted.amountBB,
    bigBlindAtHand: converted.bigBlindAtHand,
    inputMode,
  };
}

export function bankrollNet(buyIns: number[], cashOut: number): number {
  return cashOut - buyIns.reduce((sum, buyIn) => sum + buyIn, 0);
}

export function formatLiveNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}

export function stackDepthLabel(stackBB: number): StackDepthLabel {
  if (stackBB < 40) return 'Short';
  if (stackBB <= 100) return 'Medium';
  return 'Deep';
}
