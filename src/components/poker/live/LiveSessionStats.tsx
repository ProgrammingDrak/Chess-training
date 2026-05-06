import { useEffect, useState } from 'react';
import type { Card } from '../../../types/poker';
import type { LiveSession } from '../../../types/liveSession';
import type { PlayerProfile } from '../../../types/profiles';
import { computeStats } from '../../../utils/livePoker';
import { handLabel } from '../../../utils/poker';
import { PlayingCard } from '../HandDisplay';

interface LiveSessionStatsProps {
  session: LiveSession;
  profiles: PlayerProfile[];
  /** When true, ticks the elapsed-time clock once per second. */
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

export function LiveSessionStats({ session, profiles, liveTicker }: LiveSessionStatsProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!liveTicker || session.endedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [liveTicker, session.endedAt]);

  const stats = computeStats(session, now);
  const profileName = (id: string) =>
    profiles.find(p => p.id === id)?.name ?? `Player ${id.slice(0, 6)}`;
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

  return (
    <div className="live-stats">
      <div className="live-stats-headline">
        <div className="live-stats-stat">
          <div className="live-stats-stat-value">{stats.totalHands}</div>
          <div className="live-stats-stat-label">Hands</div>
        </div>
        <div className="live-stats-stat">
          <div className="live-stats-stat-value">{stats.handsPerHour.toFixed(1)}</div>
          <div className="live-stats-stat-label">Hands / hr</div>
        </div>
        <div className="live-stats-stat">
          <div className="live-stats-stat-value">{formatElapsed(stats.elapsedMs)}</div>
          <div className="live-stats-stat-label">Elapsed</div>
        </div>
      </div>

      <div className="live-stats-grid">
        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Win % per player</h3>
          {stats.byPlayer.length === 0 ? (
            <p className="live-stats-empty">No hands played yet.</p>
          ) : (
            <table className="live-stats-table">
              <thead>
                <tr><th>Player</th><th>Won</th><th>Played</th><th>Win %</th></tr>
              </thead>
              <tbody>
                {stats.byPlayer
                  .slice()
                  .sort((a, b) => b.winPct - a.winPct)
                  .map(p => (
                    <tr key={p.playerProfileId}>
                      <td>{profileName(p.playerProfileId)}</td>
                      <td>{p.handsWon}</td>
                      <td>{p.handsDealtIn}</td>
                      <td>{p.winPct.toFixed(1)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Win % by position</h3>
          {stats.byPosition.length === 0 ? (
            <p className="live-stats-empty">No hands played yet.</p>
          ) : (
            <table className="live-stats-table">
              <thead>
                <tr><th>Position</th><th>Won</th><th>Played</th><th>Win %</th></tr>
              </thead>
              <tbody>
                {stats.byPosition
                  .slice()
                  .sort((a, b) => b.winPct - a.winPct)
                  .map(p => (
                    <tr key={p.position}>
                      <td>{p.position}</td>
                      <td>{p.handsWonAtPosition}</td>
                      <td>{p.handsAtPosition}</td>
                      <td>{p.winPct.toFixed(1)}%</td>
                    </tr>
                  ))}
              </tbody>
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
                      <span className="live-hand-history-winner-name">
                        {profileName(hand.winnerPlayerProfileId)}
                      </span>
                      <span className="live-hand-history-position">{hand.winnerPosition}</span>
                      <span className="live-hand-history-winner-cards">
                        {hand.winningCards === null
                          ? 'No show'
                          : hand.winningCards
                            ? handLabel(hand.winningCards[0], hand.winningCards[1])
                            : 'Not recorded'}
                      </span>
                    </div>
                  </div>
                  <div className="live-hand-history-right">
                    {boardCards(hand).length > 0 && (
                      <div className="live-hand-history-board">
                        {boardCards(hand).map((card, index) => (
                          <PlayingCard key={`${card.rank}${card.suit}-${index}`} card={card} size="sm" />
                        ))}
                      </div>
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
                              <strong>{handLabel(shown.cards[0], shown.cards[1])}</strong>
                            </div>
                          ))}
                        </div>
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
