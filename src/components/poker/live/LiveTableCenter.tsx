import type { ReactNode } from 'react';
import type { Card } from '../../../types/poker';
import type { LiveStreet } from '../../../types/liveSession';
import { PlayingCard } from '../HandDisplay';
import { formatLiveNumber } from '../../../utils/liveMoney';

export type LiveBoardCards = [Card | null, Card | null, Card | null, Card | null, Card | null];
export type LiveBoardSelection = 'flop' | 'turn' | 'river';

interface LiveTableCenterProps {
  potBB: number;
  bigBlind: number;
  currency?: string;
  boardCards: LiveBoardCards;
  status: ReactNode;
  boardDisabled?: boolean;
  onBoardSelect?: (selection: LiveBoardSelection) => void;
}

const BOARD_SELECTION_LABELS: Record<LiveBoardSelection, string> = {
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

function slotLabel(selection: LiveBoardSelection, index: number): string {
  if (selection === 'flop') return String(index + 1);
  return selection === 'turn' ? 'T' : 'R';
}

export function LiveTableCenter({
  potBB,
  bigBlind,
  currency = '$',
  boardCards,
  status,
  boardDisabled,
  onBoardSelect,
}: LiveTableCenterProps) {
  const potAmount = potBB * bigBlind;

  const renderSlot = (selection: LiveBoardSelection, index: number) => (
    <button
      key={index}
      type="button"
      className={`live-board-slot ${boardCards[index] ? 'filled' : ''}`}
      onClick={() => onBoardSelect?.(selection)}
      disabled={boardDisabled || !onBoardSelect}
      aria-label={BOARD_SELECTION_LABELS[selection]}
    >
      {boardCards[index] ? <PlayingCard card={boardCards[index]} size="sm" /> : <span>{slotLabel(selection, index)}</span>}
    </button>
  );

  return (
    <div className="live-table-center-stack">
      <div className="live-table-pot" aria-label="Current pot">
        <span className="live-table-pot-label">Pot</span>
        <strong>{formatLiveNumber(potBB)}BB</strong>
        <span className="live-table-pot-amount">
          {currency}{formatLiveNumber(potAmount)}
        </span>
      </div>
      <div className="live-board">
        <div className="live-board-group live-board-flop" aria-label="Flop">
          {[0, 1, 2].map(index => renderSlot('flop', index))}
        </div>
        {(['turn', 'river'] as LiveBoardSelection[]).map(selection => {
          const index = selection === 'turn' ? 3 : 4;
          return (
            <div key={selection} className="live-board-group" aria-label={BOARD_SELECTION_LABELS[selection]}>
              {renderSlot(selection, index)}
            </div>
          );
        })}
      </div>
      <div className="live-table-center-text">
        {status}
      </div>
    </div>
  );
}

export function visibleBoardCards(cards: Card[], count: number): LiveBoardCards {
  return [0, 1, 2, 3, 4].map(index => (index < count ? cards[index] ?? null : null)) as LiveBoardCards;
}

export function visibleBoardCountForStreet(street: LiveStreet | 'showdown'): number {
  if (street === 'showdown') return 5;
  if (street === 'river') return 5;
  if (street === 'turn') return 4;
  if (street === 'flop') return 3;
  return 0;
}
