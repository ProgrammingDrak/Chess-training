import type { AppProgress } from '../types';
import type { PokerProgress, PokerDrillType } from '../types/poker';
import type { BlackjackProgress, BlackjackDrillType } from '../types/blackjack';

const POKER_DRILL_TYPES: PokerDrillType[] = [
  'hand_selection', 'pot_odds', 'equity_estimation',
  'bet_sizing', 'opponent_simulation', 'ev_calculation', 'range_reading',
];

const BJ_DRILL_TYPES: BlackjackDrillType[] = [
  'basic_strategy', 'card_counting', 'true_count', 'bet_spread',
];

interface GameSelectorProps {
  chessProgress: AppProgress;
  pokerProgress: PokerProgress;
  bjProgress: BlackjackProgress;
  onSelectChess: () => void;
  onSelectPoker: () => void;
  onSelectBlackjack: () => void;
}

export function GameSelector({
  chessProgress,
  pokerProgress,
  bjProgress,
  onSelectChess,
  onSelectPoker,
  onSelectBlackjack,
}: GameSelectorProps) {
  // Chess stats
  const chessLines = Object.values(chessProgress.lines);
  const chessMastered = chessLines.filter((l) => l.mastered).length;
  const chessAttempted = chessLines.filter((l) => l.attempts > 0).length;
  const chessAccuracy = chessLines.reduce((sum, l) => {
    if (!l.attempts) return sum;
    return sum + l.correctOnFirst / l.attempts;
  }, 0) / Math.max(chessAttempted, 1);

  // Poker stats
  const pokerDrills = Object.values(pokerProgress.drills);
  const pokerTotal = pokerDrills.reduce((s, d) => s + (d?.totalAttempts ?? 0), 0);
  const pokerCorrect = pokerDrills.reduce((s, d) => s + (d?.correctAttempts ?? 0), 0);
  const pokerAccuracy = pokerTotal > 0 ? Math.round((pokerCorrect / pokerTotal) * 100) : 0;
  const drillsStarted = POKER_DRILL_TYPES.filter(
    (t) => (pokerProgress.drills[t]?.totalAttempts ?? 0) > 0,
  ).length;

  // Blackjack stats
  const bjDrills = Object.values(bjProgress.drills);
  const bjTotal = bjDrills.reduce((s, d) => s + (d?.totalAttempts ?? 0), 0);
  const bjCorrect = bjDrills.reduce((s, d) => s + (d?.correctAttempts ?? 0), 0);
  const bjAccuracy = bjTotal > 0 ? Math.round((bjCorrect / bjTotal) * 100) : 0;
  const bjDrillsStarted = BJ_DRILL_TYPES.filter(
    (t) => (bjProgress.drills[t]?.totalAttempts ?? 0) > 0,
  ).length;

  return (
    <div className="game-selector">
      <div className="game-selector-header">
        <h1>GTO Training Hub</h1>
        <p className="subtitle">
          Master game theory optimal strategy across multiple disciplines.
          Train your decision-making, mathematical thinking, and pattern recognition.
        </p>
      </div>

      <div className="game-selector-grid">
        {/* Chess Card */}
        <button
          className="game-discipline-card"
          style={{ '--card-accent': '#769656' } as React.CSSProperties}
          onClick={onSelectChess}
        >
          <div className="card-icon">♟</div>
          <div className="card-title">Chess GTO</div>
          <div className="card-description">
            Master chess openings through line drilling. Learn theory, understand strategic themes,
            and train against every level of opponent response.
          </div>
          <div className="card-modules">
            {['Opening theory & lines', 'Move quality analysis', 'Position-based drilling', 'Progress tracking'].map((m) => (
              <div key={m} className="card-module-item">
                <div className="card-module-dot" />
                <span>{m}</span>
              </div>
            ))}
          </div>
          {chessAttempted > 0 ? (
            <div className="card-progress-summary">
              <span>{chessMastered} lines mastered</span>
              <span>{Math.round(chessAccuracy * 100)}% accuracy</span>
            </div>
          ) : (
            <div className="card-cta">Start Training →</div>
          )}
        </button>

        {/* Poker Card */}
        <button
          className="game-discipline-card"
          style={{ '--card-accent': '#4a9eff' } as React.CSSProperties}
          onClick={onSelectPoker}
        >
          <div className="card-icon">♠</div>
          <div className="card-title">Poker GTO</div>
          <div className="card-description">
            Build GTO fundamentals through targeted drilling. Master pot odds, hand selection,
            equity math, bet sizing, and opponent exploitation.
          </div>
          <div className="card-modules">
            {[
              'Hand selection by position',
              'Pot odds & equity math',
              'Bet sizing by board texture',
              'Opponent type exploitation',
            ].map((m) => (
              <div key={m} className="card-module-item">
                <div className="card-module-dot" />
                <span>{m}</span>
              </div>
            ))}
          </div>
          {pokerTotal > 0 ? (
            <div className="card-progress-summary">
              <span>{drillsStarted}/{POKER_DRILL_TYPES.length} drills started</span>
              <span>{pokerAccuracy}% accuracy</span>
            </div>
          ) : (
            <div className="card-cta">Start Training →</div>
          )}
        </button>

        {/* Blackjack Card */}
        <button
          className="game-discipline-card"
          style={{ '--card-accent': '#e6a000' } as React.CSSProperties}
          onClick={onSelectBlackjack}
        >
          <div className="card-icon">🃏</div>
          <div className="card-title">Blackjack</div>
          <div className="card-description">
            Perfect basic strategy, card counting foundations, and deviation charts
            for different rule sets.
          </div>
          <div className="card-modules">
            {['Basic strategy charts', 'Hi-Lo card counting', 'True count conversion', 'Bet spread training'].map((m) => (
              <div key={m} className="card-module-item">
                <div className="card-module-dot" />
                <span>{m}</span>
              </div>
            ))}
          </div>
          {bjTotal > 0 ? (
            <div className="card-progress-summary">
              <span>{bjDrillsStarted}/4 drills started</span>
              <span>{bjAccuracy}% accuracy</span>
            </div>
          ) : (
            <div className="card-cta">Start Training →</div>
          )}
        </button>
      </div>
    </div>
  );
}
