import type { TrueCountScenario } from '../../types/blackjack';

// True Count = Running Count ÷ Decks Remaining, rounded to nearest integer.
// Decks remaining values use 0.5 increments: 0.5, 1, 1.5, 2, 2.5, 3, 4, 5.

export const TRUE_COUNT_SCENARIOS: TrueCountScenario[] = [

  // ── Easy ─────────────────────────────────────────────────────────────────────

  {
    id: 'tc-001',
    difficulty: 'easy',
    runningCount: 6,
    decksRemaining: 2,
    // 6 ÷ 2 = 3
    correctTrueCount: 3,
    options: [1, 2, 3, 4],
    explanation:
      'True Count = RC ÷ Decks Remaining = 6 ÷ 2 = 3. ' +
      'With 2 decks remaining in the shoe and a running count of +6, ' +
      'the concentration of high cards is moderate. A true count of +3 ' +
      'represents a meaningful player advantage — this is typically when ' +
      'card counters begin to raise their bets significantly.',
  },

  {
    id: 'tc-002',
    difficulty: 'easy',
    runningCount: 4,
    decksRemaining: 1,
    // 4 ÷ 1 = 4
    correctTrueCount: 4,
    options: [2, 3, 4, 5],
    explanation:
      'True Count = RC ÷ Decks Remaining = 4 ÷ 1 = 4. ' +
      'With only 1 deck remaining the running count is already the true count. ' +
      'A TC of +4 is a strong player advantage and calls for maximum bet sizing ' +
      'in most counting strategies.',
  },

  {
    id: 'tc-003',
    difficulty: 'easy',
    runningCount: 8,
    decksRemaining: 4,
    // 8 ÷ 4 = 2
    correctTrueCount: 2,
    options: [1, 2, 3, 4],
    explanation:
      'True Count = RC ÷ Decks Remaining = 8 ÷ 4 = 2. ' +
      'A high running count of +8 may look impressive, but with 4 decks still ' +
      'remaining in the shoe the advantage is only moderate. True count adjusts ' +
      'the raw count for shoe depth — a +8 early in the shoe is far less powerful ' +
      'than a +4 with 1 deck remaining.',
  },

  {
    id: 'tc-004',
    difficulty: 'easy',
    runningCount: 5,
    decksRemaining: 1,
    // 5 ÷ 1 = 5
    correctTrueCount: 5,
    options: [3, 4, 5, 6],
    explanation:
      'True Count = RC ÷ Decks Remaining = 5 ÷ 1 = 5. ' +
      'When only 1 deck remains, RC = TC directly. A TC of +5 is a very strong ' +
      'player advantage. In a 1-8 unit spread, this would call for the maximum ' +
      '8-unit bet. Be aware that casinos watch for large bet jumps at this depth.',
  },

  {
    id: 'tc-005',
    difficulty: 'easy',
    runningCount: -4,
    decksRemaining: 2,
    // -4 ÷ 2 = -2
    correctTrueCount: -2,
    options: [-4, -3, -2, -1],
    explanation:
      'True Count = RC ÷ Decks Remaining = −4 ÷ 2 = −2. ' +
      'A negative true count means the remaining shoe is rich in low cards, ' +
      'which favors the house. At TC −2, play minimum bets or consider sitting ' +
      'out a hand (if the casino allows). The house edge increases measurably ' +
      'with every point below 0.',
  },

  // ── Medium ────────────────────────────────────────────────────────────────────

  {
    id: 'tc-006',
    difficulty: 'medium',
    runningCount: -3,
    decksRemaining: 1.5,
    // -3 ÷ 1.5 = -2
    correctTrueCount: -2,
    options: [-4, -3, -2, -1],
    explanation:
      'True Count = RC ÷ Decks Remaining = −3 ÷ 1.5 = −2. ' +
      'Dividing by a non-integer like 1.5 requires care. −3 ÷ 1.5 = −2 exactly. ' +
      'A helpful trick: multiply both numbers by 2 to convert to a fraction — ' +
      '−6 ÷ 3 = −2. The shoe is mildly unfavorable; stick to minimum bets.',
  },

  {
    id: 'tc-007',
    difficulty: 'medium',
    runningCount: 9,
    decksRemaining: 3,
    // 9 ÷ 3 = 3
    correctTrueCount: 3,
    options: [2, 3, 4, 5],
    explanation:
      'True Count = RC ÷ Decks Remaining = 9 ÷ 3 = 3. ' +
      'With 3 decks remaining and a running count of +9 the true count is +3. ' +
      'Despite the large running count, the advantage is diluted across 3 decks. ' +
      'This is a good situation to raise your bet to 4 units in a 1-8 spread.',
  },

  {
    id: 'tc-008',
    difficulty: 'medium',
    runningCount: 5,
    decksRemaining: 2.5,
    // 5 ÷ 2.5 = 2
    correctTrueCount: 2,
    options: [1, 2, 3, 4],
    explanation:
      'True Count = RC ÷ Decks Remaining = 5 ÷ 2.5 = 2. ' +
      'Tip: 5 ÷ 2.5 = 5 × (2/5) = 2. Or simply: with 2.5 decks remaining, ' +
      'ask "how many times does 2.5 go into 5?" — exactly 2 times. ' +
      'TC +2 calls for a 2-unit bet in the standard 1-8 spread.',
  },

  {
    id: 'tc-009',
    difficulty: 'medium',
    runningCount: 7,
    decksRemaining: 3.5,
    // 7 ÷ 3.5 = 2
    correctTrueCount: 2,
    options: [1, 2, 3, 4],
    explanation:
      'True Count = RC ÷ Decks Remaining = 7 ÷ 3.5 = 2. ' +
      'A large running count of +7 but with 3.5 decks left results in only a ' +
      'modest TC of +2. This illustrates why a high RC early in the shoe does not ' +
      'justify large bet jumps — the advantage is spread thin over many remaining cards.',
  },

  {
    id: 'tc-010',
    difficulty: 'medium',
    runningCount: -6,
    decksRemaining: 3,
    // -6 ÷ 3 = -2
    correctTrueCount: -2,
    options: [-4, -3, -2, -1],
    explanation:
      'True Count = RC ÷ Decks Remaining = −6 ÷ 3 = −2. ' +
      'A running count of −6 with 3 decks remaining yields a true count of −2. ' +
      'The shoe is moderately unfavorable. In a negative count situation, minimize ' +
      'your bets and reduce your exposure until the count improves.',
  },

  // ── Hard ──────────────────────────────────────────────────────────────────────

  {
    id: 'tc-011',
    difficulty: 'hard',
    runningCount: 8,
    decksRemaining: 0.5,
    // 8 ÷ 0.5 = 16
    correctTrueCount: 16,
    options: [8, 12, 16, 20],
    explanation:
      'True Count = RC ÷ Decks Remaining = 8 ÷ 0.5 = 16. ' +
      'Dividing by 0.5 is equivalent to multiplying by 2: 8 × 2 = 16. ' +
      'With less than a half-deck remaining, even a modest running count becomes ' +
      'a massive true count. TC +16 is an extraordinary advantage, though in ' +
      'practice you rarely see this with a full 6-deck shoe due to casino cut cards.',
  },

  {
    id: 'tc-012',
    difficulty: 'hard',
    runningCount: -5,
    decksRemaining: 0.5,
    // -5 ÷ 0.5 = -10
    correctTrueCount: -10,
    options: [-12, -10, -8, -5],
    explanation:
      'True Count = RC ÷ Decks Remaining = −5 ÷ 0.5 = −10. ' +
      'A negative running count with very few cards remaining produces an extremely ' +
      'negative true count of −10. The shoe is catastrophically unfavorable. This is ' +
      'a clear signal to bet the absolute minimum or take a bathroom break.',
  },

  {
    id: 'tc-013',
    difficulty: 'hard',
    runningCount: 7,
    decksRemaining: 1.5,
    // 7 ÷ 1.5 = 4.67 → rounds to 5
    correctTrueCount: 5,
    options: [4, 5, 6, 7],
    explanation:
      'True Count = RC ÷ Decks Remaining = 7 ÷ 1.5 ≈ 4.67, rounds to 5. ' +
      'In practice, most card counters round to the nearest integer. 7 ÷ 1.5 = 4.67, ' +
      'which rounds up to 5. Some counters always round down (floor) to be conservative, ' +
      'which would give TC = 4. The standard rounding convention gives TC = 5.',
  },

  {
    id: 'tc-014',
    difficulty: 'hard',
    runningCount: 11,
    decksRemaining: 4,
    // 11 ÷ 4 = 2.75 → rounds to 3
    correctTrueCount: 3,
    options: [2, 3, 4, 5],
    explanation:
      'True Count = RC ÷ Decks Remaining = 11 ÷ 4 = 2.75, rounds to 3. ' +
      'A running count of +11 sounds impressive, but with 4 decks remaining the true ' +
      'count is only +3. 11 ÷ 4 = 2.75, which rounds to 3. This is the beauty of true ' +
      'count: it normalizes raw counts for accurate comparison across shoe depths.',
  },

  {
    id: 'tc-015',
    difficulty: 'hard',
    runningCount: -7,
    decksRemaining: 2.5,
    // -7 ÷ 2.5 = -2.8 → rounds to -3
    correctTrueCount: -3,
    options: [-4, -3, -2, -1],
    explanation:
      'True Count = RC ÷ Decks Remaining = −7 ÷ 2.5 = −2.8, rounds to −3. ' +
      'Note that for negative numbers, "rounding to nearest integer" means −2.8 rounds ' +
      'to −3 (not −2). The shoe has a significantly negative composition. Bet minimum.',
  },

  {
    id: 'tc-016',
    difficulty: 'hard',
    runningCount: 3,
    decksRemaining: 0.5,
    // 3 ÷ 0.5 = 6
    correctTrueCount: 6,
    options: [3, 5, 6, 8],
    explanation:
      'True Count = RC ÷ Decks Remaining = 3 ÷ 0.5 = 6. ' +
      'Even a small running count of +3 produces a TC of +6 when only half a deck ' +
      'remains. This is why shoe penetration matters so much — counters love deep ' +
      'penetration because it allows small running counts to manifest as powerful ' +
      'true counts near the end of the shoe.',
  },

  {
    id: 'tc-017',
    difficulty: 'hard',
    runningCount: 10,
    decksRemaining: 2.5,
    // 10 ÷ 2.5 = 4
    correctTrueCount: 4,
    options: [2, 3, 4, 5],
    explanation:
      'True Count = RC ÷ Decks Remaining = 10 ÷ 2.5 = 4. ' +
      'Tip: 10 ÷ 2.5 = 10 × (2/5) = 4. Alternatively, multiply both by 2: 20 ÷ 5 = 4. ' +
      'A TC of +4 is a strong player advantage calling for maximum bet in a 1-8 spread. ' +
      'When TC ≥ +4, most counters bet 8 units.',
  },

  {
    id: 'tc-018',
    difficulty: 'hard',
    runningCount: -9,
    decksRemaining: 4,
    // -9 ÷ 4 = -2.25 → rounds to -2
    correctTrueCount: -2,
    options: [-4, -3, -2, -1],
    explanation:
      'True Count = RC ÷ Decks Remaining = −9 ÷ 4 = −2.25, rounds to −2. ' +
      'Despite a very negative running count of −9, there are 4 decks left to dilute ' +
      'that negative swing, resulting in only a TC of −2. For negative fractions: ' +
      '−2.25 is between −2 and −3; the nearest integer is −2.',
  },

  {
    id: 'tc-019',
    difficulty: 'hard',
    runningCount: 6,
    decksRemaining: 1.5,
    // 6 ÷ 1.5 = 4
    correctTrueCount: 4,
    options: [2, 3, 4, 5],
    explanation:
      'True Count = RC ÷ Decks Remaining = 6 ÷ 1.5 = 4. ' +
      'Tip: divide both numbers by the same factor — 6 ÷ 1.5 = 12 ÷ 3 = 4. ' +
      'With 1.5 decks remaining and a RC of +6, the shoe is very favorable. ' +
      'A TC of +4 calls for maximum bets and may also trigger index plays ' +
      '(deviations from basic strategy based on count).',
  },

  {
    id: 'tc-020',
    difficulty: 'hard',
    runningCount: 13,
    decksRemaining: 5,
    // 13 ÷ 5 = 2.6 → rounds to 3
    correctTrueCount: 3,
    options: [2, 3, 4, 5],
    explanation:
      'True Count = RC ÷ Decks Remaining = 13 ÷ 5 = 2.6, rounds to 3. ' +
      'This scenario shows a very high running count early in the shoe. With 5 decks ' +
      'remaining, even a RC of +13 only translates to TC ≈ +3. 2.6 rounds up to 3. ' +
      'This is why professional counters wait for the end of a shoe — the same RC ' +
      'becomes far more powerful with fewer decks left.',
  },
];
