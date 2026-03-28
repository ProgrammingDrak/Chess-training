import type { PotOddsScenario } from '../../types/poker';

// Required equity = betSize / (potSize + betSize + betSize) * 100
// (pot before bet + villain bet + hero call)

export const POT_ODDS_SCENARIOS: PotOddsScenario[] = [
  // ─── EASY — Round numbers ────────────────────────────────────────────────────
  {
    id: 'po-1', difficulty: 'easy', street: 'flop',
    potSizeBB: 10, betSizeBB: 10,
    heroHandDescription: 'flush draw (9 outs)',
    boardDescription: 'A♥ 9♥ 3♦',
    outCount: 9,
    requiredEquityPct: 33, // 10 / (10+10+10) = 33%
    estimatedEquityPct: 36,
    correctAnswer: 'call',
    explanation: 'Pot is 10, villain bets 10. Required equity = 10 / (10+10+10) = 33%. Your flush draw has ~9×4 = 36% equity. You have enough equity to call.',
  },
  {
    id: 'po-2', difficulty: 'easy', street: 'turn',
    potSizeBB: 20, betSizeBB: 10,
    heroHandDescription: 'open-ended straight draw (8 outs)',
    boardDescription: 'K♠ J♦ T♣ 3♥',
    outCount: 8,
    requiredEquityPct: 25, // 10/(20+10+10) = 10/40 = 25%
    // Hmm: 10/(20+10+10) = 10/40 = 25%. OESD on turn = 8×2 = 16%. FOLD.
    estimatedEquityPct: 16,
    correctAnswer: 'fold',
    explanation: 'Pot is 20, villain bets 10. Required equity = 10/(20+10+10) = 25%. Your OESD on turn has only 8×2 = 16% equity. Not enough — fold (unless you have implied odds).',
  },
  {
    id: 'po-3', difficulty: 'easy', street: 'flop',
    potSizeBB: 20, betSizeBB: 20,
    heroHandDescription: 'open-ended straight draw (8 outs)',
    boardDescription: '9♠ 8♦ 2♣',
    outCount: 8,
    requiredEquityPct: 33, // 20/(20+20+20) = 33%
    estimatedEquityPct: 32,
    correctAnswer: 'fold',
    explanation: 'Pot is 20, villain bets 20 (pot-sized). Required equity = 33%. OESD on flop = 8×4 = 32%. Very close — technically a marginal fold. With any implied odds, calling becomes okay.',
  },
  {
    id: 'po-4', difficulty: 'easy', street: 'flop',
    potSizeBB: 15, betSizeBB: 5,
    heroHandDescription: 'gutshot straight draw (4 outs)',
    boardDescription: 'K♥ 9♣ 5♦',
    outCount: 4,
    requiredEquityPct: 20, // 5/(15+5+5) = 5/25 = 20%
    estimatedEquityPct: 16,
    correctAnswer: 'fold',
    explanation: 'Pot is 15, villain bets 5. Required equity = 5/25 = 20%. Gutshot on flop = 4×4 = 16%. Not enough equity — fold a gutshot vs a small bet here.',
  },
  {
    id: 'po-5', difficulty: 'easy', street: 'flop',
    potSizeBB: 10, betSizeBB: 5,
    heroHandDescription: 'flush draw (9 outs)',
    boardDescription: 'Q♠ 7♠ 2♦',
    outCount: 9,
    requiredEquityPct: 25, // 5/(10+5+5) = 5/20 = 25%
    estimatedEquityPct: 36,
    correctAnswer: 'call',
    explanation: 'Pot is 10, villain bets 5. Required equity = 5/20 = 25%. Flush draw = 9×4 = 36%. Comfortably profitable call.',
  },

  // ─── EASY-MEDIUM — Non-round but clear ──────────────────────────────────────
  {
    id: 'po-6', difficulty: 'easy', street: 'turn',
    potSizeBB: 30, betSizeBB: 30,
    heroHandDescription: 'flush draw (9 outs)',
    boardDescription: 'A♦ 9♦ 5♣ K♦',
    outCount: 9,
    requiredEquityPct: 33, // 30/(30+30+30) = 33%
    estimatedEquityPct: 18,
    correctAnswer: 'fold',
    explanation: 'Pot is 30, villain bets 30 (pot-sized). Required equity = 33%. On the TURN, flush draw = 9×2 = 18%. Far short — fold.',
  },
  {
    id: 'po-7', difficulty: 'medium', street: 'flop',
    potSizeBB: 12, betSizeBB: 8,
    heroHandDescription: 'pair + flush draw (12 outs)',
    boardDescription: 'J♥ 8♥ 3♦',
    outCount: 12,
    requiredEquityPct: 29, // 8/(12+8+8) = 8/28 ≈ 28.6%
    estimatedEquityPct: 48,
    correctAnswer: 'call',
    explanation: 'Pot is 12, villain bets 8. Required equity ≈ 8/28 = 29%. Pair + flush draw (12 outs) = 12×4 = 48%. Strong call — you have nearly double the required equity.',
  },
  {
    id: 'po-8', difficulty: 'medium', street: 'flop',
    potSizeBB: 18, betSizeBB: 12,
    heroHandDescription: 'open-ended straight draw (8 outs)',
    boardDescription: 'T♠ 9♦ 3♣',
    outCount: 8,
    requiredEquityPct: 29, // 12/(18+12+12) = 12/42 ≈ 28.6%
    estimatedEquityPct: 32,
    correctAnswer: 'call',
    explanation: 'Pot is 18, villain bets 12. Required equity = 12/42 ≈ 29%. OESD on flop = 8×4 = 32%. Slightly profitable call.',
  },
  {
    id: 'po-9', difficulty: 'medium', street: 'turn',
    potSizeBB: 40, betSizeBB: 20,
    heroHandDescription: 'gutshot + overcards (7 outs)',
    boardDescription: '8♣ 5♦ 2♥ K♠',
    outCount: 7,
    requiredEquityPct: 25, // 20/(40+20+20) = 20/80 = 25%
    estimatedEquityPct: 14,
    correctAnswer: 'fold',
    explanation: 'Pot is 40, villain bets 20. Required equity = 25%. Gutshot+overcards on turn = 7×2 = 14%. Not enough equity — fold.',
  },
  {
    id: 'po-10', difficulty: 'medium', street: 'flop',
    potSizeBB: 25, betSizeBB: 15,
    heroHandDescription: 'combo draw: flush + straight (15 outs)',
    boardDescription: '9♥ 8♥ 3♦',
    outCount: 15,
    requiredEquityPct: 27, // 15/(25+15+15) = 15/55 ≈ 27%
    estimatedEquityPct: 60,
    correctAnswer: 'call',
    explanation: 'Pot is 25, villain bets 15. Required equity ≈ 27%. Flush+straight draw (combo draw, 15 outs) = 15×4 = 60%. Monster call — consider raising for protection and value.',
  },

  // ─── MEDIUM ──────────────────────────────────────────────────────────────────
  {
    id: 'po-11', difficulty: 'medium', street: 'flop',
    potSizeBB: 22, betSizeBB: 18,
    heroHandDescription: 'flush draw (9 outs)',
    boardDescription: 'K♦ 7♦ 2♣',
    outCount: 9,
    requiredEquityPct: 31, // 18/(22+18+18) = 18/58 ≈ 31%
    estimatedEquityPct: 36,
    correctAnswer: 'call',
    explanation: 'Pot is 22, villain bets 18. Required equity = 18/58 ≈ 31%. Flush draw = 36%. Profitable call.',
  },
  {
    id: 'po-12', difficulty: 'medium', street: 'turn',
    potSizeBB: 45, betSizeBB: 15,
    heroHandDescription: 'flush draw (9 outs)',
    boardDescription: 'A♠ J♠ 6♥ T♦',
    outCount: 9,
    requiredEquityPct: 20, // 15/(45+15+15) = 15/75 = 20%
    estimatedEquityPct: 18,
    correctAnswer: 'fold',
    explanation: 'Pot is 45, villain bets 15. Required equity = 20%. Flush draw on turn = 9×2 = 18%. Slightly unprofitable — borderline fold unless you have implied odds.',
  },
  {
    id: 'po-13', difficulty: 'medium', street: 'flop',
    potSizeBB: 30, betSizeBB: 10,
    heroHandDescription: 'gutshot straight draw (4 outs)',
    boardDescription: 'A♣ K♦ 9♥',
    outCount: 4,
    requiredEquityPct: 20, // 10/(30+10+10) = 10/50 = 20%
    estimatedEquityPct: 16,
    correctAnswer: 'fold',
    explanation: 'Pot is 30, villain bets 10. Required equity = 20%. Gutshot = 4×4 = 16%. Need implied odds to justify this call.',
  },
  {
    id: 'po-14', difficulty: 'medium', street: 'flop',
    potSizeBB: 14, betSizeBB: 14,
    heroHandDescription: 'two overcards (6 outs)',
    boardDescription: '9♠ 7♦ 3♣',
    outCount: 6,
    requiredEquityPct: 33, // 14/(14+14+14) = 33%
    estimatedEquityPct: 24,
    correctAnswer: 'fold',
    explanation: 'Pot is 14, villain bets 14 (pot-sized). Required equity = 33%. Two overcards only = 6×4 = 24%. Fold against a pot-sized bet.',
  },
  {
    id: 'po-15', difficulty: 'medium', street: 'turn',
    potSizeBB: 35, betSizeBB: 25,
    heroHandDescription: 'open-ended straight draw (8 outs)',
    boardDescription: 'J♦ T♣ 6♥ 2♠',
    outCount: 8,
    requiredEquityPct: 29, // 25/(35+25+25) = 25/85 ≈ 29%
    estimatedEquityPct: 16,
    correctAnswer: 'fold',
    explanation: 'Pot is 35, villain bets 25. Required equity ≈ 29%. OESD on turn = 8×2 = 16%. Significant shortfall — fold.',
  },

  // ─── HARD — Tricky math ──────────────────────────────────────────────────────
  {
    id: 'po-16', difficulty: 'hard', street: 'flop',
    potSizeBB: 33, betSizeBB: 17,
    heroHandDescription: 'flush draw (9 outs)',
    boardDescription: 'Q♣ 8♣ 2♠',
    outCount: 9,
    requiredEquityPct: 25, // 17/(33+17+17) = 17/67 ≈ 25%
    estimatedEquityPct: 36,
    correctAnswer: 'call',
    explanation: 'Pot is 33, villain bets 17. Required equity = 17/67 ≈ 25%. Flush draw = 36%. Good call.',
  },
  {
    id: 'po-17', difficulty: 'hard', street: 'turn',
    potSizeBB: 60, betSizeBB: 40,
    heroHandDescription: 'combo draw: OESD + flush (15 outs)',
    boardDescription: 'J♥ T♥ 9♦ 3♣',
    outCount: 15,
    requiredEquityPct: 29, // 40/(60+40+40) = 40/140 ≈ 29%
    estimatedEquityPct: 30,
    correctAnswer: 'call',
    explanation: 'Pot is 60, villain bets 40. Required equity ≈ 29%. Combo draw on turn = 15×2 = 30%. Marginal profitable call — barely above breakeven.',
  },
  {
    id: 'po-18', difficulty: 'hard', street: 'river',
    potSizeBB: 80, betSizeBB: 60,
    heroHandDescription: 'missed draw (0 outs)',
    boardDescription: 'K♠ Q♦ J♣ T♠ 2♥',
    outCount: 0,
    requiredEquityPct: 30, // 60/(80+60+60) = 60/200 = 30%
    estimatedEquityPct: 0,
    correctAnswer: 'fold',
    explanation: 'Pot is 80, villain bets 60. Required equity = 60/200 = 30%. You missed your draw and have 0 equity to win at showdown. Fold.',
  },
  {
    id: 'po-19', difficulty: 'hard', street: 'flop',
    potSizeBB: 27, betSizeBB: 23,
    heroHandDescription: 'flush draw + pair (11 outs)',
    boardDescription: '8♦ 5♦ 3♣',
    outCount: 11,
    requiredEquityPct: 32, // 23/(27+23+23) = 23/73 ≈ 31.5%
    estimatedEquityPct: 44,
    correctAnswer: 'call',
    explanation: 'Pot is 27, villain bets 23. Required equity ≈ 32%. Flush draw + pair (11 outs) = 11×4 = 44%. Good profitable call.',
  },
  {
    id: 'po-20', difficulty: 'hard', street: 'turn',
    potSizeBB: 55, betSizeBB: 55,
    heroHandDescription: 'flush draw (9 outs)',
    boardDescription: 'A♣ 9♣ 4♦ K♠',
    outCount: 9,
    requiredEquityPct: 33, // 55/(55+55+55) = 33%
    estimatedEquityPct: 18,
    correctAnswer: 'fold',
    explanation: 'Pot is 55, villain bets 55 (pot-sized). Required equity = 33%. Flush draw on TURN = 9×2 = 18%. Large shortfall — fold.',
  },
  {
    id: 'po-21', difficulty: 'hard', street: 'flop',
    potSizeBB: 16, betSizeBB: 8,
    heroHandDescription: 'top pair weak kicker + gutshot (7 outs)',
    boardDescription: 'A♠ 7♥ 6♦',
    outCount: 7,
    requiredEquityPct: 25, // 8/(16+8+8) = 8/32 = 25%
    estimatedEquityPct: 28,
    correctAnswer: 'call',
    explanation: 'Pot is 16, villain bets 8. Required equity = 8/32 = 25%. Pair+gutshot (7 outs) on flop = 7×4 = 28%. Marginal call, but you also have current showdown value.',
  },
  {
    id: 'po-22', difficulty: 'hard', street: 'river',
    potSizeBB: 100, betSizeBB: 100,
    heroHandDescription: 'second pair (checking river showdown value)',
    boardDescription: 'A♠ J♦ 9♣ 7♥ 2♦',
    outCount: 0,
    requiredEquityPct: 33, // 100/(100+100+100) = 33%
    estimatedEquityPct: 25,
    correctAnswer: 'fold',
    explanation: 'Pot is 100, villain bets 100. Required equity = 33%. Second pair has maybe 20-25% equity vs a polar betting range at this size. Fold vs pot-sized river bet.',
  },
  {
    id: 'po-23', difficulty: 'hard', street: 'flop',
    potSizeBB: 42, betSizeBB: 14,
    heroHandDescription: 'backdoor flush draw + overcards (5 outs)',
    boardDescription: 'J♣ 8♦ 3♣',
    outCount: 5,
    requiredEquityPct: 20, // 14/(42+14+14) = 14/70 = 20%
    estimatedEquityPct: 20,
    correctAnswer: 'call',
    explanation: 'Pot is 42, villain bets 14. Required equity = 14/70 = 20%. With backdoor draws + overcards (~5 outs) = 5×4 = 20%. Breakeven call — add implied odds if any.',
  },
  {
    id: 'po-24', difficulty: 'hard', street: 'turn',
    potSizeBB: 22, betSizeBB: 18,
    heroHandDescription: 'flush draw (9 outs)',
    boardDescription: 'K♦ 8♦ 5♣ J♦',
    outCount: 9,
    requiredEquityPct: 31, // 18/(22+18+18) = 18/58 ≈ 31%
    estimatedEquityPct: 18,
    correctAnswer: 'fold',
    explanation: 'Pot is 22, villain bets 18. Required equity ≈ 31%. Flush draw on TURN = 9×2 = 18%. Don\'t confuse turn/flop — on the turn use ×2, not ×4.',
  },
  {
    id: 'po-25', difficulty: 'hard', street: 'flop',
    potSizeBB: 50, betSizeBB: 50,
    heroHandDescription: 'open-ended straight draw + flush draw (15 outs)',
    boardDescription: 'T♥ 9♥ 4♠',
    outCount: 15,
    requiredEquityPct: 33, // 50/(50+50+50) = 33%
    estimatedEquityPct: 60,
    correctAnswer: 'call',
    explanation: 'Pot is 50, villain bets 50 (pot-sized). Required equity = 33%. Combo draw (15 outs) = 15×4 = 60%. Strong call — even consider raising as a semi-bluff.',
  },
];
