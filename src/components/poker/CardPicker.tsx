import { useMemo, useState } from 'react';
import type { Card, Rank } from '../../types/poker';
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

type CardPickerMode = 'quick' | 'grid' | 'text';

interface CardPickerProps {
  value: Card[];
  onChange: (cards: Card[]) => void;
  maxCards?: number;
  label?: string;
}

const MODE_LABELS: Record<CardPickerMode, string> = {
  quick: 'Rank + suit',
  grid: '52-card grid',
  text: 'Type',
};

function addOrToggleCard(cards: Card[], card: Card, maxCards: number): Card[] {
  if (cards.some(selected => cardsEqual(selected, card))) {
    return cards.filter(selected => !cardsEqual(selected, card));
  }
  if (cards.length >= maxCards) {
    return [...cards.slice(1), card];
  }
  return [...cards, card];
}

export function CardPicker({
  value,
  onChange,
  maxCards = 2,
  label = 'Cards',
}: CardPickerProps) {
  const [mode, setMode] = useState<CardPickerMode>('quick');
  const [selectedRank, setSelectedRank] = useState<Rank | null>(null);
  const [textValue, setTextValue] = useState('');
  const [textError, setTextError] = useState<string | null>(null);

  const selectedKeys = useMemo(
    () => new Set(value.map(cardKey)),
    [value],
  );

  const allCards = useMemo(() => (
    EXACT_CARD_RANKS.flatMap(rank => EXACT_CARD_SUITS.map(suit => ({ rank, suit })))
  ), []);

  const handlePick = (card: Card) => {
    onChange(addOrToggleCard(value, card, maxCards));
    setTextError(null);
  };

  const handleTextChange = (raw: string) => {
    setTextValue(raw);
    const result = parseExactCardInput(raw, maxCards);
    setTextError(result.error);
    if (!result.error) onChange(result.cards);
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
        {(Object.keys(MODE_LABELS) as CardPickerMode[]).map(nextMode => (
          <button
            key={nextMode}
            type="button"
            className={`card-picker-mode ${mode === nextMode ? 'active' : ''}`}
            onClick={() => setMode(nextMode)}
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
            {EXACT_CARD_SUITS.map(suit => (
              <button
                key={suit}
                type="button"
                className={`card-picker-suit ${isRedSuit(suit) ? 'red' : ''}`}
                disabled={!selectedRank}
                onClick={() => selectedRank && handlePick({ rank: selectedRank, suit })}
              >
                <span>{SUIT_SYMBOLS[suit]}</span>
                <small>{suit.toUpperCase()}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'grid' && (
        <div className="card-picker-grid">
          {allCards.map(card => {
            const key = cardKey(card);
            return (
              <button
                key={key}
                type="button"
                className={`card-picker-card ${selectedKeys.has(key) ? 'selected' : ''}`}
                onClick={() => handlePick(card)}
                aria-label={cardLabel(card)}
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
