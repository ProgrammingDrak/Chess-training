import type { Card, Suit, Rank } from '../types/poker';

// ─── Card Display ───────────────────────────────────────────────────────────────

export const SUIT_SYMBOLS: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

export const RED_SUITS: Suit[] = ['h', 'd'];

export function isRedSuit(suit: Suit): boolean {
  return RED_SUITS.includes(suit);
}

export function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function handLabel(c1: Card, c2: Card): string {
  return `${cardLabel(c1)} ${cardLabel(c2)}`;
}

// ─── Pot Odds Math ──────────────────────────────────────────────────────────────

/**
 * Required equity % to call: call / (pot + call + call) * 100
 * (pot = pot before villain bet, betSize = villain's bet)
 */
export function calcRequiredEquity(potSize: number, betSize: number): number {
  const totalPot = potSize + betSize + betSize;
  return (betSize / totalPot) * 100;
}

// ─── Rule of 4 & 2 ─────────────────────────────────────────────────────────────

/** Flop equity estimate: outs × 4 */
export function rule4(outs: number): number {
  return outs * 4;
}

/** Turn equity estimate: outs × 2 */
export function rule2(outs: number): number {
  return outs * 2;
}

// ─── EV Math ────────────────────────────────────────────────────────────────────

export function calcEV(outcomes: Array<{ probability: number; netValueBB: number }>): number {
  return outcomes.reduce((sum, o) => sum + o.probability * o.netValueBB, 0);
}

// ─── Multiple Choice Distractors ───────────────────────────────────────────────

/**
 * Generate 3 plausible wrong answers for a percentage question.
 * Keeps values in 1-99 range, avoids duplicating correct answer.
 */
export function generatePctDistractors(correct: number, count = 3): number[] {
  const offsets = [5, 10, 15, 20, -5, -10, -15, -20, 7, -7, 12, -12, 8, -8];
  const distractors: number[] = [];
  const seen = new Set([correct]);

  for (const offset of offsets) {
    if (distractors.length >= count) break;
    const v = Math.round(correct + offset);
    if (v >= 1 && v <= 99 && !seen.has(v)) {
      distractors.push(v);
      seen.add(v);
    }
  }
  return distractors;
}

/**
 * Generate 3 plausible wrong EV answers (in BB).
 */
export function generateEvDistractors(correct: number, count = 3): number[] {
  const offsets = [2, -2, 4, -4, 3, -3, 6, -6, 1.5, -1.5];
  const distractors: number[] = [];
  const seen = new Set([correct]);

  for (const offset of offsets) {
    if (distractors.length >= count) break;
    const v = Math.round((correct + offset) * 10) / 10;
    if (!seen.has(v)) {
      distractors.push(v);
      seen.add(v);
    }
  }
  return distractors;
}

/** Shuffle an array */
export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Position Labels ────────────────────────────────────────────────────────────

export const POSITION_FULL: Record<string, string> = {
  UTG: 'Under the Gun',
  'UTG+1': 'UTG+1',
  MP: 'Middle Position',
  HJ: 'Hijack',
  CO: 'Cutoff',
  BTN: 'Button',
  SB: 'Small Blind',
  BB: 'Big Blind',
};

export const RANKS_ORDER: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// ─── Hand Type Classification ────────────────────────────────────────────────────

export type HandTypeFilter = 'any' | 'premium' | 'interesting';

const RANK_VAL: Record<string, number> = {
  A: 14, K: 13, Q: 12, J: 11, T: 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
};

/**
 * Classify a hand notation string into premium, interesting, or other.
 * Premium: TT+ pairs, AKs/AQs/AJs/ATs/KQs, AKo/AQo
 * Interesting: 22-99, Axs, suited connectors, one-gappers, AJo-A9o, KQo, KJo, JTo-76o
 * Other: dominated off-suit trash
 */
export function classifyHandType(hand: string): 'premium' | 'interesting' | 'other' {
  if (!hand || hand.length < 2) return 'other';
  const r1 = hand[0];
  const r2 = hand[1];
  const isPair = r1 === r2;
  if (isPair) {
    const v = RANK_VAL[r1] ?? 0;
    return v >= 10 ? 'premium' : 'interesting'; // TT+ = premium, 22-99 = interesting
  }
  const suited = hand.endsWith('s');
  const v1 = RANK_VAL[r1] ?? 0;
  const v2 = RANK_VAL[r2] ?? 0;
  const gap = v1 - v2;
  if (suited) {
    if (r1 === 'A' && v2 >= 10) return 'premium';       // ATs-AKs
    if (r1 === 'K' && r2 === 'Q') return 'premium';      // KQs
    if (r1 === 'A') return 'interesting';                // A2s-A9s
    if (gap === 1) return 'interesting';                 // suited connectors
    if (gap === 2 && v1 >= 6) return 'interesting';      // suited one-gappers
    if (r1 === 'K' && v2 >= 9) return 'interesting';    // KJs/KTs/K9s
    if (r1 === 'Q' && v2 >= 9) return 'interesting';    // QJs/QTs/Q9s
    if (r1 === 'J' && v2 >= 8) return 'interesting';    // JTs/J9s/J8s
    return 'other';
  }
  // Offsuit
  if (r1 === 'A' && r2 === 'K') return 'premium';
  if (r1 === 'A' && r2 === 'Q') return 'premium';
  if (r1 === 'A' && v2 >= 9) return 'interesting';      // AJo/ATo/A9o
  if (r1 === 'K' && r2 === 'Q') return 'interesting';
  if (r1 === 'K' && r2 === 'J') return 'interesting';
  if (gap === 1 && v1 >= 10) return 'interesting';      // JTo/T9o
  if (gap === 1 && v1 >= 7) return 'interesting';       // 98o/87o/76o (borderline)
  return 'other';
}
