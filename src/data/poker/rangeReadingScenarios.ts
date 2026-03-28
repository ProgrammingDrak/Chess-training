import type { RangeReadingScenario } from '../../types/poker';

export const RANGE_READING_SCENARIOS: RangeReadingScenario[] = [

  // ── NIT 1 ── Triple-barrel value on dry board ──────────────────────────────
  {
    id: 'rr-nit-1',
    villainHandCategory: 'premium',
    profile: 'NIT',
    profileLabel: 'NIT — The Rock',
    profileDescription: 'Only plays premium hands (~10% of all hands). Raises only for value, never bluffs. Folds to aggression unless holding the nuts.',
    profileStats: 'VPIP: 10% · PFR: 9% · 3-Bet: 3% · Fold to C-Bet: 65%',
    profileColor: '#4a90d9',
    villainPosition: 'UTG',
    heroPosition: 'BTN',
    preflopAction: 'Villain raises 3× from UTG (first to act — tightest possible position). Action folds around. You call on the Button.',

    flop: [{ rank: 'A', suit: 's' }, { rank: '7', suit: 'c' }, { rank: '2', suit: 'd' }],
    flopAction: 'Villain leads out — bets 70% pot.',
    flopQuestion: {
      prompt: 'NIT bets 70% on A♠ 7♣ 2♦ (rainbow, no draws). Given their UTG raising range and this bet, what do they most likely have?',
      options: [
        'Strong value — AA (set), AK or AQ (top pair). This board hits UTG ranges hard.',
        'Middle pair — they have 77 or 22 but are bloating the pot unnecessarily.',
        'A bluff — they picked up a backdoor flush draw and are semi-bluffing.',
        'An overpair like KK or QQ, trying to find out where they stand.',
      ],
      correctIndex: 0,
      explanation: 'NITs never bluff. A 70% bet from UTG on a dry A-high board means they connected hard — either AA (flopped top set) or a strong ace like AK/AQ. KK/QQ would bet smaller to control pot size when an overcard has arrived.',
    },

    turn: { rank: 'J', suit: 'h' },
    turnAction: 'Villain bets 80% pot.',
    turnNote: 'The J♥ is a mostly blank card — no flush draws complete, and straights are unlikely given the UTG range. Villain\'s larger bet means their range is narrowing. They\'re not slowing down.',

    river: { rank: '5', suit: 's' },
    riverAction: 'Villain bets pot (overbet).',
    riverQuestion: {
      prompt: 'NIT triple-barrelled A♠7♣2♦ · J♥ · 5♠ with escalating sizes (70% → 80% → pot overbet). What do they have?',
      options: [
        'A♥A♣ — Flopped top set. Value betting for maximum chips on a board where you can\'t fold.',
        'A♦K♠ — Top pair top kicker. Three streets of thin value.',
        'K♣K♥ — Overpair, barrelling despite the ace on board.',
        'K♦Q♦ — A pure bluff that turned into a three-street commitment.',
      ],
      correctIndex: 0,
      explanation: 'NITs absolutely do not bluff three streets. The escalating overbet pattern screams the nuts — they flopped top set (AA) on a dry board and want every chip. AK would likely check-raise or slow down. KK would rarely triple-barrel with an ace out there.',
    },

    revealCard1: { rank: 'A', suit: 'h' },
    revealCard2: { rank: 'A', suit: 'c' },
    revealHand: 'A♥A♣ — Flopped Top Set',
    revealExplanation: 'The NIT flopped the best possible hand on this board and value-bet every street with increasing sizes. Against NITs, triple barrels on dry boards always mean the nuts. The key tell: escalating bet sizes from a player who almost never bluffs.',
  },

  // ── NIT 2 ── Slow-play trap → river check-raise ────────────────────────────
  {
    id: 'rr-nit-2',
    villainHandCategory: 'premium',
    profile: 'NIT',
    profileLabel: 'NIT — The Rock',
    profileDescription: 'Only plays premium hands. Occasionally slow-plays monsters to induce bluffs from aggressive players.',
    profileStats: 'VPIP: 10% · PFR: 9% · 3-Bet: 3% · Fold to C-Bet: 65%',
    profileColor: '#4a90d9',
    villainPosition: 'CO',
    heroPosition: 'BTN',
    preflopAction: 'Villain opens 2.5× from CO. You 3-bet to 8BB. Villain calls (does NOT 4-bet — unusual for a NIT, suggests a hand they want to disguise).',

    flop: [{ rank: 'K', suit: 's' }, { rank: '9', suit: 'd' }, { rank: '3', suit: 'c' }],
    flopAction: 'Villain checks. You c-bet 50% pot. Villain calls.',
    flopQuestion: {
      prompt: 'NIT called your 3-bet preflop, then check-called your c-bet on K♠ 9♦ 3♣ (rainbow). A NIT who calls a 3-bet and check-calls the flop is representing...',
      options: [
        'A set (KK or 99) — trapping. NITs slow-play their monsters by calling rather than raising.',
        'AK (TPTK) — they\'d have 4-bet preflop, not called.',
        'A draw — there are almost none on this board, making this very unlikely.',
        'Air — they floated and will bluff the turn.',
      ],
      correctIndex: 0,
      explanation: 'When a NIT calls a 3-bet and then check-calls rather than raising or folding, they almost always have a monster they\'re disguising. AK would have 4-bet preflop. Draws barely exist on K-9-3 rainbow. This screams KK or 99.',
    },

    turn: { rank: '2', suit: 'h' },
    turnAction: 'Villain checks again. You bet 55% pot. Villain calls again.',
    turnNote: 'The 2♥ is a complete blank. Villain calling two streets now without raising? They\'re either trapped with a set or have a very strong hand they\'re milking. Their patience is suspicious.',

    river: { rank: 'Q', suit: 'c' },
    riverAction: 'Villain checks. You bet 65% pot. Villain CHECK-RAISES to 3× your bet.',
    riverQuestion: {
      prompt: 'NIT check-called two streets, then check-raised the river on K♠9♦3♣·2♥·Q♣. What do they have?',
      options: [
        'K♠K♦ — Flopped top set. They slow-played three streets and now want maximum value.',
        '9♦9♣ — Middle set. Same slow-play line, raising to extract chips.',
        'Q♠Q♥ — Flopped nothing, turned nothing, rivered top set.',
        'A♠K♥ — Rivered top two pair and raised for value.',
      ],
      correctIndex: 0,
      explanation: 'A NIT check-raising the river after check-calling twice is the definition of a monster hand. KK is the most likely (top set), though 99 is possible (middle set). The preflop call of your 3-bet makes KK most likely — they specifically called to disguise the hand. NITs NEVER bluff-raise rivers.',
    },

    revealCard1: { rank: 'K', suit: 'd' },
    revealCard2: { rank: 'K', suit: 'h' },
    revealHand: 'K♦K♥ — Flopped Top Set (slow-played)',
    revealExplanation: 'The NIT called your 3-bet with KK to disguise their hand, then check-called every street to let you build the pot, and finally check-raised the river for maximum value. This is textbook NIT slow-play. Lesson: when a NIT refuses to raise for 3 streets, be afraid of their check-raise.',
  },

  // ── TAG 1 ── Semi-bluff on draw-heavy board, gives up river ────────────────
  {
    id: 'rr-tag-1',
    villainHandCategory: 'interesting',
    profile: 'TAG',
    profileLabel: 'TAG — Tight-Aggressive',
    profileDescription: 'GTO-balanced player. Opens 18-22% of hands. Bets both for value and as semi-bluffs with draws. Balanced and hard to read.',
    profileStats: 'VPIP: 20% · PFR: 18% · 3-Bet: 8% · C-Bet: 65%',
    profileColor: '#9b59b6',
    villainPosition: 'BTN',
    heroPosition: 'BB',
    preflopAction: 'Villain opens 2.5× from the Button (wide range). You call from the BB.',

    flop: [{ rank: 'J', suit: 'h' }, { rank: 'T', suit: 's' }, { rank: '8', suit: 'h' }],
    flopAction: 'Villain bets 50% pot.',
    flopQuestion: {
      prompt: 'TAG bets 50% on J♥ T♠ 8♥ — a highly coordinated board with flush draws and straight draws everywhere. What\'s their range?',
      options: [
        'Balanced: value (JJ, TT, T9, J8, etc.) AND semi-bluffs (KQ, A♥Q♥, 97s). TAGs bet both.',
        'Pure value only — they always have it on wet boards.',
        'Pure bluff — they can\'t have value on this board.',
        'Only strong hands like JJ or TT — they\'re over-betting their monsters.',
      ],
      correctIndex: 0,
      explanation: 'This is textbook TAG play: a 50% half-pot bet on a wet board is a balanced range — strong made hands (sets, two pair) AND semi-bluffs (straight draws, flush draws). The medium sizing signals range betting, not pure polarization.',
    },

    turn: { rank: '9', suit: 'h' },
    turnAction: 'Villain bets 65% pot.',
    turnNote: 'The 9♥ is a bomb card — it completes straights (KQ, Q7) and brings a three-flush on the board. Villain continues to bet despite the scary card. This either means they have value (have a straight or full house) or are pressing a draw that just got better.',

    river: { rank: '2', suit: 'c' },
    riverAction: 'Villain checks.',
    riverQuestion: {
      prompt: 'TAG bet flop (50%) and turn (65%) on J♥T♠8♥·9♥, then CHECKS the blank 2♣ river. What do they have?',
      options: [
        'K♥Q♥ — Had nut flush draw + open-ended straight draw, both missed. Classic semi-bluff give-up.',
        'J♣J♦ — Flopped top set, checking to induce a bluff from you.',
        'T♥9♣ — Made a straight on the turn, slowplaying the river.',
        'A♠A♦ — Overpair that was betting for protection, now checking back.',
      ],
      correctIndex: 0,
      explanation: 'TAGs give up on river when their draw misses. K♥Q♥ had an absolute monster draw (nut flush draw + OESD = 15 outs), semi-bluffed two streets, but when the blank 2♣ fell, they had nothing and checked. The turn 9♥ actually completed straights but not their specific hand. If TAG had value, they\'d bet the river.',
    },

    revealCard1: { rank: 'K', suit: 'h' },
    revealCard2: { rank: 'Q', suit: 'h' },
    revealHand: 'K♥Q♥ — Nut Flush Draw + Open-Ended Straight Draw (missed)',
    revealExplanation: 'TAG had 15 outs on the flop (9 flush outs + 6 additional straight outs not overlapping). With such a strong draw, betting two streets as a semi-bluff is correct GTO play. The river blank ended their equity — they had nothing and correctly checked back.',
  },

  // ── TAG 2 ── Thin value bets, checks back river ────────────────────────────
  {
    id: 'rr-tag-2',
    villainHandCategory: 'premium',
    profile: 'TAG',
    profileLabel: 'TAG — Tight-Aggressive',
    profileDescription: 'GTO-balanced player who bets for thin value when ahead and controls pot size when uncertain. Rarely gives away hand strength.',
    profileStats: 'VPIP: 20% · PFR: 18% · 3-Bet: 8% · C-Bet: 65%',
    profileColor: '#9b59b6',
    villainPosition: 'HJ',
    heroPosition: 'CO',
    preflopAction: 'Villain opens 2.5× from HJ. You call from CO with position.',

    flop: [{ rank: 'A', suit: 'c' }, { rank: '5', suit: 'd' }, { rank: '3', suit: 'h' }],
    flopAction: 'Villain bets 33% pot (small sizing).',
    flopQuestion: {
      prompt: 'TAG bets just 1/3 pot on A♣ 5♦ 3♥ — a dry board where the ace dominates. What does a small bet signal here?',
      options: [
        'Thin value with a medium-strength hand — they have an ace but want calls from worse. Small bet = wide range.',
        'A bluff — they have nothing and are betting small to risk less.',
        'A monster (set or two pair) — they\'re betting small to keep you in.',
        'Total uncertainty — they don\'t know what to do and bet the minimum.',
      ],
      correctIndex: 0,
      explanation: 'TAGs bet small (1/3 pot) on dry boards as a "range bet" — they have a wide range of medium-strength hands (Ax, pocket pairs below the board) and want cheap value while keeping worse hands in. A large bet here would fold out all worse holdings.',
    },

    turn: { rank: 'K', suit: 's' },
    turnAction: 'Villain bets 45% pot.',
    turnNote: 'The K♠ is an interesting card. Someone with AK just made two pair. Villain continues with a medium bet. Their range is getting clearer — they likely have an ace that improved or a strong ace that\'s still ahead.',

    river: { rank: '7', suit: 'd' },
    riverAction: 'Villain checks.',
    riverQuestion: {
      prompt: 'TAG bet small (33%) on the flop, medium (45%) on the turn when the King fell, then checked the 7♦ river. What hand makes this line most sense?',
      options: [
        'A♦K♣ — Hit two pair on the turn, bet for value, but checks river to control pot size and let you bluff.',
        'A♣Q♠ — Top pair, bet two streets for value, river is a free showdown.',
        'K♣K♦ — Flopped middle pair, turned top set, extracting value.',
        '5♣5♦ — Flopped bottom set and slow-played the whole way.',
      ],
      correctIndex: 0,
      explanation: 'AK fits this line perfectly: small flop bet (ace is good but no need to go big), medium turn bet (turned top two pair — now more confident), then checking the river (two pair is strong but not a monster on A-5-3-K-7, pot control is fine). A TAG checks back rivers with medium-strong hands to induce bluffs.',
    },

    revealCard1: { rank: 'A', suit: 'd' },
    revealCard2: { rank: 'K', suit: 'h' },
    revealHand: 'A♦K♥ — Top Two Pair (flopped top pair, turned two pair)',
    revealExplanation: 'Classic TAG thin-value line. Small bet on the flop (ace is good, keep range wide), medium bet on the turn when they improved to two pair, river check to control pot and possibly induce a bluff. They don\'t need to overbet — they have a strong enough hand to get value but don\'t want to build a huge pot with two pair on a board with potential straights.',
  },

  // ── LAG 1 ── Multi-street bluff using scare cards ──────────────────────────
  {
    id: 'rr-lag-1',
    villainHandCategory: 'interesting',
    profile: 'LAG',
    profileLabel: 'LAG — Loose-Aggressive',
    profileDescription: 'Plays 30-40% of hands aggressively. 3-bets wide, barrels frequently, uses scare cards to pressure opponents. Bluffs at high frequency.',
    profileStats: 'VPIP: 35% · PFR: 30% · 3-Bet: 14% · C-Bet: 80%',
    profileColor: '#e67e22',
    villainPosition: 'SB',
    heroPosition: 'BTN',
    preflopAction: 'You open 2.5× from the BTN. Villain 3-bets to 9BB from the SB (LAG 3-bets wide from the SB — over 14% of hands). You call.',

    flop: [{ rank: 'Q', suit: 'c' }, { rank: '7', suit: 'd' }, { rank: '2', suit: 's' }],
    flopAction: 'Villain bets 70% pot.',
    flopQuestion: {
      prompt: 'LAG 3-bets SB and bets 70% pot on Q♣ 7♦ 2♠ (dry rainbow). What\'s their betting range?',
      options: [
        'Very wide — QQ (set), AQ (TPTK), and also 5♥4♥, A♠J♠ type bluffs. LAGs barrel wide on dry boards.',
        'Only value hands — they only bet when they have Q or better.',
        'Only bluffs — no LAG has value on this board.',
        'Always a draw — they must have a backdoor something.',
      ],
      correctIndex: 0,
      explanation: 'A LAG 3-betting from the SB and continuing on Q-7-2 has an extremely wide range — both strong value (QQ, AQ, KQ) and total air (any two cards they decided to barrel). The large bet size is a polarization signal: either they have it or they don\'t.',
    },

    turn: { rank: 'A', suit: 'h' },
    turnAction: 'Villain bets 80% pot.',
    turnNote: 'The A♥ is a key scare card — LAGs love barrelling when an Ace falls because it represents so many hands in their wide 3-betting range. The large bet says "I have an ace now" but also could mean "this ace scared you so I\'m using it."',

    river: { rank: 'K', suit: 'd' },
    riverAction: 'Villain bets pot (overbet).',
    riverQuestion: {
      prompt: 'LAG bet Q♣7♦2♠·A♥·K♦ with escalating sizes. The board now shows Q-7-2-A-K (three big cards, no draws). After 3 streets of aggression, what\'s most likely?',
      options: [
        'A multi-street bluff — scare cards (Ace then King) gave them excuses to keep barrelling. Their actual hand missed.',
        'AK (flopped nothing, turned top pair, rivered two pair) — bet for value all three streets.',
        'QQ (flopped top set) — value betting relentlessly.',
        'AA (bet every street because they had the best hand the whole time).',
      ],
      correctIndex: 0,
      explanation: 'This is a classic LAG bluff pattern: barrel the flop to take down the pot, barrel when the Ace falls ("I 3-bet, I must have an ace"), barrel again when the King falls ("now I have AK"). Their actual hand (6♠5♣ or similar) was air throughout. The pot overbet on the river is the final pressure play.',
    },

    revealCard1: { rank: '6', suit: 's' },
    revealCard2: { rank: '5', suit: 'c' },
    revealHand: '6♠5♣ — Complete Air (pure bluff)',
    revealExplanation: 'Pure bluff from start to finish. The LAG 3-bet with 65o (a common LAG bluff range), then used every scare card — the flop (representing a queen), the Ace (representing AK/AA from their wide 3-bet range), and the King — to apply maximum pressure. Against LAGs, you must call down with top pair or better.',
  },

  // ── LAG 2 ── LAG actually flops a monster ──────────────────────────────────
  {
    id: 'rr-lag-2',
    villainHandCategory: 'premium',
    profile: 'LAG',
    profileLabel: 'LAG — Loose-Aggressive',
    profileDescription: 'Wide aggressive player who often bluffs — but sometimes they\'ve actually flopped the nuts. The challenge is telling the difference.',
    profileStats: 'VPIP: 35% · PFR: 30% · 3-Bet: 14% · C-Bet: 80%',
    profileColor: '#e67e22',
    villainPosition: 'BTN',
    heroPosition: 'BB',
    preflopAction: 'Villain opens 2.5× from the BTN (extremely wide — nearly every hand). You call from the BB.',

    flop: [{ rank: '8', suit: 's' }, { rank: '8', suit: 'c' }, { rank: '3', suit: 'd' }],
    flopAction: 'Villain bets 75% pot.',
    flopQuestion: {
      prompt: 'LAG bets 75% pot on 8♠ 8♣ 3♦ — a paired dry board. What does a large bet here typically mean?',
      options: [
        'Polarized — either they have an 8 (trips/quads) / 33 (full house), OR they\'re bluffing with overs. Dry paired boards = polarized bets.',
        'They always have a bluff here — paired boards never hit wide ranges.',
        'Middle pair (77, 66) — they\'re betting for protection against your overcards.',
        'Top pair — they have Ax and are value betting.',
      ],
      correctIndex: 0,
      explanation: 'A large bet on a paired dry board is always polarized. The LAG either has trips (an 8, making trips) or a full house (88 for quads or 33 for the boat), OR they\'re pure bluffing with overs. Middle pair or weak holdings would bet smaller — or not at all.',
    },

    turn: { rank: '8', suit: 'h' },
    turnAction: 'Villain bets 80% pot.',
    turnNote: 'The 8♥ is a third eight on the board — quads are now possible if villain had 88 preflop. Anyone who had an 8 now has at least trips. Anyone who didn\'t hits a dangerous board. Villain still has the same large bet.',

    river: { rank: 'K', suit: 's' },
    riverAction: 'Villain shoves all-in.',
    riverQuestion: {
      prompt: 'Board runs out 8♠8♣3♦·8♥·K♠. LAG shoves the river. Given they open ANY two cards from the BTN, what\'s the most likely hand now?',
      options: [
        '8♦3♣ — Flopped a full house (8s full of 3s), improved to quads when 8♥ fell.',
        'K♦K♣ — Rivered top full house. They\'re shoving for value.',
        'A♠A♦ — Overpair that never improved, bluffing the river.',
        'J♠T♠ — Missed straight draw, now shoving as a bluff.',
      ],
      correctIndex: 0,
      explanation: 'Even LAGs have the nuts sometimes — and 8-3 is absolutely in their wide BTN opening range. They flopped a full house (eights full of threes), the turn gave them quads (four eights), and they shoved the river for maximum value. The lesson: the board texture heavily weights villain towards value even for a LAG.',
    },

    revealCard1: { rank: '8', suit: 'd' },
    revealCard2: { rank: '3', suit: 'c' },
    revealHand: '8♦3♣ — Flopped Full House, Turned Quads',
    revealExplanation: 'Even wild LAGs flop the nuts. 8♦3♣ is definitely in the BTN opening range of a LAG. They flopped a full house (eights full of threes), turned quads (four eights), and rightfully shoved the river. The key lesson: when the board heavily favors value hands (paired board = full houses and quads), even a LAG\'s aggressive line is weighted toward the top of their range.',
  },

  // ── Calling Station ── Passive caller hits a hidden wheel ──────────────────
  {
    id: 'rr-station-1',
    villainHandCategory: 'interesting',
    profile: 'calling_station',
    profileLabel: 'Calling Station — The Sticky Fish',
    profileDescription: 'Calls too much with any pair, any draw, or any "potential." Rarely raises and almost never folds once in the hand. Passive but dangerous when they hit.',
    profileStats: 'VPIP: 55% · PFR: 8% · Fold to C-Bet: 20% · Aggression Factor: 0.8',
    profileColor: '#f1c40f',
    villainPosition: 'BTN',
    heroPosition: 'CO',
    preflopAction: 'You open 2.5× from CO. Villain calls from the BTN (they call pre with a huge range — any ace, any pair, any two suited cards).',

    flop: [{ rank: 'A', suit: 'h' }, { rank: '5', suit: 'd' }, { rank: '2', suit: 'c' }],
    flopAction: 'You bet 50% pot. Villain calls.',
    flopQuestion: {
      prompt: 'Calling station calls your 50% c-bet on A♥ 5♦ 2♣. They never fold one pair. What\'s most likely in their range?',
      options: [
        'Any ace (A2-A9 type hands), any pair (55, 22), or backdoor draws (3♠4♠ = gutshot). They call with all of these.',
        'Only strong aces — they\'d have raised with AK or AQ preflop.',
        'A monster — they\'re trapping with AA or 55.',
        'Pure air — they\'re planning to bluff a scary turn card.',
      ],
      correctIndex: 0,
      explanation: 'Calling stations call with nearly everything that has any showdown value or draw equity: any pair (bottom pair, middle pair), any ace, any gutshot. They\'re not trapping — they just can\'t find the fold button.',
    },

    turn: { rank: '4', suit: 's' },
    turnAction: 'You bet 60% pot. Villain calls again — still passive.',
    turnNote: 'The 4♠ brings a backdoor straight draw (any 3 completes A-2-3-4-5 or 2-3-4-5-6). Villain called again. A player who has been passively calling suddenly becomes a concern when the board runs out interesting draws.',

    river: { rank: '3', suit: 'h' },
    riverAction: 'The 3♥ completes the low straight. Villain LEADS for 80% pot — suddenly aggressive!',
    riverQuestion: {
      prompt: 'Passive calling station, who only called twice, suddenly LEADS for 80% pot when the 3♥ completes the board (A♥5♦2♣·4♠·3♥). What happened?',
      options: [
        '6♠3♠ or similar — called with a backdoor straight draw, hit the wheel (A-2-3-4-5) or 2-3-4-5-6, now betting the nuts.',
        'A♠4♣ — made two pair on the turn, now leading for value.',
        'A♦A♣ — was trapping with top set the whole time.',
        'Complete bluff — the 3 scared them and they\'re trying to fold you out.',
      ],
      correctIndex: 0,
      explanation: 'Calling stations lead the river when they hit the nuts. They\'ll passively call with any draw (even weak ones like a backdoor straight draw with 6-3), and when the board completes, they suddenly spring to life with a big lead. The golden rule: when a calling station bets the river, they have it.',
    },

    revealCard1: { rank: '6', suit: 'd' },
    revealCard2: { rank: '3', suit: 'c' },
    revealHand: '6♦3♣ — Hit the Straight (2-3-4-5-6)',
    revealExplanation: 'The calling station called pre and two streets with 6-3 (backdoor straight draw). The 4 on the turn gave them a gutshot, the 3 on the river completed the straight. The universal rule: passive players who lead the river have a strong hand. Never bluff-catch calling stations on the river when they wake up.',
  },

  // ── Maniac ── Pressure bluff, nothing but air ──────────────────────────────
  {
    id: 'rr-maniac-1',
    villainHandCategory: 'interesting',
    profile: 'maniac',
    profileLabel: 'Maniac — The Aggro Bomb',
    profileDescription: 'Raises 50%+ of hands, 3-bets constantly, barrels every street. Bluffs at extreme frequencies. Almost impossible to put on a hand — they have everything and nothing.',
    profileStats: 'VPIP: 60% · PFR: 52% · 3-Bet: 20%+ · Fold to River Bet: 15%',
    profileColor: '#e74c3c',
    villainPosition: 'SB',
    heroPosition: 'BTN',
    preflopAction: 'You open 2.5× from the BTN. Maniac 3-bets to 10BB from the SB (they do this constantly — any two cards). You call.',

    flop: [{ rank: 'K', suit: 's' }, { rank: 'J', suit: 'c' }, { rank: '5', suit: 'd' }],
    flopAction: 'Villain bets 90% pot.',
    flopQuestion: {
      prompt: 'Maniac 3-bets from SB then overbets 90% pot on K♠ J♣ 5♦. After a 3-bet, what does their range look like here?',
      options: [
        'Massive range — from KK (top set) to 8♦4♦ (pure air). Their 3-bet range is so wide that almost any hand is possible.',
        'Only strong hands — they must have KK, JJ, or KJ to bet this large.',
        'Only bluffs — they never have value when they\'re aggressive like this.',
        'Mostly draws — they c-bet with every drawing hand.',
      ],
      correctIndex: 0,
      explanation: 'A Maniac 3-betting from the SB and c-betting 90% can have literally anything. Their preflop 3-betting range is 20%+ of all hands. On this board, they have value (KK, JJ, 55, KJ) AND every possible bluff hand. Their range is nearly impossible to narrow.',
    },

    turn: { rank: 'Q', suit: 'd' },
    turnAction: 'Villain bets 90% pot again.',
    turnNote: 'The Q♦ brings a one-card straight (AT makes the nuts). Villain doesn\'t slow down — another 90% bet. A player who fires two huge bullets without slowing down is either nutted or committed to a bluff. Against a Maniac, both are equally likely.',

    river: { rank: '2', suit: 'h' },
    riverAction: 'Villain shoves all-in.',
    riverQuestion: {
      prompt: 'Maniac fired 90%, 90%, and then shoved on K♠J♣5♦·Q♦·2♥. The river changed nothing. What is most likely?',
      options: [
        'A pure bluff — 8♠7♠ or similar. They applied pressure every street with nothing.',
        'AT — flopped a gutshot, turned Broadway, now value-shoving the nuts.',
        'KK — flopped top set and value-bet three streets.',
        'Q♠J♣ — turned two pair and shoved for maximum value.',
      ],
      correctIndex: 0,
      explanation: 'Against Maniacs, bluffs are the most common hand. Their range is so wide that air is their highest-frequency holding when they barrel three streets. The 2♥ river changed nothing — they were either nutted (and would shove) or bluffing (and still shove). Call them down with top pair or better. You\'ll be right often enough.',
    },

    revealCard1: { rank: '8', suit: 's' },
    revealCard2: { rank: '7', suit: 's' },
    revealHand: '8♠7♠ — Complete Bluff (pure air)',
    revealExplanation: 'Pure bluff from start to finish. The Maniac 3-bet with 87s (suited = slightly prettier bluff), c-bet with a gutshot on the flop (K-J-5, 9 makes the straight), the Q gave them additional straight draws, and they barrel-shoved the river when everything missed. Against Maniacs: call them with strong top pair or better. Their bluff frequency is enormous.',
  },
];
