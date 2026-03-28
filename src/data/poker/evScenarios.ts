import type { EvScenario } from '../../types/poker';

// EV = Σ(probability × netValueBB)

export const EV_SCENARIOS: EvScenario[] = [
  // ─── EASY — Simple 2-outcome scenarios ──────────────────────────────────────
  {
    id: 'ev-1', difficulty: 'easy',
    scenarioDescription: 'Preflop shove with AA vs a calling range',
    potBeforeActionBB: 3,
    heroActionDescription: 'Shove 100BB total',
    outcomes: [
      { description: 'Villain calls, hero wins (80% equity)', probability: 0.80, netValueBB: 100 },
      { description: 'Villain calls, hero loses (20% equity)', probability: 0.20, netValueBB: -100 },
    ],
    correctEvBB: 60.0, // 0.80×100 + 0.20×(-100) = 80-20 = 60
    toleranceBB: 3,
    explanation: 'EV = (0.80 × 100) + (0.20 × -100) = 80 - 20 = +60 BB. Shoving AA with 80% equity is extremely profitable.',
  },
  {
    id: 'ev-2', difficulty: 'easy',
    scenarioDescription: 'River bluff — bet 20BB into a 30BB pot',
    potBeforeActionBB: 30,
    heroActionDescription: 'Bet 20BB as a bluff',
    outcomes: [
      { description: 'Villain folds (estimated 60% of the time)', probability: 0.60, netValueBB: 30 },
      { description: 'Villain calls, hero loses (missed draw)', probability: 0.40, netValueBB: -20 },
    ],
    correctEvBB: 10.0, // 0.60×30 + 0.40×(-20) = 18-8 = 10
    toleranceBB: 2,
    explanation: 'EV = (0.60 × 30) + (0.40 × -20) = 18 - 8 = +10 BB. The bluff is profitable because villain folds often enough.',
  },
  {
    id: 'ev-3', difficulty: 'easy',
    scenarioDescription: '50/50 coinflip — all-in preflop',
    potBeforeActionBB: 4,
    heroActionDescription: 'Call all-in for 50BB total',
    outcomes: [
      { description: 'Win the pot', probability: 0.50, netValueBB: 50 },
      { description: 'Lose the pot', probability: 0.50, netValueBB: -50 },
    ],
    correctEvBB: 0.0, // 0.50×50 + 0.50×(-50) = 0
    toleranceBB: 1,
    explanation: 'EV = (0.50 × 50) + (0.50 × -50) = 25 - 25 = 0. A pure coinflip has zero EV.',
  },
  {
    id: 'ev-4', difficulty: 'easy',
    scenarioDescription: 'Steal attempt from BTN — 3BB open, expect folds',
    potBeforeActionBB: 1.5,
    heroActionDescription: 'Open raise to 3BB',
    outcomes: [
      { description: 'SB and BB both fold (70% of the time)', probability: 0.70, netValueBB: 1.5 },
      { description: 'Someone calls/3-bets (30% of the time) — fold to 3-bet', probability: 0.30, netValueBB: -3 },
    ],
    correctEvBB: 0.15, // 0.70×1.5 + 0.30×(-3) = 1.05 - 0.9 = 0.15
    toleranceBB: 1,
    explanation: 'EV = (0.70 × 1.5) + (0.30 × -3) = 1.05 - 0.9 = +0.15 BB. Small but positive — stealing is profitable in the long run.',
  },
  {
    id: 'ev-5', difficulty: 'easy',
    scenarioDescription: 'Calling a river bet as a bluff catcher',
    potBeforeActionBB: 40,
    heroActionDescription: 'Call 20BB river bet',
    outcomes: [
      { description: 'Villain is bluffing, hero wins (35% of villain range)', probability: 0.35, netValueBB: 60 },
      { description: 'Villain has value, hero loses (65% of villain range)', probability: 0.65, netValueBB: -20 },
    ],
    correctEvBB: 8.0, // 0.35×60 + 0.65×(-20) = 21-13 = 8
    toleranceBB: 2,
    explanation: 'EV = (0.35 × 60) + (0.65 × -20) = 21 - 13 = +8 BB. If villain bluffs 35% on this size, calling is profitable.',
  },

  // ─── MEDIUM — 3-outcome scenarios ────────────────────────────────────────────
  {
    id: 'ev-6', difficulty: 'medium',
    scenarioDescription: 'Semi-bluff on the flop with a flush draw',
    potBeforeActionBB: 20,
    heroActionDescription: 'Bet 15BB with flush draw (9 outs)',
    outcomes: [
      { description: 'Villain folds immediately (40% chance)', probability: 0.40, netValueBB: 20 },
      { description: 'Villain calls, hero makes flush and wins (18% equity when called)', probability: 0.18, netValueBB: 50 },
      { description: 'Villain calls, hero misses and gives up (42%)', probability: 0.42, netValueBB: -15 },
    ],
    correctEvBB: 10.7, // 0.40×20 + 0.18×50 + 0.42×(-15) = 8+9-6.3 = 10.7
    toleranceBB: 2,
    explanation: 'EV = (0.40×20) + (0.18×50) + (0.42×-15) = 8 + 9 - 6.3 = +10.7 BB. Semi-bluffs are profitable combining fold equity + draw equity.',
  },
  {
    id: 'ev-7', difficulty: 'medium',
    scenarioDescription: 'Preflop 3-bet with AKs from BB vs BTN open',
    potBeforeActionBB: 3,
    heroActionDescription: '3-bet to 12BB',
    outcomes: [
      { description: 'BTN folds (55% of time)', probability: 0.55, netValueBB: 3 },
      { description: 'BTN calls, hero wins 60% equity postflop', probability: 0.27, netValueBB: 27 },
      { description: 'BTN calls, hero loses 40% equity postflop', probability: 0.18, netValueBB: -12 },
    ],
    correctEvBB: 6.78, // 0.55×3 + 0.27×27 + 0.18×(-12) = 1.65+7.29-2.16 = 6.78
    toleranceBB: 2,
    explanation: 'EV = (0.55×3) + (0.27×27) + (0.18×-12) = 1.65 + 7.29 - 2.16 ≈ +6.8 BB. 3-betting AKs is highly profitable.',
  },
  {
    id: 'ev-8', difficulty: 'medium',
    scenarioDescription: 'Calling a 3-bet with pocket jacks',
    potBeforeActionBB: 3,
    heroActionDescription: 'Call a 3-bet, putting in 12BB total',
    outcomes: [
      { description: 'Flop and win (JJ has 56% equity vs 3-bet range)', probability: 0.56, netValueBB: 25 },
      { description: 'Flop and lose (44% of time)', probability: 0.44, netValueBB: -12 },
    ],
    correctEvBB: 8.72, // 0.56×25 + 0.44×(-12) = 14 - 5.28 = 8.72
    toleranceBB: 2,
    explanation: 'EV = (0.56×25) + (0.44×-12) = 14 - 5.28 = +8.72 BB. Calling 3-bets with JJ is profitable due to strong equity.',
  },
  {
    id: 'ev-9', difficulty: 'medium',
    scenarioDescription: 'River value bet with top pair',
    potBeforeActionBB: 25,
    heroActionDescription: 'Bet 18BB for value',
    outcomes: [
      { description: 'Villain calls with worse (60% of calling range)', probability: 0.45, netValueBB: 43 },
      { description: 'Villain folds (25% of time)', probability: 0.25, netValueBB: 25 },
      { description: 'Villain calls with better or raises (30%)', probability: 0.30, netValueBB: -18 },
    ],
    correctEvBB: 20.2, // 0.45×43 + 0.25×25 + 0.30×(-18) = 19.35+6.25-5.4 = 20.2
    toleranceBB: 3,
    explanation: 'EV ≈ (0.45×43) + (0.25×25) + (0.30×-18) = 19.35 + 6.25 - 5.4 ≈ +20.2 BB. Betting top pair for value is profitable vs a reasonable villain range.',
  },
  {
    id: 'ev-10', difficulty: 'medium',
    scenarioDescription: 'Pure bluff on the river (no outs)',
    potBeforeActionBB: 30,
    heroActionDescription: 'Bluff 30BB (pot-sized)',
    outcomes: [
      { description: 'Villain folds (45% of time)', probability: 0.45, netValueBB: 30 },
      { description: 'Villain calls, hero loses', probability: 0.55, netValueBB: -30 },
    ],
    correctEvBB: -3.0, // 0.45×30 + 0.55×(-30) = 13.5-16.5 = -3
    toleranceBB: 2,
    explanation: 'EV = (0.45×30) + (0.55×-30) = 13.5 - 16.5 = -3 BB. A pot-sized bluff needs villain to fold 50% to break even. At 45%, it\'s slightly -EV.',
  },

  // ─── HARD — Complex multi-outcome scenarios ──────────────────────────────────
  {
    id: 'ev-11', difficulty: 'hard',
    scenarioDescription: 'Facing a 4-bet with KK — call or fold?',
    potBeforeActionBB: 3,
    heroActionDescription: 'Call a 4-bet, putting in 32BB total',
    outcomes: [
      { description: 'Villain has QQ or worse (wins 82% equity)', probability: 0.45, netValueBB: 65 },
      { description: 'Villain has AA (loses 18% equity)', probability: 0.55, netValueBB: -32 },
    ],
    correctEvBB: 11.65, // 0.45×65 + 0.55×(-32) = 29.25-17.6 = 11.65
    toleranceBB: 3,
    explanation: 'EV = (0.45×65) + (0.55×-32) = 29.25 - 17.6 = +11.65 BB. Calling a 4-bet with KK is profitable unless villain only 4-bets AA.',
  },
  {
    id: 'ev-12', difficulty: 'hard',
    scenarioDescription: 'C-bet on a dry board: bet or check?',
    potBeforeActionBB: 12,
    heroActionDescription: 'C-bet 6BB (half pot) on A-7-2 rainbow',
    outcomes: [
      { description: 'Villain folds (58% of the time)', probability: 0.58, netValueBB: 12 },
      { description: 'Villain calls with worse (24%)', probability: 0.24, netValueBB: 20 },
      { description: 'Villain calls with better or check-raises (18%)', probability: 0.18, netValueBB: -6 },
    ],
    correctEvBB: 10.68, // 0.58×12 + 0.24×20 + 0.18×(-6) = 6.96+4.8-1.08 = 10.68
    toleranceBB: 3,
    explanation: 'EV ≈ (0.58×12) + (0.24×20) + (0.18×-6) = 6.96 + 4.8 - 1.08 ≈ +10.68 BB. C-betting a dry board with range advantage is highly profitable.',
  },
  {
    id: 'ev-13', difficulty: 'hard',
    scenarioDescription: 'Should you call a river shove?',
    potBeforeActionBB: 60,
    heroActionDescription: 'Call a 50BB river shove',
    outcomes: [
      { description: 'Villain is bluffing, hero wins 160BB pot', probability: 0.38, netValueBB: 110 },
      { description: 'Villain has the goods, hero loses 50BB', probability: 0.62, netValueBB: -50 },
    ],
    correctEvBB: 10.8, // 0.38×110 + 0.62×(-50) = 41.8-31 = 10.8
    toleranceBB: 3,
    explanation: 'EV = (0.38×110) + (0.62×-50) = 41.8 - 31 = +10.8 BB. Calling is profitable if villain bluffs 38%+ of the time at this bet sizing.',
  },
  {
    id: 'ev-14', difficulty: 'hard',
    scenarioDescription: 'Turn semi-bluff raise vs a c-bet',
    potBeforeActionBB: 25,
    heroActionDescription: 'Raise to 55BB with flush+straight draw',
    outcomes: [
      { description: 'Villain folds immediately (35%)', probability: 0.35, netValueBB: 25 },
      { description: 'Villain calls, hero hits draw and wins (20% × 2 streets)', probability: 0.26, netValueBB: 135 },
      { description: 'Villain calls, hero misses and checks down (39%)', probability: 0.39, netValueBB: -55 },
    ],
    correctEvBB: 22.35, // 0.35×25 + 0.26×135 + 0.39×(-55) = 8.75+35.1-21.45 = 22.4
    toleranceBB: 3,
    explanation: 'EV = (0.35×25) + (0.26×135) + (0.39×-55) = 8.75 + 35.1 - 21.45 ≈ +22.4 BB. Combo draws make powerful semi-bluff raises.',
  },
  {
    id: 'ev-15', difficulty: 'hard',
    scenarioDescription: 'Folding KK preflop to a 5-bet?',
    potBeforeActionBB: 6,
    heroActionDescription: 'Call a 5-bet shove for 100BB',
    outcomes: [
      { description: 'Villain only 5-bets AA (80% of 5-bet range), KK is ~18% equity', probability: 0.80, netValueBB: -100 },
      { description: 'Villain 5-bets AK/QQ as bluff (20% of range), KK wins 70%', probability: 0.14, netValueBB: 200 },
      { description: 'Villain has QQ, hero wins 55%', probability: 0.06, netValueBB: 200 },
    ],
    correctEvBB: -40.0, // 0.80×(-100) + 0.14×200 + 0.06×200 = -80+28+12 = -40
    toleranceBB: 10,
    explanation: 'EV ≈ (0.80×-100) + (0.14×200) + (0.06×200) = -80 + 28 + 12 = -40 BB. Against a tight 5-bet range (mostly AA), calling with KK is -EV. This is a fold or marginal call spot.',
  },
  {
    id: 'ev-16', difficulty: 'medium',
    scenarioDescription: 'Limping vs raising from UTG with a marginal hand',
    potBeforeActionBB: 1,
    heroActionDescription: 'Raise to 3BB from UTG with AJo',
    outcomes: [
      { description: 'Everyone folds (50% of time)', probability: 0.50, netValueBB: 1.5 },
      { description: 'Called by 1-2 players, win pot (30%)', probability: 0.30, netValueBB: 8 },
      { description: 'Called and lose (20%)', probability: 0.20, netValueBB: -3 },
    ],
    correctEvBB: 2.55, // 0.50×1.5 + 0.30×8 + 0.20×(-3) = 0.75+2.4-0.6 = 2.55
    toleranceBB: 1.5,
    explanation: 'EV = (0.50×1.5) + (0.30×8) + (0.20×-3) = 0.75 + 2.4 - 0.6 = +2.55 BB. Raising AJo from UTG is profitable.',
  },
  {
    id: 'ev-17', difficulty: 'hard',
    scenarioDescription: 'Turn barrel on a blank with air (two-barrel bluff)',
    potBeforeActionBB: 40,
    heroActionDescription: 'Bet 30BB on blank turn as continuation',
    outcomes: [
      { description: 'Villain folds to second barrel (50%)', probability: 0.50, netValueBB: 40 },
      { description: 'Villain calls, river gives up — net loss only bet size (30%)', probability: 0.30, netValueBB: -30 },
      { description: 'Villain raises, fold — lose 30BB (20%)', probability: 0.20, netValueBB: -30 },
    ],
    correctEvBB: 5.0, // 0.50×40 + 0.30×(-30) + 0.20×(-30) = 20-9-6 = 5
    toleranceBB: 3,
    explanation: 'EV = (0.50×40) + (0.30×-30) + (0.20×-30) = 20 - 9 - 6 = +5 BB. Two-barrel bluffs are profitable when villain folds 50%+ of the time.',
  },
  {
    id: 'ev-18', difficulty: 'medium',
    scenarioDescription: 'Calling a flop bet with middle pair',
    potBeforeActionBB: 15,
    heroActionDescription: 'Call 10BB with middle pair (88 on K-8-3)',
    outcomes: [
      { description: 'Villain checks turn and river, hero wins (45%)', probability: 0.45, netValueBB: 25 },
      { description: 'Villain continues betting, hero folds on turn (35%)', probability: 0.35, netValueBB: -10 },
      { description: 'Hero improves to set and stacks off (20%)', probability: 0.20, netValueBB: 100 },
    ],
    correctEvBB: 27.75, // 0.45×25 + 0.35×(-10) + 0.20×100 = 11.25-3.5+20 = 27.75
    toleranceBB: 5,
    explanation: 'EV = (0.45×25) + (0.35×-10) + (0.20×100) = 11.25 - 3.5 + 20 = +27.75 BB. Middle set potential and good equity make calling profitable.',
  },
  {
    id: 'ev-19', difficulty: 'easy',
    scenarioDescription: 'Pure stone cold bluff — 0% equity when called',
    potBeforeActionBB: 20,
    heroActionDescription: 'Bluff 20BB (pot) with 0% equity',
    outcomes: [
      { description: 'Villain folds (40%)', probability: 0.40, netValueBB: 20 },
      { description: 'Villain calls and hero loses (60%)', probability: 0.60, netValueBB: -20 },
    ],
    correctEvBB: -4.0, // 0.40×20 + 0.60×(-20) = 8-12 = -4
    toleranceBB: 2,
    explanation: 'EV = (0.40×20) + (0.60×-20) = 8 - 12 = -4 BB. A pot-sized bluff needs 50% fold equity to break even. At 40% folds, it\'s -EV. Don\'t bluff here.',
  },
  {
    id: 'ev-20', difficulty: 'hard',
    scenarioDescription: '3-way pot dynamic: bet-call-fold decision',
    potBeforeActionBB: 45,
    heroActionDescription: 'Bet 30BB into 3-way pot with top pair',
    outcomes: [
      { description: 'Both players fold (30%)', probability: 0.30, netValueBB: 45 },
      { description: 'One calls with worse, one folds (40%)', probability: 0.40, netValueBB: 75 },
      { description: 'Raised by one player, hero folds losing 30BB (30%)', probability: 0.30, netValueBB: -30 },
    ],
    correctEvBB: 34.5, // 0.30×45 + 0.40×75 + 0.30×(-30) = 13.5+30-9 = 34.5
    toleranceBB: 5,
    explanation: 'EV = (0.30×45) + (0.40×75) + (0.30×-30) = 13.5 + 30 - 9 = +34.5 BB. Betting top pair in 3-way pots is still profitable when you fold to aggression.',
  },
];
