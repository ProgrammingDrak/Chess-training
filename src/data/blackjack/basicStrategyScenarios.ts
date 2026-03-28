import type { BasicStrategyScenario } from '../../types/blackjack';

export const BASIC_STRATEGY_SCENARIOS: BasicStrategyScenario[] = [

  // ── Hard Totals ──────────────────────────────────────────────────────────────

  {
    id: 'bs-hard-8-vs-5',
    difficulty: 'easy',
    playerCards: ['3', '5'],
    dealerUpcard: '5',
    handType: 'hard',
    playerTotal: 8,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Hard 8 vs dealer 5: Always hit. Your total of 8 cannot bust on the next card ' +
      '(worst case you draw an Ace and reach 9), and the expected value of doubling is ' +
      'negative because 8 is too low a starting point even against a weak dealer upcard. ' +
      'Simply hit and hope to build a competitive total.',
  },

  {
    id: 'bs-hard-9-vs-3',
    difficulty: 'medium',
    playerCards: ['4', '5'],
    dealerUpcard: '3',
    handType: 'hard',
    playerTotal: 9,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Hard 9 vs dealer 3: Hit. Many beginners double here, but the correct play is to ' +
      'hit. The basic strategy double range for hard 9 is dealer 3-6, but *only* in single- ' +
      'and double-deck games. In the standard 6-deck S17/DAS game the edge on doubling hard 9 ' +
      'vs 3 is marginally negative compared to hitting — you give up the ability to draw a ' +
      'multi-card total. Hit and keep your options open.',
  },

  {
    id: 'bs-hard-9-vs-6',
    difficulty: 'medium',
    playerCards: ['4', '5'],
    dealerUpcard: '6',
    handType: 'hard',
    playerTotal: 9,
    correctAction: 'D',
    acceptableActions: ['D', 'H'],
    explanation:
      'Hard 9 vs dealer 6: Double down. The dealer\'s 6 is the weakest possible upcard — ' +
      'the dealer busts more than 42% of the time when showing a 6. Doubling lets you put ' +
      'extra money in play when the dealer is most vulnerable. You only receive one more ' +
      'card, but even a mediocre 10-value card gives you 19, which is strong enough. The ' +
      'EV of doubling is positive here in a 6-deck game.',
  },

  {
    id: 'bs-hard-10-vs-2',
    difficulty: 'easy',
    playerCards: ['6', '4'],
    dealerUpcard: '2',
    handType: 'hard',
    playerTotal: 10,
    correctAction: 'D',
    acceptableActions: ['D'],
    explanation:
      'Hard 10 vs dealer 2: Double down. Hard 10 is one of the strongest starting totals ' +
      'for the player. Any 10-value card (about 31% of the deck) gives you 20. The dealer ' +
      'showing a 2 will bust roughly 35% of the time. Doubling your bet here gives a ' +
      'substantial positive expected value. Never just hit this hand.',
  },

  {
    id: 'bs-hard-10-vs-9',
    difficulty: 'easy',
    playerCards: ['7', '3'],
    dealerUpcard: '9',
    handType: 'hard',
    playerTotal: 10,
    correctAction: 'D',
    acceptableActions: ['D'],
    explanation:
      'Hard 10 vs dealer 9: Double down. Even against a strong dealer upcard of 9, ' +
      'hard 10 has enough winning potential to double profitably. You will beat dealer 9 ' +
      'whenever you draw a 10-value card (20 vs dealer\'s likely 19) or a 9 (tie) or many ' +
      'other strong cards. The EV of doubling exceeds hitting here in a 6-deck game.',
  },

  {
    id: 'bs-hard-10-vs-T',
    difficulty: 'hard',
    playerCards: ['6', '4'],
    dealerUpcard: 'T',
    handType: 'hard',
    playerTotal: 10,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Hard 10 vs dealer T: Hit — do not double. This is a common mistake. When the ' +
      'dealer shows a 10-value card they have a 30%+ chance of having a natural blackjack ' +
      'and are otherwise likely to stand on a strong total. Doubling hard 10 vs T is ' +
      'marginally negative in a 6-deck game; the correct play is to hit and take your ' +
      'chances without extra money at risk.',
  },

  {
    id: 'bs-hard-11-vs-6',
    difficulty: 'easy',
    playerCards: ['7', '4'],
    dealerUpcard: '6',
    handType: 'hard',
    playerTotal: 11,
    correctAction: 'D',
    acceptableActions: ['D'],
    explanation:
      'Hard 11 vs dealer 6: Double down — one of the most profitable doubles in blackjack. ' +
      'Hard 11 is the best possible doubling total because drawing any 10-value card ' +
      '(~31% chance) gives you an unbeatable 21. Against the dealer\'s worst upcard (6), ' +
      'which busts over 42% of the time, this is a premium situation. Always double here.',
  },

  {
    id: 'bs-hard-11-vs-A',
    difficulty: 'hard',
    playerCards: ['7', '4'],
    dealerUpcard: 'A',
    handType: 'hard',
    playerTotal: 11,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Hard 11 vs dealer Ace: Hit — do not double in a 6-deck S17 game. This is a ' +
      'critical S17 rule distinction. In H17 games you would double, but under S17 rules ' +
      'the dealer standing on soft 17 is slightly advantageous to them, making doubling ' +
      'hard 11 vs Ace marginally unprofitable. Hit and draw as many cards as needed to ' +
      'build your best total.',
  },

  {
    id: 'bs-hard-12-vs-2',
    difficulty: 'medium',
    playerCards: ['T', '2'],
    dealerUpcard: '2',
    handType: 'hard',
    playerTotal: 12,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Hard 12 vs dealer 2: Hit. Many players stand here fearing a bust, but the ' +
      'correct play is to hit. The dealer showing a 2 will only bust about 35% of the ' +
      'time — not enough to make standing profitable when you hold a breaking hand of 12. ' +
      'Of 13 card ranks you can draw, only 4 bust you (any 10-value). Hit and build a ' +
      'better total; your expected loss is lower hitting than standing here.',
  },

  {
    id: 'bs-hard-12-vs-4',
    difficulty: 'easy',
    playerCards: ['T', '2'],
    dealerUpcard: '4',
    handType: 'hard',
    playerTotal: 12,
    correctAction: 'S',
    acceptableActions: ['S'],
    explanation:
      'Hard 12 vs dealer 4: Stand. The dealer showing 4 busts about 40% of the time. ' +
      'Although 12 is a weak total, you risk busting on the very next card (any 10-value). ' +
      'Against this bust-heavy dealer hand, the correct strategy is to let the dealer ' +
      'take the risk and stand pat. The EV of standing surpasses hitting when the ' +
      'dealer shows 4, 5, or 6.',
  },

  {
    id: 'bs-hard-12-vs-6',
    difficulty: 'easy',
    playerCards: ['T', '2'],
    dealerUpcard: '6',
    handType: 'hard',
    playerTotal: 12,
    correctAction: 'S',
    acceptableActions: ['S'],
    explanation:
      'Hard 12 vs dealer 6: Stand. Dealer 6 is the worst possible upcard — the dealer ' +
      'busts more than 42% of the time. With your 12 you would bust roughly 31% of the ' +
      'time on the next card. The correct play is to stand and collect your 42% windfall ' +
      'when the dealer busts. Never hit a breaking hand against a bust card.',
  },

  {
    id: 'bs-hard-12-vs-7',
    difficulty: 'easy',
    playerCards: ['T', '2'],
    dealerUpcard: '7',
    handType: 'hard',
    playerTotal: 12,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Hard 12 vs dealer 7: Hit. Once the dealer shows 7 or higher their bust percentage ' +
      'drops significantly. Standing on 12 against a 7 means you lose any time the dealer ' +
      'makes 17-21 (the majority of outcomes). You must draw to improve your total. ' +
      'Hit until you reach 17 or higher.',
  },

  {
    id: 'bs-hard-13-vs-2',
    difficulty: 'easy',
    playerCards: ['T', '3'],
    dealerUpcard: '2',
    handType: 'hard',
    playerTotal: 13,
    correctAction: 'S',
    acceptableActions: ['S'],
    explanation:
      'Hard 13 vs dealer 2: Stand. The dealer showing 2 busts approximately 35% of the ' +
      'time. Hard 13 is a breaking hand — any 9 or 10-value card busts you (~38% of cards). ' +
      'The basic strategy break-even point against a 2 is around 13, so standing is ' +
      'correct. Use the dealer\'s likely busting to your advantage.',
  },

  {
    id: 'bs-hard-13-vs-7',
    difficulty: 'medium',
    playerCards: ['T', '3'],
    dealerUpcard: '7',
    handType: 'hard',
    playerTotal: 13,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Hard 13 vs dealer 7: Hit. A dealer 7 completes to 17 most efficiently — with an ' +
      'ace-in-the-hole the dealer has 17 already, and a 10 gives them 17 as well. ' +
      'The dealer will rarely bust showing a 7. Standing on 13 loses whenever the dealer ' +
      'makes 17-21, which is most of the time. Hit aggressively until 17+.',
  },

  {
    id: 'bs-hard-14-vs-4',
    difficulty: 'easy',
    playerCards: ['T', '4'],
    dealerUpcard: '4',
    handType: 'hard',
    playerTotal: 14,
    correctAction: 'S',
    acceptableActions: ['S'],
    explanation:
      'Hard 14 vs dealer 4: Stand. Dealer 4 busts about 40% of the time. Your 14 ' +
      'would bust on any 8-value or higher (~46% of cards). Letting the dealer take ' +
      'the bust risk is the profitable play. Stand on all hard 13-16 against dealer ' +
      '2 through 6 — these are the "bust cards."',
  },

  {
    id: 'bs-hard-14-vs-7',
    difficulty: 'easy',
    playerCards: ['T', '4'],
    dealerUpcard: '7',
    handType: 'hard',
    playerTotal: 14,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Hard 14 vs dealer 7: Hit. Once the dealer shows a 7 the strategy flips from ' +
      '"stand and let them bust" to "hit and build your total." The dealer makes a ' +
      'completed hand most of the time with a 7 upcard. Standing on 14 is a losing ' +
      'play; you need to improve. Hit until reaching 17 or better.',
  },

  {
    id: 'bs-hard-15-vs-6',
    difficulty: 'easy',
    playerCards: ['9', '6'],
    dealerUpcard: '6',
    handType: 'hard',
    playerTotal: 15,
    correctAction: 'S',
    acceptableActions: ['S'],
    explanation:
      'Hard 15 vs dealer 6: Stand. This is one of the clearest stand situations. ' +
      'Dealer 6 busts over 42% of the time — the highest bust rate of any upcard. ' +
      'Even though 15 is a weak total, the correct play is to stand and collect the ' +
      'dealer\'s frequent busts. Do not risk busting your hand when the dealer is ' +
      'so likely to bust themselves.',
  },

  {
    id: 'bs-hard-15-vs-7',
    difficulty: 'easy',
    playerCards: ['9', '6'],
    dealerUpcard: '7',
    handType: 'hard',
    playerTotal: 15,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Hard 15 vs dealer 7: Hit. Against a 7, the dealer will complete to 17 the ' +
      'majority of the time. A standing 15 loses to 17, 18, 19, 20, and 21 — that is ' +
      'most dealer outcomes. You must hit. Yes, you bust some of the time, but the ' +
      'alternative of standing is a greater loss in the long run.',
  },

  {
    id: 'bs-hard-15-vs-T',
    difficulty: 'medium',
    playerCards: ['9', '6'],
    dealerUpcard: 'T',
    handType: 'hard',
    playerTotal: 15,
    correctAction: 'R',
    acceptableActions: ['R', 'H'],
    explanation:
      'Hard 15 vs dealer T: Surrender (if available), otherwise hit. Surrender gives ' +
      'you back half your bet (net loss of 0.5 units) rather than playing out a hand ' +
      'that loses about 54% of the time. Against a 10-value card the dealer is very ' +
      'likely to have 20 or complete to a high total. Surrendering hard 15 vs T and ' +
      'hard 16 vs 9/T/A are the four standard surrender decisions.',
  },

  {
    id: 'bs-hard-16-vs-7',
    difficulty: 'medium',
    playerCards: ['9', '7'],
    dealerUpcard: '7',
    handType: 'hard',
    playerTotal: 16,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Hard 16 vs dealer 7: Hit. Hard 16 is the worst hand in blackjack, but against ' +
      'a dealer 7 you must hit. The dealer showing 7 makes 17 or better most of the ' +
      'time. Standing on 16 loses to 17-21 (the majority of dealer outcomes). Yes, ' +
      'you bust often when hitting 16, but the EV of hitting is still better than ' +
      'standing here.',
  },

  {
    id: 'bs-hard-16-vs-9',
    difficulty: 'medium',
    playerCards: ['9', '7'],
    dealerUpcard: '9',
    handType: 'hard',
    playerTotal: 16,
    correctAction: 'R',
    acceptableActions: ['R', 'H'],
    explanation:
      'Hard 16 vs dealer 9: Surrender (if available), otherwise hit. A dealer 9 will ' +
      'make 19 or higher a large fraction of the time. Your hard 16 wins only when the ' +
      'dealer busts (about 23% of the time against a 9). Surrendering saves half a bet ' +
      'compared to playing out a nearly hopeless situation. If surrender is not offered, ' +
      'hit — do not stand.',
  },

  {
    id: 'bs-hard-16-vs-T',
    difficulty: 'hard',
    playerCards: ['9', '7'],
    dealerUpcard: 'T',
    handType: 'hard',
    playerTotal: 16,
    correctAction: 'R',
    acceptableActions: ['R', 'H'],
    explanation:
      'Hard 16 vs dealer T: Surrender — this is the most important surrender in basic ' +
      'strategy. The dealer showing a 10-value card has a ~31% chance of having blackjack ' +
      'already, and will otherwise make 17+ a very high percentage of the time. Hard 16 ' +
      'wins by dealer bust only ~23% of the time against a T. Surrendering (losing 0.5 ' +
      'units) is strictly better than the ~0.54 unit expected loss of playing it out.',
  },

  {
    id: 'bs-hard-17-vs-A',
    difficulty: 'easy',
    playerCards: ['T', '7'],
    dealerUpcard: 'A',
    handType: 'hard',
    playerTotal: 17,
    correctAction: 'S',
    acceptableActions: ['S'],
    explanation:
      'Hard 17 vs dealer Ace: Stand — always. Hard 17 is a made hand. Although it ' +
      'loses to 18, 19, 20, and 21, hitting risks busting on any card 5 or higher ' +
      '(~77% of remaining cards). The dealer having an Ace is scary but that does not ' +
      'change the math: hard 17 stands regardless of the dealer upcard. Never hit ' +
      'hard 17 or higher.',
  },

  // ── Soft Totals ──────────────────────────────────────────────────────────────

  {
    id: 'bs-soft-13-vs-5',
    difficulty: 'medium',
    playerCards: ['A', '2'],
    dealerUpcard: '5',
    handType: 'soft',
    playerTotal: 13,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Soft 13 (A,2) vs dealer 5: Hit in a 6-deck game. Many players double here ' +
      'instinctively because the dealer shows a weak 5, but in a 6-deck S17 game the ' +
      'EV of doubling soft 13 vs 5 is very slightly below that of hitting. The correct ' +
      'double range for soft 13 (A,2) in 6-deck is only vs 5 and 6 in some rule sets, ' +
      'but the standard 6-deck basic strategy calls for a hit here. Build your total ' +
      'with the flexibility the Ace provides.',
  },

  {
    id: 'bs-soft-13-vs-6',
    difficulty: 'medium',
    playerCards: ['A', '2'],
    dealerUpcard: '6',
    handType: 'soft',
    playerTotal: 13,
    correctAction: 'D',
    acceptableActions: ['D', 'H'],
    explanation:
      'Soft 13 (A,2) vs dealer 6: Double down. Dealer 6 is the weakest possible upcard, ' +
      'busting more than 42% of the time. With a soft 13 you cannot bust on the next ' +
      'card — the Ace will drop to 1 if needed. Doubling takes advantage of the dealer\'s ' +
      'vulnerability. Even a mediocre draw like a 4 gives you soft 17, which you can ' +
      'continue to play. The EV of doubling is positive here.',
  },

  {
    id: 'bs-soft-15-vs-4',
    difficulty: 'medium',
    playerCards: ['A', '4'],
    dealerUpcard: '4',
    handType: 'soft',
    playerTotal: 15,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Soft 15 (A,4) vs dealer 4: Hit in standard 6-deck S17. The classic mnemonic for ' +
      'soft doubles is "double soft 13-18 vs dealer 4-6" but the 6-deck version narrows ' +
      'it: soft 15 (A,4) only doubles vs 4 in some liberal rule sets. The standard 6-deck ' +
      'correct play is to hit here. The ace gives you complete flexibility — you cannot ' +
      'bust — so keep drawing to improve your total.',
  },

  {
    id: 'bs-soft-17-vs-2',
    difficulty: 'medium',
    playerCards: ['A', '6'],
    dealerUpcard: '2',
    handType: 'soft',
    playerTotal: 17,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Soft 17 (A,6) vs dealer 2: Hit. Soft 17 is never a complete hand — you should ' +
      'always try to improve it. Against a dealer 2, the dealer busts ~35% of the time ' +
      'but will also make 17+ much of the time. Hitting soft 17 risks nothing (the Ace ' +
      'can become a 1), and you can reach a better total like 18, 19, or 20. ' +
      'Standing on soft 17 vs 2 is a mistake in the 6-deck game.',
  },

  {
    id: 'bs-soft-17-vs-6',
    difficulty: 'easy',
    playerCards: ['A', '6'],
    dealerUpcard: '6',
    handType: 'soft',
    playerTotal: 17,
    correctAction: 'D',
    acceptableActions: ['D'],
    explanation:
      'Soft 17 (A,6) vs dealer 6: Double down — a core basic strategy double. You cannot ' +
      'bust (the Ace will drop to 1 if needed), and the dealer is in deep trouble showing ' +
      'a 6. Any card from 2-4 gives you soft 19-21; 10-value cards give you hard 17 ' +
      '(which ties or beats many dealer outcomes). Meanwhile the dealer busts 42%+ of ' +
      'the time. The EV of doubling is strongly positive.',
  },

  {
    id: 'bs-soft-18-vs-2',
    difficulty: 'hard',
    playerCards: ['A', '7'],
    dealerUpcard: '2',
    handType: 'soft',
    playerTotal: 18,
    correctAction: 'S',
    acceptableActions: ['S'],
    explanation:
      'Soft 18 (A,7) vs dealer 2: Stand. This is one of the trickiest basic strategy ' +
      'decisions. Most players either always stand or always hit soft 18. The correct ' +
      '6-deck S17 rule is: stand vs 2, 7, and 8; double vs 3-6; hit vs 9, T, and A. ' +
      'Against a dealer 2, standing on 18 is slightly better than hitting. The dealer ' +
      'busts about 35% of the time, and your 18 wins outright against enough likely ' +
      'dealer totals to make standing the highest EV play.',
  },

  {
    id: 'bs-soft-18-vs-6',
    difficulty: 'medium',
    playerCards: ['A', '7'],
    dealerUpcard: '6',
    handType: 'soft',
    playerTotal: 18,
    correctAction: 'D',
    acceptableActions: ['D', 'S'],
    explanation:
      'Soft 18 (A,7) vs dealer 6: Double down. Even though 18 is already a solid ' +
      'total, the dealer showing a 6 busts 42%+ of the time, making any positive ' +
      'outcome with extra money on the table worthwhile. You cannot bust on one card, ' +
      'and you frequently reach 19-21. The EV of doubling exceeds standing by a ' +
      'meaningful margin against the dealer\'s worst upcard. This is a standard ' +
      'double for all soft 13-18 vs 6.',
  },

  {
    id: 'bs-soft-18-vs-9',
    difficulty: 'hard',
    playerCards: ['A', '7'],
    dealerUpcard: '9',
    handType: 'soft',
    playerTotal: 18,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Soft 18 (A,7) vs dealer 9: Hit. Many players automatically stand on 18 but ' +
      'that is a costly mistake here. A dealer showing 9 will make 19 a large percentage ' +
      'of the time (they have 19 immediately if the hole card is a 10-value). Your 18 ' +
      'loses to dealer 19, 20, and 21. You must hit to try to improve. Drawing any ' +
      'A-3 improves your total to 19-21 without risk of busting.',
  },

  {
    id: 'bs-soft-19-vs-6',
    difficulty: 'hard',
    playerCards: ['A', '8'],
    dealerUpcard: '6',
    handType: 'soft',
    playerTotal: 19,
    correctAction: 'D',
    acceptableActions: ['D', 'S'],
    explanation:
      'Soft 19 (A,8) vs dealer 6: Double down — a rare but correct edge-case double. ' +
      'Most basic strategy charts show "Stand" for soft 19, but in 6-deck S17 with DAS, ' +
      'the EV of doubling soft 19 vs a dealer 6 is marginally positive. The dealer busts ' +
      '42%+ of the time, and you cannot bust on one more card. This is considered an ' +
      'advanced basic strategy play and many players simply stand here (acceptable), ' +
      'but the GTO answer is to double.',
  },

  {
    id: 'bs-soft-20-vs-6',
    difficulty: 'easy',
    playerCards: ['A', '9'],
    dealerUpcard: '6',
    handType: 'soft',
    playerTotal: 20,
    correctAction: 'S',
    acceptableActions: ['S'],
    explanation:
      'Soft 20 (A,9) vs dealer 6: Stand — always. Soft 20 is the second-best hand in ' +
      'blackjack. There is no reason to double or hit: you already have a near-perfect ' +
      'total. Even against the weakest dealer upcard, standing on 20 is correct because ' +
      'any card drawn (except an Ace) worsens your hand. Collect the likely dealer bust ' +
      'and move on.',
  },

  // ── Pairs ────────────────────────────────────────────────────────────────────

  {
    id: 'bs-pair-2s-vs-2',
    difficulty: 'medium',
    playerCards: ['2', '2'],
    dealerUpcard: '2',
    handType: 'pair',
    playerTotal: 4,
    correctAction: 'P',
    acceptableActions: ['P', 'H'],
    explanation:
      'Pair of 2s vs dealer 2: Split in a DAS (Double After Split) game. Splitting 2s ' +
      'converts a stiff hard 4 into two hands each starting with a 2. Since DAS is ' +
      'allowed, any draw of 9 or 10 to a split 2 gives you an 11 that you can double, ' +
      'further exploiting the dealer\'s weak upcard. Without DAS the correct play would ' +
      'be hit, but the DAS rule makes splitting the highest EV option.',
  },

  {
    id: 'bs-pair-2s-vs-7',
    difficulty: 'medium',
    playerCards: ['2', '2'],
    dealerUpcard: '7',
    handType: 'pair',
    playerTotal: 4,
    correctAction: 'P',
    acceptableActions: ['P'],
    explanation:
      'Pair of 2s vs dealer 7: Split. With two hands starting at 2, you have multiple ' +
      'draws to build strong totals. Against a dealer 7, the dealer most often makes 17 ' +
      '(any 10 in the hole) but also busts about 26% of the time. Splitting gives you ' +
      'two chances to draw into a 17-21 while keeping your investment equal to one bet. ' +
      'Hard 4 is a horrible starting total — split and rebuild.',
  },

  {
    id: 'bs-pair-3s-vs-4',
    difficulty: 'easy',
    playerCards: ['3', '3'],
    dealerUpcard: '4',
    handType: 'pair',
    playerTotal: 6,
    correctAction: 'P',
    acceptableActions: ['P'],
    explanation:
      'Pair of 3s vs dealer 4: Split. Dealer 4 busts about 40% of the time. A hard 6 ' +
      'starting total is mediocre at best. By splitting you turn one likely-losing hand ' +
      'into two hands each with a full range of draws. With DAS, you can also double ' +
      'down on a strong second card like an 8 (giving 11). Always split 2s and 3s vs ' +
      'dealer 2-7 in a DAS 6-deck game.',
  },

  {
    id: 'bs-pair-4s-vs-5',
    difficulty: 'hard',
    playerCards: ['4', '4'],
    dealerUpcard: '5',
    handType: 'pair',
    playerTotal: 8,
    correctAction: 'H',
    acceptableActions: ['H', 'P'],
    explanation:
      'Pair of 4s vs dealer 5: Hit in most common interpretations. The split of 4,4 is ' +
      'only slightly profitable vs dealer 5 and 6 in DAS games, and many simple basic ' +
      'strategy charts list it as H/P depending on DAS. In a strict 6-deck S17/DAS chart, ' +
      'splitting 4s vs 5 yields a marginally positive EV. However, as a practical ' +
      'matter, hitting hard 8 vs 5 (EV close to 0) is nearly equivalent and simpler. ' +
      'This is one of the closest borderline decisions in basic strategy.',
  },

  {
    id: 'bs-pair-5s-vs-6',
    difficulty: 'easy',
    playerCards: ['5', '5'],
    dealerUpcard: '6',
    handType: 'pair',
    playerTotal: 10,
    correctAction: 'D',
    acceptableActions: ['D'],
    explanation:
      'Pair of 5s vs dealer 6: Double down — never split 5s. Two 5s give you hard 10, ' +
      'which is one of the best doubling hands. Splitting them would create two hands ' +
      'each starting with 5, which is a weak starting point. Doubling hard 10 vs dealer ' +
      '6 is maximally profitable: the dealer busts 42%+ and any 10-value card gives you ' +
      '20. The rule: treat 5,5 as a hard 10, not as a pair.',
  },

  {
    id: 'bs-pair-5s-vs-T',
    difficulty: 'medium',
    playerCards: ['5', '5'],
    dealerUpcard: 'T',
    handType: 'pair',
    playerTotal: 10,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Pair of 5s vs dealer T: Hit. Treat 5,5 as hard 10. Against a dealer 10-value ' +
      'card, doubling hard 10 is not profitable (the dealer is too strong), and splitting ' +
      'is even worse. Simply hit the hard 10, and keep drawing if needed. The dealer ' +
      'showing T has roughly a 31% chance of making 20, making extra investment unwise.',
  },

  {
    id: 'bs-pair-6s-vs-3',
    difficulty: 'easy',
    playerCards: ['6', '6'],
    dealerUpcard: '3',
    handType: 'pair',
    playerTotal: 12,
    correctAction: 'P',
    acceptableActions: ['P'],
    explanation:
      'Pair of 6s vs dealer 3: Split. Hard 12 (the combined total) is already a ' +
      'standing-or-losing proposition against the dealer. By splitting, each new hand ' +
      'starts with a 6, and a draw of 10-value gives you a solid 16 that you stand on ' +
      'vs the dealer\'s 3 (a bust card). The dealer showing a 3 busts about 37% of the ' +
      'time. Split 6s vs dealer 2-6 in standard 6-deck DAS.',
  },

  {
    id: 'bs-pair-6s-vs-7',
    difficulty: 'medium',
    playerCards: ['6', '6'],
    dealerUpcard: '7',
    handType: 'pair',
    playerTotal: 12,
    correctAction: 'H',
    acceptableActions: ['H'],
    explanation:
      'Pair of 6s vs dealer 7: Hit — do not split. Against a 7 the dealer is favored ' +
      'to make a strong hand and not bust. Splitting creates two hands each needing ' +
      'improvement from a 6 start, which is a weak position against a dealer who will ' +
      'likely make 17-21. The correct play is to hit the hard 12 (even knowing it is ' +
      'an overall losing hand) to try to improve.',
  },

  {
    id: 'bs-pair-7s-vs-7',
    difficulty: 'medium',
    playerCards: ['7', '7'],
    dealerUpcard: '7',
    handType: 'pair',
    playerTotal: 14,
    correctAction: 'P',
    acceptableActions: ['P'],
    explanation:
      'Pair of 7s vs dealer 7: Split. Hard 14 against a 7 is a losing hand — you must ' +
      'hit it and can bust. Splitting 7s vs a 7 is correct because each hand starting ' +
      'with a 7 has a reasonable chance of drawing a 10-value card to reach 17, which ' +
      'ties the dealer\'s most likely outcome. You convert one bad 14 into two hands ' +
      'with a fighting chance. Split 7s vs dealer 2-7.',
  },

  {
    id: 'bs-pair-8s-vs-A',
    difficulty: 'hard',
    playerCards: ['8', '8'],
    dealerUpcard: 'A',
    handType: 'pair',
    playerTotal: 16,
    correctAction: 'P',
    acceptableActions: ['P'],
    explanation:
      'Pair of 8s vs dealer Ace: Always split — this is one of the most important ' +
      'rules in blackjack. Hard 16 is the worst hand and a virtual guaranteed loss ' +
      'against a dealer Ace. Splitting creates two hands starting at 8; a draw of ' +
      '10-value gives 18 on each, which is competitive. Yes, splitting vs an Ace is ' +
      'losing money on average, but it loses less than standing on hard 16. Always ' +
      'split 8s regardless of the dealer upcard.',
  },

  {
    id: 'bs-pair-9s-vs-6',
    difficulty: 'easy',
    playerCards: ['9', '9'],
    dealerUpcard: '6',
    handType: 'pair',
    playerTotal: 18,
    correctAction: 'P',
    acceptableActions: ['P'],
    explanation:
      'Pair of 9s vs dealer 6: Split. Many players are tempted to stand on 18, but ' +
      'the EV of splitting two 9s vs a dealer 6 is higher. Two hands starting at 9 ' +
      'each have excellent draw potential (a 9 draws 18, a 10-value draws 19), and the ' +
      'dealer busts 42%+ of the time. You turn one 18 into two likely-winning hands. ' +
      'Split 9s vs 2-6 and 8-9 (stand vs 7, T, A).',
  },

  {
    id: 'bs-pair-9s-vs-7',
    difficulty: 'hard',
    playerCards: ['9', '9'],
    dealerUpcard: '7',
    handType: 'pair',
    playerTotal: 18,
    correctAction: 'S',
    acceptableActions: ['S'],
    explanation:
      'Pair of 9s vs dealer 7: Stand — this surprises many players. The dealer showing ' +
      'a 7 will most commonly make exactly 17 (a 10-value in the hole). Your 18 already ' +
      'beats that outcome. Splitting 9s vs 7 would break up a winning hand into two ' +
      'hands against a dealer that is unlikely to bust. The rule: stand on 9,9 vs 7, ' +
      'T, and A; split vs 2-6 and 8-9.',
  },

  {
    id: 'bs-pair-Ts-vs-6',
    difficulty: 'easy',
    playerCards: ['T', 'T'],
    dealerUpcard: '6',
    handType: 'pair',
    playerTotal: 20,
    correctAction: 'S',
    acceptableActions: ['S'],
    explanation:
      'Pair of tens vs dealer 6: Stand — never split tens. Hard 20 is the best possible ' +
      'non-blackjack hand; only dealer blackjack or a dealer 21 beats you. No matter how ' +
      'tempting it looks to split vs a weak dealer 6, you are breaking a near-guaranteed ' +
      'winner into two hands that are more likely to end up with weaker totals. This is ' +
      'the cardinal rule: never split 10-value cards.',
  },

  {
    id: 'bs-pair-As-vs-6',
    difficulty: 'easy',
    playerCards: ['A', 'A'],
    dealerUpcard: '6',
    handType: 'pair',
    playerTotal: 12,
    correctAction: 'P',
    acceptableActions: ['P'],
    explanation:
      'Pair of Aces vs dealer 6: Always split — one of the most straightforward rules. ' +
      'Two Aces as a hard total give you 12 (or soft 12/22, which is a bust). By ' +
      'splitting you put each Ace out as the first card of a new hand: any 10-value ' +
      'card gives you a blackjack-equivalent 21. Against the dealer\'s worst upcard this ' +
      'is maximally profitable. Always split Aces regardless of the dealer upcard.',
  },
];
