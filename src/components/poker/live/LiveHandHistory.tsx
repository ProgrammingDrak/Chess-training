import type { Card } from '../../../types/poker';
import type { ExposedCards, LiveHand, LiveSession, SeatId } from '../../../types/liveSession';
import type { PlayerProfile } from '../../../types/profiles';
import { cardLabel, handLabel } from '../../../utils/poker';
import { PlayingCard } from '../HandDisplay';

interface LiveHandHistoryProps {
  session: LiveSession;
  profiles: PlayerProfile[];
  onEditWinningCards?: (handIndex: number) => void;
  onEditShownHands?: (handIndex: number) => void;
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function formatExposedCards(cards: ExposedCards): string {
  const [first, second] = cards;
  return second ? handLabel(first, second) : cardLabel(first);
}

function boardCards(hand: LiveHand): Card[] {
  const board = hand.board;
  if (!board) return [];
  return [
    ...(board.flop ?? []),
    board.turn ?? null,
    board.river ?? null,
  ].filter((card): card is Card => card !== null);
}

export function LiveHandHistory({
  session,
  profiles,
  onEditWinningCards,
  onEditShownHands,
}: LiveHandHistoryProps) {
  const hands = session.hands.slice().reverse();
  const recentHands = hands.slice(0, 1);
  const olderHands = hands.slice(1);

  if (hands.length === 0) return null;

  const profileName = (id: string) =>
    profiles.find(p => p.id === id)?.name ?? `Player ${id.slice(0, 6)}`;
  const handSeatName = (hand: LiveHand, seatId: SeatId) => {
    const profileId = hand.seatedPlayerProfileIds?.[String(seatId)]
      ?? session.seats.find(s => s.seatId === seatId)?.player?.playerProfileId;
    return profileId ? profileName(profileId) : `Seat ${seatId + 1}`;
  };
  const handOutcomeName = (hand: LiveHand) => {
    if (hand.skipped) return 'Skipped hand';
    if (hand.chopped) return 'Chop pot';
    return hand.winnerPlayerProfileId ? profileName(hand.winnerPlayerProfileId) : 'Outcome not recorded';
  };
  const handOutcomePosition = (hand: LiveHand) => {
    if (hand.skipped) return 'Button moved';
    if (hand.chopped) return hand.chopPositions?.join(' / ') ?? 'Chop';
    return hand.winnerPosition ?? '-';
  };
  const handOutcomeCards = (hand: LiveHand) => {
    if (hand.skipped) return hand.skippedReason ?? 'Blank hand';
    if (hand.chopped) return `${hand.chopSeats?.length ?? 0} players split`;
    if (hand.winningCards === null) return 'No show';
    if (hand.winningCards) return formatExposedCards(hand.winningCards);
    return 'Not recorded';
  };

  const renderHand = (hand: LiveHand) => {
    const visibleBoardCards = boardCards(hand);

    return (
      <div key={hand.index} className="live-hand-history-item">
        <div className="live-hand-history-row">
          <div className="live-hand-history-main">
            <span className="live-hand-history-index">#{hand.index + 1}</span>
            <div className="live-hand-history-winner">
              <span className="live-hand-history-winner-name">
                {handOutcomeName(hand)}
              </span>
              <span className="live-hand-history-position">{handOutcomePosition(hand)}</span>
              <span className="live-hand-history-winner-cards">
                {handOutcomeCards(hand)}
              </span>
            </div>
          </div>
          <div className="live-hand-history-right">
            {hand.heroDecision && (
              <details className="live-hand-history-showdown live-hand-history-decision">
                <summary>
                  Advice: {hand.heroDecision.handNotation} - {hand.heroDecision.recommendedActionLabel}
                </summary>
                <div className="live-hand-history-showdown-list">
                  <div className="live-hand-history-showdown-row">
                    <span>{handSeatName(hand, hand.heroDecision.seatId)} - {hand.heroDecision.position}</span>
                    <strong>{handLabel(hand.heroDecision.cards[0], hand.heroDecision.cards[1])}</strong>
                  </div>
                  <div className="live-hand-history-showdown-row">
                    <span>{hand.heroDecision.source === 'profile' ? hand.heroDecision.profileName ?? 'Profile' : 'GTO fallback'}</span>
                    <strong>{hand.heroDecision.recommendedActionLabel}</strong>
                  </div>
                  <div className="live-hand-history-showdown-row">
                    <span>GTO compare</span>
                    <strong>{hand.heroDecision.gtoActionLabel}</strong>
                  </div>
                  {(hand.heroDecision.playedActionType || hand.heroDecision.playedAction) && (
                    <div className="live-hand-history-showdown-row">
                      <span>Played</span>
                      <strong>
                        {hand.heroDecision.playedActionType ?? hand.heroDecision.playedAction}
                        {hand.heroDecision.playedActionAmountBB !== undefined ? ` - ${formatNumber(hand.heroDecision.playedActionAmountBB)}BB` : ''}
                      </strong>
                    </div>
                  )}
                  {hand.heroDecision.followedAdvice !== undefined && (
                    <div className="live-hand-history-showdown-row">
                      <span>Advice match</span>
                      <strong>{hand.heroDecision.followedAdvice ? 'Followed' : 'Different'}</strong>
                    </div>
                  )}
                </div>
              </details>
            )}
            {visibleBoardCards.length > 0 && (
              <div className="live-hand-history-board">
                {visibleBoardCards.map((card, index) => (
                  <PlayingCard key={`${card.rank}${card.suit}-${index}`} card={card} size="sm" />
                ))}
              </div>
            )}
            {hand.chopped && hand.chopSeats && hand.chopSeats.length > 0 && (
              <details className="live-hand-history-showdown">
                <summary>Chopped by {hand.chopSeats.length} players</summary>
                <div className="live-hand-history-showdown-list">
                  {hand.chopSeats.map((seatId, index) => (
                    <div key={seatId} className="live-hand-history-showdown-row">
                      <span>{handSeatName(hand, seatId)}</span>
                      <strong>{hand.chopPositions?.[index] ?? ''}</strong>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {hand.showdown && hand.showdown.length > 0 && (
              <details className="live-hand-history-showdown">
                <summary>
                  {hand.showdown.length} shown hand{hand.showdown.length === 1 ? '' : 's'}
                </summary>
                <div className="live-hand-history-showdown-list">
                  {hand.showdown.map(shown => (
                    <div key={shown.seatId} className="live-hand-history-showdown-row">
                      <span>{handSeatName(hand, shown.seatId)}</span>
                      <strong>{formatExposedCards(shown.cards)}</strong>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {(onEditWinningCards || onEditShownHands) && hand.winnerSeat !== undefined && !hand.chopped && !hand.skipped && (
              <div className="live-card-modal-actions">
                {onEditWinningCards && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onEditWinningCards(hand.index)}
                  >
                    {hand.winningCards ? 'Edit winner' : 'Add winner'}
                  </button>
                )}
                {onEditShownHands && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onEditShownHands(hand.index)}
                  >
                    {hand.showdown?.length ? 'Edit shown' : 'Add shown'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="live-stats-section live-hand-history">
      <h3 className="live-stats-section-title">Hand history</h3>
      <div className="live-hand-history-list">
        {recentHands.map(renderHand)}
      </div>
      {olderHands.length > 0 && (
        <details className="live-hand-history-archive">
          <summary>
            Show {olderHands.length} older hand{olderHands.length === 1 ? '' : 's'}
          </summary>
          <div className="live-hand-history-list">
            {olderHands.map(renderHand)}
          </div>
        </details>
      )}
    </section>
  );
}
