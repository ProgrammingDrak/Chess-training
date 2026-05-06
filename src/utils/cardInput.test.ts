import { describe, expect, it } from 'vitest';
import { parseExactCardInput } from './cardInput';

describe('parseExactCardInput', () => {
  it('parses compact poker shorthand', () => {
    expect(parseExactCardInput('AsKd', 2).cards).toEqual([
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 'd' },
    ]);
  });

  it('parses spaced text, 10 aliases, and suit symbols', () => {
    expect(parseExactCardInput('10♠ 9♥', 2).cards).toEqual([
      { rank: 'T', suit: 's' },
      { rank: '9', suit: 'h' },
    ]);
  });

  it('rejects duplicate cards', () => {
    expect(parseExactCardInput('Ah Ah', 2).error).toBe('A card can only be selected once.');
  });

  it('rejects too many cards for a bounded picker', () => {
    expect(parseExactCardInput('As Kd Qh', 2).error).toBe('Pick 2 cards or fewer.');
  });
});
