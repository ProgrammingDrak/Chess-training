import { describe, it, expect } from 'vitest';
import {
  BASIC_STRATEGY_SCENARIOS,
  CARD_COUNTING_SCENARIOS,
  TRUE_COUNT_SCENARIOS,
  BET_SPREAD_SCENARIOS,
} from './index';

// Hi-Lo point values
function hiLoValue(card: string): number {
  if (['2', '3', '4', '5', '6'].includes(card)) return 1;
  if (['7', '8', '9'].includes(card)) return 0;
  if (['T', 'J', 'Q', 'K', 'A'].includes(card)) return -1;
  throw new Error(`Unknown card: ${card}`);
}

describe('Basic Strategy Scenarios', () => {
  it('all have unique IDs', () => {
    const ids = BASIC_STRATEGY_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  BASIC_STRATEGY_SCENARIOS.forEach((s) => {
    it(`${s.id}: correctAction is in acceptableActions`, () => {
      expect(s.acceptableActions).toContain(s.correctAction);
    });

    it(`${s.id}: has exactly 2 player cards`, () => {
      expect(s.playerCards).toHaveLength(2);
    });

    it(`${s.id}: has valid handType`, () => {
      expect(['hard', 'soft', 'pair']).toContain(s.handType);
    });
  });
});

describe('Card Counting Scenarios', () => {
  it('all have unique IDs', () => {
    const ids = CARD_COUNTING_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  CARD_COUNTING_SCENARIOS.forEach((s) => {
    it(`${s.id}: computed count matches correctCount`, () => {
      const computed = s.startingCount + s.cards.reduce((sum, c) => sum + hiLoValue(c), 0);
      expect(computed).toBe(s.correctCount);
    });
  });
});

describe('True Count Scenarios', () => {
  it('all have unique IDs', () => {
    const ids = TRUE_COUNT_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  TRUE_COUNT_SCENARIOS.forEach((s) => {
    it(`${s.id}: correctTrueCount matches RC / decks remaining`, () => {
      const computed = Math.round(s.runningCount / s.decksRemaining);
      expect(computed).toBe(s.correctTrueCount);
    });

    it(`${s.id}: correctTrueCount is in options`, () => {
      expect(s.options).toContain(s.correctTrueCount);
    });
  });
});

describe('Bet Spread Scenarios', () => {
  it('all have unique IDs', () => {
    const ids = BET_SPREAD_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  BET_SPREAD_SCENARIOS.forEach((s) => {
    it(`${s.id}: correctMultiplier follows 1-2-4-8 spread rule`, () => {
      let expected: number;
      if (s.trueCount <= 1) expected = 1;
      else if (s.trueCount === 2) expected = 2;
      else if (s.trueCount === 3) expected = 4;
      else expected = 8;
      expect(s.correctMultiplier).toBe(expected);
    });
  });
});
