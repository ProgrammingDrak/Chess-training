import type { LivePosition, LiveStackSnapshot, SeatId } from '../../../types/liveSession';
import { SeatChip } from './SeatChip';
import { formatLiveNumber } from '../../../utils/liveMoney';

interface PokerTableProps {
  tableSize: number;
  /** Maps seatId → display name (or null for empty). length === tableSize. */
  playerNames: (string | null)[];
  buttonSeat: SeatId | null;
  actionSeat?: SeatId | null;
  /** Optional position labels per seat (e.g. for active hand display). */
  positions?: Map<SeatId, LivePosition>;
  /** Optional stack display per seat. */
  stackInfo?: Map<SeatId, LiveStackSnapshot>;
  bigBlind?: number;
  /** Amount each seat has committed on the current betting street, in BB. */
  streetBets?: Map<SeatId, number>;
  /** Center-area children — usually a status line or tap prompt. */
  centerContent?: React.ReactNode;
  /** Disable per-seat taps based on seatId. */
  isSeatDisabled?: (seatId: SeatId) => boolean;
  onSeatTap?: (seatId: SeatId) => void;
  draggableSeats?: boolean;
  draggedSeat?: SeatId | null;
  onSeatDragStart?: (seatId: SeatId) => void;
  onSeatDragEnd?: () => void;
  onSeatDrop?: (fromSeatId: SeatId, toSeatId: SeatId) => void;
}

/**
 * Presentational poker table.  Seats are positioned around an oval via
 * absolute positioning + trigonometry — no canvas, no SVG library.
 *
 * The container is square at any width (aspect-ratio: 1 / 1 in CSS) so
 * percentages map to a stable circle.  Seat 0 is at the bottom-center
 * (closest to the player holding the phone) and indices proceed clockwise.
 */
export function PokerTable({
  tableSize,
  playerNames,
  buttonSeat,
  actionSeat,
  positions,
  stackInfo,
  bigBlind,
  streetBets,
  centerContent,
  isSeatDisabled,
  onSeatTap,
  draggableSeats,
  draggedSeat,
  onSeatDragStart,
  onSeatDragEnd,
  onSeatDrop,
}: PokerTableProps) {
  return (
    <div className="live-table">
      <div className="live-table-felt">
        {centerContent && <div className="live-table-center">{centerContent}</div>}
      </div>

      {streetBets && Array.from({ length: tableSize }).map((_, seatId) => {
        const amountBB = streetBets.get(seatId) ?? 0;
        if (amountBB <= 0) return null;
        const angle = Math.PI / 2 + (2 * Math.PI * seatId) / tableSize;
        const radius = 31;
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);

        return (
          <span
            key={`bet-${seatId}`}
            className="live-seat-bet-marker"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {formatLiveNumber(amountBB)}BB
          </span>
        );
      })}

      {Array.from({ length: tableSize }).map((_, seatId) => {
        // Bottom-center is seat 0 (player POV); proceed clockwise.
        // Angle starts at +π/2 (bottom in screen coords) and increases by
        // 2π/N per seat.  Use cos/sin to place at radius 0.46 (just inside
        // the felt edge).
        const angle = Math.PI / 2 + (2 * Math.PI * seatId) / tableSize;
        const radius = 46; // % of container
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);

        return (
          <div
            key={seatId}
            className="live-seat-wrapper"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <SeatChip
              seatId={seatId}
              playerName={playerNames[seatId] ?? null}
              isButton={buttonSeat === seatId}
              isActionSeat={actionSeat === seatId}
              position={positions?.get(seatId) ?? null}
              stack={stackInfo?.get(seatId) ?? null}
              bigBlind={bigBlind}
              disabled={isSeatDisabled?.(seatId)}
              onTap={onSeatTap}
              draggable={Boolean(draggableSeats && playerNames[seatId])}
              isDragging={draggedSeat === seatId}
              isDropTarget={draggedSeat !== null && draggedSeat !== seatId}
              onDragStart={onSeatDragStart}
              onDragEnd={onSeatDragEnd}
              onDrop={onSeatDrop}
            />
          </div>
        );
      })}
    </div>
  );
}
