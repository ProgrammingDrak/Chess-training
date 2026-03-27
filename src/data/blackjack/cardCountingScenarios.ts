import type { CardCountingScenario } from '../../types/blackjack';

// Hi-Lo point values:
//   2, 3, 4, 5, 6  →  +1 (low cards, player-favorable when burned)
//   7, 8, 9        →   0 (neutral)
//   T, J, Q, K, A  →  -1 (high cards, player-favorable when remaining)

export const CARD_COUNTING_SCENARIOS: CardCountingScenario[] = [

  // ── Easy ─────────────────────────────────────────────────────────────────────

  {
    id: 'cc-001',
    difficulty: 'easy',
    cards: ['2', '4', '6', 'T', 'J'],
    startingCount: 0,
    // +1 +1 +1 -1 -1 = +1
    correctCount: 1,
    explanation:
      'Start at 0. ' +
      '2 (+1) → 1 | ' +
      '4 (+1) → 2 | ' +
      '6 (+1) → 3 | ' +
      'T (−1) → 2 | ' +
      'J (−1) → 1. ' +
      'Three low cards (+3) minus two high cards (−2) = running count +1. ' +
      'This slightly positive count means a few more high cards remain in the shoe relative to low cards, ' +
      'giving the player a marginal edge.',
  },

  {
    id: 'cc-002',
    difficulty: 'easy',
    cards: ['3', 'K', '5', 'A', '2', 'T'],
    startingCount: 0,
    // +1 -1 +1 -1 +1 -1 = 0
    correctCount: 0,
    explanation:
      'Start at 0. ' +
      '3 (+1) → 1 | ' +
      'K (−1) → 0 | ' +
      '5 (+1) → 1 | ' +
      'A (−1) → 0 | ' +
      '2 (+1) → 1 | ' +
      'T (−1) → 0. ' +
      'Each low card is perfectly canceled by a high card. The count remains 0 — a neutral shoe ' +
      'with no meaningful edge for the player or the house.',
  },

  {
    id: 'cc-003',
    difficulty: 'easy',
    cards: ['7', '8', '9', '3', '5'],
    startingCount: 0,
    // 0 0 0 +1 +1 = +2
    correctCount: 2,
    explanation:
      'Start at 0. ' +
      '7 (0) → 0 | ' +
      '8 (0) → 0 | ' +
      '9 (0) → 0 | ' +
      '3 (+1) → 1 | ' +
      '5 (+1) → 2. ' +
      'The 7, 8, and 9 are neutral cards — they do not change the count at all in Hi-Lo. ' +
      'Only the 3 and 5 affect the count, each adding +1 for a total of +2.',
  },

  {
    id: 'cc-004',
    difficulty: 'easy',
    cards: ['Q', 'K', 'A', '2', '3', '4', '5', '6'],
    startingCount: 0,
    // -1 -1 -1 +1 +1 +1 +1 +1 = +2
    correctCount: 2,
    explanation:
      'Start at 0. ' +
      'Q (−1) → −1 | ' +
      'K (−1) → −2 | ' +
      'A (−1) → −3 | ' +
      '2 (+1) → −2 | ' +
      '3 (+1) → −1 | ' +
      '4 (+1) → 0 | ' +
      '5 (+1) → +1 | ' +
      '6 (+1) → +2. ' +
      'Three high cards bring the count to −3, then five low cards push it to +2. ' +
      'There is now a slight concentration of high cards remaining in the shoe.',
  },

  {
    id: 'cc-005',
    difficulty: 'easy',
    cards: ['T', 'T', 'T', 'T', '2', '3'],
    startingCount: 0,
    // -1 -1 -1 -1 +1 +1 = -2
    correctCount: -2,
    explanation:
      'Start at 0. ' +
      'T (−1) → −1 | ' +
      'T (−1) → −2 | ' +
      'T (−1) → −3 | ' +
      'T (−1) → −4 | ' +
      '2 (+1) → −3 | ' +
      '3 (+1) → −2. ' +
      'Four 10-value cards in a row create a deeply negative count. A negative running count ' +
      'means high cards have been removed from the shoe, leaving relatively more low cards — ' +
      'the house edge increases.',
  },

  // ── Medium ────────────────────────────────────────────────────────────────────

  {
    id: 'cc-006',
    difficulty: 'medium',
    cards: ['K', 'K', 'K', '2', '3', '4', '5', '6'],
    startingCount: 0,
    // -1 -1 -1 +1 +1 +1 +1 +1 = +2
    correctCount: 2,
    explanation:
      'Start at 0. ' +
      'K (−1) → −1 | ' +
      'K (−1) → −2 | ' +
      'K (−1) → −3 | ' +
      '2 (+1) → −2 | ' +
      '3 (+1) → −1 | ' +
      '4 (+1) → 0 | ' +
      '5 (+1) → +1 | ' +
      '6 (+1) → +2. ' +
      'Three Kings initially crater the count to −3. Then a run of five consecutive low cards ' +
      'recovers it to +2. In a real game, after those Kings leave the shoe the remaining cards ' +
      'are richer in high cards, raising the player advantage.',
  },

  {
    id: 'cc-007',
    difficulty: 'medium',
    cards: ['A', 'J', 'Q', '2', '4', '6', '8', '3', '5'],
    startingCount: 0,
    // -1 -1 -1 +1 +1 +1 0 +1 +1 = +2
    correctCount: 2,
    explanation:
      'Start at 0. ' +
      'A (−1) → −1 | ' +
      'J (−1) → −2 | ' +
      'Q (−1) → −3 | ' +
      '2 (+1) → −2 | ' +
      '4 (+1) → −1 | ' +
      '6 (+1) → 0 | ' +
      '8 (0) → 0 | ' +
      '3 (+1) → +1 | ' +
      '5 (+1) → +2. ' +
      'Remember: the 8 is neutral and adds nothing. Three high cards are followed by five low ' +
      'cards (the 8 being neutral), resulting in a count of +2.',
  },

  {
    id: 'cc-008',
    difficulty: 'medium',
    cards: ['5', '6', 'T', 'A', '3', 'K', '4', '9', '2'],
    startingCount: 0,
    // +1 +1 -1 -1 +1 -1 +1 0 +1 = +2
    correctCount: 2,
    explanation:
      'Start at 0. ' +
      '5 (+1) → 1 | ' +
      '6 (+1) → 2 | ' +
      'T (−1) → 1 | ' +
      'A (−1) → 0 | ' +
      '3 (+1) → 1 | ' +
      'K (−1) → 0 | ' +
      '4 (+1) → 1 | ' +
      '9 (0) → 1 | ' +
      '2 (+1) → 2. ' +
      'The count oscillates between 0 and 2 throughout. The 9 is neutral. Final count: +2. ' +
      'This kind of back-and-forth sequence tests whether you stay accurate under pressure.',
  },

  {
    id: 'cc-009',
    difficulty: 'medium',
    cards: ['J', '7', '4', 'Q', '3', 'A', '6', '8', '5', '2'],
    startingCount: 0,
    // -1 0 +1 -1 +1 -1 +1 0 +1 +1 = +2
    correctCount: 2,
    explanation:
      'Start at 0. ' +
      'J (−1) → −1 | ' +
      '7 (0) → −1 | ' +
      '4 (+1) → 0 | ' +
      'Q (−1) → −1 | ' +
      '3 (+1) → 0 | ' +
      'A (−1) → −1 | ' +
      '6 (+1) → 0 | ' +
      '8 (0) → 0 | ' +
      '5 (+1) → +1 | ' +
      '2 (+1) → +2. ' +
      'Two neutral cards (7 and 8) do nothing to the count. Interspersed high and low cards ' +
      'keep the count near zero until the final two low cards push it to +2.',
  },

  {
    id: 'cc-010',
    difficulty: 'medium',
    cards: ['2', '3', 'A', 'K', '7', '5', 'Q', '4', '9', '6'],
    startingCount: 0,
    // +1 +1 -1 -1 0 +1 -1 +1 0 +1 = +2
    correctCount: 2,
    explanation:
      'Start at 0. ' +
      '2 (+1) → 1 | ' +
      '3 (+1) → 2 | ' +
      'A (−1) → 1 | ' +
      'K (−1) → 0 | ' +
      '7 (0) → 0 | ' +
      '5 (+1) → 1 | ' +
      'Q (−1) → 0 | ' +
      '4 (+1) → 1 | ' +
      '9 (0) → 1 | ' +
      '6 (+1) → 2. ' +
      'This mixed sequence of ten cards has two neutral cards (7 and 9) and an even spread of ' +
      'high and low cards with one more low card, ending at +2.',
  },

  // ── Hard ──────────────────────────────────────────────────────────────────────

  {
    id: 'cc-011',
    difficulty: 'hard',
    cards: ['7', '8', '9', 'A', 'K', 'Q', '2', '5', '3', 'T'],
    startingCount: 2,
    // 0 0 0 -1 -1 -1 +1 +1 +1 -1 = -1 delta → 2 + (-1) = 1
    correctCount: 1,
    explanation:
      'Start at +2. ' +
      '7 (0) → 2 | ' +
      '8 (0) → 2 | ' +
      '9 (0) → 2 | ' +
      'A (−1) → 1 | ' +
      'K (−1) → 0 | ' +
      'Q (−1) → −1 | ' +
      '2 (+1) → 0 | ' +
      '5 (+1) → 1 | ' +
      '3 (+1) → 2 | ' +
      'T (−1) → 1. ' +
      'Starting from a non-zero count tests whether you maintain accuracy. Three neutral ' +
      'cards don\'t move the count at all. Three high cards cancel three low cards, and the ' +
      'final T subtracts 1, leaving you at +1.',
  },

  {
    id: 'cc-012',
    difficulty: 'hard',
    cards: ['K', 'A', 'J', 'Q', 'T', '2', '4', '3', '6', '5'],
    startingCount: 3,
    // -1 -1 -1 -1 -1 +1 +1 +1 +1 +1 = 0 delta → 3 + 0 = 3
    correctCount: 3,
    explanation:
      'Start at +3. ' +
      'K (−1) → 2 | ' +
      'A (−1) → 1 | ' +
      'J (−1) → 0 | ' +
      'Q (−1) → −1 | ' +
      'T (−1) → −2 | ' +
      '2 (+1) → −1 | ' +
      '4 (+1) → 0 | ' +
      '3 (+1) → 1 | ' +
      '6 (+1) → 2 | ' +
      '5 (+1) → 3. ' +
      'Five high cards in a row bring the count crashing from +3 to −2, then five consecutive ' +
      'low cards bring it exactly back to +3. The net delta is zero: five +1s cancel five −1s.',
  },

  {
    id: 'cc-013',
    difficulty: 'hard',
    cards: ['5', '5', '5', 'A', 'A', 'A', '7', '8', '9'],
    startingCount: -1,
    // +1 +1 +1 -1 -1 -1 0 0 0 = 0 delta → -1 + 0 = -1
    correctCount: -1,
    explanation:
      'Start at −1. ' +
      '5 (+1) → 0 | ' +
      '5 (+1) → 1 | ' +
      '5 (+1) → 2 | ' +
      'A (−1) → 1 | ' +
      'A (−1) → 0 | ' +
      'A (−1) → −1 | ' +
      '7 (0) → −1 | ' +
      '8 (0) → −1 | ' +
      '9 (0) → −1. ' +
      'Three 5s (each +1) are perfectly offset by three Aces (each −1). The three neutral ' +
      'cards at the end change nothing. Net delta = 0, so the final count equals the starting ' +
      'count of −1.',
  },

  {
    id: 'cc-014',
    difficulty: 'hard',
    cards: ['T', 'J', 'Q', 'K', 'A', '2', '3', '4', '5', '6', '7'],
    startingCount: 0,
    // -1 -1 -1 -1 -1 +1 +1 +1 +1 +1 0 = 0
    correctCount: 0,
    explanation:
      'Start at 0. ' +
      'T (−1) → −1 | ' +
      'J (−1) → −2 | ' +
      'Q (−1) → −3 | ' +
      'K (−1) → −4 | ' +
      'A (−1) → −5 | ' +
      '2 (+1) → −4 | ' +
      '3 (+1) → −3 | ' +
      '4 (+1) → −2 | ' +
      '5 (+1) → −1 | ' +
      '6 (+1) → 0 | ' +
      '7 (0) → 0. ' +
      'A complete "washout" sequence: five high cards from T through A, then five low cards ' +
      'from 2 through 6, with the neutral 7 at the end. The count returns to exactly 0.',
  },

  {
    id: 'cc-015',
    difficulty: 'hard',
    cards: ['6', 'K', '2', 'J', '4', 'A', '3', 'Q', '5', 'T'],
    startingCount: 0,
    // +1 -1 +1 -1 +1 -1 +1 -1 +1 -1 = 0
    correctCount: 0,
    explanation:
      'Start at 0. ' +
      '6 (+1) → 1 | ' +
      'K (−1) → 0 | ' +
      '2 (+1) → 1 | ' +
      'J (−1) → 0 | ' +
      '4 (+1) → 1 | ' +
      'A (−1) → 0 | ' +
      '3 (+1) → 1 | ' +
      'Q (−1) → 0 | ' +
      '5 (+1) → 1 | ' +
      'T (−1) → 0. ' +
      'A perfectly alternating sequence of low and high cards. The count bounces between 0 and ' +
      '+1 throughout and always returns to 0. This tests your ability to track rapid alternations.',
  },

  {
    id: 'cc-016',
    difficulty: 'hard',
    cards: ['2', '3', '4', '5', '6', '2', '3', 'K', 'A'],
    startingCount: -3,
    // +1 +1 +1 +1 +1 +1 +1 -1 -1 = +5 delta → -3 + 5 = +2
    correctCount: 2,
    explanation:
      'Start at −3. ' +
      '2 (+1) → −2 | ' +
      '3 (+1) → −1 | ' +
      '4 (+1) → 0 | ' +
      '5 (+1) → 1 | ' +
      '6 (+1) → 2 | ' +
      '2 (+1) → 3 | ' +
      '3 (+1) → 4 | ' +
      'K (−1) → 3 | ' +
      'A (−1) → 2. ' +
      'Starting from a negative count, seven consecutive low cards drive the count strongly ' +
      'positive. The final two high cards reduce it slightly, leaving +2. Note how quickly ' +
      'a run of low cards can flip a negative count to a positive one.',
  },

  {
    id: 'cc-017',
    difficulty: 'hard',
    cards: ['A', 'K', 'Q', 'J', 'T', '8', '7', '6', '5', '4'],
    startingCount: 4,
    // -1 -1 -1 -1 -1 0 0 +1 +1 +1 = -2 delta → 4 + (-2) = 2
    correctCount: 2,
    explanation:
      'Start at +4. ' +
      'A (−1) → 3 | ' +
      'K (−1) → 2 | ' +
      'Q (−1) → 1 | ' +
      'J (−1) → 0 | ' +
      'T (−1) → −1 | ' +
      '8 (0) → −1 | ' +
      '7 (0) → −1 | ' +
      '6 (+1) → 0 | ' +
      '5 (+1) → 1 | ' +
      '4 (+1) → 2. ' +
      'Starting from a high positive count, five consecutive high cards quickly drop it ' +
      'into negative territory. The two neutral cards (8, 7) do nothing. The three low ' +
      'cards at the end recover some ground, ending at +2.',
  },

  {
    id: 'cc-018',
    difficulty: 'hard',
    cards: ['9', '5', 'J', '8', '3', 'Q', '7', '2', 'K', '4', 'A'],
    startingCount: 0,
    // 0 +1 -1 0 +1 -1 0 +1 -1 +1 -1 = 0
    correctCount: 0,
    explanation:
      'Start at 0. ' +
      '9 (0) → 0 | ' +
      '5 (+1) → 1 | ' +
      'J (−1) → 0 | ' +
      '8 (0) → 0 | ' +
      '3 (+1) → 1 | ' +
      'Q (−1) → 0 | ' +
      '7 (0) → 0 | ' +
      '2 (+1) → 1 | ' +
      'K (−1) → 0 | ' +
      '4 (+1) → 1 | ' +
      'A (−1) → 0. ' +
      'This 11-card sequence is a stress test: neutral cards (9, 8, 7) constantly reset your ' +
      'rhythm, while alternating low/high pairs keep canceling out. The final count is 0.',
  },

  {
    id: 'cc-019',
    difficulty: 'hard',
    cards: ['6', '6', '5', '5', 'A', 'A', 'K', 'K'],
    startingCount: -2,
    // +1 +1 +1 +1 -1 -1 -1 -1 = 0 delta → -2 + 0 = -2
    correctCount: -2,
    explanation:
      'Start at −2. ' +
      '6 (+1) → −1 | ' +
      '6 (+1) → 0 | ' +
      '5 (+1) → 1 | ' +
      '5 (+1) → 2 | ' +
      'A (−1) → 1 | ' +
      'A (−1) → 0 | ' +
      'K (−1) → −1 | ' +
      'K (−1) → −2. ' +
      'Four low cards bring the count from −2 to +2, then four high cards bring it right back ' +
      'to −2. The net change is zero. Despite the dramatic swing, the final count is the same ' +
      'as the starting count.',
  },

  {
    id: 'cc-020',
    difficulty: 'hard',
    cards: ['T', '4', 'A', '6', 'K', '2', 'Q', '5', 'J', '3'],
    startingCount: 1,
    // -1 +1 -1 +1 -1 +1 -1 +1 -1 +1 = 0 delta → 1 + 0 = 1
    correctCount: 1,
    explanation:
      'Start at +1. ' +
      'T (−1) → 0 | ' +
      '4 (+1) → 1 | ' +
      'A (−1) → 0 | ' +
      '6 (+1) → 1 | ' +
      'K (−1) → 0 | ' +
      '2 (+1) → 1 | ' +
      'Q (−1) → 0 | ' +
      '5 (+1) → 1 | ' +
      'J (−1) → 0 | ' +
      '3 (+1) → 1. ' +
      'A perfectly balanced alternating sequence of high/low cards starting with a high card. ' +
      'The count oscillates between 0 and +1 throughout, ending at +1 — exactly the starting ' +
      'count plus 0. With ten cards in play that perfectly alternate, the net delta is 0.',
  },
];
