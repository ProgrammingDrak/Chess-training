import { useMemo, useState } from 'react';
import type { LiveSession, LiveSeat, LiveStackSnapshot, SeatId } from '../../../types/liveSession';
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

/**
 * Resize the seats array, preserving seated players where possible.
 *
 * - Growing: all existing seats kept at their seat IDs, blanks appended.
 * - Shrinking: players in seats < newSize stay in place; players in seats >= newSize
 *   are relocated into the earliest empty seats within the new range.
 *
 * Caller must guarantee `occupiedCount <= newSize` when shrinking.
 */
function resizeKeepingPlayers(currentSeats: LiveSeat[], newSize: number): LiveSeat[] {
  const next: LiveSeat[] = blankSeats(newSize);
  // Survivors: seated players whose seat still exists.
  for (const s of currentSeats) {
    if (s.player !== null && s.seatId < newSize) {
      next[s.seatId] = { seatId: s.seatId, player: s.player };
    }
  }
  // Displaced: seated players whose seat vanished — slot into earliest empty seats.
  for (const s of currentSeats) {
    if (s.player !== null && s.seatId >= newSize) {
      const empty = next.find(n => n.player === null);
      if (empty) empty.player = s.player;
    }
  }
  return next;
}

export function LiveSessionSetup({
  profiles,
  initialTableSize = 6,
  onCreateProfile,
  onCancel,
  onStart,
}: LiveSessionSetupProps) {
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [groupTag, setGroupTag] = useState('');
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState('$');
  const [smallBlindRaw, setSmallBlindRaw] = useState('1');
  const [bigBlindRaw, setBigBlindRaw] = useState('2');
  const [defaultStackRaw, setDefaultStackRaw] = useState('100');
  const [stackRawBySeat, setStackRawBySeat] = useState<Record<string, string>>({});
  const [tableSize, setTableSize] = useState(initialTableSize);
  const [seats, setSeats] = useState<LiveSeat[]>(() => blankSeats(initialTableSize));
  const [buttonSeat, setButtonSeat] = useState<SeatId | null>(null);
  const [pickingSeat, setPickingSeat] = useState<SeatId | null>(null);
  const [pickButton, setPickButton] = useState(false);
  // When shrinking would force players out, hold the target size here and prompt
  // the user to drop seated players one at a time until the count fits.
  const [pendingTableSize, setPendingTableSize] = useState<number | null>(null);

  /**
   * Reposition the button after a resize so it stays with the same player when
   * possible, or clears if its player was dropped or its seat vanished without
   * relocation.
   */
  const repositionButton = (
    prevSeats: LiveSeat[],
    nextSeats: LiveSeat[],
    prevButton: SeatId | null,
  ): SeatId | null => {
    if (prevButton === null) return null;
    const buttonPlayer = prevSeats.find(s => s.seatId === prevButton)?.player ?? null;
    if (!buttonPlayer) return null;
    const found = nextSeats.find(
      s => s.player?.playerProfileId === buttonPlayer.playerProfileId,
    );
    return found ? found.seatId : null;
  };

  const applyResize = (newSize: number, baseSeats: LiveSeat[] = seats) => {
    const nextSeats = resizeKeepingPlayers(baseSeats, newSize);
    setSeats(nextSeats);
    setTableSize(newSize);
    setButtonSeat(prev => repositionButton(baseSeats, nextSeats, prev));
  };

  const handleTableSizeChange = (next: number) => {
    if (next === tableSize) return;
    const occupied = seats.filter(s => s.player !== null).length;
    if (occupied <= next) {
      applyResize(next);
      return;
    }
    // Need to drop (occupied - next) players first.
    setPendingTableSize(next);
  };

  const dropPlayerForResize = (seatId: SeatId) => {
    if (pendingTableSize === null) return;
    const nextSeats = seats.map(s =>
      s.seatId === seatId ? { ...s, player: null } : s,
    );
    const occupied = nextSeats.filter(s => s.player !== null).length;
    if (occupied <= pendingTableSize) {
      applyResize(pendingTableSize, nextSeats);
      setPendingTableSize(null);
    } else {
      setSeats(nextSeats);
      if (buttonSeat === seatId) setButtonSeat(null);
    }
  };

  const cancelPendingResize = () => setPendingTableSize(null);

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

  const smallBlind = Math.max(0, Number(smallBlindRaw) || 0);
  const bigBlind = Math.max(0, Number(bigBlindRaw) || 0);
  const stackBBForSeat = (seatId: SeatId) => Math.max(0, Number(stackRawBySeat[String(seatId)] ?? defaultStackRaw) || 0);
  const setupStackInfo = useMemo(() => {
    const map = new Map<SeatId, LiveStackSnapshot>();
    for (const seatId of occupiedSeats) {
      const playerId = seats[seatId].player?.playerProfileId;
      if (!playerId) continue;
      const stackBB = stackBBForSeat(seatId);
      map.set(seatId, {
        seatId,
        playerProfileId: playerId,
        startingStack: stackBB * Math.max(0.01, bigBlind),
        startingStackBB: stackBB,
        endingStack: stackBB * Math.max(0.01, bigBlind),
        endingStackBB: stackBB,
      });
    }
    return map;
  }, [bigBlind, defaultStackRaw, occupiedSeats, seats, stackRawBySeat]);
  const canStart = occupiedSeats.length >= 2 && buttonSeat !== null && bigBlind > 0;

  const handleStart = () => {
    if (!canStart || buttonSeat === null) return;
    const now = new Date().toISOString();
    const initialStacks = Array.from(setupStackInfo.values());
    const session: LiveSession = {
      id: newSessionId(),
      name: name.trim() || undefined,
      details: {
        ...(venue.trim() ? { venue: venue.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(groupTag.trim() ? { groupTag: groupTag.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      startedAt: now,
      endedAt: null,
      tableSize,
      initialButtonSeat: buttonSeat,
      seats,
      hands: [],
      initialStacks,
      blindLevels: [{
        effectiveFromHandIndex: 0,
        smallBlind,
        bigBlind,
        currency: currency.trim() || '$',
      }],
      stakes: {
        sbBB: smallBlind,
        bbBB: bigBlind,
        currency: currency.trim() || '$',
      },
      updatedAt: now,
    };
    onStart(session);
  };

  if (pendingTableSize !== null) {
    const seated = seats.filter(s => s.player !== null);
    const toDrop = seated.length - pendingTableSize;
    return (
      <div className="live-setup">
        <div className="live-setup-header">
          <button className="back-btn" onClick={cancelPendingResize}>← Cancel</button>
          <h1 className="live-setup-title">
            Drop {toDrop} player{toDrop === 1 ? '' : 's'}
          </h1>
        </div>
        <p className="live-setup-helper">
          You're shrinking the table to {pendingTableSize} seats. Tap{' '}
          {toDrop === 1 ? 'a player' : `${toDrop} players`} to remove from the session.
        </p>
        <div className="live-setup-drop-list">
          {seated.map(s => {
            const profile = profiles.find(p => p.id === s.player!.playerProfileId);
            return (
              <button
                key={s.seatId}
                type="button"
                className="live-setup-drop-btn"
                onClick={() => dropPlayerForResize(s.seatId)}
              >
                <span className="live-setup-drop-seat">Seat {s.seatId + 1}</span>
                <span className="live-setup-drop-name">{profile?.name ?? 'Unknown'}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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

        <label className="live-setup-field">
          <span className="live-setup-label">Venue / host (optional)</span>
          <input
            className="live-setup-input"
            type="text"
            placeholder="e.g. Chris's house, Harrah's Cherokee"
            value={venue}
            onChange={e => setVenue(e.target.value)}
          />
        </label>

        <label className="live-setup-field">
          <span className="live-setup-label">Address (optional)</span>
          <input
            className="live-setup-input"
            type="text"
            placeholder="Address or location note"
            value={address}
            onChange={e => setAddress(e.target.value)}
          />
        </label>

        <label className="live-setup-field">
          <span className="live-setup-label">Group tag (optional)</span>
          <input
            className="live-setup-input"
            type="text"
            placeholder="e.g. home-game, casino, tournament"
            value={groupTag}
            onChange={e => setGroupTag(e.target.value)}
          />
        </label>

        <div className="live-setup-field">
          <span className="live-setup-label">Starting blinds</span>
          <div className="live-setup-blinds-row">
            <input
              className="live-setup-input live-setup-blind-input"
              type="text"
              value={currency}
              placeholder="$"
              title="Symbol shown before money amounts, like $ or €"
              onChange={e => setCurrency(e.target.value)}
              aria-label="Money symbol"
            />
            <input
              className="live-setup-input live-setup-blind-input"
              type="number"
              min={0}
              step={0.5}
              value={smallBlindRaw}
              onChange={e => setSmallBlindRaw(e.target.value)}
              aria-label="Small blind"
            />
            <span className="live-setup-blind-separator">/</span>
            <input
              className="live-setup-input live-setup-blind-input"
              type="number"
              min={0.01}
              step={0.5}
              value={bigBlindRaw}
              onChange={e => setBigBlindRaw(e.target.value)}
              aria-label="Big blind"
            />
          </div>
        </div>

        <div className="live-setup-field">
          <span className="live-setup-label">Default starting stack (BB)</span>
          <div className="live-setup-blinds-row">
            <input
              className="live-setup-input live-setup-blind-input"
              type="number"
              min={0}
              step={1}
              value={defaultStackRaw}
              onChange={e => setDefaultStackRaw(e.target.value)}
              aria-label="Default starting stack in big blinds"
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStackRawBySeat(Object.fromEntries(occupiedSeats.map(seatId => [String(seatId), defaultStackRaw])))}
            >
              Apply to all
            </button>
          </div>
        </div>

        <label className="live-setup-field">
          <span className="live-setup-label">Notes (optional)</span>
          <input
            className="live-setup-input"
            type="text"
            placeholder="Game details, tournament notes, table rules..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
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

      {occupiedSeats.length > 0 && (
        <div className="live-setup-stack-list">
          {occupiedSeats.map(seatId => (
            <label key={seatId} className="hl-sit-field">
              <span className="hl-label">{playerNames[seatId] ?? `Seat ${seatId + 1}`} stack (BB)</span>
              <input
                type="number"
                min={0}
                step={1}
                className="hl-num-input"
                value={stackRawBySeat[String(seatId)] ?? defaultStackRaw}
                onChange={e => setStackRawBySeat(prev => ({ ...prev, [String(seatId)]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      )}

      <PokerTable
        tableSize={tableSize}
        playerNames={playerNames}
        buttonSeat={buttonSeat}
        stackInfo={setupStackInfo}
        bigBlind={bigBlind}
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
