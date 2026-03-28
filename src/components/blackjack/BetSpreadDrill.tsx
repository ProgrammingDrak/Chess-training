import { useBlackjackDrill } from '../../hooks/useBlackjackDrill';
import { BET_SPREAD_SCENARIOS } from '../../data/blackjack';
import { DrillFeedback } from '../poker/DrillFeedback';
import { SessionComplete } from '../poker/SessionComplete';
import type { BetSpreadScenario } from '../../types/blackjack';

interface Props {
  onRecordAttempt: (id: string, correct: boolean) => void;
  onBack: () => void;
}

const BET_MULTIPLIERS = [1, 2, 4, 8] as const;

const SPREAD_TABLE: { tc: string; mult: string }[] = [
  { tc: 'TC ≤ +1', mult: '1×' },
  { tc: 'TC +2',   mult: '2×' },
  { tc: 'TC +3',   mult: '4×' },
  { tc: 'TC ≥ +4', mult: '8×' },
];

export function BetSpreadDrill({ onRecordAttempt, onBack }: Props) {
  const {
    session,
    currentScenario,
    difficulty,
    setDifficulty,
    startSession,
    submitAnswer,
    nextQuestion,
    resetSession,
  } = useBlackjackDrill<BetSpreadScenario>('bet_spread', BET_SPREAD_SCENARIOS);

  const handleBet = (multiplier: number) => {
    if (!currentScenario || session?.phase !== 'question') return;
    const correct = submitAnswer(String(multiplier), String(currentScenario.correctMultiplier));
    onRecordAttempt(currentScenario.id, correct);
  };

  // ── Idle / start screen ──────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="poker-drill-view">
        <div className="drill-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Bet Spread</h2>
        </div>
        <div className="drill-start-screen">
          <div className="drill-start-icon">💰</div>
          <h3>Bet Spread Drill</h3>
          <p>
            Given the true count, what multiple of your base bet should you wager?
            Learn the 1–8 spread for maximum EV.
          </p>
          <div className="drill-difficulty-filter">
            {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                className={`difficulty-btn ${difficulty === d ? 'active' : ''}`}
                onClick={() => setDifficulty(d)}
              >
                {d === 'all' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={startSession} style={{ marginTop: 8 }}>
            Start Session (10 questions)
          </button>
        </div>
      </div>
    );
  }

  // ── Session complete ─────────────────────────────────────────────────────────
  if (session.phase === 'session_complete') {
    return (
      <div className="poker-drill-view">
        <div className="drill-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
        </div>
        <SessionComplete
          correctCount={session.correctCount}
          totalCount={session.totalInSession}
          drillName="Bet Spread"
          onRestart={resetSession}
          onBack={onBack}
        />
      </div>
    );
  }

  const progressPct = (session.currentScenarioIndex / session.totalInSession) * 100;
  const isAnswered = session.phase === 'correct' || session.phase === 'incorrect';

  return (
    <div className="poker-drill-view">
      <div className="drill-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>💰 Bet Spread</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {session.currentScenarioIndex + 1}/{session.totalInSession}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--green)', fontFamily: 'var(--mono)' }}>
            {session.correctCount} ✓
          </span>
        </div>
      </div>

      <div className="drill-progress-bar">
        <div className="drill-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {currentScenario && !isAnswered && (
        <div className="scenario-card">
          <div className="scenario-label">Bet Spread Challenge</div>

          {/* True count display */}
          <div className="bj-stat-blocks">
            <div className="bj-stat-block">
              <div className="bj-stat-block-label">True Count</div>
              <div className="bj-stat-block-value" style={{ color: 'var(--accent-hover)' }}>
                {currentScenario.trueCount > 0 ? `+${currentScenario.trueCount}` : currentScenario.trueCount}
              </div>
            </div>
            <div className="bj-stat-block">
              <div className="bj-stat-block-label">Bankroll</div>
              <div className="bj-stat-block-value" style={{ color: 'var(--yellow)' }}>
                {currentScenario.bankrollUnits} units
              </div>
            </div>
          </div>

          {/* Spread reference table */}
          <div className="bj-spread-table">
            {SPREAD_TABLE.map((row) => (
              <div key={row.tc} className="bj-spread-row">
                <span className="bj-spread-tc">{row.tc}</span>
                <span className="bj-spread-arrow">→</span>
                <span className="bj-spread-mult">{row.mult}</span>
              </div>
            ))}
          </div>

          {/* Bet buttons */}
          <div className="bj-bet-buttons">
            {BET_MULTIPLIERS.map((mult) => (
              <button
                key={mult}
                className="bj-bet-btn"
                onClick={() => handleBet(mult)}
              >
                {mult}×
              </button>
            ))}
          </div>
        </div>
      )}

      {isAnswered && currentScenario && (
        <DrillFeedback
          isCorrect={session.phase === 'correct'}
          userAnswer={`${session.userAnswer}×`}
          correctAnswer={`${currentScenario.correctMultiplier}×`}
          answerLabel="Bet multiplier"
          explanation={currentScenario.explanation}
          onNext={nextQuestion}
          isLastQuestion={session.currentScenarioIndex >= session.totalInSession - 1}
        />
      )}
    </div>
  );
}
