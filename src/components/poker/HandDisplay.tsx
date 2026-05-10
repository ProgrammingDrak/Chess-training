import type { Card, Suit } from '../../types/poker';
import { SUIT_SYMBOLS, isRedSuit } from '../../utils/poker';

interface CardProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
}

export function PlayingCard({ card, size = 'md', faceDown = false }: CardProps) {
  const red = isRedSuit(card.suit);
  return (
    <div
      className={`playing-card ${size} suit-${card.suit} ${red ? 'red' : ''} ${faceDown ? 'face-down' : ''}`}
      title={!faceDown ? `${card.rank}${SUIT_SYMBOLS[card.suit as Suit]}` : undefined}
    >
      {!faceDown && (
        <>
          <span className="card-rank">{card.rank}</span>
          <span className="card-suit">{SUIT_SYMBOLS[card.suit as Suit]}</span>
        </>
      )}
    </div>
  );
}

interface HandDisplayProps {
  card1: Card;
  card2: Card;
  size?: 'sm' | 'md' | 'lg';
}

export function HandDisplay({ card1, card2, size = 'md' }: HandDisplayProps) {
  return (
    <div className="hand-display">
      <PlayingCard card={card1} size={size} />
      <PlayingCard card={card2} size={size} />
    </div>
  );
}

interface BoardDisplayProps {
  cards: Card[];
  size?: 'sm' | 'md' | 'lg';
}

export function BoardDisplay({ cards, size = 'sm' }: BoardDisplayProps) {
  return (
    <div className="board-display">
      {cards.map((card, i) => (
        <PlayingCard key={i} card={card} size={size} />
      ))}
    </div>
  );
}

interface HandNotationProps {
  notation: string; // e.g. "AKs", "AA", "72o"
  size?: 'sm' | 'md' | 'lg';
}

export function HandNotationDisplay({ notation }: HandNotationProps) {
  // Color suit characters in notation
  const parts = notation.split('').map((ch, i) => {
    if (ch === 'h' || ch === 'd') return <span key={i} className="red">{ch}</span>;
    return <span key={i}>{ch}</span>;
  });
  return <span className="hand-notation">{parts}</span>;
}
