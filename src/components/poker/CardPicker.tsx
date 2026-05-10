import { useMemo, useState } from 'react';
import type { Card, Rank } from '../../types/poker';
import type { LiveCardPickerMode } from '../../types/liveSession';
import { cardLabel, isRedSuit, SUIT_SYMBOLS } from '../../utils/poker';
import {
  cardKey,
  cardsEqual,
  EXACT_CARD_RANKS,
  EXACT_CARD_SUITS,
  parseExactCardInput,
} from '../../utils/cardInput';
import { PlayingCard } from './HandDisplay';
import './CardPicker.css';

type CardPickerMode = LiveCardPickerMode;

interface CardPickerProps {
  value: Card[];
  onChange: (cards: Card[]) => void;
  maxCards?: number;
  label?: string;
  mode?: CardPickerMode;
  onModeChange?: (mode: CardPickerMode) => void;
  unavailableCards?: Card[];
}

const MODE_LABELS: Record<CardPickerMode, string> = {
  grid: '52-card grid',
  quick: 'Rank + suit',
  text: 'Type',
};

const MODE_ORDER: CardPickerMode[] = ['grid', 'quick', 'text'];
const SUIT_NAMES = {
  s: 'Spade',
  h: 'Heart',
  d: 'Diamond',
  c: 'Club',
} as const;

function addOrToggleCard(cards: Card[], card: Card, maxCards: number): Card[] {
  if (cards.some(selected => cardsEqual(selected, card))) {
    return cards.filter(selected => !cardsEqual(selected, card));
  }
  if (cards.length >= maxCards) {
    return [...cards.slice(1), card];
  }
  return [...cards, card];
}

function defaultPickerMode(): CardPickerMode {
  return 'grid';
}

export function CardPicker({
  value,
  onChange,
  maxCards = 2,
  label = 'Cards',
  mode: controlledMode,
  onModeChange,
  unavailableCards = [],
}: CardPickerProps) {
  const [internalMode, setInternalMode] = useState<CardPickerMode>(() => defaultPickerMode());
  const mode = controlledMode ?? internalMode;
  const [selectedRank, setSelectedRank] = useState<Rank | null>(null);
  const [textValue, setTextValue] = useState('');
  const [textError, setTextError] = useState<string | null>(null);

  const selectedKeys = useMemo(
    () => new Set(value.map(cardKey)),
    [value],
  );
  const unavailableKeys = useMemo(
    () => new Set(unavailableCards.map(cardKey)),
    [unavailableCards],
  );

  const allCards = useMemo(() => (
    EXACT_CARD_RANKS.flatMap(rank => EXACT_CARD_SUITS.map(suit => ({ rank, suit })))
  ), []);

  const handlePick = (card: Card) => {
    const key = cardKey(card);
    if (unavailableKeys.has(key) && !selectedKeys.has(key)) return;
    onChange(addOrToggleCard(value, card, maxCards));
    setTextError(null);
  };

  const handleModeChange = (nextMode: CardPickerMode) => {
    if (!controlledMode) setInternalMode(nextMode);
    onModeChange?.(nextMode);
  };

  const handleTextChange = (raw: string) => {
    setTextValue(raw);
    const result = parseExactCardInput(raw, maxCards);
    const blockedCard = result.cards.find(card => unavailableKeys.has(cardKey(card)) && !selectedKeys.has(cardKey(card)));
    const error = result.error || (blockedCard ? `${cardLabel(blockedCard)} is already known` : null);
    setTextError(error);
    if (!error) onChange(result.cards);
  };

  return (
    <div className="card-picker">
      <div className="card-picker-top">
        <div>
          <div className="card-picker-label">{label}</div>
          <div className="card-picker-count">{value.length}/{maxCards}</div>
        </div>
        <div className="card-picker-slots">
          {Array.from({ length: maxCards }).map((_, index) => {
            const card = value[index];
            return card ? (
              <button
                key={cardKey(card)}
                type="button"
                className="card-picker-slot filled"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label={`Remove ${cardLabel(card)}`}
              >
                <PlayingCard card={card} size="sm" />
              </button>
            ) : (
              <div key={index} className="card-picker-slot empty" />
            );
          })}
        </div>
      </div>

      <div className="card-picker-modes" role="tablist" aria-label="Card input modes">
        {MODE_ORDER.map(nextMode => (
          <button
            key={nextMode}
            type="button"
            className={`card-picker-mode ${mode === nextMode ? 'active' : ''}`}
            onClick={() => handleModeChange(nextMode)}
          >
            {MODE_LABELS[nextMode]}
          </button>
        ))}
      </div>

      {mode === 'quick' && (
        <div className="card-picker-quick">
          <div className="card-picker-ranks">
            {EXACT_CARD_RANKS.map(rank => (
              <button
                key={rank}
                type="button"
                className={`card-picker-rank ${selectedRank === rank ? 'active' : ''}`}
                onClick={() => setSelectedRank(rank)}
              >
                {rank}
              </button>
            ))}
          </div>
          <div className="card-picker-suits">
            {EXACT_CARD_SUITS.map(suit => {
              const card = selectedRank ? { rank: selectedRank, suit } : null;
              const key = card ? cardKey(card) : '';
              const unavailable = card !== null && unavailableKeys.has(key) && !selectedKeys.has(key);
              return (
                <button
                  key={suit}
                  type="button"
                  className={`card-picker-suit ${isRedSuit(suit) ? 'red' : ''} ${unavailable ? 'unavailable' : ''}`}
                  disabled={!selectedRank || unavailable}
                  onClick={() => card && handlePick(card)}
                  title={unavailable && card ? `${cardLabel(card)} is already known` : undefined}
                >
                  <span>{SUIT_SYMBOLS[suit]}</span>
                  <small>{SUIT_NAMES[suit]}</small>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === 'grid' && (
        <div className="card-picker-grid">
          {allCards.map(card => {
            const key = cardKey(card);
            const unavailable = unavailableKeys.has(key) && !selectedKeys.has(key);
            return (
              <button
                key={key}
                type="button"
                className={`card-picker-card ${selectedKeys.has(key) ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}`}
                disabled={unavailable}
                onClick={() => handlePick(card)}
                aria-label={cardLabel(card)}
                title={unavailable ? `${cardLabel(card)} is already known` : undefined}
              >
                <PlayingCard card={card} size="sm" />
              </button>
            );
          })}
        </div>
      )}

      {mode === 'text' && (
        <div className="card-picker-text">
          <input
            className="card-picker-input"
            value={textValue}
            onChange={event => handleTextChange(event.target.value)}
            placeholder="As Kd"
            spellCheck={false}
          />
          {textError && <div className="card-picker-error">{textError}</div>}
        </div>
      )}
    </div>
  );
}
