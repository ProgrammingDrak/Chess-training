import type { BetSpreadScenario } from '../../types/blackjack';

// Standard Hi-Lo 1-8 unit bet spread for a 6-deck game:
//   TC ≤ +1 (including all negative counts): bet 1 unit (minimum)
//   TC = +2:  bet 2 units
//   TC = +3:  bet 4 units
//   TC ≥ +4:  bet 8 units
//
// This spread corresponds to approximately:
//   TC +1 → house edge ≈ 0.5% (neutral to slightly negative for player)
//   TC +2 → player edge ≈ +0.5%
//   TC +3 → player edge ≈ +1.0%
//   TC +4 → player edge ≈ +1.5%+

export const BET_SPREAD_SCENARIOS: BetSpreadScenario[] = [

  // ── TC ≤ 0 (minimum bet scenarios) ───────────────────────────────────────────

  {
    id: 'bs-spread-001',
    difficulty: 'easy',
    trueCount: -2,
    bankrollUnits: 100,
    correctMultiplier: 1,
    explanation:
      'True Count −2 → Bet 1 unit (minimum). A TC of −2 means the shoe is rich in low ' +
      'cards and the house edge is significantly above its baseline. The remaining cards ' +
      'are unfavorable for the player. With a 100-unit bankroll, your 1-unit minimum bet ' +
      'preserves capital while you wait for the count to improve. Never bet more in a ' +
      'negative count — you would be voluntarily giving the casino extra money.',
  },

  {
    id: 'bs-spread-002',
    difficulty: 'easy',
    trueCount: -1,
    bankrollUnits: 200,
    correctMultiplier: 1,
    explanation:
      'True Count −1 → Bet 1 unit (minimum). A TC of −1 still represents a house-favored ' +
      'shoe. Even a marginally negative count indicates more low cards remain relative to ' +
      'high cards. Bet minimum to minimize losses. With a 200-unit bankroll you have plenty ' +
      'of runway to wait for a positive count. Patience is a core discipline of card counting.',
  },

  {
    id: 'bs-spread-003',
    difficulty: 'easy',
    trueCount: 0,
    bankrollUnits: 500,
    correctMultiplier: 1,
    explanation:
      'True Count 0 → Bet 1 unit (minimum). A neutral count of exactly 0 means the ' +
      'remaining shoe has a roughly even mix of high and low cards. The house edge is at ' +
      'its baseline (~0.5% with optimal basic strategy). There is no meaningful player ' +
      'advantage, so minimum bets are correct regardless of your large 500-unit bankroll.',
  },

  {
    id: 'bs-spread-004',
    difficulty: 'easy',
    trueCount: -4,
    bankrollUnits: 100,
    correctMultiplier: 1,
    explanation:
      'True Count −4 → Bet 1 unit (minimum). A deeply negative count of −4 is a heavily ' +
      'house-favored situation. The shoe is loaded with small cards; blackjack naturals are ' +
      'rare (your bonus payout becomes infrequent) and dealer bust rates fall. Bet the ' +
      'minimum possible and consider taking a break or finding a fresher shoe if allowed.',
  },

  {
    id: 'bs-spread-005',
    difficulty: 'easy',
    trueCount: 1,
    bankrollUnits: 200,
    correctMultiplier: 1,
    explanation:
      'True Count +1 → Bet 1 unit (minimum). TC +1 is essentially breakeven — the player ' +
      'edge is approximately 0% to slightly positive. Most counting systems do not raise ' +
      'bets until TC +2 because the edge at +1 is too small to justify the increased risk. ' +
      'Keep your bet at 1 unit and wait for TC +2 to start raising.',
  },

  // ── TC = +2 (2-unit bet scenarios) ───────────────────────────────────────────

  {
    id: 'bs-spread-006',
    difficulty: 'easy',
    trueCount: 2,
    bankrollUnits: 100,
    correctMultiplier: 2,
    explanation:
      'True Count +2 → Bet 2 units. At TC +2 the player gains a small but real edge of ' +
      'approximately +0.5% over the house. This is the first count at which doubling your ' +
      'bet is mathematically justified. With a 100-unit bankroll, a 2-unit bet risks only ' +
      '2% of your session bank. The extra expected value from this bet, multiplied over ' +
      'many hands, is where the long-run profit comes from.',
  },

  {
    id: 'bs-spread-007',
    difficulty: 'medium',
    trueCount: 2,
    bankrollUnits: 500,
    correctMultiplier: 2,
    explanation:
      'True Count +2 → Bet 2 units. TC +2 is a modest but positive edge of roughly +0.5%. ' +
      'Even with a large 500-unit bankroll, the correct multiplier at TC +2 is 2x your ' +
      'base unit — not more. Betting larger than the spread calls for risks over-bet sizing ' +
      'relative to the edge. Discipline means following the spread consistently, regardless ' +
      'of bankroll size.',
  },

  {
    id: 'bs-spread-008',
    difficulty: 'medium',
    trueCount: 2,
    bankrollUnits: 200,
    correctMultiplier: 2,
    explanation:
      'True Count +2 → Bet 2 units. The transition from 1 unit to 2 units at TC +2 is ' +
      'the most frequent bet raise a counter makes. In a 6-deck shoe the count reaches +2 ' +
      'fairly regularly, giving you consistent opportunities to place a slightly advantaged ' +
      'bet. The 2-unit bet on a 200-unit bankroll is only 1% of your session stake — ' +
      'well within bankroll management guidelines (risk of ruin stays low).',
  },

  // ── TC = +3 (4-unit bet scenarios) ───────────────────────────────────────────

  {
    id: 'bs-spread-009',
    difficulty: 'medium',
    trueCount: 3,
    bankrollUnits: 100,
    correctMultiplier: 4,
    explanation:
      'True Count +3 → Bet 4 units. TC +3 represents a solid player advantage of ' +
      'approximately +1.0%. Quadrupling the base bet here captures significantly more ' +
      'expected value per hand. With a 100-unit bankroll, a 4-unit bet is 4% of your ' +
      'session bank — aggressive but within reasonable risk parameters for a skilled ' +
      'counter. This is where meaningful long-run profit begins to accumulate.',
  },

  {
    id: 'bs-spread-010',
    difficulty: 'medium',
    trueCount: 3,
    bankrollUnits: 200,
    correctMultiplier: 4,
    explanation:
      'True Count +3 → Bet 4 units. At TC +3, high cards are noticeably concentrated ' +
      'in the remaining shoe. Blackjack naturals are more frequent (paying 3:2), doubles ' +
      'and splits become more profitable, and dealer bust rates increase. The 4-unit bet ' +
      'is the mathematically optimal response to this advantage on the standard 1-8 spread.',
  },

  {
    id: 'bs-spread-011',
    difficulty: 'medium',
    trueCount: 3,
    bankrollUnits: 500,
    correctMultiplier: 4,
    explanation:
      'True Count +3 → Bet 4 units. Even with a large bankroll of 500 units, the correct ' +
      'bet is 4x base at TC +3. The spread is calibrated to edge, not bankroll size. ' +
      'With 500 units you could sustain much larger absolute bets, but the 1-8 unit spread ' +
      'is designed to stay under casino radar while still capturing the available edge. ' +
      'Scale your unit size up if you want larger absolute bets.',
  },

  // ── TC ≥ +4 (8-unit / maximum bet scenarios) ─────────────────────────────────

  {
    id: 'bs-spread-012',
    difficulty: 'medium',
    trueCount: 4,
    bankrollUnits: 100,
    correctMultiplier: 8,
    explanation:
      'True Count +4 → Bet 8 units (maximum). TC +4 is a strong player advantage of ' +
      'approximately +1.5%. This is when you put maximum chips on the table. Against your ' +
      '100-unit bankroll, 8 units is 8% of your session bank — meaningful exposure, but ' +
      'justified by the edge. Most of a counter\'s long-run profit comes from the rare, ' +
      'high-count hands where the maximum bet is deployed.',
  },

  {
    id: 'bs-spread-013',
    difficulty: 'medium',
    trueCount: 5,
    bankrollUnits: 200,
    correctMultiplier: 8,
    explanation:
      'True Count +5 → Bet 8 units (maximum). At TC +5 the player advantage is even ' +
      'larger (~+2%), but the bet stays at 8 units — the cap of the 1-8 spread. There ' +
      'is no "TC +5 = 10 units" rule; the spread maxes at TC ≥ +4. The reason for ' +
      'capping is camouflage: jumping to 16 units at TC +5 would draw unwanted attention. ' +
      'Consistent maximum bets above TC +4 already provide excellent expected value.',
  },

  {
    id: 'bs-spread-014',
    difficulty: 'hard',
    trueCount: 6,
    bankrollUnits: 500,
    correctMultiplier: 8,
    explanation:
      'True Count +6 → Bet 8 units (maximum). TC +6 is an exceptional player advantage ' +
      '(~+2.5%), but the bet is still capped at 8 units. With a 500-unit bankroll your ' +
      '8-unit bet is only 1.6% of your total stake — conservative, but by design. The ' +
      'risk of casino detection grows sharply with very large bets. Maximum of 8 units ' +
      'regardless of how high the TC climbs.',
  },

  {
    id: 'bs-spread-015',
    difficulty: 'hard',
    trueCount: 4,
    bankrollUnits: 500,
    correctMultiplier: 8,
    explanation:
      'True Count +4 → Bet 8 units (maximum). TC +4 is the threshold to maximum bet. ' +
      'Think of it this way: TC +1 = 1 unit, TC +2 = 2 units, TC +3 = 4 units, and ' +
      'TC +4 = 8 units — the spread roughly doubles each point. The jump from 4 to 8 ' +
      'at TC +4 reflects the increasing concentration of high cards in an increasingly ' +
      'favorable shoe, where naturals and strong doubles become very frequent.',
  },

  // ── Mixed / review scenarios ──────────────────────────────────────────────────

  {
    id: 'bs-spread-016',
    difficulty: 'easy',
    trueCount: -3,
    bankrollUnits: 100,
    correctMultiplier: 1,
    explanation:
      'True Count −3 → Bet 1 unit (minimum). A TC of −3 means the shoe is significantly ' +
      'stacked with low cards. Every time a low card is dealt it is +1 to your count ' +
      '(meaning it benefits you when it *remains* in the shoe). A negative count means ' +
      'those helpful high cards have been dealt out. Bet minimum and wait for the shoe ' +
      'to turn around — or leave for a freshly shuffled table.',
  },

  {
    id: 'bs-spread-017',
    difficulty: 'medium',
    trueCount: 2,
    bankrollUnits: 100,
    correctMultiplier: 2,
    explanation:
      'True Count +2 → Bet 2 units. This is the critical transition point: the first ' +
      'TC at which you raise your bet above minimum. At TC +2 the expected value of each ' +
      'dollar bet flips from negative to slightly positive. With a 100-unit session bank ' +
      'and a $25 base unit, your 2-unit bet of $50 is justified — you are now the ' +
      'statistical favorite on this hand for the first time.',
  },

  {
    id: 'bs-spread-018',
    difficulty: 'hard',
    trueCount: 3,
    bankrollUnits: 100,
    correctMultiplier: 4,
    explanation:
      'True Count +3 → Bet 4 units. At TC +3 you are betting four times your minimum. ' +
      'This is where counters need discipline: it is tempting to bet 6 or 8 units at +3 ' +
      'to maximize profits, but over-betting relative to edge increases risk of ruin. The ' +
      '1-8 spread is designed as a balanced risk/reward system. Trust the math and bet ' +
      'exactly 4 units at TC +3.',
  },

  {
    id: 'bs-spread-019',
    difficulty: 'hard',
    trueCount: 5,
    bankrollUnits: 100,
    correctMultiplier: 8,
    explanation:
      'True Count +5 → Bet 8 units (maximum). TC +5 and above all call for maximum bets. ' +
      'At TC +5 the player edge is approximately +2.0%, which is a significant long-run ' +
      'advantage. With a 100-unit bankroll and 8-unit maximum bet, you are risking 8% of ' +
      'your session on a hand where you have a statistical edge — exactly the right time ' +
      'to have maximum money in play.',
  },

  {
    id: 'bs-spread-020',
    difficulty: 'hard',
    trueCount: 0,
    bankrollUnits: 500,
    correctMultiplier: 1,
    explanation:
      'True Count 0 → Bet 1 unit (minimum). Even with a large 500-unit bankroll and a ' +
      'neutral shoe, the correct bet is minimum. The house edge at TC 0 is approximately ' +
      '0.5% with perfect basic strategy — the house is still favored. The entire point of ' +
      'card counting is to bet large only when you have the edge. Betting large at TC 0 ' +
      'simply donates more money to the casino per hour.',
  },
];
