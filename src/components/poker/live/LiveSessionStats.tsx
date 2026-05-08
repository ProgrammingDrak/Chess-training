import { useEffect, useState } from 'react';
import type { Card } from '../../../types/poker';
import type { ExposedCards, LiveSession } from '../../../types/liveSession';
import type { PlayerProfile } from '../../../types/profiles';
import { computeStats } from '../../../utils/livePoker';
import { cardLabel, handLabel } from '../../../utils/poker';
import { PlayingCard } from '../HandDisplay';

interface LiveSessionStatsProps {
  session: LiveSession;
  profiles: PlayerProfile[];
  liveTicker?: boolean;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}

function exposedCardsLabel(cards: ExposedCards): string {
  return cards.length === 1 ? cardLabel(cards[0]) : handLabel(cards[0], cards[1]);
}

export function LiveSessionStats({ session, profiles, liveTicker }: LiveSessionStatsProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!liveTicker || session.endedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [liveTicker, session.endedAt]);

  const stats = computeStats(session, now);
  const currency = session.bankroll?.currency ?? session.stakes?.currency ?? '$';
  const profileName = (id: string) => profiles.find(p => p.id === id)?.name ?? `Player ${id.slice(0, 6)}`;
  const handSeatName = (hand: LiveSession['hands'][number], seatId: number) => {
    const profileId = hand.seatedPlayerProfileIds?.[String(seatId)]
      ?? session.seats.find(s => s.seatId === seatId)?.player?.playerProfileId;
    return profileId ? profileName(profileId) : `Seat ${seatId + 1}`;
  };
  const boardCards = (hand: LiveSession['hands'][number]): Card[] => {
    const board = hand.board;
    if (!board) return [];
    return [
      ...(board.flop ?? []),
      board.turn ?? null,
      board.river ?? null,
    ].filter((card): card is NonNullable<typeof card> => card !== null);
  };
  const handOutcomeName = (hand: LiveSession['hands'][number]) => {
    if (hand.skipped) return 'Skipped hand';
    if (hand.chopped) return 'Chop pot';
    return hand.winnerPlayerProfileId ? profileName(hand.winnerPlayerProfileId) : 'Outcome not recorded';
  };
  const handOutcomePosition = (hand: LiveSession['hands'][number]) => {
    if (hand.skipped) return 'Button moved';
    if (hand.chopped) return hand.chopPositions?.join(' / ') ?? 'Chop';
    return hand.winnerPosition ?? '—';
  };
  const handOutcomeCards = (hand: LiveSession['hands'][number]) => {
    if (hand.skipped) return hand.skippedReason ?? 'Blank hand';
    if (hand.chopped) return `${hand.chopSeats?.length ?? 0} players split`;
    if (hand.winningCards === null) return 'No show';
    if (hand.winningCards) return exposedCardsLabel(hand.winningCards);
    return 'Not recorded';
  };

  return (
    <div className="live-stats">
      <div className="live-stats-headline">
        <div className="live-stats-stat"><div className="live-stats-stat-value">{stats.totalHands}</div><div className="live-stats-stat-label">Hands</div></div>
        <div className="live-stats-stat"><div className="live-stats-stat-value">{stats.handsPerHour.toFixed(1)}</div><div className="live-stats-stat-label">Hands / hr</div></div>
        <div className="live-stats-stat"><div className="live-stats-stat-value">{formatElapsed(stats.elapsedMs)}</div><div className="live-stats-stat-label">Elapsed</div></div>
      </div>

      {session.bankroll && (
        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Bankroll</h3>
          <p className="live-stats-empty">
            Buy-ins: {session.bankroll.buyIns.map(value => `${currency}${formatNumber(value)}`).join(' + ') || '—'} · Cash out: {currency}{formatNumber(session.bankroll.cashOut)} · Net: {currency}{formatNumber(session.bankroll.net)}
          </p>
        </section>
      )}

      <div className="live-stats-grid">
        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Win % per player</h3>
          {stats.byPlayer.length === 0 ? <p className="live-stats-empty">No scored hands played yet.</p> : (
            <table className="live-stats-table">
              <thead><tr><th>Player</th><th>Won</th><th>Played</th><th>Win %</th></tr></thead>
              <tbody>{stats.byPlayer.slice().sort((a, b) => b.winPct - a.winPct).map(p => <tr key={p.playerProfileId}><td>{profileName(p.playerProfileId)}</td><td>{formatNumber(p.handsWon)}</td><td>{p.handsDealtIn}</td><td>{p.winPct.toFixed(1)}%</td></tr>)}</tbody>
            </table>
          )}
        </section>

        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Win % by position</h3>
          {stats.byPosition.length === 0 ? <p className="live-stats-empty">No scored hands played yet.</p> : (
            <table className="live-stats-table">
              <thead><tr><th>Position</th><th>Won</th><th>Played</th><th>Win %</th></tr></thead>
              <tbody>{stats.byPosition.slice().sort((a, b) => b.winPct - a.winPct).map(p => <tr key={p.position}><td>{p.position}</td><td>{formatNumber(p.handsWonAtPosition)}</td><td>{p.handsAtPosition}</td><td>{p.winPct.toFixed(1)}%</td></tr>)}</tbody>
            </table>
          )}
        </section>
      </div>

      {session.hands.length > 0 && (
        <section className="live-stats-section live-hand-history">
          <h3 className="live-stats-section-title">Recent hands</h3>
          <div className="live-hand-history-list">
            {session.hands.slice(-8).reverse().map(hand => (
              <div key={hand.index} className="live-hand-history-item">
                <div className="live-hand-history-row">
                  <div className="live-hand-history-main">
                    <span className="live-hand-history-index">#{hand.index + 1}</span>
                    <div className="live-hand-history-winner">
                      <span className="live-hand-history-winner-name">{handOutcomeName(hand)}</span>
                      <span className="live-hand-history-position">{handOutcomePosition(hand)}</span>
                      <span className="live-hand-history-winner-cards">{handOutcomeCards(hand)}</span>
                    </div>
                  </div>
                  <div className="live-hand-history-right">
                    {boardCards(hand).length > 0 && <div className="live-hand-history-board">{boardCards(hand).map((card, index) => <PlayingCard key={`${card.rank}${card.suit}-${index}`} card={card} size="sm" />)}</div>}
                    {hand.betSizing && (
                      <details className="live-hand-history-showdown">
                        <summary>Bet: {formatNumber(hand.betSizing.amountBB)}BB</summary>
                        <div className="live-hand-history-showdown-list">
                          <div className="live-hand-history-showdown-row"><span>Amount</span><strong>{currency}{formatNumber(hand.betSizing.amount)}</strong></div>
                          {hand.betSizing.potFraction !== undefined && <div className="live-hand-history-showdown-row"><span>Pot size</span><strong>{formatNumber(hand.betSizing.potFraction)}x pot</strong></div>}
                          <div className="live-hand-history-showdown-row"><span>Blinds used</span><strong>{currency}{formatNumber(hand.betSizing.smallBlindAtHand ?? 0)}/{currency}{formatNumber(hand.betSizing.bigBlindAtHand)}</strong></div>
                        </div>
                      </details>
                    )}
                    {hand.chopped && hand.chopSeats && hand.chopSeats.length > 0 && (
                      <details className="live-hand-history-showdown">
                        <summary>Chopped by {hand.chopSeats.length} players</summary>
                        <div className="live-hand-history-showdown-list">{hand.chopSeats.map((seatId, index) => <div key={seatId} className="live-hand-history-showdown-row"><span>{handSeatName(hand, seatId)}</span><strong>{hand.chopPositions?.[index] ?? ''}</strong></div>)}</div>
                      </details>
                    )}
                    {hand.heroDecision && (
                      <details className="live-hand-history-showdown live-hand-history-decision">
                        <summary>Advice: {hand.heroDecision.handNotation} → {hand.heroDecision.recommendedActionLabel}</summary>
                        <div className="live-hand-history-showdown-list">
                          <div className="live-hand-history-showdown-row"><span>{handSeatName(hand, hand.heroDecision.seatId)} · {hand.heroDecision.position}</span><strong>{handLabel(hand.heroDecision.cards[0], hand.heroDecision.cards[1])}</strong></div>
                          <div className="live-hand-history-showdown-row"><span>{hand.heroDecision.source === 'profile' ? hand.heroDecision.profileName ?? 'Profile' : 'GTO fallback'}</span><strong>{hand.heroDecision.recommendedActionLabel}</strong></div>
                          <div className="live-hand-history-showdown-row"><span>GTO compare</span><strong>{hand.heroDecision.gtoActionLabel}</strong></div>
                          {hand.heroDecision.playedAction && <div className="live-hand-history-showdown-row"><span>Played</span><strong>{hand.heroDecision.playedAction}</strong></div>}
                        </div>
                      </details>
                    )}
                    {hand.showdown && hand.showdown.length > 0 && (
                      <details className="live-hand-history-showdown">
                        <summary>{hand.showdown.length} shown hand{hand.showdown.length === 1 ? '' : 's'}</summary>
                        <div className="live-hand-history-showdown-list">{hand.showdown.map(shown => <div key={shown.seatId} className="live-hand-history-showdown-row"><span>{handSeatName(hand, shown.seatId)}</span><strong>{exposedCardsLabel(shown.cards)}</strong></div>)}</div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
