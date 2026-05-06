import type { Card, Rank, Suit } from '../types/poker';
import { RANKS_ORDER } from './poker';

export const EXACT_CARD_RANKS: Rank[] = RANKS_ORDER;
export const EXACT_CARD_SUITS: Suit[] = ['s', 'h', 'd', 'c'];

export interface CardInputResult {
  cards: Card[];
  error: string | null;
}

const RANK_SET = new Set<string>(EXACT_CARD_RANKS);
const SUIT_SET = new Set<string>(EXACT_CARD_SUITS);

export function cardKey(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

function normalizeCardInput(raw: string): string {
  return raw
    .replace(/10/gi, 'T')
    .replace(/[♠♤]/g, 's')
    .replace(/[♥♡]/g, 'h')
    .replace(/[♦♢]/g, 'd')
    .replace(/[♣♧]/g, 'c')
    .replace(/spades?/gi, 's')
    .replace(/hearts?/gi, 'h')
    .replace(/diamonds?/gi, 'd')
    .replace(/clubs?/gi, 'c')
    .replace(/[^AKQJT2-9SHDC]/gi, '')
    .toUpperCase();
}

export function parseExactCardInput(raw: string, maxCards = 52): CardInputResult {
  const normalized = normalizeCardInput(raw);
  if (!normalized) return { cards: [], error: null };

  if (normalized.length % 2 !== 0) {
    return { cards: [], error: 'Use rank + suit for each card, like As Kd.' };
  }

  const cards: Card[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < normalized.length; i += 2) {
    const rank = normalized[i];
    const suit = normalized[i + 1].toLowerCase();

    if (!RANK_SET.has(rank) || !SUIT_SET.has(suit)) {
      return { cards: [], error: 'Use ranks A-K-Q-J-T-9...2 and suits s-h-d-c.' };
    }

    const card = { rank: rank as Rank, suit: suit as Suit };
    const key = cardKey(card);
    if (seen.has(key)) {
      return { cards: [], error: 'A card can only be selected once.' };
    }

    seen.add(key);
    cards.push(card);
  }

  if (cards.length > maxCards) {
    return { cards: [], error: `Pick ${maxCards} card${maxCards === 1 ? '' : 's'} or fewer.` };
  }

  return { cards, error: null };
}
