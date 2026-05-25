import type { LivePosition, LiveStackSnapshot, SeatId } from '../../../types/liveSession';
import { SeatChip } from './SeatChip';
import { formatLiveNumber } from '../../../utils/liveMoney';

export interface TableActionAnimation {
  id: string | number;
  seatId: SeatId;
  label: string;
  action: string;
}

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
  /** Amount each seat has committed on the current betting street, in BB. */
  streetBets?: Map<SeatId, number>;
  /** Total amount currently collected in the pot, in BB. */
  potAmountBB?: number;
  /** Short-lived action callouts, positioned at their acting seats. */
  actionAnimations?: TableActionAnimation[];
  /** Seats with live face-down hole cards on the table. */
  dealtSeatIds?: SeatId[];
  /** Seats whose hole cards have moved to the burn/muck pile. */
  foldedSeatIds?: SeatId[];
  /** Number of face-down cards currently in the burn/muck pile. */
  burnPileCount?: number;
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

function chipCountForBB(amountBB: number): number {
  if (amountBB >= 20) return 5;
  if (amountBB >= 8) return 4;
  if (amountBB >= 2) return 3;
  return 2;
}

function ChipStackIcon({ amountBB, className = '' }: { amountBB: number; className?: string }) {
  return (
    <span className={`live-chip-stack ${className}`} aria-hidden="true">
      {Array.from({ length: chipCountForBB(amountBB) }).map((_, index) => (
        <span key={index} style={{ '--chip-index': index } as React.CSSProperties} />
      ))}
    </span>
  );
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
  streetBets,
  potAmountBB,
  actionAnimations,
  dealtSeatIds,
  foldedSeatIds,
  burnPileCount,
  centerContent,
  isSeatDisabled,
  onSeatTap,
  draggableSeats,
  draggedSeat,
  onSeatDragStart,
  onSeatDragEnd,
  onSeatDrop,
}: PokerTableProps) {
  const dealtSeats = new Set(dealtSeatIds ?? []);
  const foldedSeats = new Set(foldedSeatIds ?? []);

  return (
    <div className="live-table">
      <div className="live-table-felt">
        {potAmountBB !== undefined && potAmountBB > 0 && (
          <div key={Math.round(potAmountBB * 100)} className="live-pot-chip-pile" aria-label={`${formatLiveNumber(potAmountBB)} big blinds in the pot`}>
            <ChipStackIcon amountBB={potAmountBB} className="live-pot-chip-stack" />
            <span>{formatLiveNumber(potAmountBB)}BB</span>
          </div>
        )}
        {centerContent && <div className="live-table-center">{centerContent}</div>}
      </div>

      {burnPileCount !== undefined && burnPileCount > 0 && (
        <div key={burnPileCount} className="live-burn-pile" aria-label={`${burnPileCount} cards in burn pile`}>
          <div className="live-burn-pile-cards" aria-hidden="true">
            {Array.from({ length: Math.min(4, burnPileCount) }).map((_, index) => (
              <span key={index} className="live-table-card-back" style={{ '--card-offset': index } as React.CSSProperties} />
            ))}
          </div>
          <span>Burn pile · {burnPileCount}</span>
        </div>
      )}

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
            <ChipStackIcon amountBB={amountBB} className="live-bet-chip-stack" />
            <strong>{formatLiveNumber(amountBB)}BB</strong>
          </span>
        );
      })}

      {Array.from({ length: tableSize }).map((_, seatId) => {
        if (!dealtSeats.has(seatId) || foldedSeats.has(seatId)) return null;
        const angle = Math.PI / 2 + (2 * Math.PI * seatId) / tableSize;
        const radius = 35;
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        const rotation = (angle * 180) / Math.PI - 90;

        return (
          <div
            key={`hole-${seatId}`}
            className="live-seat-hole-cards"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              '--hole-card-rotation': `${rotation}deg`,
            } as React.CSSProperties}
            aria-label={`Face-down cards for seat ${seatId + 1}`}
          >
            <span className="live-table-card-back" aria-hidden="true" />
            <span className="live-table-card-back" aria-hidden="true" />
          </div>
        );
      })}

      {actionAnimations
        ?.filter((animation) => animation.action === 'fold')
        .map((animation) => {
          const angle = Math.PI / 2 + (2 * Math.PI * animation.seatId) / tableSize;
          const radius = 35;
          const x = 50 + radius * Math.cos(angle);
          const y = 50 + radius * Math.sin(angle);
          const rotation = (angle * 180) / Math.PI - 90;

          return (
            <div
              key={`fold-cards-${animation.id}`}
              className="live-fold-to-burn"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                '--burn-left': '64%',
                '--burn-top': '60%',
                '--hole-card-rotation': `${rotation}deg`,
              } as React.CSSProperties}
              aria-hidden="true"
            >
              <span className="live-table-card-back" />
              <span className="live-table-card-back" />
            </div>
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
              disabled={isSeatDisabled?.(seatId)}
              onTap={onSeatTap}
              draggable={Boolean(draggableSeats && playerNames[seatId])}
              isDragging={draggedSeat === seatId}
              isDropTarget={draggedSeat !== null && draggedSeat !== seatId}
              onDragStart={onSeatDragStart}
              onDragEnd={onSeatDragEnd}
              onDrop={onSeatDrop}
            />
            {actionAnimations
              ?.filter((animation) => animation.seatId === seatId)
              .map((animation) => (
                <span
                  key={animation.id}
                  className={`live-action-pop live-action-pop-${animation.action}`}
                  aria-hidden="true"
                >
                  {animation.action === 'check' && <span className="live-action-knock" />}
                  {animation.label}
                </span>
              ))}
          </div>
        );
      })}
    </div>
  );
}
