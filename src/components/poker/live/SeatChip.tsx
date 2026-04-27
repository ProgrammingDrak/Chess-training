import type { LivePosition } from '../../../types/liveSession';

interface SeatChipProps {
  seatId: number;
  /** null when empty. */
  playerName: string | null;
  isButton: boolean;
  position: LivePosition | null;
  isWinner?: boolean;
  disabled?: boolean;
  onTap?: (seatId: number) => void;
}

export function SeatChip({
  seatId,
  playerName,
  isButton,
  position,
  isWinner,
  disabled,
  onTap,
}: SeatChipProps) {
  const empty = playerName === null;
  const className = [
    'live-seat',
    empty ? 'live-seat-empty' : 'live-seat-filled',
    isButton ? 'live-seat-button' : '',
    isWinner ? 'live-seat-winner' : '',
    disabled ? 'live-seat-disabled' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => onTap?.(seatId)}
      aria-label={empty ? `Empty seat ${seatId + 1}` : `${playerName} (seat ${seatId + 1})`}
    >
      {isButton && <span className="live-seat-button-marker" aria-label="Dealer button">D</span>}
      {position && <span className="live-seat-position">{position}</span>}
      <span className="live-seat-name">
        {empty ? <span className="live-seat-empty-label">Seat {seatId + 1}</span> : playerName}
      </span>
    </button>
  );
}
