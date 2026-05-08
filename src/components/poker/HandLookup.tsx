import { useEffect, useMemo, useState } from 'react';
import { RANKS, cellHand } from '../../utils/handMatrix';
import { HAND_RANK_MAP } from '../../data/poker/profileTemplates';
import { cardKey } from '../../utils/cardInput';
import { analyzeHoldemScenario, handNotationFromCards, type HoldemOutDetail, type HoldemStreetStats } from '../../utils/holdemEquity';
import { handLabel } from '../../utils/poker';
import type { Card, Suit } from '../../types/poker';
import { CardPicker } from './CardPicker';
import { PlayingCard } from './HandDisplay';

const RANK_SET = new Set(RANKS as unknown as string[]);
const SUIT_ORDER: Suit[] = ['s', 'h', 'd', 'c'];
type LookupTab = 'hero' | 'flop' | 'turn' | 'river';
type ActiveLookupTab = LookupTab | 'board';

const LOOKUP_TABS: Array<{ id: ActiveLookupTab; label: string; helper: string }> = [
  { id: 'hero', label: 'Hero Hand', helper: 'Pick the exact two cards or type notation.' },
  { id: 'board', label: 'Full Board', helper: 'Enter flop, turn, and river in one pass.' },
  { id: 'flop', label: 'Flop', helper: 'Add the three flop cards.' },
  { id: 'turn', label: 'Turn', helper: 'Add the turn card.' },
  { id: 'river', label: 'River', helper: 'Add the river card.' },
];

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

function groupOutDetails(outDetails: HoldemOutDetail[]): Array<{ key: string; label: string; note: string; handRank: number; cards: Card[] }> {
  const groups = new Map<string, { key: string; label: string; note: string; handRank: number; cards: Card[] }>();
  for (const detail of outDetails) {
    const key = detail.improvesTo;
    const group = groups.get(key) ?? {
      key,
      label: detail.improvesTo,
      note: detail.note,
      handRank: detail.handRank,
      cards: [],
    };
    group.cards.push(detail.card);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.handRank - a.handRank || b.cards.length - a.cards.length);
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
  const [ruledOutOutGroups, setRuledOutOutGroups] = useState<Set<string>>(() => new Set());
  const [heroCards, setHeroCards] = useState<Card[]>([{ rank: 'A', suit: 's' }, { rank: 'K', suit: 's' }]);
  const [flopCards, setFlopCards] = useState<Card[]>([]);
  const [turnCard, setTurnCard] = useState<Card[]>([]);
  const [riverCard, setRiverCard] = useState<Card[]>([]);
  const [selectedHand, setSelectedHand] = useState<string>('AKs');
  const [textInput, setTextInput] = useState<string>('AKs');
  const [textError, setTextError] = useState(false);
  const [showGrid, setShowGrid] = useState(defaultShowGrid);

  const boardCards = useMemo(() => [...flopCards, ...turnCard, ...riverCard], [flopCards, riverCard, turnCard]);
  const heroNotation = handNotationFromCards(heroCards) ?? selectedHand;
  const rank = HAND_RANK_MAP[heroNotation] ?? HAND_RANK_MAP[selectedHand] ?? null;

  useEffect(() => {
    setRuledOutOutGroups(new Set());
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

  function selectFromGrid(hand: string) {
    setSelectedHand(hand);
    setTextInput(hand);
    setTextError(false);
    const exactCards = cardsForHandNotation(hand, boardCards);
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
      const exactCards = cardsForHandNotation(parsed, boardCards);
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

  function toggleRuledOutGroup(street: string, groupKey: string) {
    const key = outGroupKey(street, groupKey);
    setRuledOutOutGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const streetStats = useMemo(
    () => analyzeHoldemScenario(heroCards, boardCards),
    [boardCards, heroCards],
  );

  const completeHero = heroCards.length === 2;
  const heroSummary = completeHero ? handLabel(heroCards[0], heroCards[1]) : 'Choose two cards';
  const latestAvailable = [...streetStats].reverse().find(stats => stats.available) ?? streetStats[0];
  const activeLookupMeta = activeLookupTab ? LOOKUP_TABS.find(tab => tab.id === activeLookupTab) : null;

  const turnUnavailable = [...heroCards, ...flopCards, ...riverCard];
  const riverUnavailable = [...heroCards, ...flopCards, ...turnCard];

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
                <small>{latestAvailable.label} equity</small>
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
                    unavailableCards={boardCards}
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
                  unavailableCards={[...heroCards, ...turnCard, ...riverCard]}
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
                  unavailableCards={heroCards}
                />
              )}
            </div>
            )}
          </div>

        </div>

        <div className="hl-results">
          <div className="hl-street-table-wrap">
            <div className="hl-grid-label">Street-by-street statistics vs one random hand</div>
            <div className="hl-street-table">
              {streetStats.map(stats => {
                const outsExpanded = expandedOutsStreet === stats.street;
                const outsClickable = stats.outDetails.length > 0;
                const outGroups = groupOutDetails(stats.outDetails);
                const liveOutGroups = outGroups.filter(group => !ruledOutOutGroups.has(outGroupKey(stats.street, group.key)));
                const liveOutCount = liveOutGroups.reduce((sum, group) => sum + group.cards.length, 0);
                const hasRuledOuts = liveOutCount !== stats.outDetails.length;
                return (
                  <div key={stats.street} className="hl-street-block">
                    <div className={`hl-street-row${stats.available ? '' : ' pending'}`}>
                      <div className="hl-street-name">
                        <strong>{stats.label}</strong>
                        <span>{formatSamples(stats)}</span>
                      </div>
                      <div className="hl-stat-cell primary">
                        <span>{formatPct(stats.equityPct)}</span>
                        <small>Equity</small>
                      </div>
                      <div className="hl-stat-cell">
                        <span>{formatPct(stats.winPct)}</span>
                        <small>Win</small>
                      </div>
                      <div className="hl-stat-cell">
                        <span>{formatPct(stats.tiePct)}</span>
                        <small>Tie</small>
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
                            {stats.outs === null ? '-' : hasRuledOuts ? `${liveOutCount}/${stats.outs}` : stats.outs}
                          </span>
                          <small>{hasRuledOuts ? 'Live outs' : 'Outs'}</small>
                        </button>
                      </div>
                      <div className="hl-street-detail">
                        <strong>{stats.madeHand}</strong>
                        <span>{stats.drawSummary}</span>
                        {stats.boardTexture.length > 0 && (
                          <div className="hl-texture-tags">
                            {stats.boardTexture.map(label => <span key={label}>{label}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                    {outsExpanded && (
                      <div className="hl-outs-detail">
                        {outGroups.map(group => (
                          <div
                            key={group.key}
                            className={`hl-outs-group${ruledOutOutGroups.has(outGroupKey(stats.street, group.key)) ? ' ruled-out' : ''}`}
                          >
                            <div className="hl-outs-group-head">
                              <div>
                                <div className="hl-outs-group-title">{group.label}</div>
                                <div className="hl-outs-group-subtitle">{group.note} · {group.cards.length} card{group.cards.length === 1 ? '' : 's'}</div>
                              </div>
                              <button
                                type="button"
                                className="hl-outs-ruleout"
                                onClick={() => toggleRuledOutGroup(stats.street, group.key)}
                                aria-label={ruledOutOutGroups.has(outGroupKey(stats.street, group.key))
                                  ? `Restore ${group.label} outs`
                                  : `Rule out ${group.label} as a viable winning hand`}
                              >
                                {ruledOutOutGroups.has(outGroupKey(stats.street, group.key)) ? 'Undo' : 'X'}
                              </button>
                            </div>
                            <div className="hl-outs-cards">
                              {group.cards.map(card => (
                                <PlayingCard key={cardKey(card)} card={card} size="sm" />
                              ))}
                            </div>
                          </div>
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
