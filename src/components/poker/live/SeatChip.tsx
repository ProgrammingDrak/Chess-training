import type { LivePosition, LiveStackSnapshot } from '../../../types/liveSession';
import { formatLiveNumber } from '../../../utils/liveMoney';

interface SeatChipProps {
  seatId: number;
  /** null when empty. */
  playerName: string | null;
  isButton: boolean;
  isActionSeat?: boolean;
  position: LivePosition | null;
  stack?: LiveStackSnapshot | null;
  isWinner?: boolean;
  disabled?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onTap?: (seatId: number) => void;
  onDragStart?: (seatId: number) => void;
  onDragEnd?: () => void;
  onDrop?: (fromSeatId: number, toSeatId: number) => void;
}

export function SeatChip({
  seatId,
  playerName,
  isButton,
  isActionSeat,
  position,
  stack,
  isWinner,
  disabled,
  draggable,
  isDragging,
  isDropTarget,
  onTap,
  onDragStart,
  onDragEnd,
  onDrop,
}: SeatChipProps) {
  const empty = playerName === null;
  const className = [
    'live-seat',
    empty ? 'live-seat-empty' : 'live-seat-filled',
    isButton ? 'live-seat-button' : '',
    isActionSeat ? 'live-seat-action' : '',
    isWinner ? 'live-seat-winner' : '',
    disabled ? 'live-seat-disabled' : '',
    draggable ? 'live-seat-draggable' : '',
    isDragging ? 'live-seat-dragging' : '',
    isDropTarget ? 'live-seat-drop-target' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      draggable={draggable && !disabled}
      onDragStart={(event) => {
        if (!draggable || disabled) return;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(seatId));
        onDragStart?.(seatId);
      }}
      onDragOver={(event) => {
        if (!onDrop) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        if (!onDrop) return;
        event.preventDefault();
        const from = Number(event.dataTransfer.getData('text/plain'));
        if (Number.isFinite(from)) onDrop(from, seatId);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onTap?.(seatId)}
      aria-label={empty ? `Empty seat ${seatId + 1}` : `${playerName} (seat ${seatId + 1})`}
      title={draggable ? 'Drag to move this player to another seat' : undefined}
    >
      {isButton && <span className="live-seat-button-marker" aria-label="Dealer button">D</span>}
      {position && <span className="live-seat-position">{position}</span>}
      <span className="live-seat-name">
        {empty ? <span className="live-seat-empty-label">Seat {seatId + 1}</span> : playerName}
      </span>
      {stack && (
        <span className="live-seat-stack" title={`${formatLiveNumber(stack.startingStack)} / ${formatLiveNumber(stack.startingStackBB)}BB`}>
          {formatLiveNumber(stack.startingStackBB)}BB
        </span>
      )}
    </button>
  );
}
