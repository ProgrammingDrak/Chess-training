import { useEffect, useMemo, useState } from 'react';
import { RANKS, cellHand } from '../../utils/handMatrix';
import { HAND_RANK_MAP } from '../../data/poker/profileTemplates';
import { cardKey } from '../../utils/cardInput';
import {
  analyzeHoldemScenario,
  analyzeNextCardImpacts,
  calculateSpecificHoldemEquity,
  handNotationFromCards,
  type HoldemOutDetail,
  type HoldemStreetStats,
  type NextCardImpact,
  type NextCardImpactCategory,
} from '../../utils/holdemEquity';
import { handLabel } from '../../utils/poker';
import type { Card, Suit } from '../../types/poker';
import { CardPicker } from './CardPicker';
import { PlayingCard } from './HandDisplay';

const RANK_SET = new Set(RANKS as unknown as string[]);
const SUIT_ORDER: Suit[] = ['s', 'h', 'd', 'c'];
type LookupTab = 'hero' | 'flop' | 'turn' | 'river';
type ActiveLookupTab = LookupTab | 'board' | `opponent:${string}`;
type OpponentHand = { id: string; name: string; cards: Card[] };

function blankOpponent(index: number): OpponentHand {
  return {
    id: `villain-${Date.now()}-${index + 1}`,
    name: `Villain ${index + 1}`,
    cards: [],
  };
}

function renumberOpponents(opponents: OpponentHand[]) {
  return opponents.map((opponent, index) => ({
    ...opponent,
    name: `Villain ${index + 1}`,
  }));
}

type LookupOutGroup = {
  key: string;
  label: string;
  note: string;
  handRank: number;
  cards: Card[];
  improvingCards: number;
  betterClassCards: number;
  defaultIncluded: boolean;
  category: 'draw' | NextCardImpactCategory;
};

const LOOKUP_TABS: Array<{ id: ActiveLookupTab; label: string; helper: string }> = [
  { id: 'hero', label: 'Hero Hand', helper: 'Pick the exact two cards or type notation.' },
  { id: 'board', label: 'Full Board', helper: 'Enter flop, turn, and river in one pass.' },
  { id: 'flop', label: 'Flop', helper: 'Add the three flop cards.' },
  { id: 'turn', label: 'Turn', helper: 'Add the turn card.' },
  { id: 'river', label: 'River', helper: 'Add the river card.' },
];

const MAX_PLAYERS = 10;

function parseHandInput(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/10/g, 'T');
  if (s.length < 2 || s.length > 3) return null;
  const r1 = s[0], r2 = s[1];
  if (!RANK_SET.has(r1) || !RANK_SET.has(r2)) return null;

  if (r1 === r2) return s.length === 2 ? `${r1}${r2}` : null;

  const suffix = s.length === 3 ? s[2] : null;
  if (suffix && suffix !== 'S' && suffix !== 'O') return null;

  const idx1 = RANKS.indexOf(r1 as typeof RANKS[number]);
  const idx2 = RANKS.indexOf(r2 as typeof RANKS[number]);
  const [highR, lowR] = idx1 < idx2 ? [r1, r2] : [r2, r1];
  const suf = suffix ? suffix.toLowerCase() : 's';
  const hand = `${highR}${lowR}${suf}`;
  return HAND_RANK_MAP[hand] !== undefined ? hand : null;
}

function defaultShowGrid(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function cardsForHandNotation(hand: string, unavailableCards: Card[] = []): Card[] | null {
  const unavailable = new Set(unavailableCards.map(cardKey));
  const r1 = hand[0] as Card['rank'];
  const r2 = hand[1] as Card['rank'];

  if (r1 === r2) {
    for (let i = 0; i < SUIT_ORDER.length - 1; i++) {
      for (let j = i + 1; j < SUIT_ORDER.length; j++) {
        const cards = [{ rank: r1, suit: SUIT_ORDER[i] }, { rank: r2, suit: SUIT_ORDER[j] }];
        if (cards.every(card => !unavailable.has(cardKey(card)))) return cards;
      }
    }
    return null;
  }

  if (hand.endsWith('s')) {
    for (const suit of SUIT_ORDER) {
      const cards = [{ rank: r1, suit }, { rank: r2, suit }];
      if (cards.every(card => !unavailable.has(cardKey(card)))) return cards;
    }
    return null;
  }

  for (const highSuit of SUIT_ORDER) {
    for (const lowSuit of SUIT_ORDER) {
      if (highSuit === lowSuit) continue;
      const cards = [{ rank: r1, suit: highSuit }, { rank: r2, suit: lowSuit }];
      if (cards.every(card => !unavailable.has(cardKey(card)))) return cards;
    }
  }
  return null;
}

function formatPct(value: number | null): string {
  return value === null ? '-' : `${value.toFixed(1)}%`;
}

function formatSamples(stats: HoldemStreetStats): string {
  if (!stats.available || stats.samples === 0) return 'Pending';
  return stats.exact ? `${stats.samples.toLocaleString()} exact combos` : `${stats.samples.toLocaleString()} sims`;
}

function formatRunouts(samples: number, exact: boolean): string {
  if (samples === 0) return 'Waiting for complete hands';
  return exact ? `${samples.toLocaleString()} exact river runouts` : `${samples.toLocaleString()} sampled river runouts`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function groupOutDetails(outDetails: HoldemOutDetail[]): LookupOutGroup[] {
  const groups = new Map<string, LookupOutGroup>();
  for (const detail of outDetails) {
    const key = `draw:${detail.improvesTo}`;
    const group = groups.get(key) ?? {
      key,
      label: detail.improvesTo,
      note: detail.note,
      handRank: detail.handRank,
      cards: [],
      improvingCards: 0,
      betterClassCards: 0,
      defaultIncluded: false,
      category: 'draw',
    };
    group.cards.push(detail.card);
    if (detail.improvesCurrent) group.improvingCards++;
    if (detail.improvesHandClass) group.betterClassCards++;
    group.defaultIncluded = group.betterClassCards > 0;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.handRank - a.handRank || b.cards.length - a.cards.length);
}

function groupNextCardImpacts(impacts: NextCardImpact[]): LookupOutGroup[] {
  const groups = new Map<string, LookupOutGroup>();
  for (const impact of impacts) {
    const key = `${impact.category}:${impact.affectedPlayerId ?? 'table'}:${impact.handClass}`;
    const group = groups.get(key) ?? {
      key,
      label: impact.label,
      note: impact.handClass,
      handRank: impact.handRank,
      cards: [],
      improvingCards: 0,
      betterClassCards: 0,
      defaultIncluded: impact.defaultIncluded,
      category: impact.category,
    };
    group.cards.push(impact.card);
    if (impact.category === 'hero-upgrade') group.betterClassCards++;
    else group.improvingCards++;
    group.defaultIncluded = group.defaultIncluded || impact.defaultIncluded;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    const categoryOrder: Record<LookupOutGroup['category'], number> = {
      danger: 0,
      chop: 1,
      'hero-upgrade': 2,
      draw: 3,
    };
    return categoryOrder[a.category] - categoryOrder[b.category] || b.handRank - a.handRank || b.cards.length - a.cards.length;
  });
}

function countUniqueCards(groups: LookupOutGroup[]): number {
  const keys = new Set<string>();
  for (const group of groups) {
    for (const card of group.cards) keys.add(cardKey(card));
  }
  return keys.size;
}

function outGroupSubtitle(group: LookupOutGroup): string {
  const cardCount = `${group.cards.length} card${group.cards.length === 1 ? '' : 's'}`;
  if (group.category === 'danger') return `${cardCount} · villain can beat Hero`;
  if (group.category === 'chop') return `${cardCount} · villain can chop`;
  if (group.category === 'hero-upgrade') return `${cardCount} · Hero upgrades`;
  if (group.betterClassCards > 0) return `${cardCount} · ${group.betterClassCards} upgrade class`;
  if (group.improvingCards > 0) return `${cardCount} · ${group.improvingCards} improve`;
  return `${cardCount} · no immediate improvement`;
}

function EquityStatButton({
  id,
  equity,
  win,
  tie,
  expanded,
  onToggle,
}: {
  id: string;
  equity: number | null;
  win: number | null;
  tie: number | null;
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  const disabled = equity === null;
  return (
    <button
      type="button"
      className={`hl-equity-stat${expanded ? ' expanded' : ''}`}
      onClick={() => !disabled && onToggle(id)}
      disabled={disabled}
      aria-expanded={expanded}
    >
      {expanded && (
        <>
          <span className="hl-equity-corner hl-equity-win">Win {formatPct(win)}</span>
          <span className="hl-equity-corner hl-equity-tie">Tie {formatPct(tie)}</span>
        </>
      )}
      {!expanded && (
        <>
          <span className="hl-equity-main">{formatPct(equity)}</span>
          <small>Equity</small>
        </>
      )}
    </button>
  );
}

function HandPickerGrid({
  selectedHand,
  onSelect,
}: {
  selectedHand: string;
  onSelect: (hand: string) => void;
}) {
  return (
    <div className="hlpg-wrapper">
      <div className="hlpg-col-headers">
        <div className="hlpg-corner" />
        {RANKS.map(r => <div key={r} className="hlpg-axis">{r}</div>)}
      </div>

      {RANKS.map((rowRank, row) => (
        <div key={rowRank} className="hlpg-row">
          <div className="hlpg-axis">{rowRank}</div>
          {RANKS.map((_, col) => {
            const hand = cellHand(row, col);
            const isSelected = hand === selectedHand;
            const isPair = row === col;
            const isSuited = col > row;

            return (
              <button
                key={hand}
                className={[
                  'hlpg-cell',
                  isPair ? 'hlpg-pair' : isSuited ? 'hlpg-suited' : 'hlpg-offsuit',
                  isSelected ? 'hlpg-selected' : '',
                ].join(' ')}
                onClick={() => onSelect(hand)}
                title={`${hand}${isSuited ? ' suited' : isPair ? ' pair' : ' offsuit'}`}
              >
                {hand}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function CardSlotStrip({ cards, slots }: { cards: Card[]; slots: number }) {
  return (
    <div className="hl-board-strip">
      {Array.from({ length: slots }).map((_, index) => {
        const card = cards[index];
        return card ? (
          <PlayingCard key={cardKey(card)} card={card} size="sm" />
        ) : (
          <div key={`empty-${index}`} className="hl-board-placeholder" />
        );
      })}
    </div>
  );
}

interface HandLookupProps {
  profiles: unknown[];
  onBack: () => void;
}

export function HandLookup({ onBack }: HandLookupProps) {
  const [activeLookupTab, setActiveLookupTab] = useState<ActiveLookupTab | null>(null);
  const [expandedOutsStreet, setExpandedOutsStreet] = useState<string | null>(null);
  const [expandedEquityCells, setExpandedEquityCells] = useState<Set<string>>(() => new Set());
  const [outGroupChoices, setOutGroupChoices] = useState<Record<string, boolean>>({});
  const [heroCards, setHeroCards] = useState<Card[]>([{ rank: 'A', suit: 's' }, { rank: 'K', suit: 's' }]);
  const [opponentHands, setOpponentHands] = useState<OpponentHand[]>([
    { id: 'villain-1', name: 'Villain 1', cards: [] },
  ]);
  const [flopCards, setFlopCards] = useState<Card[]>([]);
  const [turnCard, setTurnCard] = useState<Card[]>([]);
  const [riverCard, setRiverCard] = useState<Card[]>([]);
  const [selectedHand, setSelectedHand] = useState<string>('AKs');
  const [textInput, setTextInput] = useState<string>('AKs');
  const [textError, setTextError] = useState(false);
  const [showGrid, setShowGrid] = useState(defaultShowGrid);

  const boardCards = useMemo(() => [...flopCards, ...turnCard, ...riverCard], [flopCards, riverCard, turnCard]);
  const opponentCards = useMemo(() => opponentHands.flatMap(opponent => opponent.cards), [opponentHands]);
  const allHoleCards = useMemo(() => [...heroCards, ...opponentCards], [heroCards, opponentCards]);
  const heroNotation = handNotationFromCards(heroCards) ?? selectedHand;
  const rank = HAND_RANK_MAP[heroNotation] ?? HAND_RANK_MAP[selectedHand] ?? null;

  useEffect(() => {
    setOutGroupChoices({});
  }, [heroCards, boardCards]);

  function handleHeroCardsChange(cards: Card[]) {
    setHeroCards(cards);
    const notation = handNotationFromCards(cards);
    if (notation) {
      setSelectedHand(notation);
      setTextInput(notation);
      setTextError(false);
      setActiveLookupTab(null);
    }
  }

  function updateOpponentCards(id: string, cards: Card[]) {
    setOpponentHands(prev => prev.map(opponent => (
      opponent.id === id ? { ...opponent, cards } : opponent
    )));
  }

  function addOpponent() {
    setOpponentHands(prev => {
      if (prev.length + 1 >= MAX_PLAYERS) return prev;
      return [
        ...prev,
        blankOpponent(prev.length),
      ];
    });
  }

  function removeOpponent(id: string) {
    setOpponentHands(prev => {
      const next = prev.filter(opponent => opponent.id !== id);
      return next.length > 0 ? renumberOpponents(next) : [blankOpponent(0)];
    });
    setActiveLookupTab(prev => (prev === `opponent:${id}` ? null : prev));
  }

  function unavailableForOpponent(id: string): Card[] {
    return [
      ...heroCards,
      ...boardCards,
      ...opponentHands.filter(opponent => opponent.id !== id).flatMap(opponent => opponent.cards),
    ];
  }

  function selectFromGrid(hand: string) {
    setSelectedHand(hand);
    setTextInput(hand);
    setTextError(false);
    const exactCards = cardsForHandNotation(hand, [...boardCards, ...opponentCards]);
    if (exactCards) {
      setHeroCards(exactCards);
      setActiveLookupTab(null);
    }
  }

  function handleTextChange(value: string) {
    setTextInput(value);
    const parsed = parseHandInput(value);
    if (parsed) {
      setSelectedHand(parsed);
      setTextError(false);
      const exactCards = cardsForHandNotation(parsed, [...boardCards, ...opponentCards]);
      if (exactCards) setHeroCards(exactCards);
    } else if (value.trim() === '') {
      setTextError(false);
    } else {
      setTextError(true);
    }
  }

  function clearBoard() {
    setFlopCards([]);
    setTurnCard([]);
    setRiverCard([]);
    if (activeLookupTab && activeLookupTab !== 'hero') setActiveLookupTab(null);
  }

  function handleFlopCardsChange(cards: Card[]) {
    setFlopCards(cards);
    if (cards.length === 3) setActiveLookupTab(null);
  }

  function handleTurnCardChange(cards: Card[]) {
    setTurnCard(cards);
    if (cards.length === 1) setActiveLookupTab(null);
  }

  function handleRiverCardChange(cards: Card[]) {
    setRiverCard(cards);
    if (cards.length === 1) setActiveLookupTab(null);
  }

  function handleBoardCardsChange(cards: Card[]) {
    setFlopCards(cards.slice(0, 3));
    setTurnCard(cards.slice(3, 4));
    setRiverCard(cards.slice(4, 5));
    if (cards.length === 5) setActiveLookupTab(null);
  }

  function outGroupKey(street: string, groupKey: string): string {
    return `${street}:${groupKey}`;
  }

  function isOutGroupSelected(street: string, group: { key: string; defaultIncluded: boolean }): boolean {
    const key = outGroupKey(street, group.key);
    return outGroupChoices[key] ?? group.defaultIncluded;
  }

  function toggleOutGroup(street: string, group: { key: string; defaultIncluded: boolean }) {
    const key = outGroupKey(street, group.key);
    setOutGroupChoices(prev => ({
      ...prev,
      [key]: !(prev[key] ?? group.defaultIncluded),
    }));
  }

  function toggleEquityCell(id: string) {
    setExpandedEquityCells(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const streetStats = useMemo(
    () => analyzeHoldemScenario(heroCards, boardCards),
    [boardCards, heroCards],
  );
  const exactPlayers = useMemo(
    () => [{ id: 'hero', name: 'Hero', cards: heroCards }, ...opponentHands],
    [heroCards, opponentHands],
  );
  const showdownEquity = useMemo(
    () => calculateSpecificHoldemEquity(exactPlayers, boardCards),
    [boardCards, exactPlayers],
  );

  const completeHero = heroCards.length === 2;
  const heroSummary = completeHero ? handLabel(heroCards[0], heroCards[1]) : 'Choose two cards';
  const latestAvailable = [...streetStats].reverse().find(stats => stats.available) ?? streetStats[0];
  const activeOpponentId = activeLookupTab?.startsWith('opponent:') ? activeLookupTab.replace('opponent:', '') : null;
  const activeOpponent = activeOpponentId ? opponentHands.find(opponent => opponent.id === activeOpponentId) : null;
  const activeLookupMeta = activeOpponent
    ? { label: activeOpponent.name, helper: 'Pick this opponent\'s exact two hole cards.' }
    : activeLookupTab ? LOOKUP_TABS.find(tab => tab.id === activeLookupTab) : null;
  const heroShowdown = showdownEquity.players.find(player => player.id === 'hero');
  const completeOpponentCount = opponentHands.filter(opponent => opponent.cards.length === 2).length;

  const turnUnavailable = [...allHoleCards, ...flopCards, ...riverCard];
  const riverUnavailable = [...allHoleCards, ...flopCards, ...turnCard];

  return (
    <div className="hl-wrapper">
      <div className="hl-header">
        <button className="back-btn" onClick={onBack}>← Poker GTO</button>
        <div>
          <h1 className="hl-title">Hand Lookup Lab</h1>
          <p className="hl-desc">
            Look up exact hole cards, add board runouts, and compare equity, made hand, draw pressure, and range context by street.
          </p>
        </div>
      </div>

      <div className="hl-body">
        <div className="hl-inputs">
          <div className="hl-section hl-lookup-tabs-section">
            <div className="hl-section-heading-row">
              <h3 className="hl-section-title">Lookup Builder</h3>
              <div className="hl-section-actions">
                <button
                  className={`hl-inline-btn${activeLookupTab === 'board' ? ' active' : ''}`}
                  onClick={() => setActiveLookupTab(activeLookupTab === 'board' ? null : 'board')}
                >
                  Full board
                </button>
                <button className="hl-inline-btn" onClick={clearBoard}>Clear board</button>
              </div>
            </div>

            <div className="hl-equity-hero hl-current-scenario-card">
              <div className="hl-current-actions">
                <button
                  type="button"
                  className={`hl-current-edit-target hl-current-hero-target${activeLookupTab === 'hero' ? ' active' : ''}`}
                  onClick={() => setActiveLookupTab(activeLookupTab === 'hero' ? null : 'hero')}
                  aria-expanded={activeLookupTab === 'hero'}
                >
                  <span className="hl-result-title">Your hand</span>
                  <CardSlotStrip cards={heroCards} slots={2} />
                  <span className="hl-result-subtitle">
                    {heroSummary} · {heroNotation}
                  </span>
                </button>
                <button
                  type="button"
                  className={`hl-current-edit-target hl-board-street-target hl-flop-target${activeLookupTab === 'flop' ? ' active' : ''}`}
                  onClick={() => setActiveLookupTab(activeLookupTab === 'flop' ? null : 'flop')}
                  aria-expanded={activeLookupTab === 'flop'}
                >
                  <span className="hl-result-title">Flop</span>
                  <CardSlotStrip cards={flopCards} slots={3} />
                  <span className="hl-result-subtitle">{flopCards.length}/3</span>
                </button>
                <button
                  type="button"
                  className={`hl-current-edit-target hl-board-street-target${activeLookupTab === 'turn' ? ' active' : ''}`}
                  onClick={() => setActiveLookupTab(activeLookupTab === 'turn' ? null : 'turn')}
                  aria-expanded={activeLookupTab === 'turn'}
                >
                  <span className="hl-result-title">Turn</span>
                  <CardSlotStrip cards={turnCard} slots={1} />
                  <span className="hl-result-subtitle">{turnCard.length}/1</span>
                </button>
                <button
                  type="button"
                  className={`hl-current-edit-target hl-board-street-target${activeLookupTab === 'river' ? ' active' : ''}`}
                  onClick={() => setActiveLookupTab(activeLookupTab === 'river' ? null : 'river')}
                  aria-expanded={activeLookupTab === 'river'}
                >
                  <span className="hl-result-title">River</span>
                  <CardSlotStrip cards={riverCard} slots={1} />
                  <span className="hl-result-subtitle">{riverCard.length}/1</span>
                </button>
              </div>
              <div className="hl-equity-big">
                  <span>{formatPct(latestAvailable.equityPct)}</span>
                <small>{latestAvailable.label} equity vs random hand</small>
              </div>
            </div>

            <div className="hl-opponents-card">
              <div className="hl-opponents-head">
                <div>
                  <h4>Exact Opponents</h4>
                  <span>{pluralize(completeOpponentCount, 'complete opponent')} in the equity calc</span>
                </div>
                <button
                  type="button"
                  className="hl-inline-btn"
                  onClick={addOpponent}
                  disabled={opponentHands.length + 1 >= MAX_PLAYERS}
                >
                  Add player
                </button>
              </div>
              <div className="hl-opponents-list">
                {opponentHands.map(opponent => (
                  <div key={opponent.id} className="hl-opponent-row">
                    <button
                      type="button"
                      className={`hl-opponent-edit${activeLookupTab === `opponent:${opponent.id}` ? ' active' : ''}`}
                      onClick={() => setActiveLookupTab(activeLookupTab === `opponent:${opponent.id}` ? null : `opponent:${opponent.id}`)}
                      aria-expanded={activeLookupTab === `opponent:${opponent.id}`}
                    >
                      <span>{opponent.name}</span>
                      <CardSlotStrip cards={opponent.cards} slots={2} />
                      <small>{opponent.cards.length === 2 ? handLabel(opponent.cards[0], opponent.cards[1]) : `${opponent.cards.length}/2 cards`}</small>
                    </button>
                    <button
                      type="button"
                      className="hl-opponent-remove"
                      onClick={event => {
                        event.stopPropagation();
                        removeOpponent(opponent.id);
                      }}
                      aria-label={`Remove ${opponent.name}`}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {activeLookupTab && (
            <div className="hl-tab-panel">
              <div className="hl-tab-panel-head">
                <div>
                  <div className="hl-tab-title">{activeLookupMeta?.label}</div>
                  <div className="hl-tab-helper">{activeLookupMeta?.helper}</div>
                </div>
                {activeLookupTab === 'hero' && (
                  <div className="hl-mode-toggle">
                    <button
                      className={`hl-mode-btn${!showGrid ? ' active' : ''}`}
                      onClick={() => setShowGrid(false)}
                      title="Type hand notation"
                    >
                      Text
                    </button>
                    <button
                      className={`hl-mode-btn${showGrid ? ' active' : ''}`}
                      onClick={() => setShowGrid(true)}
                      title="Open range grid"
                    >
                      Grid
                    </button>
                  </div>
                )}
              </div>

              {activeLookupTab === 'hero' && (
                <>
                  <CardPicker
                    value={heroCards}
                    onChange={handleHeroCardsChange}
                    maxCards={2}
                    label="Exact cards"
                    unavailableCards={[...boardCards, ...opponentCards]}
                  />

                  <div className="hl-text-input-row">
                    <input
                      className={`hl-text-input${textError ? ' hl-text-error' : ''}`}
                      value={textInput}
                      onChange={e => handleTextChange(e.target.value)}
                      placeholder="AKs, JJ, 72o"
                      spellCheck={false}
                      autoComplete="off"
                      autoCapitalize="characters"
                    />
                    <div className="hl-hand-badge">
                      {!textError && heroNotation ? (
                        <>
                          <span className="hl-hand-notation">{heroNotation}</span>
                          {rank && <span className="hl-hand-rank">#{rank}</span>}
                        </>
                      ) : textError ? (
                        <span className="hl-hand-invalid">?</span>
                      ) : null}
                    </div>
                  </div>
                  {textError && (
                    <div className="hl-text-hint">
                      Type a hand like <code>AKs</code>, <code>AKo</code>, <code>JJ</code>, or <code>T9s</code>.
                    </div>
                  )}

                  {showGrid && (
                    <div className="hl-grid-picker-wrap">
                      <HandPickerGrid
                        selectedHand={heroNotation}
                        onSelect={selectFromGrid}
                      />
                      <div className="hl-grid-picker-hint">
                        Grid cells load a matching exact-card example when possible.
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeLookupTab === 'flop' && (
                <CardPicker
                  value={flopCards}
                  onChange={handleFlopCardsChange}
                  maxCards={3}
                  label="Flop"
                  unavailableCards={[...allHoleCards, ...turnCard, ...riverCard]}
                />
              )}

              {activeLookupTab === 'turn' && (
                <CardPicker
                  value={turnCard}
                  onChange={handleTurnCardChange}
                  maxCards={1}
                  label="Turn"
                  unavailableCards={turnUnavailable}
                />
              )}

              {activeLookupTab === 'river' && (
                <CardPicker
                  value={riverCard}
                  onChange={handleRiverCardChange}
                  maxCards={1}
                  label="River"
                  unavailableCards={riverUnavailable}
                />
              )}

              {activeLookupTab === 'board' && (
                <CardPicker
                  value={boardCards}
                  onChange={handleBoardCardsChange}
                  maxCards={5}
                  label="Full board"
                  unavailableCards={allHoleCards}
                />
              )}

              {activeOpponent && (
                <CardPicker
                  value={activeOpponent.cards}
                  onChange={cards => updateOpponentCards(activeOpponent.id, cards)}
                  maxCards={2}
                  label={`${activeOpponent.name} cards`}
                  unavailableCards={unavailableForOpponent(activeOpponent.id)}
                />
              )}
            </div>
            )}
          </div>

        </div>

        <div className="hl-results">
          <div className="hl-street-table-wrap">
            <div className="hl-grid-label">By-river odds vs exact hands</div>
            <div className="hl-showdown-summary">
              <div>
                <span className="hl-showdown-primary">
                  {showdownEquity.available && heroShowdown ? formatPct(heroShowdown.equityPct) : '-'}
                </span>
                <small>Hero equity</small>
              </div>
              <div>
                <span>{formatRunouts(showdownEquity.samples, showdownEquity.exact)}</span>
                <small>{showdownEquity.missingBoardCards} board card{showdownEquity.missingBoardCards === 1 ? '' : 's'} to come</small>
              </div>
            </div>
            {showdownEquity.error && (
              <div className="hl-showdown-empty">{showdownEquity.error}</div>
            )}
            {showdownEquity.available && (
              <div className="hl-showdown-table">
                <div className="hl-showdown-column-heads">
                  <span>Player</span>
                  <span>Equity</span>
                  <span className="hl-showdown-lose-head">
                    Lose
                    <button
                      type="button"
                      className="hl-info-toast-trigger"
                      aria-label="Equity and lose percentage explanation"
                    >
                      i
                    </button>
                    <span className="hl-info-toast" role="tooltip">
                      Equity is expected pot share: wins plus your share of chops. Lose is the runouts where this player gets no part of the pot.
                    </span>
                  </span>
                </div>
                {showdownEquity.players.map(player => (
                  <div key={player.id} className={`hl-showdown-row${player.id === 'hero' ? ' hero' : ''}`}>
                    <div className="hl-showdown-player">
                      <strong>{player.name}</strong>
                      <span>{player.cards.length === 2 ? handLabel(player.cards[0], player.cards[1]) : 'Incomplete'}</span>
                    </div>
                    <div className="hl-stat-cell primary">
                      <EquityStatButton
                        id={`showdown:${player.id}`}
                        equity={player.equityPct}
                        win={player.winPct}
                        tie={player.tiePct}
                        expanded={expandedEquityCells.has(`showdown:${player.id}`)}
                        onToggle={toggleEquityCell}
                      />
                    </div>
                    <div className="hl-stat-cell hl-lose-cell">
                      <span>{formatPct(player.lossPct)}</span>
                      <small>Lose</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hl-street-table-wrap">
            <div className="hl-grid-label">Street-by-street statistics vs one random hand</div>
            <div className="hl-street-table">
              {streetStats.map(stats => {
                const outsExpanded = expandedOutsStreet === stats.street;
                const impactResult = analyzeNextCardImpacts(heroCards, opponentHands, stats.board);
                const useImpactMode = stats.available && impactResult.available && impactResult.currentHeroHandRank >= 1;
                const outGroups = useImpactMode ? groupNextCardImpacts(impactResult.impacts) : groupOutDetails(stats.outDetails);
                const selectedOutGroups = outGroups.filter(group => isOutGroupSelected(stats.street, group));
                const selectedOutCount = countUniqueCards(selectedOutGroups);
                const possibleOutCount = useImpactMode ? impactResult.totalNextCards : countUniqueCards(outGroups);
                const outsClickable = outGroups.length > 0;
                const outsLabel = useImpactMode ? 'Impact cards' : 'Selected outs';
                const outsPanelTitle = useImpactMode
                  ? `${impactResult.nextStreetLabel ?? 'Next'} card impact`
                  : 'Possible next-card hands';
                const outsPanelHelper = useImpactMode
                  ? 'Tap a group to include or exclude those impact cards.'
                  : 'Tap a hand class to count those cards as outs.';
                return (
                  <div key={stats.street} className="hl-street-block">
                    <div className={`hl-street-row${stats.available ? '' : ' pending'}`}>
                      <div className="hl-street-name">
                        <strong>{stats.label}</strong>
                        <span>{formatSamples(stats)}</span>
                      </div>
                      <div className="hl-stat-cell primary">
                        <EquityStatButton
                          id={`street:${stats.street}`}
                          equity={stats.equityPct}
                          win={stats.winPct}
                          tie={stats.tiePct}
                          expanded={expandedEquityCells.has(`street:${stats.street}`)}
                          onToggle={toggleEquityCell}
                        />
                      </div>
                      <div className="hl-stat-cell">
                        <button
                          type="button"
                          className="hl-outs-button"
                          onClick={() => outsClickable && setExpandedOutsStreet(outsExpanded ? null : stats.street)}
                          disabled={!outsClickable}
                          aria-expanded={outsExpanded}
                        >
                          <span>
                            {stats.outs === null ? '-' : `${selectedOutCount}/${possibleOutCount}`}
                          </span>
                          <small>{outsLabel}</small>
                        </button>
                      </div>
                      <div className="hl-street-detail">
                        <strong>{stats.madeHand}</strong>
                        <span>
                          {useImpactMode
                            ? impactResult.impacts.length > 0
                              ? `${countUniqueCards(groupNextCardImpacts(impactResult.impacts))} ${impactResult.nextStreetLabel?.toLowerCase() ?? 'next'} cards can change the exact-villain outcome`
                              : `No ${impactResult.nextStreetLabel?.toLowerCase() ?? 'next'} cards change the exact-villain outcome`
                            : stats.drawSummary}
                        </span>
                        {stats.boardTexture.length > 0 && (
                          <div className="hl-texture-tags">
                            {stats.boardTexture.map(label => <span key={label}>{label}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                    {outsExpanded && (
                      <div className="hl-outs-detail">
                        <div className="hl-outs-detail-head">
                          <strong>{outsPanelTitle}</strong>
                          <span>{outsPanelHelper}</span>
                        </div>
                        {outGroups.map(group => (
                          <button
                            type="button"
                            key={group.key}
                            className={`hl-outs-group${isOutGroupSelected(stats.street, group) ? ' selected' : ''}`}
                            onClick={() => toggleOutGroup(stats.street, group)}
                            aria-pressed={isOutGroupSelected(stats.street, group)}
                          >
                            <div className="hl-outs-group-head">
                              <div>
                                <div className="hl-outs-group-title">{group.label}</div>
                                <div className="hl-outs-group-subtitle">{outGroupSubtitle(group)}</div>
                              </div>
                              <span className="hl-outs-selected-mark">
                                {isOutGroupSelected(stats.street, group) ? 'Included' : 'Excluded'}
                              </span>
                            </div>
                            <div className="hl-outs-cards">
                              {group.cards.map(card => (
                                <PlayingCard key={cardKey(card)} card={card} size="sm" />
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
