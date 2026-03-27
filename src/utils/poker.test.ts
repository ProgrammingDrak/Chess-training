import { describe, it, expect } from 'vitest';
import {
  isRedSuit,
  cardLabel,
  calcRequiredEquity,
  rule4,
  rule2,
  calcEV,
  generatePctDistractors,
  generateEvDistractors,
  shuffle,
  classifyHandType,
} from './poker';

describe('isRedSuit', () => {
  it('returns true for hearts and diamonds', () => {
    expect(isRedSuit('h')).toBe(true);
    expect(isRedSuit('d')).toBe(true);
  });
  it('returns false for spades and clubs', () => {
    expect(isRedSuit('s')).toBe(false);
    expect(isRedSuit('c')).toBe(false);
  });
});

describe('cardLabel', () => {
  it('formats card with suit symbol', () => {
    expect(cardLabel({ rank: 'A', suit: 's' })).toBe('A♠');
    expect(cardLabel({ rank: 'K', suit: 'h' })).toBe('K♥');
  });
});

describe('calcRequiredEquity', () => {
  it('calculates pot odds correctly', () => {
    // Pot 100, bet 50 → need 50/(100+50+50) = 25%
    expect(calcRequiredEquity(100, 50)).toBeCloseTo(25, 1);
  });
  it('handles half-pot bet', () => {
    // Pot 100, bet 50 → 25%
    expect(calcRequiredEquity(100, 50)).toBeCloseTo(25, 1);
  });
  it('handles pot-size bet', () => {
    // Pot 100, bet 100 → 100/300 = 33.3%
    expect(calcRequiredEquity(100, 100)).toBeCloseTo(33.33, 1);
  });
});

describe('rule4 / rule2', () => {
  it('rule4 multiplies outs by 4', () => {
    expect(rule4(9)).toBe(36); // flush draw
    expect(rule4(15)).toBe(60);
  });
  it('rule2 multiplies outs by 2', () => {
    expect(rule2(9)).toBe(18);
  });
});

describe('calcEV', () => {
  it('computes weighted EV', () => {
    const ev = calcEV([
      { probability: 0.5, netValueBB: 10 },
      { probability: 0.5, netValueBB: -6 },
    ]);
    expect(ev).toBeCloseTo(2, 1);
  });
  it('returns 0 for empty outcomes', () => {
    expect(calcEV([])).toBe(0);
  });
});

describe('generatePctDistractors', () => {
  it('returns 3 distractors by default', () => {
    const d = generatePctDistractors(50);
    expect(d).toHaveLength(3);
    d.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(99);
      expect(v).not.toBe(50);
    });
  });
  it('avoids duplicates', () => {
    const d = generatePctDistractors(50);
    expect(new Set(d).size).toBe(d.length);
  });
});

describe('generateEvDistractors', () => {
  it('returns 3 distractors', () => {
    const d = generateEvDistractors(5);
    expect(d).toHaveLength(3);
    d.forEach((v) => expect(v).not.toBe(5));
  });
});

describe('shuffle', () => {
  it('preserves array length and elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled).toHaveLength(5);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('does not mutate the original array', () => {
    const arr = [1, 2, 3];
    shuffle(arr);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe('classifyHandType', () => {
  it('classifies premium pairs', () => {
    expect(classifyHandType('AA')).toBe('premium');
    expect(classifyHandType('KK')).toBe('premium');
    expect(classifyHandType('TT')).toBe('premium');
  });
  it('classifies small pairs as interesting', () => {
    expect(classifyHandType('99')).toBe('interesting');
    expect(classifyHandType('22')).toBe('interesting');
  });
  it('classifies premium suited hands', () => {
    expect(classifyHandType('AKs')).toBe('premium');
    expect(classifyHandType('ATs')).toBe('premium');
    expect(classifyHandType('KQs')).toBe('premium');
  });
  it('classifies suited connectors as interesting', () => {
    expect(classifyHandType('JTs')).toBe('interesting');
    expect(classifyHandType('98s')).toBe('interesting');
  });
  it('classifies AKo as premium', () => {
    expect(classifyHandType('AKo')).toBe('premium');
    expect(classifyHandType('AQo')).toBe('premium');
  });
  it('classifies trash as other', () => {
    expect(classifyHandType('72o')).toBe('other');
    expect(classifyHandType('83o')).toBe('other');
  });
  it('handles empty/invalid input', () => {
    expect(classifyHandType('')).toBe('other');
    expect(classifyHandType('A')).toBe('other');
  });
});
