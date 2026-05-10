import { describe, expect, it } from 'vitest';
import { analyzeNextCardImpacts, calculateSpecificHoldemEquity } from './holdemEquity';
import type { Card } from '../types/poker';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

describe('calculateSpecificHoldemEquity', () => {
  it('calculates exact by-river equity for two specific hands on the flop', () => {
    const result = calculateSpecificHoldemEquity(
      [
        { id: 'hero', name: 'Hero', cards: [c('A', 's'), c('K', 's')] },
        { id: 'villain-1', name: 'Villain 1', cards: [c('Q', 'h'), c('Q', 'd')] },
      ],
      [c('A', 'h'), c('7', 'c'), c('2', 'd')],
    );

    expect(result.available).toBe(true);
    expect(result.exact).toBe(true);
    expect(result.samples).toBe(990);

    const totalEquity = result.players.reduce((sum, player) => sum + player.equityPct, 0);
    expect(totalEquity).toBeCloseTo(100, 5);
  });

  it('splits equity among tied winners on the river', () => {
    const result = calculateSpecificHoldemEquity(
      [
        { id: 'hero', name: 'Hero', cards: [c('A', 's'), c('K', 's')] },
        { id: 'villain-1', name: 'Villain 1', cards: [c('A', 'h'), c('K', 'h')] },
      ],
      [c('Q', 'c'), c('J', 'd'), c('T', 'c'), c('2', 's'), c('3', 'd')],
    );

    expect(result.samples).toBe(1);
    expect(result.players[0].equityPct).toBeCloseTo(50, 5);
    expect(result.players[1].equityPct).toBeCloseTo(50, 5);
    expect(result.players[0].tiePct).toBeCloseTo(100, 5);
    expect(result.players[1].tiePct).toBeCloseTo(100, 5);
  });

  it('supports multiway exact hands', () => {
    const result = calculateSpecificHoldemEquity(
      [
        { id: 'hero', name: 'Hero', cards: [c('A', 's'), c('A', 'd')] },
        { id: 'villain-1', name: 'Villain 1', cards: [c('K', 's'), c('K', 'd')] },
        { id: 'villain-2', name: 'Villain 2', cards: [c('Q', 's'), c('Q', 'd')] },
      ],
      [c('2', 'c'), c('7', 'h'), c('T', 'd'), c('J', 'c')],
    );

    expect(result.available).toBe(true);
    expect(result.samples).toBe(42);
    expect(result.players).toHaveLength(3);
  });
});

describe('analyzeNextCardImpacts', () => {
  it('does not count every blank as a straight impact when Hero already flopped a straight', () => {
    const result = analyzeNextCardImpacts(
      [c('7', 'c'), c('J', 's')],
      [{ id: 'villain-1', name: 'Villain 1', cards: [c('A', 's'), c('K', 'd')] }],
      [c('9', 'h'), c('8', 'h'), c('T', 'c')],
    );

    expect(result.available).toBe(true);
    expect(result.currentHeroHandClass).toBe('Straight');
    expect(result.impacts.length).toBeLessThan(47);
    expect(result.impacts.some(impact => (
      impact.category === 'hero-upgrade' && impact.handClass === 'Straight'
    ))).toBe(false);
  });

  it('groups next cards that let a villain beat Hero as danger cards', () => {
    const result = analyzeNextCardImpacts(
      [c('7', 'c'), c('J', 's')],
      [{ id: 'villain-1', name: 'Villain 1', cards: [c('A', 'h'), c('K', 'h')] }],
      [c('9', 'h'), c('8', 'h'), c('T', 'c')],
    );

    const danger = result.impacts.filter(impact => impact.category === 'danger');
    expect(danger.length).toBeGreaterThan(0);
    expect(danger.every(impact => impact.affectedPlayerName === 'Villain 1')).toBe(true);
    expect(danger.every(impact => impact.handClass === 'Flush')).toBe(true);
  });

  it('groups next cards that let a villain chop separately from danger cards', () => {
    const result = analyzeNextCardImpacts(
      [c('7', 'c'), c('J', 'c')],
      [{ id: 'villain-1', name: 'Villain 1', cards: [c('7', 'd'), c('2', 'd')] }],
      [c('9', 'h'), c('8', 'h'), c('T', 'c')],
    );

    const chopCards = result.impacts.filter(impact => impact.category === 'chop').map(impact => impact.card);
    const dangerCards = result.impacts.filter(impact => impact.category === 'danger').map(impact => impact.card);

    expect(chopCards).toEqual(expect.arrayContaining([
      c('J', 's'),
      c('J', 'd'),
      c('J', 'h'),
    ]));
    expect(dangerCards).not.toEqual(expect.arrayContaining([
      c('J', 's'),
      c('J', 'd'),
      c('J', 'h'),
    ]));
  });

  it('groups Hero cards that upgrade to a stronger hand class separately', () => {
    const result = analyzeNextCardImpacts(
      [c('7', 'h'), c('J', 'h')],
      [{ id: 'villain-1', name: 'Villain 1', cards: [c('A', 's'), c('K', 'd')] }],
      [c('9', 'h'), c('8', 'h'), c('T', 'c')],
    );

    const heroUpgrades = result.impacts.filter(impact => impact.category === 'hero-upgrade');
    expect(heroUpgrades.length).toBeGreaterThan(0);
    expect(heroUpgrades.every(impact => impact.affectedPlayerName === 'Hero')).toBe(true);
    expect(heroUpgrades.some(impact => impact.handClass === 'Flush')).toBe(true);
  });
});
