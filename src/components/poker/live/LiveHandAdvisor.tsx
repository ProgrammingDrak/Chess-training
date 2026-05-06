import { useEffect, useMemo, useState } from 'react';
import type {
  LiveHandDecisionSnapshot,
  LivePosition,
  LiveSession,
  SeatId,
} from '../../../types/liveSession';
import type { Card } from '../../../types/poker';
import type { PlayerProfile, RangeAction } from '../../../types/profiles';
import { cardsToHandNotation, getLiveHandRecommendation } from '../../../utils/pokerHandRecommendation';
import { actionBucketFor } from '../../../utils/profileActionBuckets';
import { handLabel } from '../../../utils/poker';
import { CardPicker } from '../CardPicker';

interface LiveHandAdvisorProps {
  session: LiveSession;
  profiles: PlayerProfile[];
  occupiedNow: SeatId[];
  positions: Map<SeatId, LivePosition>;
  playerNames: Array<string | null>;
  handIndex: number;
  disabled?: boolean;
  onSnapshotChange: (snapshot: LiveHandDecisionSnapshot | null) => void;
}

export function LiveHandAdvisor({
  session,
  profiles,
  occupiedNow,
  positions,
  playerNames,
  handIndex,
  disabled = false,
  onSnapshotChange,
}: LiveHandAdvisorProps) {
  const [selectedSeatId, setSelectedSeatId] = useState<SeatId | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [playedAction, setPlayedAction] = useState<RangeAction | ''>('');

  useEffect(() => {
    setCards([]);
    setPlayedAction('');
  }, [handIndex]);

  const preferredSeatId = useMemo<SeatId | null>(() => {
    const selfSeat = occupiedNow.find(seatId => {
      const profileId = session.seats[seatId]?.player?.playerProfileId;
      return profiles.find(profile => profile.id === profileId)?.type === 'self';
    });
    return selfSeat ?? occupiedNow[0] ?? null;
  }, [occupiedNow, profiles, session.seats]);

  const activeSeatId = selectedSeatId !== null && occupiedNow.includes(selectedSeatId)
    ? selectedSeatId
    : preferredSeatId;
  const activeSeat = activeSeatId !== null ? session.seats[activeSeatId] : null;
  const activeProfileId = activeSeat?.player?.playerProfileId ?? null;
  const activeProfile = activeProfileId
    ? profiles.find(profile => profile.id === activeProfileId) ?? null
    : null;
  const activePosition = activeSeatId !== null ? positions.get(activeSeatId) ?? null : null;
  const selectedCards = useMemo(
    () => cards.length === 2 ? [cards[0], cards[1]] as [Card, Card] : null,
    [cards],
  );
  const handNotation = selectedCards ? cardsToHandNotation(selectedCards[0], selectedCards[1]) : null;

  const recommendation = useMemo(() => {
    if (!handNotation || !activePosition) return null;
    return getLiveHandRecommendation({
      handNotation,
      tableSize: session.tableSize,
      position: activePosition,
      profile: activeProfile,
    });
  }, [activePosition, activeProfile, handNotation, session.tableSize]);

  const actionBucket = recommendation
    ? actionBucketFor(recommendation.action, recommendation.buckets)
    : null;

  const snapshot = useMemo<LiveHandDecisionSnapshot | null>(() => {
    if (activeSeatId === null || !activeProfileId || !activePosition || !selectedCards || !recommendation) {
      return null;
    }

    return {
      seatId: activeSeatId,
      playerProfileId: activeProfileId,
      position: activePosition,
      cards: selectedCards,
      handNotation: recommendation.handNotation,
      source: recommendation.source,
      ...(recommendation.profileId ? { profileId: recommendation.profileId } : {}),
      ...(recommendation.profileName ? { profileName: recommendation.profileName } : {}),
      recommendedAction: recommendation.action,
      recommendedActionLabel: recommendation.actionLabel,
      gtoAction: recommendation.gtoAction,
      gtoActionLabel: recommendation.gtoActionLabel,
      ...(playedAction ? { playedAction } : {}),
    };
  }, [
    activePosition,
    activeProfileId,
    activeSeatId,
    playedAction,
    recommendation,
    selectedCards,
  ]);

  useEffect(() => {
    onSnapshotChange(snapshot);
  }, [onSnapshotChange, snapshot]);

  if (occupiedNow.length < 2 || activeSeatId === null || !activeProfileId || !activePosition) {
    return null;
  }

  return (
    <section className="live-hand-advisor" aria-label="Live hand advisor">
      <div className="live-hand-advisor-header">
        <div>
          <h2>Should I play this hand?</h2>
          <p>Pick your seat and hole cards. The recommendation will save with the hand when you tap the winner.</p>
        </div>
        {recommendation && actionBucket && (
          <div className="live-hand-advisor-result" style={{ borderColor: actionBucket.border }}>
            <span className="live-hand-advisor-hand">{recommendation.handNotation}</span>
            <strong style={{ color: actionBucket.text }}>{actionBucket.emoji} {recommendation.actionLabel}</strong>
            <small>{recommendation.source === 'profile' ? recommendation.profileName : 'GTO fallback'}</small>
          </div>
        )}
      </div>

      <div className="live-hand-advisor-grid">
        <label className="live-hand-advisor-field">
          <span>Player / seat</span>
          <select
            value={activeSeatId}
            disabled={disabled}
            onChange={event => {
              setSelectedSeatId(Number(event.target.value));
              setPlayedAction('');
            }}
          >
            {occupiedNow.map(seatId => {
              const position = positions.get(seatId);
              return (
                <option key={seatId} value={seatId}>
                  {playerNames[seatId] ?? `Seat ${seatId + 1}`} · {position ?? '—'}
                </option>
              );
            })}
          </select>
        </label>

        <label className="live-hand-advisor-field">
          <span>What did you do?</span>
          <select
            value={playedAction}
            disabled={disabled || !recommendation}
            onChange={event => setPlayedAction(event.target.value as RangeAction | '')}
          >
            <option value="">Not recorded</option>
            {(recommendation?.buckets ?? []).map(bucket => (
              <option key={bucket.id} value={bucket.id}>{bucket.label}</option>
            ))}
          </select>
        </label>
      </div>

      <CardPicker
        value={cards}
        onChange={setCards}
        maxCards={2}
        label={`${playerNames[activeSeatId] ?? `Seat ${activeSeatId + 1}`} hole cards`}
      />

      {recommendation && (
        <div className="live-hand-advisor-detail">
          <div>
            <span className="live-hand-advisor-label">Current hand</span>
            <strong>{selectedCards ? handLabel(selectedCards[0], selectedCards[1]) : 'Select two cards'}</strong>
          </div>
          <div>
            <span className="live-hand-advisor-label">Position</span>
            <strong>{activePosition} · {session.tableSize}-max</strong>
          </div>
          <div>
            <span className="live-hand-advisor-label">GTO compare</span>
            <strong>{recommendation.gtoActionLabel}</strong>
          </div>
          <p>{recommendation.gtoNote}</p>
        </div>
      )}
    </section>
  );
}
