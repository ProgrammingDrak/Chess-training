import { useBlackjackDrill } from '../../hooks/useBlackjackDrill';
import { TRUE_COUNT_SCENARIOS } from '../../data/blackjack';
import { DrillFeedback } from '../poker/DrillFeedback';
import { SessionComplete } from '../poker/SessionComplete';
import type { TrueCountScenario } from '../../types/blackjack';

interface Props {
  onRecordAttempt: (id: string, correct: boolean) => void;
  onBack: () => void;
}

export function TrueCountDrill({ onRecordAttempt, onBack }: Props) {
  const {
    session,
    currentScenario,
    difficulty,
    setDifficulty,
    startSession,
    submitAnswer,
    nextQuestion,
    resetSession,
  } = useBlackjackDrill<TrueCountScenario>('true_count', TRUE_COUNT_SCENARIOS);

  const handleOption = (option: number) => {
    if (!currentScenario || session?.phase !== 'question') return;
    const correct = submitAnswer(String(option), String(currentScenario.correctTrueCount));
    onRecordAttempt(currentScenario.id, correct);
  };

  // ── Idle / start screen ──────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="poker-drill-view">
        <div className="drill-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>True Count</h2>
        </div>
        <div className="drill-start-screen">
          <div className="drill-start-icon" style={{ fontFamily: 'var(--mono)', fontSize: '1.6rem' }}>÷</div>
          <h3>True Count Drill</h3>
          <p>
            Convert running count to true count by dividing by decks remaining.
            The true count is what drives your betting decisions.
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
          drillName="True Count"
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
        <h2>÷ True Count</h2>
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
          <div className="scenario-label">True Count Challenge</div>

          {/* Two big stat blocks */}
          <div className="bj-stat-blocks">
            <div className="bj-stat-block">
              <div className="bj-stat-block-label">Running Count</div>
              <div className="bj-stat-block-value" style={{ color: 'var(--accent-hover)' }}>
                {currentScenario.runningCount > 0 ? `+${currentScenario.runningCount}` : currentScenario.runningCount}
              </div>
            </div>
            <div className="bj-stat-block bj-stat-block-divider">
              <div className="bj-stat-block-label" style={{ fontSize: '1.4rem', color: 'var(--text-muted)' }}>÷</div>
            </div>
            <div className="bj-stat-block">
              <div className="bj-stat-block-label">Decks Remaining</div>
              <div className="bj-stat-block-value" style={{ color: 'var(--yellow)' }}>
                {currentScenario.decksRemaining}
              </div>
            </div>
          </div>

          {/* Formula reminder */}
          <div className="bj-formula-reminder">
            True Count = Running Count ÷ Decks Remaining
          </div>

          {/* Multiple choice options */}
          <div className="bj-options-grid">
            {currentScenario.options.map((option) => (
              <button
                key={option}
                className="bj-option-btn"
                onClick={() => handleOption(option)}
              >
                {option > 0 ? `+${option}` : option}
              </button>
            ))}
          </div>
        </div>
      )}

      {isAnswered && currentScenario && (
        <DrillFeedback
          isCorrect={session.phase === 'correct'}
          userAnswer={session.userAnswer ?? ''}
          correctAnswer={String(currentScenario.correctTrueCount)}
          answerLabel="True Count"
          explanation={currentScenario.explanation}
          onNext={nextQuestion}
          isLastQuestion={session.currentScenarioIndex >= session.totalInSession - 1}
        />
      )}
    </div>
  );
}
