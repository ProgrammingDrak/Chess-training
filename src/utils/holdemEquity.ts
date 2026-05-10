import type { Card, Rank, Suit } from '../types/poker';
import { cardKey } from './cardInput';

export type HoldemStreet = 'preflop' | 'flop' | 'turn' | 'river';

export interface HoldemStreetStats {
  street: HoldemStreet;
  label: string;
  board: Card[];
  available: boolean;
  equityPct: number | null;
  winPct: number | null;
  tiePct: number | null;
  lossPct: number | null;
  samples: number;
  exact: boolean;
  madeHand: string;
  handClass: string;
  outs: number | null;
  outDetails: HoldemOutDetail[];
  drawSummary: string;
  boardTexture: string[];
}

export interface HoldemOutDetail {
  card: Card;
  improvesTo: string;
  handRank: number;
  note: string;
  improvesCurrent: boolean;
  improvesHandClass: boolean;
}

export interface SpecificHoldemPlayer {
  id: string;
  name: string;
  cards: Card[];
}

export interface SpecificHoldemPlayerResult {
  id: string;
  name: string;
  cards: Card[];
  equityPct: number;
  winPct: number;
  tiePct: number;
  lossPct: number;
  wins: number;
  ties: number;
  losses: number;
  equityShares: number;
}

export interface SpecificHoldemEquityResult {
  available: boolean;
  error: string | null;
  board: Card[];
  missingBoardCards: number;
  samples: number;
  exact: boolean;
  players: SpecificHoldemPlayerResult[];
}

export type NextCardImpactCategory = 'danger' | 'chop' | 'hero-upgrade';

export interface NextCardImpact {
  card: Card;
  category: NextCardImpactCategory;
  label: string;
  handClass: string;
  handRank: number;
  affectedPlayerId: string | null;
  affectedPlayerName: string | null;
  defaultIncluded: boolean;
}

export interface NextCardImpactResult {
  available: boolean;
  error: string | null;
  nextStreetLabel: 'Turn' | 'River' | null;
  totalNextCards: number;
  currentHeroHandRank: number;
  currentHeroHandClass: string | null;
  impacts: NextCardImpact[];
}

interface HandValue {
  rank: number;
  tiebreakers: number[];
}

const RANK_VALUE: Record<Rank, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
};

const VALUE_RANK: Record<number, Rank> = {
  14: 'A',
  13: 'K',
  12: 'Q',
  11: 'J',
  10: 'T',
  9: '9',
  8: '8',
  7: '7',
  6: '6',
  5: '5',
  4: '4',
  3: '3',
  2: '2',
};

const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const MAX_EXACT_SPECIFIC_RUNOUTS = 50000;
const SPECIFIC_RUNOUT_SAMPLES = 2500;
const HAND_CLASS = [
  'High card',
  'One pair',
  'Two pair',
  'Three of a kind',
  'Straight',
  'Flush',
  'Full house',
  'Four of a kind',
  'Straight flush',
];

export function buildDeck(): Card[] {
  return RANKS.flatMap(rank => SUITS.map(suit => ({ rank, suit })));
}

export function handNotationFromCards(cards: Card[]): string | null {
  if (cards.length !== 2) return null;
  const [a, b] = cards;
  const av = RANK_VALUE[a.rank];
  const bv = RANK_VALUE[b.rank];
  if (av === bv) return `${a.rank}${b.rank}`;
  const high = av > bv ? a : b;
  const low = av > bv ? b : a;
  return `${high.rank}${low.rank}${high.suit === low.suit ? 's' : 'o'}`;
}

export function analyzeHoldemScenario(heroCards: Card[], boardCards: Card[]): HoldemStreetStats[] {
  const streets: Array<{ street: HoldemStreet; label: string; needed: number }> = [
    { street: 'preflop', label: 'Preflop', needed: 0 },
    { street: 'flop', label: 'Flop', needed: 3 },
    { street: 'turn', label: 'Turn', needed: 4 },
    { street: 'river', label: 'River', needed: 5 },
  ];

  return streets.map(({ street, label, needed }) => {
    const board = boardCards.slice(0, needed);
    const available = heroCards.length === 2 && boardCards.length >= needed;
    if (!available) {
      return emptyStreet(street, label, board, needed);
    }

    const equity = calculateHeadsUpEquity(heroCards, board);
    const hand = summarizeMadeHand(heroCards, board);
    const draws = summarizeDraws(heroCards, board);

    return {
      street,
      label,
      board,
      available: true,
      equityPct: equity.equityPct,
      winPct: equity.winPct,
      tiePct: equity.tiePct,
      lossPct: equity.lossPct,
      samples: equity.samples,
      exact: equity.exact,
      madeHand: hand.madeHand,
      handClass: hand.handClass,
      outs: draws.outs,
      outDetails: draws.outDetails,
      drawSummary: draws.summary,
      boardTexture: board.length >= 3 ? describeBoardTexture(board) : ['No board yet'],
    };
  });
}

export function calculateSpecificHoldemEquity(
  players: SpecificHoldemPlayer[],
  boardCards: Card[],
): SpecificHoldemEquityResult {
  const activePlayers = players.filter(player => player.cards.length > 0);
  const completePlayers = activePlayers.filter(player => player.cards.length === 2);
  const board = boardCards.slice(0, 5);

  const basePlayers = players.map(player => ({
    id: player.id,
    name: player.name,
    cards: player.cards,
    equityPct: 0,
    winPct: 0,
    tiePct: 0,
    lossPct: 0,
    wins: 0,
    ties: 0,
    losses: 0,
    equityShares: 0,
  }));

  if (completePlayers.length < 2) {
    return {
      available: false,
      error: 'Add at least two complete hands.',
      board,
      missingBoardCards: Math.max(0, 5 - board.length),
      samples: 0,
      exact: true,
      players: basePlayers,
    };
  }

  const knownCards = [...completePlayers.flatMap(player => player.cards), ...board];
  const knownKeys = knownCards.map(cardKey);
  if (new Set(knownKeys).size !== knownKeys.length) {
    return {
      available: false,
      error: 'Each card can only appear once.',
      board,
      missingBoardCards: Math.max(0, 5 - board.length),
      samples: 0,
      exact: true,
      players: basePlayers,
    };
  }

  if (board.length > 5) {
    return {
      available: false,
      error: 'The board can only have five cards.',
      board,
      missingBoardCards: 0,
      samples: 0,
      exact: true,
      players: basePlayers,
    };
  }

  const missingBoardCards = 5 - board.length;
  const deck = buildDeck().filter(card => !knownKeys.includes(cardKey(card)));
  const totalRunouts = combinationCount(deck.length, missingBoardCards);
  const exact = totalRunouts <= MAX_EXACT_SPECIFIC_RUNOUTS;
  const results = new Map<string, SpecificHoldemPlayerResult>(
    completePlayers.map(player => [
      player.id,
      {
        id: player.id,
        name: player.name,
        cards: player.cards,
        equityPct: 0,
        winPct: 0,
        tiePct: 0,
        lossPct: 0,
        wins: 0,
        ties: 0,
        losses: 0,
        equityShares: 0,
      },
    ]),
  );

  let samples = 0;
  const runout: Card[] = [];

  function scoreRunout(finalBoard: Card[]) {
    const scored = completePlayers.map(player => ({
      player,
      value: evaluateBestHand([...player.cards, ...finalBoard]),
    }));
    let best = scored[0].value;
    for (let i = 1; i < scored.length; i++) {
      if (compareHandValues(scored[i].value, best) > 0) best = scored[i].value;
    }

    const winners = scored.filter(score => compareHandValues(score.value, best) === 0);
    const winnerIds = new Set(winners.map(winner => winner.player.id));
    const share = 1 / winners.length;

    for (const score of scored) {
      const result = results.get(score.player.id);
      if (!result) continue;
      if (winnerIds.has(score.player.id)) {
        result.equityShares += share;
        if (winners.length === 1) result.wins++;
        else result.ties++;
      } else {
        result.losses++;
      }
    }
    samples++;
  }

  function enumerateRunouts(startIndex: number) {
    if (runout.length === missingBoardCards) {
      scoreRunout([...board, ...runout]);
      return;
    }

    const needed = missingBoardCards - runout.length;
    for (let i = startIndex; i <= deck.length - needed; i++) {
      runout.push(deck[i]);
      enumerateRunouts(i + 1);
      runout.pop();
    }
  }

  if (exact) {
    enumerateRunouts(0);
  } else {
    const seed = seedFromCards(knownCards);
    for (let i = 0; i < SPECIFIC_RUNOUT_SAMPLES; i++) {
      scoreRunout([...board, ...sampleCards(deck, missingBoardCards, seed + i * 131)]);
    }
  }

  const finalPlayers = players.map(player => {
    const result = results.get(player.id);
    if (!result || samples === 0) {
      return basePlayers.find(base => base.id === player.id) ?? {
        id: player.id,
        name: player.name,
        cards: player.cards,
        equityPct: 0,
        winPct: 0,
        tiePct: 0,
        lossPct: 0,
        wins: 0,
        ties: 0,
        losses: 0,
        equityShares: 0,
      };
    }
    return {
      ...result,
      equityPct: (result.equityShares / samples) * 100,
      winPct: (result.wins / samples) * 100,
      tiePct: (result.ties / samples) * 100,
      lossPct: (result.losses / samples) * 100,
    };
  });

  return {
    available: true,
    error: null,
    board,
    missingBoardCards,
    samples,
    exact,
    players: finalPlayers,
  };
}

export function analyzeNextCardImpacts(
  heroCards: Card[],
  opponents: SpecificHoldemPlayer[],
  boardCards: Card[],
): NextCardImpactResult {
  const board = boardCards.slice(0, 5);
  const completeOpponents = opponents.filter(player => player.cards.length === 2);
  const currentHeroValue = heroCards.length === 2 && board.length >= 3
    ? evaluateBestHand([...heroCards, ...board])
    : null;

  if (heroCards.length !== 2 || board.length < 3 || board.length >= 5 || completeOpponents.length === 0 || !currentHeroValue) {
    return {
      available: false,
      error: 'Need Hero, at least one exact opponent, and a flop or turn.',
      nextStreetLabel: board.length === 3 ? 'Turn' : board.length === 4 ? 'River' : null,
      totalNextCards: 0,
      currentHeroHandRank: currentHeroValue?.rank ?? 0,
      currentHeroHandClass: currentHeroValue ? HAND_CLASS[currentHeroValue.rank] : null,
      impacts: [],
    };
  }

  const knownCards = [...heroCards, ...completeOpponents.flatMap(player => player.cards), ...board];
  const knownKeys = knownCards.map(cardKey);
  if (new Set(knownKeys).size !== knownKeys.length) {
    return {
      available: false,
      error: 'Each card can only appear once.',
      nextStreetLabel: board.length === 3 ? 'Turn' : 'River',
      totalNextCards: 0,
      currentHeroHandRank: currentHeroValue.rank,
      currentHeroHandClass: HAND_CLASS[currentHeroValue.rank],
      impacts: [],
    };
  }

  const deck = buildDeck().filter(card => !knownKeys.includes(cardKey(card)));
  const impacts: NextCardImpact[] = [];

  for (const card of deck) {
    const nextBoard = [...board, card];
    const heroNext = evaluateBestHand([...heroCards, ...nextBoard]);
    const heroHandClass = HAND_CLASS[heroNext.rank];

    if (heroNext.rank > currentHeroValue.rank) {
      impacts.push({
        card,
        category: 'hero-upgrade',
        label: `Hero improves to ${heroHandClass.toLowerCase()}`,
        handClass: heroHandClass,
        handRank: heroNext.rank,
        affectedPlayerId: 'hero',
        affectedPlayerName: 'Hero',
        defaultIncluded: true,
      });
    }

    const opponentScores = completeOpponents.map(player => ({
      player,
      value: evaluateBestHand([...player.cards, ...nextBoard]),
    }));
    const ahead = opponentScores.filter(score => compareHandValues(score.value, heroNext) > 0);

    if (ahead.length > 0) {
      for (const score of ahead) {
        const handClass = HAND_CLASS[score.value.rank];
        impacts.push({
          card,
          category: 'danger',
          label: `${score.player.name} improves to ${handClass.toLowerCase()}`,
          handClass,
          handRank: score.value.rank,
          affectedPlayerId: score.player.id,
          affectedPlayerName: score.player.name,
          defaultIncluded: true,
        });
      }
      continue;
    }

    const tied = opponentScores.filter(score => compareHandValues(score.value, heroNext) === 0);
    for (const score of tied) {
      const handClass = HAND_CLASS[score.value.rank];
      impacts.push({
        card,
        category: 'chop',
        label: `${score.player.name} chops ${handClass.toLowerCase()}`,
        handClass,
        handRank: score.value.rank,
        affectedPlayerId: score.player.id,
        affectedPlayerName: score.player.name,
        defaultIncluded: true,
      });
    }
  }

  return {
    available: true,
    error: null,
    nextStreetLabel: board.length === 3 ? 'Turn' : 'River',
    totalNextCards: deck.length,
    currentHeroHandRank: currentHeroValue.rank,
    currentHeroHandClass: HAND_CLASS[currentHeroValue.rank],
    impacts,
  };
}

function combinationCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const picks = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= picks; i++) {
    result = (result * (n - picks + i)) / i;
  }
  return Math.round(result);
}

function emptyStreet(street: HoldemStreet, label: string, board: Card[], needed: number): HoldemStreetStats {
  return {
    street,
    label,
    board,
    available: false,
    equityPct: null,
    winPct: null,
    tiePct: null,
    lossPct: null,
    samples: 0,
    exact: false,
    madeHand: needed === 0 ? 'Choose two hole cards' : `Add ${label.toLowerCase()} cards`,
    handClass: 'Pending',
    outs: null,
    outDetails: [],
    drawSummary: 'Waiting for cards',
    boardTexture: [],
  };
}

function calculateHeadsUpEquity(heroCards: Card[], board: Card[]) {
  const knownKeys = new Set([...heroCards, ...board].map(cardKey));
  const deck = buildDeck().filter(card => !knownKeys.has(cardKey(card)));

  let wins = 0;
  let ties = 0;
  let losses = 0;
  let samples = 0;

  if (board.length === 5) {
    for (let i = 0; i < deck.length - 1; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        const villain = [deck[i], deck[j]];
        const result = compareShowdown(heroCards, villain, board);
        if (result > 0) wins++;
        else if (result < 0) losses++;
        else ties++;
        samples++;
      }
    }
    return equityResult(wins, ties, losses, samples, true);
  }

  const missingBoard = 5 - board.length;
  const iterations = board.length === 0 ? 2500 : board.length === 3 ? 4000 : 2500;
  const seed = seedFromCards([...heroCards, ...board]);

  for (let i = 0; i < iterations; i++) {
    const sampled = sampleCards(deck, 2 + missingBoard, seed + i * 101);
    const villain = sampled.slice(0, 2);
    const runout = sampled.slice(2);
    const result = compareShowdown(heroCards, villain, [...board, ...runout]);
    if (result > 0) wins++;
    else if (result < 0) losses++;
    else ties++;
    samples++;
  }

  return equityResult(wins, ties, losses, samples, false);
}

function equityResult(wins: number, ties: number, losses: number, samples: number, exact: boolean) {
  const equityPct = samples > 0 ? ((wins + ties * 0.5) / samples) * 100 : 0;
  return {
    equityPct,
    winPct: samples > 0 ? (wins / samples) * 100 : 0,
    tiePct: samples > 0 ? (ties / samples) * 100 : 0,
    lossPct: samples > 0 ? (losses / samples) * 100 : 0,
    samples,
    exact,
  };
}

function compareShowdown(hero: Card[], villain: Card[], board: Card[]): number {
  const heroValue = evaluateBestHand([...hero, ...board]);
  const villainValue = evaluateBestHand([...villain, ...board]);
  return compareHandValues(heroValue, villainValue);
}

function evaluateBestHand(cards: Card[]): HandValue {
  if (cards.length < 5) return { rank: 0, tiebreakers: [] };
  let best: HandValue | null = null;

  for (let a = 0; a < cards.length - 4; a++) {
    for (let b = a + 1; b < cards.length - 3; b++) {
      for (let c = b + 1; c < cards.length - 2; c++) {
        for (let d = c + 1; d < cards.length - 1; d++) {
          for (let e = d + 1; e < cards.length; e++) {
            const value = evaluateFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareHandValues(value, best) > 0) best = value;
          }
        }
      }
    }
  }

  return best ?? { rank: 0, tiebreakers: [] };
}

function evaluateFive(cards: Card[]): HandValue {
  const values = cards.map(card => RANK_VALUE[card.rank]).sort((a, b) => b - a);
  const valueCounts = new Map<number, number>();
  for (const value of values) valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1);

  const groups = [...valueCounts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const isFlush = cards.every(card => card.suit === cards[0].suit);
  const straightHigh = getStraightHigh(values);

  if (isFlush && straightHigh) return { rank: 8, tiebreakers: [straightHigh] };

  const quads = groups.find(group => group.count === 4);
  if (quads) {
    return { rank: 7, tiebreakers: [quads.value, ...values.filter(value => value !== quads.value)] };
  }

  const trips = groups.filter(group => group.count === 3);
  const pairs = groups.filter(group => group.count === 2);
  if (trips.length > 0 && (pairs.length > 0 || trips.length > 1)) {
    return { rank: 6, tiebreakers: [trips[0].value, pairs[0]?.value ?? trips[1].value] };
  }

  if (isFlush) return { rank: 5, tiebreakers: values };
  if (straightHigh) return { rank: 4, tiebreakers: [straightHigh] };

  if (trips.length > 0) {
    return {
      rank: 3,
      tiebreakers: [trips[0].value, ...values.filter(value => value !== trips[0].value)],
    };
  }

  if (pairs.length >= 2) {
    const pairValues = pairs.map(pair => pair.value).sort((a, b) => b - a);
    const kicker = values.find(value => !pairValues.includes(value)) ?? 0;
    return { rank: 2, tiebreakers: [pairValues[0], pairValues[1], kicker] };
  }

  if (pairs.length === 1) {
    return {
      rank: 1,
      tiebreakers: [pairs[0].value, ...values.filter(value => value !== pairs[0].value)],
    };
  }

  return { rank: 0, tiebreakers: values };
}

function getStraightHigh(values: number[]): number | null {
  const unique = [...new Set(values)];
  if (unique.includes(14)) unique.push(1);
  const sorted = unique.sort((a, b) => b - a);

  for (let i = 0; i <= sorted.length - 5; i++) {
    const window = sorted.slice(i, i + 5);
    if (window[0] - window[4] === 4) return window[0];
  }

  return null;
}

function compareHandValues(a: HandValue, b: HandValue): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const length = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < length; i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function summarizeMadeHand(heroCards: Card[], board: Card[]) {
  if (heroCards.length !== 2) {
    return { madeHand: 'Choose two hole cards', handClass: 'Pending' };
  }

  if (board.length < 3) {
    return { madeHand: describePreflopHand(heroCards), handClass: 'Starting hand' };
  }

  const value = evaluateBestHand([...heroCards, ...board]);
  return {
    madeHand: HAND_CLASS[value.rank],
    handClass: HAND_CLASS[value.rank],
  };
}

function describePreflopHand(cards: Card[]): string {
  const [a, b] = cards;
  const av = RANK_VALUE[a.rank];
  const bv = RANK_VALUE[b.rank];
  if (av === bv) return `${a.rank}${b.rank} pocket pair`;
  const high = av > bv ? a : b;
  const low = av > bv ? b : a;
  const gap = Math.abs(av - bv) - 1;
  const suited = a.suit === b.suit ? 'suited' : 'offsuit';
  if (gap === 0) return `${high.rank}${low.rank} ${suited} connector`;
  if (gap === 1) return `${high.rank}${low.rank} ${suited} one-gapper`;
  return `${high.rank}${low.rank} ${suited}`;
}

function summarizeDraws(heroCards: Card[], board: Card[]) {
  if (heroCards.length !== 2 || board.length < 3 || board.length >= 5) {
    return {
      outs: board.length === 5 ? 0 : null,
      outDetails: [],
      summary: board.length === 5 ? 'No cards to come' : 'Draws appear after the flop',
    };
  }

  const known = [...heroCards, ...board];
  const knownKeys = new Set(known.map(cardKey));
  const deck = buildDeck().filter(card => !knownKeys.has(cardKey(card)));
  const current = evaluateBestHand(known);
  const outDetails = deck.map(card => describeOutCard(card, known, current));
  const improvingCards = outDetails.filter(detail => detail.improvesCurrent);

  const labels: string[] = [];
  const flush = flushDrawSummary(known, deck);
  if (flush) labels.push(flush);
  const straight = straightDrawSummary(known, deck);
  if (straight) labels.push(straight);

  return {
    outs: improvingCards.length,
    outDetails,
    summary: labels.length > 0 ? labels.join(' + ') : 'No major draw flagged',
  };
}

function describeOutCard(card: Card, known: Card[], current: HandValue): HoldemOutDetail {
  const next = evaluateBestHand([...known, card]);
  const improvesTo = HAND_CLASS[next.rank];
  const comparison = compareHandValues(next, current);
  const improvesCurrent = comparison > 0;
  const improvesHandClass = next.rank > current.rank;
  const note = improvesHandClass
    ? `Makes ${articleFor(improvesTo)} ${improvesTo.toLowerCase()}`
    : improvesCurrent
      ? `Improves your ${improvesTo.toLowerCase()}`
      : `Can finish as ${articleFor(improvesTo)} ${improvesTo.toLowerCase()}`;

  return {
    card,
    improvesTo,
    handRank: next.rank,
    note,
    improvesCurrent,
    improvesHandClass,
  };
}

function articleFor(label: string): 'a' | 'an' {
  return /^[aeiou]/i.test(label) ? 'an' : 'a';
}

function flushDrawSummary(known: Card[], deck: Card[]): string | null {
  const suitCounts = new Map<Suit, number>();
  for (const card of known) suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
  const draw = [...suitCounts.entries()].find(([, count]) => count === 4);
  if (!draw) return null;
  const outs = deck.filter(card => card.suit === draw[0]).length;
  return `${outs} flush outs`;
}

function straightDrawSummary(known: Card[], deck: Card[]): string | null {
  const currentValues = new Set(known.map(card => RANK_VALUE[card.rank]));
  if (currentValues.has(14)) currentValues.add(1);
  const rankOuts = new Set<number>();

  for (const card of deck) {
    const next = new Set(currentValues);
    const value = RANK_VALUE[card.rank];
    next.add(value);
    if (value === 14) next.add(1);
    if (hasStraight([...next])) rankOuts.add(value);
  }

  if (rankOuts.size === 0) return null;
  const labels = [...rankOuts]
    .sort((a, b) => b - a)
    .map(value => VALUE_RANK[value] ?? String(value));
  const outs = deck.filter(card => rankOuts.has(RANK_VALUE[card.rank])).length;
  return `${outs} straight outs (${labels.join(', ')})`;
}

function hasStraight(values: number[]): boolean {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  for (let i = 0; i <= unique.length - 5; i++) {
    const window = unique.slice(i, i + 5);
    if (window[0] - window[4] === 4) return true;
  }
  return false;
}

function describeBoardTexture(board: Card[]): string[] {
  const labels: string[] = [];
  const ranks = new Map<Rank, number>();
  const suits = new Map<Suit, number>();
  for (const card of board) {
    ranks.set(card.rank, (ranks.get(card.rank) ?? 0) + 1);
    suits.set(card.suit, (suits.get(card.suit) ?? 0) + 1);
  }

  const rankCounts = [...ranks.values()];
  const maxSuit = Math.max(...suits.values());
  if (rankCounts.some(count => count >= 3)) labels.push('Trips on board');
  else if (rankCounts.some(count => count === 2)) labels.push('Paired board');

  if (maxSuit >= 5) labels.push('Monotone');
  else if (maxSuit === 4) labels.push('Four-flush');
  else if (maxSuit === 3) labels.push('Flush draw');
  else labels.push('Rainbow');

  const values = [...new Set(board.map(card => RANK_VALUE[card.rank]))].sort((a, b) => b - a);
  const span = values.length > 1 ? values[0] - values[values.length - 1] : 0;
  if (values.some(value => value >= 10)) labels.push('Broadway present');
  if (values.length >= 3 && span <= 5) labels.push('Connected');
  if (labels.length <= 2 && !labels.includes('Connected')) labels.push('Dry');

  return labels;
}

function sampleCards(cards: Card[], count: number, seed: number): Card[] {
  const pool = [...cards];
  const picked: Card[] = [];
  let state = seed || 1;

  for (let i = 0; i < count && pool.length > 0; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const index = state % pool.length;
    picked.push(pool[index]);
    pool[index] = pool[pool.length - 1];
    pool.pop();
  }

  return picked;
}

function seedFromCards(cards: Card[]): number {
  return cards.reduce((seed, card) => {
    const rank = RANK_VALUE[card.rank];
    const suit = SUITS.indexOf(card.suit) + 1;
    return ((seed * 31) + rank * 7 + suit) >>> 0;
  }, 2166136261);
}
