import { useEffect, useMemo } from 'react';
import type {
  LiveHandDecisionSnapshot,
  LivePosition,
  LiveSession,
  SeatId,
} from '../../../types/liveSession';
import type { Card } from '../../../types/poker';
import type { PlayerProfile } from '../../../types/profiles';
import { DEFAULT_ACTION_CONTEXT } from '../../../types/profiles';
import { cardsToHandNotation, getLiveHandRecommendation } from '../../../utils/pokerHandRecommendation';
import { actionBucketFor } from '../../../utils/profileActionBuckets';
import { handLabel } from '../../../utils/poker';
import { ProfileRangeChart } from '../profiles/ProfileRangeChart';
import './LiveHandAdvisor.css';

interface LiveHandAdvisorProps {
  session: LiveSession;
  profiles: PlayerProfile[];
  occupiedNow: SeatId[];
  positions: Map<SeatId, LivePosition>;
  cards: Card[];
  disabled?: boolean;
  showChart?: boolean;
  showDetail?: boolean;
  onRequestCards: () => void;
  onRequestAdvice?: () => void;
  onSnapshotChange: (snapshot: LiveHandDecisionSnapshot | null) => void;
}

export function LiveHandAdvisor({
  session,
  profiles,
  occupiedNow,
  positions,
  cards,
  disabled = false,
  showChart = false,
  showDetail = false,
  onRequestCards,
  onRequestAdvice,
  onSnapshotChange,
}: LiveHandAdvisorProps) {
  const preferredSeatId = useMemo<SeatId | null>(() => {
    const heroSeat = occupiedNow.find(seatId => {
      const profileId = session.seats[seatId]?.player?.playerProfileId;
      return profiles.find(profile => profile.id === profileId)?.type === 'self';
    });
    return heroSeat ?? occupiedNow[0] ?? null;
  }, [occupiedNow, profiles, session.seats]);

  const activeSeatId = preferredSeatId;
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
  const activeProfileSituation = useMemo(() => (
    activeProfile && activePosition
      ? activeProfile.positions.find(position => position.position === activePosition)
        ?.situations[DEFAULT_ACTION_CONTEXT] ?? null
      : null
  ), [activePosition, activeProfile]);

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
      ...(actionBucket ? { recommendedBucketKind: actionBucket.kind } : {}),
      ...(actionBucket?.maxBB !== undefined ? { recommendedBucketMaxBB: actionBucket.maxBB } : {}),
    };
  }, [
    activePosition,
    activeProfileId,
    activeSeatId,
    actionBucket,
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
          <p>{selectedCards ? handLabel(selectedCards[0], selectedCards[1]) : `${activePosition} · ${session.tableSize}-max`}</p>
          <button
            type="button"
            className="btn-secondary live-hand-advisor-card-button"
            disabled={disabled}
            onClick={onRequestCards}
          >
            {selectedCards ? 'Edit Hero cards' : 'Pick Hero cards'}
          </button>
        </div>
        {recommendation && actionBucket ? (
          <button
            type="button"
            className="live-hand-advisor-result live-hand-advisor-result-button"
            style={{ borderColor: actionBucket.border }}
            onClick={onRequestAdvice}
            disabled={!onRequestAdvice}
          >
            <span className="live-hand-advisor-hand">{recommendation.handNotation}</span>
            <strong style={{ color: actionBucket.text }}>{actionBucket.emoji} {recommendation.actionLabel}</strong>
            <small>{recommendation.source === 'profile' ? recommendation.profileName : 'GTO fallback'}</small>
          </button>
        ) : (
          <div className="live-hand-advisor-result">
            <span className="live-hand-advisor-hand">Hero</span>
            <strong>Pick cards</strong>
            <small>{activePosition} · {session.tableSize}-max</small>
          </div>
        )}
      </div>

      {showChart && activeProfile && activeProfileSituation && (
        <ProfileRangeChart
          situation={activeProfileSituation}
          profileName={activeProfile.name}
          position={activePosition}
          tableSize={session.tableSize}
          highlightedHand={handNotation}
        />
      )}

      {showDetail && recommendation && (
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
