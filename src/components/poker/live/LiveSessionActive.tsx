import { useMemo, useState } from 'react';
import type {
  LiveSession,
  LiveHand,
  SeatId,
} from '../../../types/liveSession';
import type { PlayerProfile } from '../../../types/profiles';
import {
  occupiedSeatsAt,
  advanceButton,
  derivePositions,
  canSeatNewPlayerAt,
} from '../../../utils/livePoker';
import { PokerTable } from './PokerTable';
import { LiveSessionStats } from './LiveSessionStats';
import { SeatPlayerPicker } from './SeatPlayerPicker';

interface LiveSessionActiveProps {
  session: LiveSession;
  profiles: PlayerProfile[];
  onSave: (session: LiveSession) => LiveSession;
  onCreateProfile: (name: string, tableSize: number) => Promise<PlayerProfile>;
  onExit: () => void;
}

type PanelMode = 'idle' | 'add-player' | 'remove-player' | 'end-confirm';

export function LiveSessionActive({
  session,
  profiles,
  onSave,
  onCreateProfile,
  onExit,
}: LiveSessionActiveProps) {
  const [mode, setMode] = useState<PanelMode>('idle');
  const [addingAtSeat, setAddingAtSeat] = useState<SeatId | null>(null);

  // Hand index of the *upcoming* hand (the one a winner-tap would close).
  const nextHandIndex = session.hands.length;

  // Current button: taken from the most recent hand if any, else initial.
  const currentButton: SeatId = session.hands.length > 0
    ? (() => {
        const lastHand = session.hands[session.hands.length - 1];
        const occupiedNext = occupiedSeatsAt(session.seats, nextHandIndex);
        return advanceButton(lastHand.buttonSeat, occupiedNext, session.tableSize)
          ?? lastHand.buttonSeat;
      })()
    : session.initialButtonSeat;

  const occupiedNow = occupiedSeatsAt(session.seats, nextHandIndex);

  const positions = useMemo(
    () => derivePositions(currentButton, occupiedNow, session.tableSize),
    [currentButton, occupiedNow, session.tableSize],
  );

  const playerNames = useMemo(() => {
    return session.seats.map(s => {
      if (!s.player) return null;
      const occupiedThisHand = occupiedNow.includes(s.seatId);
      if (!occupiedThisHand) return null;
      const p = profiles.find(pr => pr.id === s.player!.playerProfileId);
      return p?.name ?? `Player ${s.player.playerProfileId.slice(0, 6)}`;
    });
  }, [session.seats, profiles, occupiedNow]);

  const isEnded = session.endedAt !== null;

  // ── Tap a seat: depending on mode, that's a winner / a remove / an add ──

  const handleSeatTap = (seatId: SeatId) => {
    if (isEnded) return;

    if (mode === 'remove-player') {
      const seat = session.seats[seatId];
      if (!seat?.player || !occupiedNow.includes(seatId)) return;
      // Mark left at the upcoming hand index — they won't be dealt in next hand.
      const nextSeats = session.seats.map(s => s.seatId === seatId
        ? { ...s, player: s.player ? { ...s.player, leftAtHandIndex: nextHandIndex } : null }
        : s);
      onSave({ ...session, seats: nextSeats });
      setMode('idle');
      return;
    }

    if (mode === 'add-player') {
      // Validate seat is allowed for a new player.
      if (!canSeatNewPlayerAt(seatId, currentButton, occupiedNow, session.tableSize)) {
        alert('Cannot seat a new player there — they would be SB or BB on the next hand.');
        return;
      }
      setAddingAtSeat(seatId);
      return;
    }

    // Default: tap a seated player to record them as winner of the current hand.
    if (!occupiedNow.includes(seatId)) return;
    const seat = session.seats[seatId];
    if (!seat?.player) return;

    const winnerPosition = positions.get(seatId);
    if (!winnerPosition) return; // need at least 2 players

    const now = new Date().toISOString();
    const startedAt = session.hands.length > 0
      ? session.hands[session.hands.length - 1].endedAt
      : session.startedAt;

    const hand: LiveHand = {
      index: nextHandIndex,
      startedAt,
      endedAt: now,
      buttonSeat: currentButton,
      seatedPlayers: [...occupiedNow],
      winnerSeat: seatId,
      winnerPlayerProfileId: seat.player.playerProfileId,
      winnerPosition,
    };
    onSave({ ...session, hands: [...session.hands, hand] });
  };

  const handleAddPlayer = (profileId: string) => {
    if (addingAtSeat === null) return;
    const seatId = addingAtSeat;
    const nextSeats = session.seats.map(s => s.seatId === seatId
      ? { ...s, player: { playerProfileId: profileId, joinedAtHandIndex: nextHandIndex, leftAtHandIndex: null } }
      : s);
    onSave({ ...session, seats: nextSeats });
    setAddingAtSeat(null);
    setMode('idle');
  };

  const handleEndSession = () => {
    onSave({ ...session, endedAt: new Date().toISOString() });
    setMode('idle');
  };

  // ── Player picker overlay (mid-session add) ──

  if (addingAtSeat !== null) {
    return (
      <SeatPlayerPicker
        profiles={profiles}
        excludeIds={session.seats
          .filter(s => s.player !== null && occupiedNow.includes(s.seatId))
          .map(s => s.player!.playerProfileId)}
        tableSize={session.tableSize}
        onCancel={() => { setAddingAtSeat(null); setMode('idle'); }}
        onPickExisting={handleAddPlayer}
        onCreateNew={onCreateProfile}
        title={`Add player to seat ${addingAtSeat + 1}`}
        helperText="They post the big blind to enter the next hand."
      />
    );
  }

  // ── Center prompt depending on mode ──

  const centerContent = (
    <div className="live-table-center-text">
      {isEnded ? (
        <>Session ended<br /><span className="live-table-center-sub">Read-only</span></>
      ) : mode === 'add-player' ? (
        'Tap an empty seat (not SB or BB)'
      ) : mode === 'remove-player' ? (
        'Tap a seated player to remove'
      ) : occupiedNow.length < 2 ? (
        'Need at least 2 seated players'
      ) : (
        <>
          Hand {nextHandIndex + 1}<br />
          <span className="live-table-center-sub">Tap the winner</span>
        </>
      )}
    </div>
  );

  return (
    <div className="live-active">
      <div className="live-active-header">
        <button className="back-btn" onClick={onExit}>← Live Sessions</button>
        <div className="live-active-title-block">
          <h1 className="live-active-title">{session.name ?? 'Live session'}</h1>
          {isEnded && <span className="live-active-ended-tag">Ended</span>}
        </div>
      </div>

      <PokerTable
        tableSize={session.tableSize}
        playerNames={playerNames}
        buttonSeat={currentButton}
        positions={positions}
        centerContent={centerContent}
        isSeatDisabled={(seatId) => {
          if (isEnded) return true;
          if (mode === 'add-player') {
            // Disable already-occupied seats and seats that violate SB/BB rule.
            if (occupiedNow.includes(seatId)) return true;
            return !canSeatNewPlayerAt(seatId, currentButton, occupiedNow, session.tableSize);
          }
          if (mode === 'remove-player') {
            return !occupiedNow.includes(seatId);
          }
          // Default winner-tap mode: disable empty seats.
          return !occupiedNow.includes(seatId);
        }}
        onSeatTap={handleSeatTap}
      />

      {!isEnded && (
        <div className="live-active-actions">
          <button
            type="button"
            className={`btn-secondary ${mode === 'add-player' ? 'active' : ''}`}
            onClick={() => setMode(m => m === 'add-player' ? 'idle' : 'add-player')}
            disabled={occupiedNow.length >= session.tableSize}
          >
            {mode === 'add-player' ? 'Cancel add' : '+ Add player'}
          </button>
          <button
            type="button"
            className={`btn-secondary ${mode === 'remove-player' ? 'active' : ''}`}
            onClick={() => setMode(m => m === 'remove-player' ? 'idle' : 'remove-player')}
            disabled={occupiedNow.length === 0}
          >
            {mode === 'remove-player' ? 'Cancel remove' : '− Remove player'}
          </button>
          <button
            type="button"
            className="btn-secondary live-active-end-btn"
            onClick={() => setMode('end-confirm')}
          >
            End session
          </button>
        </div>
      )}

      {mode === 'end-confirm' && (
        <div className="live-confirm">
          <p className="live-confirm-text">
            End this session? Stats will be locked and hands can't be added afterwards.
          </p>
          <div className="live-confirm-actions">
            <button className="btn-secondary" onClick={() => setMode('idle')}>Cancel</button>
            <button className="btn-primary" onClick={handleEndSession}>End session</button>
          </div>
        </div>
      )}

      <LiveSessionStats session={session} profiles={profiles} liveTicker={!isEnded} />
    </div>
  );
}
