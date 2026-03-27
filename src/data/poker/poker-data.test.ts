import { describe, it, expect } from 'vitest';
import { POT_ODDS_SCENARIOS } from './potOddsScenarios';
import { EQUITY_SCENARIOS } from './equityScenarios';
import { EV_SCENARIOS } from './evScenarios';
import { HAND_SELECTION_SCENARIOS } from './handSelectionData';
import { BET_SIZING_SCENARIOS } from './betSizingScenarios';

describe('Pot Odds Scenarios', () => {
  it('all have unique IDs', () => {
    const ids = POT_ODDS_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  POT_ODDS_SCENARIOS.forEach((s) => {
    it(`${s.id}: requiredEquityPct matches pot odds formula`, () => {
      const computed = Math.round((s.betSizeBB / (s.potSizeBB + s.betSizeBB + s.betSizeBB)) * 100);
      expect(s.requiredEquityPct).toBe(computed);
    });

    it(`${s.id}: correctAnswer matches equity vs required`, () => {
      const expected = s.estimatedEquityPct >= s.requiredEquityPct ? 'call' : 'fold';
      expect(s.correctAnswer).toBe(expected);
    });
  });
});

describe('Equity Estimation Scenarios', () => {
  it('all have unique IDs', () => {
    const ids = EQUITY_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  EQUITY_SCENARIOS.forEach((s) => {
    it(`${s.id}: equityEstimatePct matches rule of 4/2`, () => {
      const multiplier = s.ruleMethod === 'x4' ? 4 : 2;
      const computed = s.outCount * multiplier;
      expect(s.equityEstimatePct).toBe(computed);
    });
  });
});

describe('EV Scenarios', () => {
  it('all have unique IDs', () => {
    const ids = EV_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  EV_SCENARIOS.forEach((s) => {
    it(`${s.id}: probabilities sum to ~1.0`, () => {
      const sum = s.outcomes.reduce((acc, o) => acc + o.probability, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    });

    it(`${s.id}: correctEvBB matches computed EV within tolerance`, () => {
      const computed = s.outcomes.reduce((acc, o) => acc + o.probability * o.netValueBB, 0);
      expect(s.correctEvBB).toBeCloseTo(computed, 0);
    });
  });
});

describe('Hand Selection Scenarios', () => {
  it('all have unique IDs', () => {
    const ids = HAND_SELECTION_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  HAND_SELECTION_SCENARIOS.forEach((s) => {
    it(`${s.id}: correctAction is in acceptableActions`, () => {
      expect(s.acceptableActions).toContain(s.correctAction);
    });
  });
});

describe('Bet Sizing Scenarios', () => {
  it('all have unique IDs', () => {
    const ids = BET_SIZING_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  BET_SIZING_SCENARIOS.forEach((s) => {
    it(`${s.id}: correctOption is in options`, () => {
      expect(s.options).toContain(s.correctOption);
    });

    it(`${s.id}: correctOption is in acceptableOptions`, () => {
      expect(s.acceptableOptions).toContain(s.correctOption);
    });
  });
});
