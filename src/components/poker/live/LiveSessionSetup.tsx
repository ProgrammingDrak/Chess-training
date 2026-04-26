import { useState } from 'react';
import type { LiveSession, LiveSeat, SeatId } from '../../../types/liveSession';
import type { PlayerProfile } from '../../../types/profiles';
import { newSessionId } from '../../../hooks/useLiveSessions';
import { PokerTable } from './PokerTable';
import { SeatPlayerPicker } from './SeatPlayerPicker';

interface LiveSessionSetupProps {
  profiles: PlayerProfile[];
  /** Defaults to 6.  Allowed range 2–9. */
  initialTableSize?: number;
  onCreateProfile: (name: string, tableSize: number) => Promise<PlayerProfile>;
  onCancel: () => void;
  onStart: (session: LiveSession) => void;
}

const TABLE_SIZE_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

function blankSeats(tableSize: number): LiveSeat[] {
  return Array.from({ length: tableSize }, (_, seatId) => ({
    seatId,
    player: null,
  }));
}

export function LiveSessionSetup({
  profiles,
  initialTableSize = 6,
  onCreateProfile,
  onCancel,
  onStart,
}: LiveSessionSetupProps) {
  const [name, setName] = useState('');
  const [tableSize, setTableSize] = useState(initialTableSize);
  const [seats, setSeats] = useState<LiveSeat[]>(() => blankSeats(initialTableSize));
  const [buttonSeat, setButtonSeat] = useState<SeatId | null>(null);
  const [pickingSeat, setPickingSeat] = useState<SeatId | null>(null);
  const [pickButton, setPickButton] = useState(false);

  const handleTableSizeChange = (next: number) => {
    setTableSize(next);
    setSeats(blankSeats(next));
    setButtonSeat(null);
  };

  const occupiedSeats = seats.filter(s => s.player !== null).map(s => s.seatId);
  const playerNames = seats.map(s => {
    if (!s.player) return null;
    const p = profiles.find(pr => pr.id === s.player!.playerProfileId);
    return p?.name ?? `Player ${s.player.playerProfileId.slice(0, 6)}`;
  });

  const seatPlayer = (seatId: SeatId, profileId: string) => {
    setSeats(prev => prev.map(s => s.seatId === seatId
      ? { ...s, player: { playerProfileId: profileId, joinedAtHandIndex: 0, leftAtHandIndex: null } }
      : s));
    setPickingSeat(null);
    // If button hasn't been chosen yet, default it to the first seated seat.
    if (buttonSeat === null) setButtonSeat(seatId);
  };

  const removePlayer = (seatId: SeatId) => {
    setSeats(prev => prev.map(s => s.seatId === seatId ? { ...s, player: null } : s));
    if (buttonSeat === seatId) setButtonSeat(null);
  };

  const onSeatTap = (seatId: SeatId) => {
    if (pickButton) {
      // Choosing button — only allow occupied seats.
      if (occupiedSeats.includes(seatId)) {
        setButtonSeat(seatId);
        setPickButton(false);
      }
      return;
    }
    if (seats[seatId].player === null) {
      setPickingSeat(seatId);
    } else {
      // Already filled — offer to remove.
      if (window.confirm('Remove this player from the seat?')) removePlayer(seatId);
    }
  };

  const canStart = occupiedSeats.length >= 2 && buttonSeat !== null;

  const handleStart = () => {
    if (!canStart || buttonSeat === null) return;
    const now = new Date().toISOString();
    const session: LiveSession = {
      id: newSessionId(),
      name: name.trim() || undefined,
      startedAt: now,
      endedAt: null,
      tableSize,
      initialButtonSeat: buttonSeat,
      seats,
      hands: [],
      updatedAt: now,
    };
    onStart(session);
  };

  if (pickingSeat !== null) {
    return (
      <SeatPlayerPicker
        profiles={profiles}
        excludeIds={seats.map(s => s.player?.playerProfileId).filter((x): x is string => Boolean(x))}
        tableSize={tableSize}
        onCancel={() => setPickingSeat(null)}
        onPickExisting={(id) => seatPlayer(pickingSeat, id)}
        onCreateNew={async (n, ts) => onCreateProfile(n, ts)}
        title={`Seat ${pickingSeat + 1} — pick a player`}
      />
    );
  }

  return (
    <div className="live-setup">
      <div className="live-setup-header">
        <button className="back-btn" onClick={onCancel}>← Live Sessions</button>
        <h1 className="live-setup-title">Start a new session</h1>
      </div>

      <div className="live-setup-controls">
        <label className="live-setup-field">
          <span className="live-setup-label">Session name (optional)</span>
          <input
            className="live-setup-input"
            type="text"
            placeholder="e.g. Saturday $2/$5 home game"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </label>

        <div className="live-setup-field">
          <span className="live-setup-label">Table size</span>
          <div className="live-setup-tablesize">
            {TABLE_SIZE_OPTIONS.map(n => (
              <button
                key={n}
                type="button"
                className={`live-setup-tablesize-btn ${tableSize === n ? 'active' : ''}`}
                onClick={() => handleTableSizeChange(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="live-setup-helper">
        Tap an empty seat to add a player.  Tap a filled seat to remove it.  Once you have at
        least 2 players seated, choose the dealer button and start the session.
      </p>

      <PokerTable
        tableSize={tableSize}
        playerNames={playerNames}
        buttonSeat={buttonSeat}
        centerContent={
          <div className="live-table-center-text">
            {occupiedSeats.length < 2
              ? `Add ${2 - occupiedSeats.length} more player${occupiedSeats.length === 1 ? '' : 's'}`
              : pickButton
                ? 'Tap a seat for the button'
                : buttonSeat === null
                  ? 'Choose a button'
                  : `${occupiedSeats.length} seated · Button at seat ${buttonSeat + 1}`}
          </div>
        }
        onSeatTap={onSeatTap}
      />

      <div className="live-setup-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setPickButton(p => !p)}
          disabled={occupiedSeats.length < 2}
        >
          {pickButton ? 'Cancel button pick' : (buttonSeat === null ? 'Choose dealer button' : 'Change dealer button')}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleStart}
          disabled={!canStart || pickButton}
        >
          Start session
        </button>
      </div>
    </div>
  );
}
