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

function formatWinCredit(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function formatMoney(currency: string, value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}${currency}${Math.abs(value).toFixed(2)}`;
}

function formatExposedCards(cards: ExposedCards): string {
  const [first, second] = cards;
  return second ? handLabel(first, second) : cardLabel(first);
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
    if (hand.winningCards) return formatExposedCards(hand.winningCards);
    return 'Not recorded';
  };

  return (
    <div className="live-stats">
      <div className="live-stats-headline">
        <div className="live-stats-stat">
          <div className="live-stats-stat-value">{stats.totalHands}</div>
          <div className="live-stats-stat-label">Hands</div>
        </div>
        {stats.choppedPots > 0 && (
          <div className="live-stats-stat">
            <div className="live-stats-stat-value">{stats.choppedPots}</div>
            <div className="live-stats-stat-label">Chopped pots</div>
          </div>
        )}
        <div className="live-stats-stat">
          <div className="live-stats-stat-value">{stats.handsPerHour.toFixed(1)}</div>
          <div className="live-stats-stat-label">Hands / hr</div>
        </div>
        <div className="live-stats-stat">
          <div className="live-stats-stat-value">{formatElapsed(stats.elapsedMs)}</div>
          <div className="live-stats-stat-label">Elapsed</div>
        </div>
        {stats.profit && (
          <div className="live-stats-stat">
            <div className="live-stats-stat-value">{formatMoney(stats.profit.currency, stats.profit.dollarsPerHour)}</div>
            <div className="live-stats-stat-label">$/hr</div>
          </div>
        )}
        {stats.showdownVisibility.knownWonHands > 0 && (
          <div className="live-stats-stat">
            <div className="live-stats-stat-value">{stats.showdownVisibility.noShowPct.toFixed(0)}%</div>
            <div className="live-stats-stat-label">No-show wins</div>
          </div>
        )}
        {stats.advisor.recordedActions > 0 && (
          <div className="live-stats-stat">
            <div className="live-stats-stat-value">{stats.advisor.followPct.toFixed(0)}%</div>
            <div className="live-stats-stat-label">Followed advice</div>
          </div>
        )}
      </div>

      <div className="live-stats-grid">
        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Win % per player</h3>
          {stats.byPlayer.length === 0 ? (
            <p className="live-stats-empty">No scored hands played yet.</p>
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
                      <td>{formatWinCredit(p.handsWon)}</td>
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
            <p className="live-stats-empty">No scored hands played yet.</p>
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
                      <td>{formatWinCredit(p.handsWonAtPosition)}</td>
                      <td>{p.handsAtPosition}</td>
                      <td>{p.winPct.toFixed(1)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Position outcomes per player</h3>
          {stats.byPlayerPosition.length === 0 ? (
            <p className="live-stats-empty">No player-position hands yet.</p>
          ) : (
            <table className="live-stats-table">
              <thead>
                <tr><th>Player</th><th>Pos</th><th>Won</th><th>Played</th><th>Win %</th></tr>
              </thead>
              <tbody>
                {stats.byPlayerPosition
                  .slice()
                  .sort((a, b) => profileName(a.playerProfileId).localeCompare(profileName(b.playerProfileId)) || b.winPct - a.winPct)
                  .map(row => (
                    <tr key={`${row.playerProfileId}-${row.position}`}>
                      <td>{profileName(row.playerProfileId)}</td>
                      <td>{row.position}</td>
                      <td>{formatWinCredit(row.handsWonAtPosition)}</td>
                      <td>{row.handsAtPosition}</td>
                      <td>{row.winPct.toFixed(1)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Show vs no-show wins</h3>
          {stats.showdownVisibility.knownWonHands === 0 ? (
            <p className="live-stats-empty">No known show/no-show outcomes yet.</p>
          ) : (
            <table className="live-stats-table">
              <thead>
                <tr><th>Outcome</th><th>Hands</th><th>Share</th></tr>
              </thead>
              <tbody>
                <tr><td>Winner showed</td><td>{stats.showdownVisibility.shownWins}</td><td>{stats.showdownVisibility.shownPct.toFixed(1)}%</td></tr>
                <tr><td>Winner did not show</td><td>{stats.showdownVisibility.noShowWins}</td><td>{stats.showdownVisibility.noShowPct.toFixed(1)}%</td></tr>
              </tbody>
            </table>
          )}
        </section>

        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Showdown profile</h3>
          {stats.showdownProfiles.byPlayer.length === 0 ? (
            <p className="live-stats-empty">No showdown profile data yet.</p>
          ) : (
            <table className="live-stats-table">
              <thead>
                <tr><th>Player</th><th>Shown W</th><th>No-show W</th><th>Shown L</th></tr>
              </thead>
              <tbody>
                {stats.showdownProfiles.byPlayer.map(row => (
                  <tr key={row.playerProfileId}>
                    <td>{profileName(row.playerProfileId)}</td>
                    <td>{row.shownWins}</td>
                    <td>{row.noShowWins}</td>
                    <td>{row.shownLosingHands}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Winning hand classes</h3>
          {stats.showdownProfiles.winningHandClasses.length === 0 ? (
            <p className="live-stats-empty">No winning cards shown yet.</p>
          ) : (
            <table className="live-stats-table">
              <thead>
                <tr><th>Class</th><th>Wins</th><th>Share</th></tr>
              </thead>
              <tbody>
                {stats.showdownProfiles.winningHandClasses.map(row => (
                  <tr key={row.label}><td>{row.label}</td><td>{row.count}</td><td>{row.pct.toFixed(1)}%</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Board textures</h3>
          {stats.showdownProfiles.boardTextures.length === 0 ? (
            <p className="live-stats-empty">No boards recorded yet.</p>
          ) : (
            <table className="live-stats-table">
              <thead>
                <tr><th>Texture</th><th>Hands</th><th>Share</th></tr>
              </thead>
              <tbody>
                {stats.showdownProfiles.boardTextures.map(row => (
                  <tr key={row.label}><td>{row.label}</td><td>{row.count}</td><td>{row.pct.toFixed(1)}%</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Bet sizing</h3>
          {stats.betSizing.sampleSize === 0 ? (
            <p className="live-stats-empty">No bet sizing logged yet.</p>
          ) : (
            <table className="live-stats-table">
              <thead>
                <tr><th>Metric</th><th>Value</th></tr>
              </thead>
              <tbody>
                <tr><td>Avg bet</td><td>{formatNumber(stats.betSizing.avgBetBB)} BB</td></tr>
                <tr><td>Avg pot before bet</td><td>{formatNumber(stats.betSizing.avgPotBB)} BB</td></tr>
                <tr><td>Avg final pot</td><td>{formatNumber(stats.betSizing.avgFinalPotBB)} BB</td></tr>
                <tr><td>Avg pot fraction</td><td>{formatNumber(stats.betSizing.avgPotFraction, 2)}x</td></tr>
              </tbody>
            </table>
          )}
        </section>

        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Bet sizing by player</h3>
          {stats.betSizing.byPlayer.length === 0 ? (
            <p className="live-stats-empty">No player bet samples yet.</p>
          ) : (
            <table className="live-stats-table">
              <thead>
                <tr><th>Player</th><th>Samples</th><th>Avg bet</th><th>Avg % pot</th></tr>
              </thead>
              <tbody>
                {stats.betSizing.byPlayer.map(row => (
                  <tr key={row.key}><td>{profileName(row.key)}</td><td>{row.count}</td><td>{formatNumber(row.avgBetBB)} BB</td><td>{formatNumber(row.avgPotFraction, 2)}x</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Bet sizing by position</h3>
          {stats.betSizing.byPosition.length === 0 ? (
            <p className="live-stats-empty">No position bet samples yet.</p>
          ) : (
            <table className="live-stats-table">
              <thead>
                <tr><th>Pos</th><th>Samples</th><th>Avg bet</th><th>Avg % pot</th></tr>
              </thead>
              <tbody>
                {stats.betSizing.byPosition.map(row => (
                  <tr key={row.key}><td>{row.key}</td><td>{row.count}</td><td>{formatNumber(row.avgBetBB)} BB</td><td>{formatNumber(row.avgPotFraction, 2)}x</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Advisor stats</h3>
          {stats.advisor.totalAdvice === 0 ? (
            <p className="live-stats-empty">No advisor hands saved yet.</p>
          ) : (
            <table className="live-stats-table">
              <thead>
                <tr><th>Metric</th><th>Value</th></tr>
              </thead>
              <tbody>
                <tr><td>Advice saved</td><td>{stats.advisor.totalAdvice}</td></tr>
                <tr><td>Actions recorded</td><td>{stats.advisor.recordedActions}</td></tr>
                <tr><td>Followed</td><td>{stats.advisor.followed}</td></tr>
                <tr><td>Different</td><td>{stats.advisor.different}</td></tr>
                <tr><td>Follow rate</td><td>{stats.advisor.followPct.toFixed(1)}%</td></tr>
              </tbody>
            </table>
          )}
        </section>

        <section className="live-stats-section">
          <h3 className="live-stats-section-title">Preflop action stats</h3>
          {stats.actionStats.byPlayer.length === 0 ? (
            <p className="live-stats-empty">No action log data yet.</p>
          ) : (
            <table className="live-stats-table">
              <thead>
                <tr><th>Player</th><th>VPIP</th><th>PFR</th><th>3B</th><th>4B</th><th>Str</th><th>AF</th></tr>
              </thead>
              <tbody>
                {stats.actionStats.byPlayer.map(row => (
                  <tr key={row.playerProfileId}>
                    <td>{profileName(row.playerProfileId)}</td>
                    <td>{row.vpipPct.toFixed(0)}%</td>
                    <td>{row.pfrPct.toFixed(0)}%</td>
                    <td>{row.threeBetPct.toFixed(0)}%</td>
                    <td>{row.fourBetPct.toFixed(0)}%</td>
                    <td>{row.straddlePct.toFixed(0)}%</td>
                    <td>{row.aggressionFactor === null ? '—' : row.aggressionFactor.toFixed(1)}</td>
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
                        {handOutcomeName(hand)}
                      </span>
                      <span className="live-hand-history-position">{handOutcomePosition(hand)}</span>
                      <span className="live-hand-history-winner-cards">
                        {handOutcomeCards(hand)}
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
                    {hand.heroDecision && (
                      <details className="live-hand-history-showdown live-hand-history-decision">
                        <summary>
                          Advice: {hand.heroDecision.handNotation} → {hand.heroDecision.recommendedActionLabel}
                        </summary>
                        <div className="live-hand-history-showdown-list">
                          <div className="live-hand-history-showdown-row">
                            <span>{handSeatName(hand, hand.heroDecision.seatId)} · {hand.heroDecision.position}</span>
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
                                {hand.heroDecision.playedActionAmountBB !== undefined ? ` · ${formatNumber(hand.heroDecision.playedActionAmountBB)}BB` : ''}
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
