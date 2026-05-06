import { describe, it, expect } from 'vitest';
import { POT_ODDS_SCENARIOS } from './potOddsScenarios';
import { EQUITY_SCENARIOS } from './equityScenarios';
import { EV_SCENARIOS } from './evScenarios';
import { HAND_SELECTION_SCENARIOS } from './handSelectionData';
import { BET_SIZING_SCENARIOS } from './betSizingScenarios';
import { EIGHT_MAX_GTO_RFI_CHART, FIVE_MAX_GTO_RFI_CHART, FOUR_MAX_GTO_RFI_CHART, HEADS_UP_GTO_CHART, NINE_MAX_GTO_RFI_CHART, SEVEN_MAX_GTO_RFI_CHART, SIX_MAX_GTO_RFI_CHART, THREE_MAX_GTO_RFI_CHART, getGtoChartEntry } from './profileTemplates';
import { handCombos } from '../../utils/handMatrix';

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

describe('6-max GTO RFI chart', () => {
  it('covers each six-max position in table order', () => {
    expect(SIX_MAX_GTO_RFI_CHART.map(entry => entry.position)).toEqual([
      'UTG',
      'HJ',
      'CO',
      'BTN',
      'SB',
      'BB',
    ]);
  });

  it('keeps published ranges close to their combo percentages', () => {
    for (const entry of SIX_MAX_GTO_RFI_CHART) {
      if (entry.publishedPct === null) continue;
      const chartCombos = Object.entries(entry.range)
        .filter(([, action]) => action === 'call' || action === 'raise')
        .reduce((sum, [hand]) => sum + handCombos(hand), 0);
      expect(Math.abs((chartCombos / 1326) * 100 - entry.publishedPct)).toBeLessThan(1);
    }
  });

  it('marks representative boundary hands correctly', () => {
    const byPos = Object.fromEntries(SIX_MAX_GTO_RFI_CHART.map(entry => [entry.position, entry]));

    expect(byPos.UTG.range['66']).toBe('call');
    expect(byPos.UTG.range['55']).toBe('fold');
    expect(byPos.UTG.range['A3s']).toBe('call');
    expect(byPos.UTG.range['A2s']).toBe('fold');
    expect(byPos.UTG.range['AKs']).toBe('raise');

    expect(byPos.HJ.range['76s']).toBe('call');
    expect(byPos.HJ.range['65s']).toBe('limp');

    expect(byPos.CO.range['A8o']).toBe('call');
    expect(byPos.CO.range['A7o']).toBe('fold');

    expect(byPos.BTN.range['K8o']).toBe('call');
    expect(byPos.BTN.range['K7o']).toBe('limp');
    expect(byPos.BTN.range['K5o']).toBe('limp');

    expect(byPos.SB.range['Q5o']).toBe('call');
    expect(byPos.SB.range['Q4o']).toBe('limp');
    expect(byPos.SB.range['93s']).toBe('fold');
  });

  it('shows BB blind defense instead of an all-fold RFI row', () => {
    const bb = SIX_MAX_GTO_RFI_CHART.find(entry => entry.position === 'BB');
    expect(bb?.publishedPct).toBeNull();
    expect(bb?.range['A2s']).toBe('call');
    expect(bb?.range['AKs']).toBe('raise');
    expect(bb?.range['K2o']).toBe('limp');
    expect(bb?.range['72o']).toBe('fold');
  });
});

describe('5-max GTO chart', () => {
  it('covers each five-max position in table order', () => {
    expect(FIVE_MAX_GTO_RFI_CHART.map(entry => entry.position)).toEqual([
      'HJ',
      'CO',
      'BTN',
      'SB',
      'BB',
    ]);
  });

  it('uses researched chart lookup for five-max spots', () => {
    expect(getGtoChartEntry(5, 'HJ')?.range['76s']).toBe('call');
    expect(getGtoChartEntry(5, 'CO')?.range['A8o']).toBe('call');
    expect(getGtoChartEntry(5, 'BTN')?.range['K7o']).toBe('limp');
    expect(getGtoChartEntry(5, 'SB')?.range['Q4o']).toBe('limp');
    expect(getGtoChartEntry(5, 'BB')?.range['A2s']).toBe('call');
  });

  it('does not expose a five-max UTG chart', () => {
    expect(getGtoChartEntry(5, 'UTG')).toBeNull();
  });

  it('maps five-max to the same named short-handed seats, not to tighter early-position ranges', () => {
    for (const position of ['HJ', 'CO', 'BTN', 'SB', 'BB']) {
      expect(getGtoChartEntry(5, position)?.range).toEqual(getGtoChartEntry(6, position)?.range);
    }
  });
});

describe('4-max GTO chart', () => {
  it('covers each four-max position in table order', () => {
    expect(FOUR_MAX_GTO_RFI_CHART.map(entry => entry.position)).toEqual([
      'CO',
      'BTN',
      'SB',
      'BB',
    ]);
  });

  it('uses researched chart lookup for four-max spots', () => {
    expect(getGtoChartEntry(4, 'CO')?.range['A8o']).toBe('call');
    expect(getGtoChartEntry(4, 'BTN')?.range['K7o']).toBe('limp');
    expect(getGtoChartEntry(4, 'SB')?.range['Q4o']).toBe('limp');
    expect(getGtoChartEntry(4, 'BB')?.range['AKs']).toBe('raise');
  });

  it('does not expose earlier seats at four-max', () => {
    expect(getGtoChartEntry(4, 'UTG')).toBeNull();
    expect(getGtoChartEntry(4, 'HJ')).toBeNull();
  });

  it('maps four-max to the same named late/blind seats, not tighter early-position ranges', () => {
    for (const position of ['CO', 'BTN', 'SB', 'BB']) {
      expect(getGtoChartEntry(4, position)?.range).toEqual(getGtoChartEntry(6, position)?.range);
    }
  });
});

describe('3-max GTO chart', () => {
  it('covers each three-max position in table order', () => {
    expect(THREE_MAX_GTO_RFI_CHART.map(entry => entry.position)).toEqual([
      'BTN',
      'SB',
      'BB',
    ]);
  });

  it('uses researched chart lookup for three-max spots', () => {
    expect(getGtoChartEntry(3, 'BTN')?.range['K7o']).toBe('limp');
    expect(getGtoChartEntry(3, 'SB')?.range['Q4o']).toBe('limp');
    expect(getGtoChartEntry(3, 'BB')?.range['AKs']).toBe('raise');
  });

  it('does not expose earlier seats at three-max', () => {
    expect(getGtoChartEntry(3, 'UTG')).toBeNull();
    expect(getGtoChartEntry(3, 'HJ')).toBeNull();
    expect(getGtoChartEntry(3, 'CO')).toBeNull();
  });

  it('maps three-max to the same named late/blind seats', () => {
    for (const position of ['BTN', 'SB', 'BB']) {
      expect(getGtoChartEntry(3, position)?.range).toEqual(getGtoChartEntry(6, position)?.range);
    }
  });
});

describe('heads-up GTO chart', () => {
  it('covers only the two heads-up positions in table order', () => {
    expect(HEADS_UP_GTO_CHART.map(entry => entry.position)).toEqual([
      'BTN',
      'BB',
    ]);
  });

  it('uses a heads-up-specific BTN/SB opening range', () => {
    const btn = getGtoChartEntry(2, 'BTN');
    expect(btn?.range['AA']).toBe('raise');
    expect(btn?.range['K2o']).toBe('limp');
    expect(btn?.range['J6o']).toBe('limp');
    expect(btn?.range['Q2o']).toBe('limp');
    expect(btn?.range['Q8o']).toBe('call');
    expect(btn?.range['72o']).toBe('fold');
  });

  it('uses a heads-up-specific BB defense range', () => {
    const bb = getGtoChartEntry(2, 'BB');
    expect(bb?.range['AKs']).toBe('raise');
    expect(bb?.range['Q6o']).toBe('call');
    expect(bb?.range['Q2o']).toBe('limp');
    expect(bb?.range['72o']).toBe('fold');
  });

  it('does not expose non-heads-up positions at two-max', () => {
    expect(getGtoChartEntry(2, 'SB')).toBeNull();
    expect(getGtoChartEntry(2, 'CO')).toBeNull();
    expect(getGtoChartEntry(2, 'UTG')).toBeNull();
  });
});

describe('GTO chart structure audit', () => {
  const tableSizes = [2, 3, 4, 5, 6, 7, 8, 9];
  const validActions = new Set(['fold', 'limp', 'call', 'raise']);

  it('every generated position has a complete 169-hand matrix with known actions', () => {
    for (const tableSize of tableSizes) {
      for (const position of ['BTN', 'SB', 'BB', 'CO', 'HJ', 'LJ', 'UTG', 'UTG+1', 'UTG+2']) {
        const entry = getGtoChartEntry(tableSize, position);
        if (!entry) continue;
        expect(Object.keys(entry.range).length).toBe(169);
        expect(Object.values(entry.range).every(action => validActions.has(action))).toBe(true);
      }
    }
  });

  it('does not put cheap-flop limps in early positions', () => {
    for (const tableSize of [6, 7, 8, 9]) {
      for (const position of ['UTG', 'UTG+1', 'UTG+2', 'LJ']) {
        const entry = getGtoChartEntry(tableSize, position);
        if (!entry) continue;
        expect(Object.values(entry.range).some(action => action === 'limp')).toBe(false);
      }
    }
  });

  it('keeps the opening chart wider as fewer players remain behind', () => {
    const openPct = (tableSize: number, position: string) => {
      const entry = getGtoChartEntry(tableSize, position);
      if (!entry) return 0;
      const combos = Object.entries(entry.range)
        .filter(([, action]) => action === 'call' || action === 'raise')
        .reduce((sum, [hand]) => sum + handCombos(hand), 0);
      return combos / 1326;
    };

    expect(openPct(9, 'UTG')).toBeLessThan(openPct(8, 'UTG'));
    expect(openPct(8, 'UTG')).toBeLessThan(openPct(7, 'UTG'));
    expect(openPct(7, 'UTG')).toBeLessThan(openPct(6, 'UTG'));
    expect(openPct(6, 'UTG')).toBeLessThan(openPct(6, 'HJ'));
    expect(openPct(6, 'HJ')).toBeLessThan(openPct(6, 'CO'));
    expect(openPct(6, 'CO')).toBeLessThan(openPct(6, 'BTN'));
  });
});

describe('7-max GTO chart', () => {
  it('covers each seven-max position in table order', () => {
    expect(SEVEN_MAX_GTO_RFI_CHART.map(entry => entry.position)).toEqual([
      'UTG',
      'LJ',
      'HJ',
      'CO',
      'BTN',
      'SB',
      'BB',
    ]);
  });

  it('adds a tighter first-position range before the six-max seats', () => {
    const utg = getGtoChartEntry(7, 'UTG');
    expect(utg?.range['77']).toBe('call');
    expect(utg?.range['66']).toBe('call');
    expect(utg?.range['A5s']).toBe('call');
    expect(utg?.range['A4s']).toBe('call');
    expect(utg?.range['A3s']).toBe('fold');
  });

  it('maps seven-max LJ to the six-max earliest open range', () => {
    expect(getGtoChartEntry(7, 'LJ')?.range).toEqual(getGtoChartEntry(6, 'UTG')?.range);
  });

  it('keeps named later seats aligned with six-max', () => {
    for (const position of ['HJ', 'CO', 'BTN', 'SB', 'BB']) {
      expect(getGtoChartEntry(7, position)?.range).toEqual(getGtoChartEntry(6, position)?.range);
    }
  });
});

describe('8-max GTO chart', () => {
  it('covers each eight-max position in table order', () => {
    expect(EIGHT_MAX_GTO_RFI_CHART.map(entry => entry.position)).toEqual([
      'UTG',
      'UTG+1',
      'LJ',
      'HJ',
      'CO',
      'BTN',
      'SB',
      'BB',
    ]);
  });

  it('adds a tighter first-position range before the seven-max first seat', () => {
    const utg = getGtoChartEntry(8, 'UTG');
    expect(utg?.range['88']).toBe('call');
    expect(utg?.range['77']).toBe('call');
    expect(utg?.range['A9s']).toBe('call');
    expect(utg?.range['A8s']).toBe('call');
    expect(utg?.range['A4s']).toBe('fold');
  });

  it('maps eight-max UTG+1 to the seven-max UTG range', () => {
    expect(getGtoChartEntry(8, 'UTG+1')?.range).toEqual(getGtoChartEntry(7, 'UTG')?.range);
  });

  it('keeps named later seats aligned with established shorter-table ranges', () => {
    expect(getGtoChartEntry(8, 'LJ')?.range).toEqual(getGtoChartEntry(6, 'UTG')?.range);
    for (const position of ['HJ', 'CO', 'BTN', 'SB', 'BB']) {
      expect(getGtoChartEntry(8, position)?.range).toEqual(getGtoChartEntry(6, position)?.range);
    }
  });
});

describe('9-max GTO chart', () => {
  it('covers each full-ring position in table order', () => {
    expect(NINE_MAX_GTO_RFI_CHART.map(entry => entry.position)).toEqual([
      'UTG',
      'UTG+1',
      'UTG+2',
      'LJ',
      'HJ',
      'CO',
      'BTN',
      'SB',
      'BB',
    ]);
  });

  it('adds the tightest full-ring UTG range', () => {
    const utg = getGtoChartEntry(9, 'UTG');
    expect(utg?.range['99']).toBe('call');
    expect(utg?.range['88']).toBe('call');
    expect(utg?.range['A9s']).toBe('call');
    expect(utg?.range['A8s']).toBe('fold');
    expect(utg?.range['KQs']).toBe('call');
    expect(utg?.range['KJs']).toBe('call');
  });

  it('steps UTG+1 and UTG+2 back toward shorter-table early ranges', () => {
    expect(getGtoChartEntry(9, 'UTG+1')?.range).toEqual(getGtoChartEntry(8, 'UTG')?.range);
    expect(getGtoChartEntry(9, 'UTG+2')?.range).toEqual(getGtoChartEntry(7, 'UTG')?.range);
  });

  it('keeps later named positions aligned with established shorter-table ranges', () => {
    expect(getGtoChartEntry(9, 'LJ')?.range).toEqual(getGtoChartEntry(6, 'UTG')?.range);
    for (const position of ['HJ', 'CO', 'BTN', 'SB', 'BB']) {
      expect(getGtoChartEntry(9, position)?.range).toEqual(getGtoChartEntry(6, position)?.range);
    }
  });
});
